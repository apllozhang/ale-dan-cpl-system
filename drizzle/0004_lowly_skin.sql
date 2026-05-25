CREATE TABLE `activity_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`username` varchar(64),
	`action` varchar(64) NOT NULL,
	`resourceType` varchar(64),
	`resourceId` int,
	`detail` text,
	`ipAddress` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `activity_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quotation_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(256) NOT NULL,
	`description` text,
	`createdBy` int NOT NULL,
	`isPublic` boolean NOT NULL DEFAULT false,
	`discountRate` decimal(5,2) DEFAULT '0',
	`notes` text,
	`validDays` int,
	`items` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `quotation_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quotation_versions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`quotationId` int NOT NULL,
	`version` int NOT NULL,
	`snapshot` text NOT NULL,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `quotation_versions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `saved_searches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(128) NOT NULL,
	`page` varchar(32) NOT NULL,
	`conditions` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `saved_searches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','sales_manager','sales_rep','viewer') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `quotations` ADD `industry` varchar(128);--> statement-breakpoint
ALTER TABLE `quotations` ADD `version` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `quotations` ADD `shareToken` varchar(64);--> statement-breakpoint
ALTER TABLE `quotations` ADD CONSTRAINT `quotations_shareToken_unique` UNIQUE(`shareToken`);