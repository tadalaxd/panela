import { Client } from 'discord.js';
import { ping } from './ping';
import { Command } from '../types';

export async function loadCommands(client: Client) {
    // Add commands to collection
    client.commands.set(ping.name, ping);

    // Register commands with Discord
    try {
        const commands = [ping];
        await client.application?.commands.set(commands);
    } catch (error) {
        console.error('Error registering commands:', error);
        throw error;
    }
}
