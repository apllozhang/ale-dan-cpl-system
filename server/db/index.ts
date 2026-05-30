import { drizzle } from "drizzle-orm/mysql2";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// Re-export all modules
export * from "./users";
export * from "./organizations";
export * from "./userGroups";
export * from "./cpl";
export * from "./importLogs";
export * from "./quotations";
export * from "./activityLogs";
export * from "./templates";
export * from "./versions";
export * from "./searches";
export * from "./suggestions";
export * from "./sharing";
export * from "./productSpecs";
export * from "./customers";
