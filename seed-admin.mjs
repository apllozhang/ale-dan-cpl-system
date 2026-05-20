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

  // 1. Create default organization
  const orgResult = await db.execute(
    sql`SELECT id FROM organizations WHERE name = 'ALE' LIMIT 1`
  );
  let orgId;
  if (orgResult[0] && orgResult[0].length > 0) {
    orgId = orgResult[0][0].id;
    console.log(`Organization already exists: ALE (id=${orgId})`);
  } else {
    const inserted = await db.execute(
      sql`INSERT INTO organizations (name) VALUES ('ALE')`
    );
    orgId = inserted[0].insertId;
    console.log(`Created organization: ALE (id=${orgId})`);
  }

  // 2. Create default user group
  const groupResult = await db.execute(
    sql`SELECT id FROM user_groups WHERE name = 'administrator' AND organizationId = ${orgId} LIMIT 1`
  );
  let groupId;
  if (groupResult[0] && groupResult[0].length > 0) {
    groupId = groupResult[0][0].id;
    console.log(`User group already exists: administrator (id=${groupId})`);
  } else {
    const inserted = await db.execute(
      sql`INSERT INTO user_groups (name, organizationId) VALUES ('administrator', ${orgId})`
    );
    groupId = inserted[0].insertId;
    console.log(`Created user group: administrator (id=${groupId})`);
  }

  // 3. Create/update super admin user
  const username = "aletss";
  const password = "Ale@tss";
  const passwordHash = await hash(password, 10);
  const openId = `local-${username}`;

  const existing = await db.execute(
    sql`SELECT id FROM users WHERE username = ${username} LIMIT 1`
  );

  if (existing[0] && existing[0].length > 0) {
    await db.execute(
      sql`UPDATE users SET passwordHash = ${passwordHash}, openId = ${openId}, loginMethod = 'local', role = 'admin', isSuperAdmin = true, organizationId = ${orgId}, groupId = ${groupId} WHERE username = ${username}`
    );
    console.log(`Updated super admin user: ${username}`);
  } else {
    await db.execute(
      sql`INSERT INTO users (openId, username, passwordHash, name, email, loginMethod, role, isSuperAdmin, organizationId, groupId) VALUES (${openId}, ${username}, ${passwordHash}, 'ALE TSS', 'aletss@ale.com', 'local', 'admin', true, ${orgId}, ${groupId})`
    );
    console.log(`Created super admin user: ${username}`);
  }

  console.log("Done!");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
