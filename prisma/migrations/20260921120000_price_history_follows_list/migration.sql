/*
  Deleting a grocery list now deletes the price history recorded on it.

  Until now the foreign key was ON DELETE SET NULL, so deleting a list left
  its price rows behind with listId = NULL: entries no screen could reach,
  showing no month in the item's price history, yet still quoted as the last
  price paid. A list made for a trial run and then deleted went on steering
  real shopping.

  Rows already orphaned that way are NOT touched here — this only changes
  what happens from now on. Run `npm run db:audit-prices` to see them and
  `npm run db:audit-prices -- --delete-orphans` to clear them out.
*/
-- DropForeignKey
ALTER TABLE `PriceHistory` DROP FOREIGN KEY `PriceHistory_listId_fkey`;

-- AddForeignKey
ALTER TABLE `PriceHistory` ADD CONSTRAINT `PriceHistory_listId_fkey` FOREIGN KEY (`listId`) REFERENCES `GroceryList`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
