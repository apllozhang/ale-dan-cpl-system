CREATE TABLE `quotation_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`quotationId` int NOT NULL,
	`productId` int,
	`productModel` varchar(256) NOT NULL,
	`productDesc` text,
	`listPrice` varchar(64),
	`quantity` int NOT NULL DEFAULT 1,
	`unitPrice` decimal(14,2),
	`discountRate` decimal(5,2) DEFAULT '0',
	`subtotal` decimal(14,2) DEFAULT '0',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `quotation_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quotations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`quotationNo` varchar(64) NOT NULL,
	`customerName` varchar(256) NOT NULL,
	`customerContact` varchar(128),
	`customerPhone` varchar(64),
	`customerEmail` varchar(320),
	`projectName` varchar(256),
	`status` enum('draft','submitted','approved','sent','completed','cancelled') NOT NULL DEFAULT 'draft',
	`discountRate` decimal(5,2) DEFAULT '0',
	`totalAmount` decimal(14,2) DEFAULT '0',
	`notes` text,
	`createdBy` int NOT NULL,
	`validUntil` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `quotations_id` PRIMARY KEY(`id`),
	CONSTRAINT `quotations_quotationNo_unique` UNIQUE(`quotationNo`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `username` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `passwordHash` text;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_username_unique` UNIQUE(`username`);