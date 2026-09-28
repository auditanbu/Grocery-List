-- AlterTable
ALTER TABLE `Expense` ADD COLUMN `tripId` INTEGER NULL;

-- AlterTable
ALTER TABLE `Settlement` ADD COLUMN `tripId` INTEGER NULL;

-- CreateTable
CREATE TABLE `ExpenseTrip` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `closedAt` DATETIME(3) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ExpenseTrip_closedAt_idx`(`closedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TripParticipant` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tripId` INTEGER NOT NULL,
    `personId` INTEGER NOT NULL,

    INDEX `TripParticipant_personId_idx`(`personId`),
    UNIQUE INDEX `TripParticipant_tripId_personId_key`(`tripId`, `personId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Expense_tripId_idx` ON `Expense`(`tripId`);

-- CreateIndex
CREATE INDEX `Settlement_tripId_idx` ON `Settlement`(`tripId`);

-- AddForeignKey
ALTER TABLE `Expense` ADD CONSTRAINT `Expense_tripId_fkey` FOREIGN KEY (`tripId`) REFERENCES `ExpenseTrip`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Settlement` ADD CONSTRAINT `Settlement_tripId_fkey` FOREIGN KEY (`tripId`) REFERENCES `ExpenseTrip`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TripParticipant` ADD CONSTRAINT `TripParticipant_tripId_fkey` FOREIGN KEY (`tripId`) REFERENCES `ExpenseTrip`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TripParticipant` ADD CONSTRAINT `TripParticipant_personId_fkey` FOREIGN KEY (`personId`) REFERENCES `ExpensePerson`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
