ALTER TABLE `orders` ADD `invoiceNumber` varchar(16);--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_invoiceNumber_unique` UNIQUE(`invoiceNumber`);