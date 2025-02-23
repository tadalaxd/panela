import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";
import { eq } from 'drizzle-orm';

console.log("Iniciando configuração do banco de dados para migração...");

if (!process.env.DATABASE_URL && !process.env.PGDATABASE) {
  throw new Error(
    "Nenhuma credencial de banco de dados encontrada. Configure DATABASE_URL ou as variáveis PGHOST, PGPORT, etc.",
  );
}

let pool;

if (process.env.DATABASE_URL) {
  console.log("Usando DATABASE_URL para conexão");
  pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });
} else {
  console.log("Usando variáveis PG individuais para conexão");
  pool = new pg.Pool({
    host: process.env.PGHOST,
    port: parseInt(process.env.PGPORT || "5432"),
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    ssl: {
      rejectUnauthorized: false
    }
  });
}

const db = drizzle(pool, { schema });

async function main() {
  console.log("Iniciando migração...");
  try {
    // Primeiro, verificar se a conexão está funcionando
    await pool.query('SELECT NOW()');
    console.log("Conexão com o banco de dados estabelecida");

    // Criar a tabela se não existir
    await pool.query(`
      CREATE TABLE IF NOT EXISTS guild_configs (
        id SERIAL PRIMARY KEY,
        guild_id TEXT NOT NULL UNIQUE,
        first_lady_role_id TEXT,
        anti_ban_role_id TEXT,
        us_role_id TEXT,
        role_limits TEXT[],
        allowed_roles TEXT[],
        us_allowed_roles TEXT[],
        member_added_by JSONB
      );
    `);
    console.log("Tabela guild_configs criada ou já existe");

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
  } finally {
    await pool.end();
  }
  process.exit(0);
}

main();