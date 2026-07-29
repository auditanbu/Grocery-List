-- AlterTable
ALTER TABLE `Item` ADD COLUMN `hasVariableUnit` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `GroceryListItem` ADD COLUMN `previousQuantity` DECIMAL(10, 2) NULL,
    ADD COLUMN `previousUnitType` ENUM('KG', 'G', 'L', 'ML', 'RS', 'COUNT') NULL;
