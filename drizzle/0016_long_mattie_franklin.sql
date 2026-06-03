ALTER TABLE `eflash_records` ADD `hasPdf` tinyint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `eflash_records` ADD `pdfPath` varchar(500);--> statement-breakpoint
ALTER TABLE `eflash_records` ADD `source` varchar(100) DEFAULT 'Import' NOT NULL;--> statement-breakpoint
ALTER TABLE `eflash_records` ADD `status` enum('active','archived') DEFAULT 'active' NOT NULL;