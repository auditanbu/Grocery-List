-- CreateTable
CREATE TABLE `FamilyMember` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `fullName` VARCHAR(191) NOT NULL,
    `gender` ENUM('MALE', 'FEMALE', 'UNKNOWN') NOT NULL DEFAULT 'UNKNOWN',
    `birthYear` INTEGER NULL,
    `notes` VARCHAR(191) NULL,
    `isPlaceholder` BOOLEAN NOT NULL DEFAULT false,
    `importKey` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `FamilyMember_importKey_key`(`importKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FamilyRelationship` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `type` ENUM('PARENT_OF', 'SPOUSE_OF') NOT NULL,
    `fromMemberId` INTEGER NOT NULL,
    `toMemberId` INTEGER NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `FamilyRelationship_fromMemberId_idx`(`fromMemberId`),
    INDEX `FamilyRelationship_toMemberId_idx`(`toMemberId`),
    UNIQUE INDEX `FamilyRelationship_fromMemberId_toMemberId_type_key`(`fromMemberId`, `toMemberId`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `FamilyRelationship` ADD CONSTRAINT `FamilyRelationship_fromMemberId_fkey` FOREIGN KEY (`fromMemberId`) REFERENCES `FamilyMember`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FamilyRelationship` ADD CONSTRAINT `FamilyRelationship_toMemberId_fkey` FOREIGN KEY (`toMemberId`) REFERENCES `FamilyMember`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

