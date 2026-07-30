-- DropIndex
ALTER TABLE `GroceryList` DROP INDEX `GroceryList_monthKey_key`;

-- CreateIndex
CREATE UNIQUE INDEX `GroceryList_monthKey_name_key` ON `GroceryList`(`monthKey`, `name`);
