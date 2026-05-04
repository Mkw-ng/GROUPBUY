CREATE TABLE `customers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`phone` varchar(20) NOT NULL,
	`name` varchar(255),
	`firstOrderDate` timestamp,
	`lastOrderDate` timestamp,
	`totalOrders` int NOT NULL DEFAULT 0,
	`totalSpend` decimal(12,2) NOT NULL DEFAULT '0.00',
	`totalKg` decimal(10,3) NOT NULL DEFAULT '0.000',
	`largestOrder` decimal(10,2) NOT NULL DEFAULT '0.00',
	`smallestOrder` decimal(10,2) NOT NULL DEFAULT '0.00',
	`powerDropsAttended` int NOT NULL DEFAULT 0,
	`totalSavings` decimal(10,2) NOT NULL DEFAULT '0.00',
	`favouriteItems` text,
	`favouriteCategory` varchar(64),
	`preferredLocation` varchar(32),
	`currentStreak` int NOT NULL DEFAULT 0,
	`longestStreak` int NOT NULL DEFAULT 0,
	`biggestSingleItem` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customers_id` PRIMARY KEY(`id`),
	CONSTRAINT `customers_phone_unique` UNIQUE(`phone`)
);
--> statement-breakpoint
ALTER TABLE `orders` ADD `customerName` varchar(255);