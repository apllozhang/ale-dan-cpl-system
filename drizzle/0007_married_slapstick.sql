ALTER TABLE `cpl_products` ADD `importLogId` int;--> statement-breakpoint
ALTER TABLE `cpl_sheets` ADD `importLogId` int;--> statement-breakpoint
ALTER TABLE `cpl_summary` ADD `importLogId` int;--> statement-breakpoint
ALTER TABLE `import_logs` ADD `isActive` boolean DEFAULT false NOT NULL;