-- CreateTable
CREATE TABLE `ticket_inventories` (
    `id` VARCHAR(191) NOT NULL,
    `eventId` VARCHAR(191) NOT NULL,
    `tier` ENUM('VIP', 'GENERAL') NOT NULL,
    `price` DECIMAL(10, 2) NOT NULL,
    `totalStock` INTEGER NOT NULL,
    `reservedStock` INTEGER NOT NULL DEFAULT 0,
    `soldStock` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ticket_inventories_eventId_idx`(`eventId`),
    UNIQUE INDEX `ticket_inventories_eventId_tier_key`(`eventId`, `tier`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
