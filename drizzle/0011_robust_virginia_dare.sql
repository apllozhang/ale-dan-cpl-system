CREATE TABLE `certifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`certType` varchar(32) NOT NULL,
	`certNo` varchar(128) NOT NULL,
	`certName` varchar(256) NOT NULL,
	`standardType` varchar(64),
	`issuer` varchar(256) NOT NULL,
	`holder` varchar(256) NOT NULL,
	`factoryNo` varchar(128),
	`testReportNo` varchar(128),
	`certScope` text,
	`issueDate` varchar(10) NOT NULL,
	`expiryDate` varchar(10),
	`status` varchar(32) NOT NULL DEFAULT 'active',
	`attachmentUrl` varchar(512),
	`remark` text,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `certifications_id` PRIMARY KEY(`id`),
	CONSTRAINT `certifications_certNo_unique` UNIQUE(`certNo`)
);
--> statement-breakpoint
CREATE TABLE `product_certifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`certificationId` int NOT NULL,
	`productModel` varchar(256) NOT NULL,
	CONSTRAINT `product_certifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `certifications_certType_idx` ON `certifications` (`certType`);--> statement-breakpoint
CREATE INDEX `certifications_expiryDate_idx` ON `certifications` (`expiryDate`);--> statement-breakpoint
CREATE INDEX `certifications_status_idx` ON `certifications` (`status`);--> statement-breakpoint
CREATE INDEX `product_certifications_certificationId_idx` ON `product_certifications` (`certificationId`);--> statement-breakpoint
CREATE INDEX `product_certifications_productModel_idx` ON `product_certifications` (`productModel`);