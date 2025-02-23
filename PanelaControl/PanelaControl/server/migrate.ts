import { Pool } from 'pg';
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";
import { sql } from "drizzle-orm";

console.log("Iniciando configuração do banco de dados para migração...");

if (!process.env.DATABASE_URL && !process.env.PGDATABASE) {
  throw new Error(
    "Nenhuma credencial de banco de dados encontrada. Configure DATABASE_URL ou as variáveis PGHOST, PGPORT, etc.",
  );
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  // Configurações adicionais para garantir que a conexão seja estabelecida
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  max: 20
});

const db = drizzle(pool, { schema });

async function main() {
  console.log("Iniciando migração...");
  let client;
  try {
    // Primeiro, verificar se a conexão está funcionando
    console.log("Tentando estabelecer conexão com o banco de dados...");
    client = await pool.connect();
    const timeResult = await client.query('SELECT NOW()');
    console.log("Conexão com o banco de dados estabelecida:", timeResult.rows[0]);

    // Verificar se a tabela existe
    console.log("Verificando se a tabela guild_configs existe...");
    const tableExists = await client.query(`
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
      await client.query(`
        CREATE TABLE IF NOT EXISTS guild_configs (
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
    }

    // Verificar se a tabela foi realmente criada
    const verifyTable = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns
      WHERE table_name = 'guild_configs';
    `);

    console.log("Estrutura da tabela:", verifyTable.rows);

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
    process.exit(0);
  } catch (error) {
    console.error("Erro durante a migração:", error);
    if (error instanceof Error) {
      console.error("Detalhes do erro:", {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    }
    process.exit(1);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Erro fatal durante a migração:", err);
  process.exit(1);
});