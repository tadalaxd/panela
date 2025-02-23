import { Client, GatewayIntentBits, Partials, GuildMember, AuditLogEvent, PermissionsBitField, PartialGuildMember } from "discord.js";
import { handleCommands } from "./commands";
import { handleButtons } from "./buttons";
import { log } from "../vite";
import { storage } from "../storage";

function validateEnvironment() {
  console.log("Validando variáveis de ambiente...");

  const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
  if (!DISCORD_TOKEN) {
    console.error("DISCORD_TOKEN não encontrado nas variáveis de ambiente!");
    console.error("Por favor, configure o token do Discord nas variáveis de ambiente.");
    process.exit(1);
  }

  console.log("✓ DISCORD_TOKEN encontrado");
  return DISCORD_TOKEN;
}

const DISCORD_TOKEN = validateEnvironment();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildModeration,
  ],
  partials: [
    Partials.Message, 
    Partials.Channel, 
    Partials.Reaction,
    Partials.User,
    Partials.GuildMember
  ],
});

client.once("ready", () => {
  log(`Bot está pronto! Logado como ${client.user?.tag}`, "discord");
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  log(`Mensagem recebida de ${message.author.tag}: ${message.content}`, "discord");
  try {
    await handleCommands(message);
  } catch (error) {
    log(`Erro ao processar comando: ${error}`, "discord");
    await message.reply("Ocorreu um erro ao processar o comando. Por favor, tente novamente.");
  }
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  log(`Interação de botão recebida - ID: ${interaction.customId}`, "discord");
  try {
    await handleButtons(interaction);
  } catch (error) {
    log(`Erro ao processar interação de botão: ${error}`, "discord");
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "Ocorreu um erro ao processar o botão. Por favor, tente novamente.",
        ephemeral: true
      });
    }
  }
});

client.on("guildMemberUpdate", async (oldMember: GuildMember | PartialGuildMember, newMember: GuildMember) => {
  try {
    const config = await storage.getGuildConfig(newMember.guild.id);
    if (!config) return;

    const protectedRoles = [
      config.firstLadyRoleId,
      config.antiBanRoleId,
      config.usRoleId
    ].filter(Boolean) as string[];

    if (protectedRoles.length === 0) return;

    if (!newMember.guild.members.me?.permissions.has([
      PermissionsBitField.Flags.ManageRoles,
      PermissionsBitField.Flags.SendMessages,
      PermissionsBitField.Flags.ViewChannel
    ])) {
      log(`Bot não tem as permissões necessárias no servidor ${newMember.guild.name}`, "discord");
      return;
    }

    const addedRoles = newMember.roles.cache
      .filter(role => !oldMember.roles.cache.has(role.id))
      .map(role => role.id);

    const removedRoles = oldMember.roles.cache
      .filter(role => !newMember.roles.cache.has(role.id))
      .map(role => role.id);

    if (addedRoles.length === 0 && removedRoles.length === 0) return;

    const protectedAdded = addedRoles.some(roleId => protectedRoles.includes(roleId));
    const protectedRemoved = removedRoles.some(roleId => protectedRoles.includes(roleId));

    if (protectedAdded || protectedRemoved) {
      const auditLogs = await newMember.guild.fetchAuditLogs({
        type: AuditLogEvent.MemberRoleUpdate,
        limit: 1,
      });

      const roleUpdateLog = auditLogs.entries.first();

      if (roleUpdateLog?.executor?.id === client.user?.id) {
        log(`Mudança de cargo feita pelo bot para ${newMember.user.tag}`, "discord");
        return;
      }

      log(`Tentativa de alteração manual de cargo protegido detectada para ${newMember.user.tag}`, "discord");

      const botMember = newMember.guild.members.me;
      if (!botMember) {
        log(`Bot não encontrado no servidor ${newMember.guild.name}`, "discord");
        return;
      }

      const roles = await newMember.guild.roles.fetch();
      const canManageAllRoles = protectedRoles.every(roleId => {
        const role = roles.get(roleId);
        return role && role.position < botMember.roles.highest.position;
      });

      if (!canManageAllRoles) {
        log(`Bot não tem hierarquia suficiente para gerenciar alguns cargos protegidos`, "discord");
        return;
      }

      try {
        await newMember.roles.set(oldMember.roles.cache);
        log(`Cargos revertidos com sucesso para ${newMember.user.tag}`, "discord");

        const channel = newMember.guild.systemChannel;
        if (channel) {
          await channel.send({
            content: `⚠️ Tentativa de modificação manual de cargo protegido detectada.\nOs cargos da Panela só podem ser gerenciados através do bot.`,
          });
        }
      } catch (error) {
        log(`Erro ao reverter cargos para ${newMember.user.tag}: ${error}`, "discord");
      }
    }
  } catch (error) {
    log(`Erro ao processar mudança de cargo: ${error}`, "discord");
  }
});

client.on("error", (error) => {
  log(`Erro não tratado no cliente Discord: ${error}`, "discord");
});

export async function startBot() {
  console.log("Iniciando o bot do Discord...");

  try {
    await client.login(DISCORD_TOKEN);
    log("Bot logado com sucesso!", "discord");
  } catch (error) {
    log(`Erro ao fazer login do bot: ${error}`, "discord");
    throw error;
  }
}