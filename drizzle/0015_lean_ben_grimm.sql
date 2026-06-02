CREATE TABLE `eflash_attachments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`recordId` int NOT NULL,
	`fileName` varchar(500) NOT NULL,
	`filePath` varchar(1000) NOT NULL,
	`fileSize` int,
	`uploadedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `eflash_attachments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `eflash_record_tags` (
	`recordId` int NOT NULL,
	`tagId` int NOT NULL
);
--> statement-breakpoint
CREATE TABLE `eflash_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`eflashId` varchar(20) NOT NULL,
	`type` enum('phase_in','phase_out','service','pricing','program') NOT NULL,
	`division` enum('communications','network','general') NOT NULL,
	`scope` enum('global','china') NOT NULL,
	`subjectEn` text,
	`subjectCn` text,
	`globalDate` timestamp,
	`chinaDate` timestamp,
	`effectiveDate` timestamp,
	`authorEn` varchar(200),
	`authorCn` varchar(200),
	`comments` text,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `eflash_records_id` PRIMARY KEY(`id`),
	CONSTRAINT `eflash_records_eflashId_unique` UNIQUE(`eflashId`)
);
--> statement-breakpoint
CREATE TABLE `eflash_tags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`category` enum('region','product') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `eflash_tags_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `eflash_attachments` ADD CONSTRAINT `eflash_attachments_recordId_eflash_records_id_fk` FOREIGN KEY (`recordId`) REFERENCES `eflash_records`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `eflash_record_tags` ADD CONSTRAINT `eflash_record_tags_recordId_eflash_records_id_fk` FOREIGN KEY (`recordId`) REFERENCES `eflash_records`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `eflash_record_tags` ADD CONSTRAINT `eflash_record_tags_tagId_eflash_tags_id_fk` FOREIGN KEY (`tagId`) REFERENCES `eflash_tags`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `eflash_attachments_recordId_idx` ON `eflash_attachments` (`recordId`);--> statement-breakpoint
CREATE INDEX `eflash_record_tags_tagId_idx` ON `eflash_record_tags` (`tagId`);--> statement-breakpoint
CREATE INDEX `eflash_records_type_idx` ON `eflash_records` (`type`);--> statement-breakpoint
CREATE INDEX `eflash_records_division_idx` ON `eflash_records` (`division`);--> statement-breakpoint
CREATE INDEX `eflash_records_scope_idx` ON `eflash_records` (`scope`);--> statement-breakpoint
CREATE INDEX `eflash_records_effectiveDate_idx` ON `eflash_records` (`effectiveDate`);--> statement-breakpoint
CREATE INDEX `eflash_tags_category_idx` ON `eflash_tags` (`category`);