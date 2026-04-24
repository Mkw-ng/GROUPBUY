CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`cut` varchar(255) NOT NULL DEFAULT '',
	`category` enum('beef','pork','lamb','poultry','seafood','other') NOT NULL DEFAULT 'beef',
	`description` text,
	`price` decimal(10,2) NOT NULL,
	`powerDropPrice` decimal(10,2),
	`unit` varchar(64) NOT NULL DEFAULT '/ kg',
	`badge` enum('LIMITED','POPULAR','NEW','SOLD OUT'),
	`available` boolean NOT NULL DEFAULT true,
	`img` text,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `products_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` varchar(128) NOT NULL,
	`value` text NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `settings_key` PRIMARY KEY(`key`)
);
