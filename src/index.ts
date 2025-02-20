import { Client, GatewayIntentBits, Collection } from 'discord.js';
import { config } from './config';
import { connectDatabase } from './db/database';
import { loadCommands } from './commands';
import { Command } from './types';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

// Create commands collection
client.commands = new Collection<string, Command>();

// Handle ready event
client.once('ready', async () => {
    console.log(`Logged in as ${client.user?.tag}`);
    
    try {
        // Connect to database
        await connectDatabase();
        console.log('Database connected successfully');

        // Load commands
        await loadCommands(client);
        console.log('Commands loaded successfully');
    } catch (error) {
        console.error('Error during initialization:', error);
    }
});

// Handle interactions
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        await interaction.reply({
            content: 'There was an error executing this command!',
            ephemeral: true
        });
    }
});

// Login
client.login(config.token);
