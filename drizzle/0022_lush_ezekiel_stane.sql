CREATE TABLE `ai_conversations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`title` varchar(200),
	`mode` enum('local','expert') NOT NULL DEFAULT 'expert',
	`provider_config_id` int,
	`search_config_id` int,
	`knowledge_base_id` int,
	`system_prompt` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_conversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_knowledge_bases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(200) NOT NULL,
	`description` text,
	`created_by` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_knowledge_bases_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_knowledge_docs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`knowledge_base_id` int NOT NULL,
	`file_name` varchar(500) NOT NULL,
	`file_type` varchar(20) NOT NULL,
	`file_size` int NOT NULL,
	`extracted_text` text,
	`chunk_count` int DEFAULT 0,
	`status` enum('processing','ready','failed') NOT NULL DEFAULT 'processing',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_knowledge_docs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`conversation_id` int NOT NULL,
	`role` enum('system','user','assistant') NOT NULL,
	`content` text NOT NULL,
	`mode` enum('local','expert'),
	`attached_files` json,
	`search_results` json,
	`token_count` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_provider_configs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`provider` enum('openai_compatible','google_gemini') NOT NULL,
	`api_base_url` varchar(500) NOT NULL,
	`api_key` text NOT NULL,
	`model_name` varchar(100) NOT NULL,
	`max_tokens` int DEFAULT 4096,
	`temperature` decimal(3,2) DEFAULT '0.70',
	`is_enabled` boolean NOT NULL DEFAULT true,
	`is_default` boolean NOT NULL DEFAULT false,
	`cost_per_input_token` decimal(10,8) DEFAULT '0',
	`cost_per_output_token` decimal(10,8) DEFAULT '0',
	`created_by` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_provider_configs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_search_configs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`provider` enum('serper','serpapi','google_custom','bing','tavily','custom') NOT NULL,
	`api_base_url` varchar(500) NOT NULL,
	`api_key` text NOT NULL,
	`extra_params` json,
	`is_default` boolean NOT NULL DEFAULT false,
	`is_enabled` boolean NOT NULL DEFAULT true,
	`daily_limit` int DEFAULT 1000,
	`created_by` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_search_configs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
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
CREATE TABLE `sessions` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp NOT NULL,
	`revokedAt` timestamp,
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`)
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
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `temp_uploads` ADD CONSTRAINT `temp_uploads_uploadedBy_users_id_fk` FOREIGN KEY (`uploadedBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `ai_conversations_user_id_idx` ON `ai_conversations` (`user_id`);--> statement-breakpoint
CREATE INDEX `ai_messages_conversation_id_idx` ON `ai_messages` (`conversation_id`);--> statement-breakpoint
CREATE INDEX `import_jobs_createdBy_idx` ON `import_jobs` (`createdBy`);--> statement-breakpoint
CREATE INDEX `import_jobs_status_idx` ON `import_jobs` (`status`);--> statement-breakpoint
CREATE INDEX `import_jobs_createdAt_idx` ON `import_jobs` (`createdAt`);--> statement-breakpoint
CREATE INDEX `login_attempts_expiresAt_idx` ON `login_attempts` (`expiresAt`);--> statement-breakpoint
CREATE INDEX `sessions_userId_idx` ON `sessions` (`userId`);--> statement-breakpoint
CREATE INDEX `sessions_expiresAt_idx` ON `sessions` (`expiresAt`);--> statement-breakpoint
CREATE INDEX `temp_uploads_uploadedBy_idx` ON `temp_uploads` (`uploadedBy`);--> statement-breakpoint
CREATE INDEX `temp_uploads_expiresAt_idx` ON `temp_uploads` (`expiresAt`);