SET @cpl_sheets_sheet_name_unique_exists = (
  SELECT COUNT(1)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'cpl_sheets'
    AND index_name = 'cpl_sheets_sheetName_unique'
);
--> statement-breakpoint
SET @drop_cpl_sheets_sheet_name_unique_sql = IF(
  @cpl_sheets_sheet_name_unique_exists > 0,
  'ALTER TABLE `cpl_sheets` DROP INDEX `cpl_sheets_sheetName_unique`',
  'SELECT 1'
);
--> statement-breakpoint
PREPARE drop_cpl_sheets_sheet_name_unique_stmt FROM @drop_cpl_sheets_sheet_name_unique_sql;
--> statement-breakpoint
EXECUTE drop_cpl_sheets_sheet_name_unique_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE drop_cpl_sheets_sheet_name_unique_stmt;
