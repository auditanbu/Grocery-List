-- CreateTable
CREATE TABLE `BudgetCategory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(64) NOT NULL,
    `iconKey` VARCHAR(32) NOT NULL DEFAULT 'other',
    `colorKey` VARCHAR(32) NOT NULL DEFAULT 'blue',
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `BudgetCategory_name_key`(`name`),
    INDEX `BudgetCategory_sortOrder_idx`(`sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BudgetExpense` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `categoryId` INTEGER NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `recurrence` ENUM('ONE_OFF', 'MONTHLY', 'EVERY_2_MONTHS', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY', 'CUSTOM_MONTHS') NOT NULL,
    `intervalMonths` INTEGER NULL,
    `anchorDate` CHAR(10) NOT NULL,
    `endDate` CHAR(10) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `remindersEnabled` BOOLEAN NOT NULL DEFAULT true,
    `reminderLeadDays` INTEGER NOT NULL DEFAULT 2,
    `notes` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `BudgetExpense_isActive_anchorDate_idx`(`isActive`, `anchorDate`),
    INDEX `BudgetExpense_categoryId_idx`(`categoryId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BudgetOccurrence` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `expenseId` INTEGER NOT NULL,
    `dueDate` CHAR(10) NOT NULL,
    `status` ENUM('PAID', 'SKIPPED') NULL,
    `plannedAmount` DECIMAL(10, 2) NULL,
    `paidAmount` DECIMAL(10, 2) NULL,
    `paidOn` CHAR(10) NULL,
    `note` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `BudgetOccurrence_dueDate_idx`(`dueDate`),
    UNIQUE INDEX `BudgetOccurrence_expenseId_dueDate_key`(`expenseId`, `dueDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BudgetReminder` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `expenseId` INTEGER NOT NULL,
    `dueDate` CHAR(10) NOT NULL,
    `kind` ENUM('UPCOMING', 'DUE') NOT NULL,
    `sentAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `delivered` INTEGER NOT NULL DEFAULT 0,

    INDEX `BudgetReminder_sentAt_idx`(`sentAt`),
    UNIQUE INDEX `BudgetReminder_expenseId_dueDate_kind_key`(`expenseId`, `dueDate`, `kind`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PushSubscription` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `endpoint` VARCHAR(512) NOT NULL,
    `p256dh` VARCHAR(255) NOT NULL,
    `auth` VARCHAR(255) NOT NULL,
    `userAgent` VARCHAR(255) NULL,
    `label` VARCHAR(64) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `failureCount` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `PushSubscription_endpoint_key`(`endpoint`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `BudgetExpense` ADD CONSTRAINT `BudgetExpense_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `BudgetCategory`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BudgetOccurrence` ADD CONSTRAINT `BudgetOccurrence_expenseId_fkey` FOREIGN KEY (`expenseId`) REFERENCES `BudgetExpense`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BudgetReminder` ADD CONSTRAINT `BudgetReminder_expenseId_fkey` FOREIGN KEY (`expenseId`) REFERENCES `BudgetExpense`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;


-- Seed the categories the household starts with, so the module is usable the
-- moment it deploys. More can be added in-app. Same approach as the Vehicle
-- seed in 20260806094133_petrol_vehicles.
INSERT INTO `BudgetCategory` (`name`, `iconKey`, `colorKey`, `sortOrder`, `createdAt`) VALUES
    ('Rent',        'home',   'blue',   10, CURRENT_TIMESTAMP(3)),
    ('Electricity', 'bolt',   'orange', 20, CURRENT_TIMESTAMP(3)),
    ('Insurance',   'shield', 'green',  30, CURRENT_TIMESTAMP(3)),
    ('Internet',    'wifi',   'purple', 40, CURRENT_TIMESTAMP(3)),
    ('Mobile',      'phone',  'blue',   50, CURRENT_TIMESTAMP(3)),
    ('Groceries',   'cart',   'green',  60, CURRENT_TIMESTAMP(3)),
    ('Education',   'book',   'orange', 70, CURRENT_TIMESTAMP(3)),
    ('Maintenance', 'wrench', 'grey',   80, CURRENT_TIMESTAMP(3)),
    ('Other',       'other',  'grey',   90, CURRENT_TIMESTAMP(3));
