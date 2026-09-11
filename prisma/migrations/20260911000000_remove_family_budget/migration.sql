/*
  Warnings:

  - The Family Budget module has been removed from the application. This
    migration DROPS its five tables and every row in them: recurring expense
    rules, the sparse paid/skipped occurrences, the sent-reminder log, the
    category list, and the browser push endpoints.

  - This is irreversible. `prisma migrate deploy` runs it automatically on the
    next boot (see docker-entrypoint.sh), so take a database backup first if
    any of that data still matters.
*/
-- DropForeignKey
ALTER TABLE `BudgetExpense` DROP FOREIGN KEY `BudgetExpense_categoryId_fkey`;

-- DropForeignKey
ALTER TABLE `BudgetOccurrence` DROP FOREIGN KEY `BudgetOccurrence_expenseId_fkey`;

-- DropForeignKey
ALTER TABLE `BudgetReminder` DROP FOREIGN KEY `BudgetReminder_expenseId_fkey`;

-- DropTable
DROP TABLE `BudgetReminder`;

-- DropTable
DROP TABLE `BudgetOccurrence`;

-- DropTable
DROP TABLE `BudgetExpense`;

-- DropTable
DROP TABLE `BudgetCategory`;

-- DropTable
DROP TABLE `PushSubscription`;
