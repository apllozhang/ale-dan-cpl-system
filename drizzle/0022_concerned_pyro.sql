-- =============================================================================
-- Migration 0020: Async Import + Upload Security + Sessions
-- =============================================================================
-- IDEMPOTENT: Safe to run multiple times. All DDL uses IF NOT EXISTS guards.
-- Tables created by prior db:push (sessions) are protected from duplicate creation.
-- =============================================================================

-- ── Helper: Drop and recreate the idempotency helper procedure ──
DROP PROCEDURE IF EXISTS `_migration_0020_add_index_if_not_exists`;
--> statement-breakpoint
DROP PROCEDURE IF EXISTS `_migration_0020_add_fk_if_not_exists`;

--> statement-breakpoint
-- ── Helper procedure: CREATE INDEX IF NOT EXISTS (MySQL 8.0 compatible) ──
CREATE PROCEDURE `_migration_0020_add_index_if_not_exists`(
    IN `tbl` VARCHAR(64),
    IN `idx_name` VARCHAR(64),
    IN `idx_cols` TEXT
)
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = `tbl`
          AND INDEX_NAME = `idx_name`
    ) THEN
        SET @ddl = CONCAT('CREATE INDEX `', `idx_name`, '` ON `', `tbl`, '` (', `idx_cols`, ')');
        PREPARE stmt FROM @ddl;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END;

--> statement-breakpoint
-- ── Helper procedure: ALTER TABLE ADD CONSTRAINT IF NOT EXISTS ──
CREATE PROCEDURE `_migration_0020_add_fk_if_not_exists`(
    IN `tbl` VARCHAR(64),
    IN `fk_name` VARCHAR(64),
    IN `fk_def` TEXT
)
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE()
          AND TABLE_NAME = `tbl`
          AND CONSTRAINT_NAME = `fk_name`
    ) THEN
        SET @ddl = CONCAT('ALTER TABLE `', `tbl`, '` ADD CONSTRAINT `', `fk_name`, '` ', `fk_def`);
        PREPARE stmt FROM @ddl;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END;

-- =============================================================================
-- TABLES
-- =============================================================================

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `import_jobs` (
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
CREATE TABLE IF NOT EXISTS `sessions` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp NOT NULL,
	`revokedAt` timestamp,
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`)
);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `temp_uploads` (
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
CREATE TABLE IF NOT EXISTS `login_attempts` (
	`id` int NOT NULL AUTO_INCREMENT,
	`key` varchar(128) NOT NULL,
	`count` int NOT NULL DEFAULT 0,
	`windowStart` timestamp NOT NULL,
	`expiresAt` timestamp NOT NULL,
	CONSTRAINT `login_attempts_id` PRIMARY KEY(`id`)
);

-- =============================================================================
-- FOREIGN KEYS (conditional — skip if already exist from db:push)
-- =============================================================================

--> statement-breakpoint
CALL `_migration_0020_add_fk_if_not_exists`(
    'import_jobs', 'import_jobs_createdBy_users_id_fk',
    'FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action'
);

--> statement-breakpoint
CALL `_migration_0020_add_fk_if_not_exists`(
    'sessions', 'sessions_userId_users_id_fk',
    'FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action'
);

--> statement-breakpoint
CALL `_migration_0020_add_fk_if_not_exists`(
    'temp_uploads', 'temp_uploads_uploadedBy_users_id_fk',
    'FOREIGN KEY (`uploadedBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action'
);

-- =============================================================================
-- INDEXES (conditional — skip if already exist from db:push)
-- =============================================================================

--> statement-breakpoint
CALL `_migration_0020_add_index_if_not_exists`('import_jobs', 'import_jobs_createdBy_idx', '`createdBy`');

--> statement-breakpoint
CALL `_migration_0020_add_index_if_not_exists`('import_jobs', 'import_jobs_status_idx', '`status`');

--> statement-breakpoint
CALL `_migration_0020_add_index_if_not_exists`('import_jobs', 'import_jobs_createdAt_idx', '`createdAt`');

--> statement-breakpoint
CALL `_migration_0020_add_index_if_not_exists`('sessions', 'sessions_userId_idx', '`userId`');

--> statement-breakpoint
CALL `_migration_0020_add_index_if_not_exists`('sessions', 'sessions_expiresAt_idx', '`expiresAt`');

--> statement-breakpoint
CALL `_migration_0020_add_index_if_not_exists`('temp_uploads', 'temp_uploads_uploadedBy_idx', '`uploadedBy`');

--> statement-breakpoint
CALL `_migration_0020_add_index_if_not_exists`('temp_uploads', 'temp_uploads_expiresAt_idx', '`expiresAt`');

--> statement-breakpoint
CALL `_migration_0020_add_index_if_not_exists`('login_attempts', 'login_attempts_key_idx', '`key`');

--> statement-breakpoint
CALL `_migration_0020_add_index_if_not_exists`('login_attempts', 'login_attempts_expiresAt_idx', '`expiresAt`');

-- =============================================================================
-- CLEANUP — remove helper procedures
-- =============================================================================

--> statement-breakpoint
DROP PROCEDURE IF EXISTS `_migration_0020_add_index_if_not_exists`;

--> statement-breakpoint
DROP PROCEDURE IF EXISTS `_migration_0020_add_fk_if_not_exists`;