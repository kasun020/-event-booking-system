param(
  [Parameter(Mandatory = $true)]
  [string]$ResourceGroupName,

  [Parameter(Mandatory = $true)]
  [string]$Location,

  [Parameter(Mandatory = $true)]
  [string]$AcrName,

  [Parameter(Mandatory = $true)]
  [string]$ContainerAppsEnvName,

  # Image tag to deploy (recommend: git SHA)
  [Parameter(Mandatory = $true)]
  [string]$ImageTag,

  # App secrets
  [Parameter(Mandatory = $true)]
  [string]$JwtSecret,

  [Parameter(Mandatory = $true)]
  [string]$RabbitMqUser,

  [Parameter(Mandatory = $true)]
  [string]$RabbitMqPass,

  # Per-service DB URLs (recommended as GitHub Secrets)
  [Parameter(Mandatory = $true)]
  [string]$IdentityDatabaseUrl,

  [Parameter(Mandatory = $true)]
  [string]$EventDatabaseUrl,

  [Parameter(Mandatory = $true)]
  [string]$TicketDatabaseUrl,

  [Parameter(Mandatory = $true)]
  [string]$BookingDatabaseUrl
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$null = az extension add --name containerapp --upgrade -o none

# FIX 1: Use & az directly and check $LASTEXITCODE instead of Invoke-Expression
function Test-AzResourceExists {
  param(
    [Parameter(Mandatory = $true)][string[]]$Args
  )

  & az @Args -o none 2>&1 | Out-Null
  return $LASTEXITCODE -eq 0
}

function ConvertTo-EnvArgs {
  param([hashtable]$Env)

  $pairs = @()
  foreach ($key in $Env.Keys) {
    $pairs += ("{0}={1}" -f $key, $Env[$key])
  }
  return $pairs
}

$acrLoginServer = az acr show --name $AcrName --query loginServer -o tsv
$acrCred = az acr credential show --name $AcrName | ConvertFrom-Json
$acrUsername = $acrCred.username
$acrPassword = $acrCred.passwords[0].value

$rabbitMqUrl = "amqp://${RabbitMqUser}:${RabbitMqPass}@rabbitmq:5672"

function Set-ContainerApp {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$Image,
    [Parameter(Mandatory = $true)][string]$Ingress,
    [Parameter(Mandatory = $true)][int]$TargetPort,
    [string]$Transport = "http",
    [hashtable]$Env = @{}
  )

  $envArgs = ConvertTo-EnvArgs $Env

  $exists = Test-AzResourceExists @('containerapp', 'show', '--name', $Name, '--resource-group', $ResourceGroupName)

  if (-not $exists) {
    # CREATE - all args supported
    $createCmd = @(
      "az containerapp create",
      "--name $Name",
      "--resource-group $ResourceGroupName",
      "--environment $ContainerAppsEnvName",
      "--image $Image",
      "--registry-server $acrLoginServer",
      "--registry-username $acrUsername",
      "--registry-password $acrPassword"
    )

    if ($Ingress -eq "disabled") {
      # disabled = omit --ingress and --target-port entirely
    } else {
      $createCmd += "--ingress $Ingress"
      $createCmd += "--target-port $TargetPort"
      if ($Transport -ne "http") {
        $createCmd += "--transport $Transport"
      }
    }

    if ($envArgs.Count -gt 0) {
      $createCmd += ("--env-vars {0}" -f ($envArgs -join " "))
    }

    Invoke-Expression (($createCmd -join " ") + " -o none")
    Write-Host "Created Container App: $Name"
  } else {
    # FIX 2: UPDATE - only supported args (no --ingress, --target-port, --transport, --registry-*)
    $updateCmd = @(
      "az containerapp update",
      "--name $Name",
      "--resource-group $ResourceGroupName",
      "--image $Image"
    )

    if ($envArgs.Count -gt 0) {
      $updateCmd += ("--set-env-vars {0}" -f ($envArgs -join " "))
    }

    Invoke-Expression (($updateCmd -join " ") + " -o none")
    Write-Host "Updated Container App: $Name"
  }
}

