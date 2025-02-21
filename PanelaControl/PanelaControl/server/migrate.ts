import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";
import { eq } from 'drizzle-orm';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const db = drizzle(pool, { schema });

async function main() {
  console.log("Iniciando migração...");
  try {
    // Create an empty config for testing if the table exists
    const testConfig = {
      guildId: "test",
      firstLadyRoleId: "test",
      antiBanRoleId: "test",
      usRoleId: "test",
      roleLimits: [],
      allowedRoles: [],
      usAllowedRoles: [],
      memberAddedBy: {},
    };

    await db.insert(schema.guildConfigs).values(testConfig).onConflictDoNothing();
    await db.delete(schema.guildConfigs).where(eq(schema.guildConfigs.guildId, "test"));

    console.log("Migração concluída com sucesso!");
  } catch (error) {
    console.error("Erro durante a migração:", error);
    process.exit(1);
  }
  process.exit(0);
}

main();