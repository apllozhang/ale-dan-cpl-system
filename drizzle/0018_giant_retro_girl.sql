CREATE INDEX `activity_logs_userId_idx` ON `activity_logs` (`userId`);--> statement-breakpoint
CREATE INDEX `certifications_createdBy_idx` ON `certifications` (`createdBy`);--> statement-breakpoint
CREATE INDEX `eflash_records_createdBy_idx` ON `eflash_records` (`createdBy`);--> statement-breakpoint
CREATE INDEX `product_specs_setId_idx` ON `product_specs` (`setId`);--> statement-breakpoint
CREATE INDEX `quotations_createdBy_idx` ON `quotations` (`createdBy`);--> statement-breakpoint
CREATE INDEX `quotations_status_idx` ON `quotations` (`status`);--> statement-breakpoint
CREATE INDEX `quotations_createdAt_idx` ON `quotations` (`createdAt`);