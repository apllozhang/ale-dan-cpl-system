import { drizzle } from "drizzle-orm/mysql2";
import type { MySql2Database } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

let _db: MySql2Database<Record<string, unknown>> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const pool = mysql.createPool({
        uri: process.env.DATABASE_URL,
        connectionLimit: 10,
        connectTimeout: 10000,
        waitForConnections: true,
        queueLimit: 0,
      });
      _db = drizzle(pool);
    } catch (error) {
      if (error instanceof Error && error.message.includes("acquire")) {
        throw new Error("Database busy, try again");
      }
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
export * from "./certifications";
export * from "./eflash";
