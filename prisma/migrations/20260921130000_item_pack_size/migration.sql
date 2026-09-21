-- Pack size becomes a field of its own.
--
-- Until now an item sold in packs carried its size in the quantity itself (a
-- 200 g tube of paste was quantity 200, unit g), and a `hasVariableUnit` flag
-- opened the *quantity* editor while shopping. Size is now its own field: the
-- quantity counts packs, `sizeValue`/`sizeUnit` say how big one pack is, and
-- the size is the only part that changes when the shop has 150 g, not 200 g.

-- AlterTable
ALTER TABLE `Item`
    ADD COLUMN `sizeValue` DECIMAL(10, 2) NULL,
    ADD COLUMN `sizeUnit` ENUM('KG', 'G', 'L', 'ML', 'RS', 'COUNT') NULL;

-- AlterTable
ALTER TABLE `GroceryListItem`
    ADD COLUMN `sizeValue` DECIMAL(10, 2) NULL,
    ADD COLUMN `sizeUnit` ENUM('KG', 'G', 'L', 'ML', 'RS', 'COUNT') NULL,
    ADD COLUMN `previousSizeValue` DECIMAL(10, 2) NULL,
    ADD COLUMN `previousSizeUnit` ENUM('KG', 'G', 'L', 'ML', 'RS', 'COUNT') NULL;

-- AlterTable
ALTER TABLE `PriceHistory`
    ADD COLUMN `sizeValue` DECIMAL(10, 2) NULL,
    ADD COLUMN `sizeUnit` ENUM('KG', 'G', 'L', 'ML', 'RS', 'COUNT') NULL;

-- A marked item's measured default quantity *was* its pack size, so that is
-- exactly what it becomes; the item itself turns countable, at one pack.
UPDATE `Item`
   SET `sizeValue` = `defaultQty`,
       `sizeUnit` = `unitType`,
       `defaultQty` = 1,
       `unitType` = 'COUNT'
 WHERE `hasVariableUnit` = true
   AND `unitType` IN ('G', 'ML', 'KG', 'L')
   AND `defaultQty` > 0;

-- Rows of lists still being planned or shopped follow their item, as long as
-- the row is still one whole pack and nothing has been paid for it. A
-- completed list records what was actually bought and is left exactly as is.
UPDATE `GroceryListItem` `row`
  JOIN `Item` `item` ON `item`.`id` = `row`.`itemId`
  JOIN `GroceryList` `list` ON `list`.`id` = `row`.`listId`
   SET `row`.`sizeValue` = `item`.`sizeValue`,
       `row`.`sizeUnit` = `item`.`sizeUnit`,
       `row`.`quantity` = 1,
       `row`.`unitType` = 'COUNT'
 WHERE `list`.`status` <> 'COMPLETED'
   AND `row`.`isPurchased` = false
   AND `item`.`sizeValue` IS NOT NULL
   AND `row`.`unitType` = `item`.`sizeUnit`
   AND `row`.`quantity` = `item`.`sizeValue`;

-- DropColumn — the flag existed only to open the quantity editor.
ALTER TABLE `Item` DROP COLUMN `hasVariableUnit`;
