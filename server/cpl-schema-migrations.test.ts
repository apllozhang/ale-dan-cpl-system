import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const drizzleDir = join(process.cwd(), "drizzle");

function readSqlMigrations() {
  return readdirSync(drizzleDir)
    .filter((fileName) => /^\d+_.*\.sql$/.test(fileName))
    .sort()
    .map((fileName) => ({
      fileName,
      sql: readFileSync(join(drizzleDir, fileName), "utf8"),
    }));
}

describe("CPL schema migrations", () => {
  it("drops the legacy global unique constraint on cpl_sheets.sheetName", () => {
    const migrations = readSqlMigrations();

    const createIndex = migrations.findIndex(({ sql }) =>
      sql.includes("CONSTRAINT `cpl_sheets_sheetName_unique` UNIQUE(`sheetName`)")
    );
    const dropIndex = migrations.findIndex(({ sql }) =>
      sql.includes("DROP INDEX `cpl_sheets_sheetName_unique`")
    );
    const dropMigration = migrations[dropIndex];

    expect(createIndex).toBeGreaterThanOrEqual(0);
    expect(dropIndex).toBeGreaterThan(createIndex);
    expect(dropMigration?.sql).toContain("information_schema.statistics");
    expect(dropMigration?.sql).toContain("PREPARE drop_cpl_sheets_sheet_name_unique_stmt");
  });
});
