import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";
import { sql } from "drizzle-orm";

console.log("Iniciando configuração do banco de dados para migração...");

if (!process.env.DATABASE_URL && !process.env.PGDATABASE) {
  throw new Error(
    "Nenhuma credencial de banco de dados encontrada. Configure DATABASE_URL ou as variáveis PGHOST, PGPORT, etc.",
  );
}

let pool;

if (process.env.DATABASE_URL) {
  console.log("Usando DATABASE_URL para conexão:", process.env.DATABASE_URL.split("@")[1]); // Log seguro da URL
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
    const timeResult = await pool.query('SELECT NOW()');
    console.log("Conexão com o banco de dados estabelecida:", timeResult.rows[0]);

    // Verificar se a tabela existe
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public'
        AND table_name = 'guild_configs'
      );
    `);

    console.log("Tabela guild_configs existe?", tableExists.rows[0].exists);

    if (!tableExists.rows[0].exists) {
      console.log("Criando tabela guild_configs...");

      // Criar a tabela usando SQL bruto para garantir
      await pool.query(`
        DROP TABLE IF EXISTS guild_configs;
        CREATE TABLE guild_configs (
          id SERIAL PRIMARY KEY,
          guild_id TEXT NOT NULL UNIQUE,
          first_lady_role_id TEXT,
          anti_ban_role_id TEXT,
          us_role_id TEXT,
          role_limits TEXT[],
          allowed_roles TEXT[],
          us_allowed_roles TEXT[],
          member_added_by JSONB DEFAULT '{}'::jsonb
        );
      `);

      console.log("Tabela guild_configs criada com sucesso");

      // Verificar se a tabela foi realmente criada
      const verifyTable = await pool.query(`
        SELECT column_name, data_type, column_default
        FROM information_schema.columns
        WHERE table_name = 'guild_configs';
      `);

      console.log("Estrutura da tabela:", verifyTable.rows);
    }

    // Tentar inserir um registro de teste
    console.log("Inserindo registro de teste...");
    const testConfig = {
      guildId: "test",
      firstLadyRoleId: "test",
      antiBanRoleId: "test",
      usRoleId: "test",
      roleLimits: [],
      allowedRoles: [],
      usAllowedRoles: [],
      memberAddedBy: {}
    };

    await db.insert(schema.guildConfigs).values(testConfig).onConflictDoNothing();

    // Verificar se o registro foi inserido
    const testSelect = await db.select().from(schema.guildConfigs).where(sql`guild_id = 'test'`);
    console.log("Registro de teste encontrado:", testSelect.length > 0);

    // Limpar o registro de teste
    await db.delete(schema.guildConfigs).where(sql`guild_id = 'test'`);

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