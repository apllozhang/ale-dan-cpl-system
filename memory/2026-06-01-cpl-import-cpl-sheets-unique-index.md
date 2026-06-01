# CPL import failure debug report - 2026-06-01

## Symptom

Production import failed while inserting sheet metadata:

`insert into cpl_sheets (importLogId, sheetName, displayOrder, productCount) ... params: 840001, OS9500 POL, 2, 28`

## Root cause

The application now supports multiple historical CPL imports by tagging `cpl_sheets` rows with `importLogId`, but the original `0001_sparkling_zarda.sql` migration created a global unique constraint on `cpl_sheets.sheetName`.

That global uniqueness is incompatible with repeated monthly imports that contain the same sheet names. The current Drizzle schema no longer declares the unique constraint, but there was no explicit migration to drop it in databases that were created from the old migration history.

TiDB auto-increment IDs such as `840001` are not evidence of a bad insert ID by themselves; TiDB can allocate non-contiguous IDs.

## Fix

Added migration `drizzle/0011_drop_cpl_sheets_sheet_name_unique.sql` to drop `cpl_sheets_sheetName_unique` when it exists. The migration is idempotent, so it also succeeds on databases where the index was already removed.

Added `server/cpl-schema-migrations.test.ts` to guard against this schema/migration drift.

## Evidence

- `npx vitest run server/cpl-schema-migrations.test.ts` passed.
- `npm run check` passed.
- `npm run test` passed: 10 files, 90 tests.
- `npm run build` passed with existing Vite warnings.
- A read-only `information_schema.statistics` query against the current `.env` database showed only the primary key on `cpl_sheets`; the idempotent migration was syntax-checked there and kept the same index state.

## Status

DONE_WITH_CONCERNS: code and migration are fixed and verified locally. Production still needs this migration deployed/applied before the live import path can be confirmed.
