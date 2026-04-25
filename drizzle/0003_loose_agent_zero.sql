CREATE TABLE `orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`phone` varchar(20) NOT NULL,
	`pickupDate` varchar(32) NOT NULL,
	`location` varchar(32) NOT NULL,
	`deliveryAddress` text,
	`items` text NOT NULL,
	`specialInstructions` text,
	`deliveryCharge` decimal(10,2) DEFAULT '0.00',
	`status` enum('pending','paid','cancelled') NOT NULL DEFAULT 'pending',
	`isPowerDrop` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`)
);
