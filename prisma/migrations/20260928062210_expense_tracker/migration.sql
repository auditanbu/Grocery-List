-- CreateTable
CREATE TABLE `ExpenseCategory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nameEn` VARCHAR(191) NOT NULL,
    `nameTa` VARCHAR(191) NULL,
    `kind` ENUM('EXPENSE', 'INCOME') NOT NULL DEFAULT 'EXPENSE',
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ExpenseCategory_kind_sortOrder_idx`(`kind`, `sortOrder`),
    UNIQUE INDEX `ExpenseCategory_nameEn_kind_key`(`nameEn`, `kind`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ExpensePerson` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `colorKey` VARCHAR(191) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ExpensePerson_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PaymentMethod` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `PaymentMethod_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Expense` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `kind` ENUM('EXPENSE', 'INCOME') NOT NULL DEFAULT 'EXPENSE',
    `amount` DECIMAL(10, 2) NOT NULL,
    `spentAt` DATETIME(3) NOT NULL,
    `monthKey` VARCHAR(191) NOT NULL,
    `categoryId` INTEGER NOT NULL,
    `paidById` INTEGER NULL,
    `methodId` INTEGER NULL,
    `note` VARCHAR(191) NULL,
    `splitMethod` ENUM('EQUAL', 'EXACT', 'SHARES') NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Expense_monthKey_idx`(`monthKey`),
    INDEX `Expense_categoryId_idx`(`categoryId`),
    INDEX `Expense_paidById_idx`(`paidById`),
    INDEX `Expense_spentAt_idx`(`spentAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ExpenseShare` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `expenseId` INTEGER NOT NULL,
    `personId` INTEGER NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `shareUnits` INTEGER NULL,

    INDEX `ExpenseShare_personId_idx`(`personId`),
    UNIQUE INDEX `ExpenseShare_expenseId_personId_key`(`expenseId`, `personId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Settlement` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `fromPersonId` INTEGER NOT NULL,
    `toPersonId` INTEGER NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `settledAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `monthKey` VARCHAR(191) NOT NULL,
    `note` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Settlement_monthKey_idx`(`monthKey`),
    INDEX `Settlement_fromPersonId_idx`(`fromPersonId`),
    INDEX `Settlement_toPersonId_idx`(`toPersonId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ExpenseBudget` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `categoryId` INTEGER NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ExpenseBudget_categoryId_key`(`categoryId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Expense` ADD CONSTRAINT `Expense_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `ExpenseCategory`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Expense` ADD CONSTRAINT `Expense_paidById_fkey` FOREIGN KEY (`paidById`) REFERENCES `ExpensePerson`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Expense` ADD CONSTRAINT `Expense_methodId_fkey` FOREIGN KEY (`methodId`) REFERENCES `PaymentMethod`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExpenseShare` ADD CONSTRAINT `ExpenseShare_expenseId_fkey` FOREIGN KEY (`expenseId`) REFERENCES `Expense`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExpenseShare` ADD CONSTRAINT `ExpenseShare_personId_fkey` FOREIGN KEY (`personId`) REFERENCES `ExpensePerson`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Settlement` ADD CONSTRAINT `Settlement_fromPersonId_fkey` FOREIGN KEY (`fromPersonId`) REFERENCES `ExpensePerson`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Settlement` ADD CONSTRAINT `Settlement_toPersonId_fkey` FOREIGN KEY (`toPersonId`) REFERENCES `ExpensePerson`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExpenseBudget` ADD CONSTRAINT `ExpenseBudget_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `ExpenseCategory`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
