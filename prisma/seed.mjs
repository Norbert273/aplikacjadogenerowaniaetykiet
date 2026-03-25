import pg from "pg";
import bcrypt from "bcryptjs";

const { Client } = pg;

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const adminEmail = process.env.ADMIN_EMAIL || "admin@firma.pl";
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";

  const existing = await client.query(
    'SELECT id FROM "User" WHERE email = $1',
    [adminEmail]
  );

  if (existing.rows.length === 0) {
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    const id =
      "c" +
      Math.random().toString(36).slice(2) +
      Date.now().toString(36);

    await client.query(
      `INSERT INTO "User" (id, email, name, "passwordHash", role, country, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
      [id, adminEmail, "Administrator", passwordHash, "ADMIN", "PL"]
    );

    console.log(`Admin user created: ${adminEmail}`);
  } else {
    console.log(`Admin user already exists: ${adminEmail}`);
  }

  await client.end();
}

main().catch((e) => {
  console.error("Seed error:", e.message);
  process.exit(1);
});
