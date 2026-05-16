import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import { sql } from "drizzle-orm";
import { hash } from "bcryptjs";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

async function main() {
  const db = drizzle(DATABASE_URL);

  const username = "aletss";
  const password = "Ale@tss";
  const passwordHash = await hash(password, 10);
  const openId = `local-${username}`;

  // Check if user exists
  const existing = await db.execute(
    sql`SELECT id FROM users WHERE username = ${username} LIMIT 1`
  );

  if (existing[0] && existing[0].length > 0) {
    // Update existing user with password hash
    await db.execute(
      sql`UPDATE users SET password_hash = ${passwordHash}, open_id = ${openId}, login_method = 'local', role = 'admin' WHERE username = ${username}`
    );
    console.log(`Updated existing admin user: ${username}`);
  } else {
    // Create new admin user
    await db.execute(
      sql`INSERT INTO users (open_id, username, password_hash, name, email, login_method, role) VALUES (${openId}, ${username}, ${passwordHash}, 'ALE TSS', 'aletss@ale.com', 'local', 'admin')`
    );
    console.log(`Created admin user: ${username}`);
  }

  console.log("Done!");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
