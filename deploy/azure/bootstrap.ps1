param(
    [string]$Prefix = "eventbook",
    [string]$Location = "eastus",

    # If you prefer explicit names, pass them in.
    [string]$ResourceGroupName = "",
    [string]$AcrName = "",
    [string]$ContainerAppsEnvName = "",
    [string]$LogAnalyticsName = "",
    [string]$MySqlServerName = "",

    # MySQL admin credentials (required)
    [Parameter(Mandatory = $true)]
    [string]$MySqlAdminUser,
    [Parameter(Mandatory = $true)]
    [securestring]$MySqlAdminPassword,

    # MySQL options (leave as defaults; script will fall back if unavailable)
    [string]$MySqlSkuName = "Standard_B1ms",
    [string]$MySqlTier = "Burstable",
    [string]$MySqlVersion = "8.0.21",
    [int]$MySqlStorageSizeGb = 32
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Invoke-Az {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Args
    )

    $output = & az @Args 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Azure CLI failed (az $($Args -join ' '))`n$output"
    }

    return $output
}

function Ensure-AzProviderRegistered {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Namespace,
        [int]$TimeoutSeconds = 300
    )

    $state = (Invoke-Az -Args @('provider','show','--namespace',$Namespace,'--query','registrationState','-o','tsv')).Trim()
    if ($state -eq 'Registered') {
        return
    }

    Write-Host "Registering resource provider $Namespace (current=$state)..."
    Invoke-Az -Args @('provider','register','--namespace',$Namespace,'-o','none') | Out-Null

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        Start-Sleep -Seconds 5
        $state = (Invoke-Az -Args @('provider','show','--namespace',$Namespace,'--query','registrationState','-o','tsv')).Trim()
        if ($state -eq 'Registered') {
            Write-Host "$Namespace registered."
            return
        }
    }

    throw "Timed out waiting for provider registration: $Namespace (lastState=$state)"
}

function New-UniqueName([string]$base, [int]$maxLen) {
    $suffix = (Get-Random -Minimum 10000 -Maximum 99999)
    $name = ("{0}{1}" -f $base.ToLower(), $suffix)
    if ($name.Length -gt $maxLen) {
        $name = $name.Substring(0, $maxLen)
    }
    return $name
}

# Resource names (ACR + MySQL must be globally unique)
if ([string]::IsNullOrWhiteSpace($ResourceGroupName)) { $ResourceGroupName = "$Prefix-rg" }
if ([string]::IsNullOrWhiteSpace($AcrName)) { $AcrName = New-UniqueName "$Prefix" 45 }
if ([string]::IsNullOrWhiteSpace($ContainerAppsEnvName)) { $ContainerAppsEnvName = "$Prefix-aca-env" }
if ([string]::IsNullOrWhiteSpace($LogAnalyticsName)) { $LogAnalyticsName = "$Prefix-law" }
if ([string]::IsNullOrWhiteSpace($MySqlServerName)) { $MySqlServerName = New-UniqueName "$Prefix-mysql" 60 }

Write-Host "Using Resource Group: $ResourceGroupName"
Write-Host "Using Location: $Location"
Write-Host "Using ACR: $AcrName"
Write-Host "Using Container Apps Env: $ContainerAppsEnvName"
Write-Host "Using Log Analytics: $LogAnalyticsName"
Write-Host "Using MySQL Flexible Server: $MySqlServerName"

$mySqlAdminPasswordPlain = [System.Net.NetworkCredential]::new("", $MySqlAdminPassword).Password

# Prereqs: containerapp extension
Invoke-Az -Args @('extension','add','--name','containerapp','--upgrade','-o','none') | Out-Null

# Ensure required resource providers are registered
Ensure-AzProviderRegistered -Namespace 'Microsoft.ContainerRegistry'
Ensure-AzProviderRegistered -Namespace 'Microsoft.OperationalInsights'
Ensure-AzProviderRegistered -Namespace 'Microsoft.App'
Ensure-AzProviderRegistered -Namespace 'Microsoft.DBforMySQL'

# 1) Resource Group
Invoke-Az -Args @('group','create','--name',$ResourceGroupName,'--location',$Location,'-o','none') | Out-Null

# 2) ACR (admin enabled for easiest Container Apps pulls)
Invoke-Az -Args @('acr','create','--resource-group',$ResourceGroupName,'--name',$AcrName,'--sku','Basic','--admin-enabled','true','-o','none') | Out-Null

# 3) Log Analytics
Invoke-Az -Args @('monitor','log-analytics','workspace','create','--resource-group',$ResourceGroupName,'--workspace-name',$LogAnalyticsName,'--location',$Location,'-o','none') | Out-Null

$lawCustomerId = $null
$lawSharedKey = $null

# Azure can take time to propagate the workspace after create; retry until it's queryable.
$lawDeadline = (Get-Date).AddMinutes(5)
while ((Get-Date) -lt $lawDeadline) {
    try {
        $lawCustomerId = (Invoke-Az -Args @('monitor','log-analytics','workspace','show','--resource-group',$ResourceGroupName,'--workspace-name',$LogAnalyticsName,'--query','customerId','-o','tsv')).Trim()
        if (-not [string]::IsNullOrWhiteSpace($lawCustomerId)) {
            $lawSharedKey = (Invoke-Az -Args @('monitor','log-analytics','workspace','get-shared-keys','--resource-group',$ResourceGroupName,'--workspace-name',$LogAnalyticsName,'--query','primarySharedKey','-o','tsv')).Trim()
            if (-not [string]::IsNullOrWhiteSpace($lawSharedKey)) {
                break
            }
        }
    } catch {
        if ($_.Exception.Message -match 'ResourceNotFound') {
            Start-Sleep -Seconds 5
            continue
        }
        throw
    }

    Start-Sleep -Seconds 5
}

if ([string]::IsNullOrWhiteSpace($lawCustomerId) -or [string]::IsNullOrWhiteSpace($lawSharedKey)) {
    throw "Timed out waiting for Log Analytics workspace '$LogAnalyticsName' to become queryable. Try rerunning in a minute."
}

# 4) Container Apps environment
Invoke-Az -Args @('containerapp','env','create','--name',$ContainerAppsEnvName,'--resource-group',$ResourceGroupName,'--location',$Location,'--logs-workspace-id',$lawCustomerId,'--logs-workspace-key',$lawSharedKey,'-o','none') | Out-Null

# 5) MySQL Flexible Server (public access for class demo; lock down later)
# Notes:
# - We try a cheap/default-friendly SKU first, but fall back to Azure defaults if that SKU/version isn't available.
# - Public access + firewall rules below allow your current IP and Azure services.
$mysqlCreateArgsPreferred = @(
    'mysql','flexible-server','create',
    '--resource-group',$ResourceGroupName,
    '--name',$MySqlServerName,
    '--location',$Location,
    '--admin-user',$MySqlAdminUser,
    '--admin-password',$mySqlAdminPasswordPlain,
    '--sku-name',$MySqlSkuName,
    '--tier',$MySqlTier,
    '--version',$MySqlVersion,
    '--storage-size',"$MySqlStorageSizeGb",
    '--public-access','0.0.0.0',
    '--yes',
    '-o','none'
)

$mysqlCreateArgsFallback = @(
    'mysql','flexible-server','create',
    '--resource-group',$ResourceGroupName,
    '--name',$MySqlServerName,
    '--location',$Location,
    '--admin-user',$MySqlAdminUser,
    '--admin-password',$mySqlAdminPasswordPlain,
    '--storage-size',"$MySqlStorageSizeGb",
    '--public-access','0.0.0.0',
    '--yes',
    '-o','none'
)

try {
    Invoke-Az -Args $mysqlCreateArgsPreferred | Out-Null
} catch {
    if ($_.Exception.Message -match 'No available SKUs in this location') {
        Write-Warning "MySQL create failed with preferred SKU/version in '$Location'. Retrying with Azure defaults..."
        try {
            Invoke-Az -Args $mysqlCreateArgsFallback | Out-Null
        } catch {
            if ($_.Exception.Message -match 'No available SKUs in this location') {
                throw "MySQL Flexible Server is not available for your subscription in location '$Location'. Try a different region (examples that often work: westus2, westeurope, australiaeast) and re-run.\n\nOriginal error:\n$($_.Exception.Message)"
            }
            throw
        }
    } else {
        throw
    }
}

# Clear plaintext copy as soon as CLI call finishes
$mySqlAdminPasswordPlain = $null

# 6) Create databases
$databases = @(
    "identity_service",
    "event_service",
    "ticket_service",
    "booking_service"
)

foreach ($db in $databases) {
    Invoke-Az -Args @('mysql','flexible-server','db','create','--resource-group',$ResourceGroupName,'--server-name',$MySqlServerName,'--database-name',$db,'-o','none') | Out-Null
}

# 7) Networking / access (simplest)
try {
    $myIp = (Invoke-RestMethod -Uri "https://api.ipify.org").Trim()
    if ($myIp) {
        Invoke-Az -Args @('mysql','flexible-server','firewall-rule','create','--resource-group',$ResourceGroupName,'--name',$MySqlServerName,'--rule-name','AllowMyIp','--start-ip-address',$myIp,'--end-ip-address',$myIp,'-o','none') | Out-Null
        Write-Host "Allowed MySQL access from your IP: $myIp"
    }
}
catch {
    Write-Warning "Could not detect public IP for firewall rule. Add it manually if needed."
}

# Allow Azure services (commonly represented as 0.0.0.0)
Invoke-Az -Args @('mysql','flexible-server','firewall-rule','create','--resource-group',$ResourceGroupName,'--name',$MySqlServerName,'--rule-name','AllowAzureServices','--start-ip-address','0.0.0.0','--end-ip-address','0.0.0.0','-o','none') | Out-Null

# Output helpful values
$acrLoginServer = (Invoke-Az -Args @('acr','show','--name',$AcrName,'--query','loginServer','-o','tsv')).Trim()
$mysqlHost = "$MySqlServerName.mysql.database.azure.com"

Write-Host "\n--- Outputs ---"
Write-Host "ResourceGroupName=$ResourceGroupName"
Write-Host "Location=$Location"
Write-Host "AcrName=$AcrName"
Write-Host "AcrLoginServer=$acrLoginServer"
Write-Host "ContainerAppsEnvName=$ContainerAppsEnvName"
Write-Host "MySqlServerName=$MySqlServerName"
Write-Host "MySqlHost=$mysqlHost"
