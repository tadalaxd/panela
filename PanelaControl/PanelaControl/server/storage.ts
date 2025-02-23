import { guildConfigs, type GuildConfig, type InsertGuildConfig } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  getGuildConfig(guildId: string): Promise<GuildConfig | undefined>;
  saveGuildConfig(config: InsertGuildConfig): Promise<GuildConfig>;
  updateGuildConfig(guildId: string, config: Partial<InsertGuildConfig>): Promise<GuildConfig>;
}

export class DatabaseStorage implements IStorage {
  async getGuildConfig(guildId: string): Promise<GuildConfig | undefined> {
    try {
      console.log(`Buscando configuração para o servidor ${guildId}...`);
      const [config] = await db
        .select()
        .from(guildConfigs)
        .where(eq(guildConfigs.guildId, guildId));

      if (config) {
        console.log(`Configuração encontrada para o servidor ${guildId}`);
      } else {
        console.log(`Nenhuma configuração encontrada para o servidor ${guildId}`);
      }

      return config;
    } catch (error) {
      console.error(`Erro ao buscar configuração do servidor ${guildId}:`, error);
      if (error instanceof Error) {
        console.error("Detalhes do erro:", {
          message: error.message,
          name: error.name,
          stack: error.stack
        });
      }
      throw error;
    }
  }

  async saveGuildConfig(insertConfig: InsertGuildConfig): Promise<GuildConfig> {
    try {
      console.log(`Salvando configuração para o servidor ${insertConfig.guildId}...`);

      // Verificar se já existe uma configuração para este servidor
      const existing = await this.getGuildConfig(insertConfig.guildId);
      if (existing) {
        console.log(`Configuração existente encontrada, atualizando...`);
        return this.updateGuildConfig(insertConfig.guildId, insertConfig);
      }

      console.log(`Inserindo nova configuração...`);
      const [config] = await db
        .insert(guildConfigs)
        .values(insertConfig)
        .returning();

      console.log(`Configuração salva com sucesso para o servidor ${insertConfig.guildId}`);
      return config;
    } catch (error) {
      console.error(`Erro ao salvar configuração do servidor ${insertConfig.guildId}:`, error);
      if (error instanceof Error) {
        console.error("Detalhes do erro:", {
          message: error.message,
          name: error.name,
          stack: error.stack
        });
      }
      throw error;
    }
  }

  async updateGuildConfig(
    guildId: string,
    updates: Partial<InsertGuildConfig>,
  ): Promise<GuildConfig> {
    try {
      console.log(`Atualizando configuração para o servidor ${guildId}...`);
      const [updated] = await db
        .update(guildConfigs)
        .set(updates)
        .where(eq(guildConfigs.guildId, guildId))
        .returning();

      if (!updated) {
        console.error(`Configuração não encontrada para o servidor ${guildId}`);
        throw new Error(`Configuração não encontrada para o servidor ${guildId}`);
      }

      console.log(`Configuração atualizada com sucesso para o servidor ${guildId}`);
      return updated;
    } catch (error) {
      console.error(`Erro ao atualizar configuração do servidor ${guildId}:`, error);
      if (error instanceof Error) {
        console.error("Detalhes do erro:", {
          message: error.message,
          name: error.name,
          stack: error.stack
        });
      }
      throw error;
    }
  }
}

export const storage = new DatabaseStorage();