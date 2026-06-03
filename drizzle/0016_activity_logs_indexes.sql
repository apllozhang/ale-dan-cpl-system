CREATE INDEX IF NOT EXISTS `idx_activity_composite` ON `activity_logs` (`createdAt`, `userId`, `action`);
CREATE INDEX IF NOT EXISTS `idx_activity_resource` ON `activity_logs` (`resourceType`, `createdAt`);