function Set-PrismaMigrationJob {
  param(
    [Parameter(Mandatory = $true)][string]$ServiceName,
    [Parameter(Mandatory = $true)][string]$Image,
    [Parameter(Mandatory = $true)][string]$DatabaseUrl
  )

  $jobName = "$ServiceName-migrate"

  $exists = Test-AzResourceExists @('containerapp', 'job', 'show', '--name', $jobName, '--resource-group', $ResourceGroupName)

  if (-not $exists) {
    # CREATE - all args supported
    $cmd = @(
      "az containerapp job create",
      "--name $jobName",
      "--resource-group $ResourceGroupName",
      "--environment $ContainerAppsEnvName",
      "--trigger-type Manual",
      "--replica-timeout 1800",
      "--replica-retry-limit 1",
      "--replica-completion-count 1",
      "--parallelism 1",
      "--image $Image",
      "--registry-server $acrLoginServer",
      "--registry-username $acrUsername",
      "--registry-password $acrPassword",
      "--command npx",
      "--args `"prisma migrate deploy`"",
      "--env-vars DATABASE_URL=$DatabaseUrl"
    )

    Invoke-Expression (($cmd -join " ") + " -o none")
    Write-Host "Created migration job: $jobName"
  } else {
    # FIX 2: UPDATE - only supported args (no --registry-*)
    $cmd = @(
      "az containerapp job update",
      "--name $jobName",
      "--resource-group $ResourceGroupName",
      "--image $Image",
      "--set-env-vars DATABASE_URL=$DatabaseUrl"
    )

    Invoke-Expression (($cmd -join " ") + " -o none")
    Write-Host "Updated migration job: $jobName"
  }
}

# --------------------
# Deploy ordering
# rabbitmq -> identity/event/ticket/payment -> booking -> notification
# --------------------

# 1) RabbitMQ
Set-ContainerApp -Name "rabbitmq" -Image "rabbitmq:3-management" -Ingress "internal" -Transport "tcp" -TargetPort 5672 -Env @{
  RABBITMQ_DEFAULT_USER = $RabbitMqUser
  RABBITMQ_DEFAULT_PASS = $RabbitMqPass
}

# 2) Prisma migration jobs
$identityImage = "$acrLoginServer/identity-service:$ImageTag"
$eventImage    = "$acrLoginServer/event-service:$ImageTag"
$ticketImage   = "$acrLoginServer/ticket-service:$ImageTag"
$bookingImage  = "$acrLoginServer/booking-service:$ImageTag"

Set-PrismaMigrationJob -ServiceName "identity-service" -Image $identityImage -DatabaseUrl $IdentityDatabaseUrl
Set-PrismaMigrationJob -ServiceName "event-service"    -Image $eventImage    -DatabaseUrl $EventDatabaseUrl
Set-PrismaMigrationJob -ServiceName "ticket-service"   -Image $ticketImage   -DatabaseUrl $TicketDatabaseUrl
Set-PrismaMigrationJob -ServiceName "booking-service"  -Image $bookingImage  -DatabaseUrl $BookingDatabaseUrl

# 3) Services
Set-ContainerApp -Name "identity-service" -Image $identityImage -Ingress "internal" -TargetPort 3001 -Env @{
  PORT         = "3001"
  JWT_SECRET   = $JwtSecret
  DATABASE_URL = $IdentityDatabaseUrl
  RABBITMQ_URL = $rabbitMqUrl
}

Set-ContainerApp -Name "event-service" -Image $eventImage -Ingress "internal" -TargetPort 3002 -Env @{
  PORT         = "3002"
  JWT_SECRET   = $JwtSecret
  DATABASE_URL = $EventDatabaseUrl
  RABBITMQ_URL = $rabbitMqUrl
}

Set-ContainerApp -Name "ticket-service" -Image $ticketImage -Ingress "internal" -TargetPort 3003 -Env @{
  PORT         = "3003"
  DATABASE_URL = $TicketDatabaseUrl
  RABBITMQ_URL = $rabbitMqUrl
}

$paymentImage = "$acrLoginServer/payment-service:$ImageTag"
Set-ContainerApp -Name "payment-service" -Image $paymentImage -Ingress "internal" -TargetPort 3005 -Env @{
  PORT         = "3005"
  RABBITMQ_URL = $rabbitMqUrl
}

# booking-service is the only public entrypoint
Set-ContainerApp -Name "booking-service" -Image $bookingImage -Ingress "external" -TargetPort 3004 -Env @{
  PORT                 = "3004"
  DATABASE_URL         = $BookingDatabaseUrl
  RABBITMQ_URL         = $rabbitMqUrl
  EVENT_SERVICE_URL    = "http://event-service"
  TICKET_SERVICE_URL   = "http://ticket-service"
  PAYMENT_SERVICE_URL  = "http://payment-service"
  IDENTITY_SERVICE_URL = "http://identity-service"
}

$notificationImage = "$acrLoginServer/notification-service:$ImageTag"
Set-ContainerApp -Name "notification-service" -Image $notificationImage -Ingress "disabled" -TargetPort 3006 -Env @{
  PORT         = "3006"
  RABBITMQ_URL = $rabbitMqUrl
}

Write-Host "`nDeploy script finished. Next: start the 4 migration jobs (identity/event/ticket/booking)."