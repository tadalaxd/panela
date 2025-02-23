import pkg from 'pg';
const { Pool } = pkg;
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

console.log("Iniciando configuração do banco de dados...");

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL deve estar configurada. Verifique as variáveis de ambiente.",
  );
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Erro inesperado no pool de conexões:', err);
});

pool.on('connect', () => {
  console.log('Nova conexão estabelecida no pool');
});

pool.on('remove', () => {
  console.log('Conexão removida do pool');
});

async function initializeDatabase() {
  let client;
  let retries = 0;
  const maxRetries = 5;

  while (retries < maxRetries) {
    try {
      console.log(`Tentativa ${retries + 1} de ${maxRetries} de conexão com o banco de dados...`);
      client = await pool.connect();

      // Garantir que estamos usando o schema público
      await client.query('SET search_path TO public');

      const result = await client.query('SELECT NOW()');
      console.log("Conexão estabelecida, timestamp:", result.rows[0].now);

      // Verificar se a tabela existe
      const tableCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public'
          AND table_name = 'guild_configs'
        );
      `);

      if (!tableCheck.rows[0].exists) {
        console.log("Tabela guild_configs não encontrada. Execute 'npm run migrate' primeiro.");
        throw new Error("Tabela guild_configs não encontrada!");
      }

      // Tentar acessar a tabela para garantir que temos permissões
      await client.query('SELECT COUNT(*) FROM public.guild_configs');
      console.log("Tabela guild_configs encontrada e acessível.");

      console.log("Conexão com o banco de dados estabelecida com sucesso!");
      return true;
    } catch (error) {
      console.error(`Tentativa ${retries + 1} falhou:`, error);
      retries++;

      if (retries < maxRetries) {
        console.log(`Aguardando 5 segundos antes da próxima tentativa...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      } else {
        console.error("Todas as tentativas de conexão falharam!");
        throw error;
      }
    } finally {
      if (client) {
        client.release();
      }
    }
  }
}

initializeDatabase().catch(error => {
  console.error("Erro fatal na inicialização do banco de dados:", error);
  process.exit(1);
});

export const db = drizzle(pool, { schema });