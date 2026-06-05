-- =============================================================================
-- Hotfix: sessions + login_attempts 表（紧急修复生产登录 2026-06-05）
-- =============================================================================
-- 背景：commit 9c4ce1a 引入了 sessions 和 login_attempts 依赖，
-- 但迁移 0020 未部署。生产数据库缺少这两张表，导致登录失败。
-- 本脚本是迁移 0020 的子集（共享同一套幂等存储过程），仅包含已上线代码必需的两张表。
-- IDEMPOTENT: 所有 DDL 都通过 information_schema 做存在性检查，可安全重复执行。
-- =============================================================================

-- ── Helper procedure: CREATE INDEX IF NOT EXISTS (MySQL 8.0 compatible) ──
DROP PROCEDURE IF EXISTS `_hotfix_add_index_if_not_exists`;

--> statement-breakpoint
CREATE PROCEDURE `_hotfix_add_index_if_not_exists`(
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
-- ── Helper procedure: ALTER TABLE ADD FOREIGN KEY IF NOT EXISTS ──
DROP PROCEDURE IF EXISTS `_hotfix_add_fk_if_not_exists`;

--> statement-breakpoint
CREATE PROCEDURE `_hotfix_add_fk_if_not_exists`(
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
-- 1. sessions 表（服务端会话管理——已上线代码依赖）
CREATE TABLE IF NOT EXISTS `sessions` (
    `id` varchar(64) NOT NULL,
    `userId` int NOT NULL,
    `createdAt` timestamp NOT NULL DEFAULT (now()),
    `expiresAt` timestamp NOT NULL,
    `revokedAt` timestamp,
    CONSTRAINT `sessions_id` PRIMARY KEY(`id`)
);

--> statement-breakpoint
-- 2. login_attempts 表（登录限流——已上线代码依赖）
CREATE TABLE IF NOT EXISTS `login_attempts` (
    `id` int NOT NULL AUTO_INCREMENT,
    `key` varchar(128) NOT NULL,
    `count` int NOT NULL DEFAULT 0,
    `windowStart` timestamp NOT NULL,
    `expiresAt` timestamp NOT NULL,
    CONSTRAINT `login_attempts_id` PRIMARY KEY(`id`)
);

-- =============================================================================
-- FOREIGN KEYS
-- =============================================================================

--> statement-breakpoint
CALL `_hotfix_add_fk_if_not_exists`(
    'sessions', 'sessions_userId_users_id_fk',
    'FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action'
);

-- =============================================================================
-- INDEXES
-- =============================================================================

--> statement-breakpoint
CALL `_hotfix_add_index_if_not_exists`('sessions', 'sessions_userId_idx', '`userId`');

--> statement-breakpoint
CALL `_hotfix_add_index_if_not_exists`('sessions', 'sessions_expiresAt_idx', '`expiresAt`');

--> statement-breakpoint
CALL `_hotfix_add_index_if_not_exists`('login_attempts', 'login_attempts_key_idx', '`key`');

--> statement-breakpoint
CALL `_hotfix_add_index_if_not_exists`('login_attempts', 'login_attempts_expiresAt_idx', '`expiresAt`');

-- =============================================================================
-- CLEANUP
-- =============================================================================

--> statement-breakpoint
DROP PROCEDURE IF EXISTS `_hotfix_add_index_if_not_exists`;

--> statement-breakpoint
DROP PROCEDURE IF EXISTS `_hotfix_add_fk_if_not_exists`;
