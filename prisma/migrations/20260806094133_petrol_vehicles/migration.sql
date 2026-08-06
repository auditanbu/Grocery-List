-- CreateTable
CREATE TABLE `Vehicle` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `type` ENUM('TWO_WHEELER', 'CAR') NOT NULL,
    `registrationNumber` VARCHAR(32) NULL,
    `insuranceRenewal` DATE NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Seed the two vehicles that previously existed only as hardcoded labels,
-- so existing FuelEntry rows have somewhere to point.
INSERT INTO `Vehicle` (`name`, `type`, `createdAt`, `updatedAt`)
VALUES
    ('Burgman (Suzuki)', 'TWO_WHEELER', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    ('Nissan Micra', 'CAR', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3));

-- AlterTable: replace FuelEntry.vehicleType (enum) with FuelEntry.vehicleId (FK)
ALTER TABLE `FuelEntry` ADD COLUMN `vehicleId` INTEGER NULL;

UPDATE `FuelEntry` fe
JOIN `Vehicle` v ON v.`name` = CASE fe.`vehicleType`
    WHEN 'TWO_WHEELER' THEN 'Burgman (Suzuki)'
    WHEN 'CAR' THEN 'Nissan Micra'
END
SET fe.`vehicleId` = v.`id`;

ALTER TABLE `FuelEntry` MODIFY COLUMN `vehicleId` INTEGER NOT NULL;

DROP INDEX `FuelEntry_vehicleType_idx` ON `FuelEntry`;
ALTER TABLE `FuelEntry` DROP COLUMN `vehicleType`;

-- CreateIndex
CREATE INDEX `FuelEntry_vehicleId_idx` ON `FuelEntry`(`vehicleId`);

-- AddForeignKey
ALTER TABLE `FuelEntry` ADD CONSTRAINT `FuelEntry_vehicleId_fkey` FOREIGN KEY (`vehicleId`) REFERENCES `Vehicle`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
