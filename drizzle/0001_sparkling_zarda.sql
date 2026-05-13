CREATE TABLE `cpl_products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sheetName` varchar(128) NOT NULL,
	`productGroup` text,
	`taxCategory` text,
	`productModel` varchar(256),
	`productDesc` text,
	`salesCategory` varchar(128),
	`serviceCategory` varchar(128),
	`productStatus` varchar(64),
	`listPrice` varchar(64),
	`priceNote` text,
	`isNew` varchar(64),
	`remark` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cpl_products_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cpl_sheets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sheetName` varchar(128) NOT NULL,
	`displayOrder` int NOT NULL DEFAULT 0,
	`productCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cpl_sheets_id` PRIMARY KEY(`id`),
	CONSTRAINT `cpl_sheets_sheetName_unique` UNIQUE(`sheetName`)
);
--> statement-breakpoint
CREATE TABLE `cpl_summary` (
	`id` int AUTO_INCREMENT NOT NULL,
	`content` text NOT NULL,
	`version` varchar(256),
	`importedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cpl_summary_id` PRIMARY KEY(`id`)
);
