CREATE TABLE `import_jobs` (
	`id` varchar(64) NOT NULL,
	`type` enum('cpl','eflash') NOT NULL,
	`status` enum('pending','processing','succeeded','failed','cancelled') NOT NULL DEFAULT 'pending',
	`fileName` varchar(256) NOT NULL,
	`uploadId` varchar(64),
	`createdBy` int NOT NULL,
	`progress` int NOT NULL DEFAULT 0,
	`errorMessage` text,
	`result` json,
	`selectedSheets` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`startedAt` timestamp,
	`finishedAt` timestamp,
	CONSTRAINT `import_jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `login_attempts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(128) NOT NULL,
	`count` int NOT NULL DEFAULT 0,
	`windowStart` timestamp NOT NULL,
	`expiresAt` timestamp NOT NULL,
	CONSTRAINT `login_attempts_id` PRIMARY KEY(`id`),
	CONSTRAINT `login_attempts_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `temp_uploads` (
	`id` varchar(64) NOT NULL,
	`fileName` varchar(256) NOT NULL,
	`filePath` varchar(1000) NOT NULL,
	`fileSize` int NOT NULL,
	`mimeType` varchar(128),
	`uploadedBy` int NOT NULL,
	`consumedAt` timestamp,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `temp_uploads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `import_jobs` ADD CONSTRAINT `import_jobs_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `temp_uploads` ADD CONSTRAINT `temp_uploads_uploadedBy_users_id_fk` FOREIGN KEY (`uploadedBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `import_jobs_createdBy_idx` ON `import_jobs` (`createdBy`);--> statement-breakpoint
CREATE INDEX `import_jobs_status_idx` ON `import_jobs` (`status`);--> statement-breakpoint
CREATE INDEX `import_jobs_createdAt_idx` ON `import_jobs` (`createdAt`);--> statement-breakpoint
CREATE INDEX `login_attempts_expiresAt_idx` ON `login_attempts` (`expiresAt`);--> statement-breakpoint
CREATE INDEX `temp_uploads_uploadedBy_idx` ON `temp_uploads` (`uploadedBy`);--> statement-breakpoint
CREATE INDEX `temp_uploads_expiresAt_idx` ON `temp_uploads` (`expiresAt`);