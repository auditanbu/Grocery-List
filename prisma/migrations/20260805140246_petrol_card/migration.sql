-- CreateTable
CREATE TABLE `FuelEntry` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `vehicleType` ENUM('TWO_WHEELER', 'CAR') NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `refueledAt` DATETIME(3) NOT NULL,
    `latitude` DECIMAL(9, 6) NULL,
    `longitude` DECIMAL(9, 6) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `FuelEntry_refueledAt_idx`(`refueledAt`),
    INDEX `FuelEntry_vehicleType_idx`(`vehicleType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FuelBudget` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `amount` DECIMAL(10, 2) NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
