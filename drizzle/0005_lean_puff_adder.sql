CREATE TABLE `product_spec_sets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(256) NOT NULL,
	`fileName` varchar(256),
	`description` text,
	`modelCount` int NOT NULL DEFAULT 0,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `product_spec_sets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `product_specs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`setId` int NOT NULL,
	`productModel` varchar(256) NOT NULL,
	`productDesc` text,
	`specs` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `product_specs_id` PRIMARY KEY(`id`)
);
