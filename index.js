require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, Collection, GatewayIntentBits, REST, Routes } = require('discord.js');
const mysql = require('mysql2/promise');

// --- CONFIGURATION KAWAII ---
const BOT_COLOR = '#FFB6C1'; // Rose pastel

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers, // Crucial pour voir les arrivées
        GatewayIntentBits.GuildPresences
    ]
});

client.commands = new Collection();
client.color = BOT_COLOR;

// --- 1. CHARGEMENT DES COMMANDES ---
const commands = [];
const foldersPath = path.join(__dirname, 'commands');
if (fs.existsSync(foldersPath)) {
    const commandFolders = fs.readdirSync(foldersPath);
    for (const folder of commandFolders) {
        const commandsPath = path.join(foldersPath, folder);
        if (fs.lstatSync(commandsPath).isDirectory()) {
            const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
            for (const file of commandFiles) {
                const filePath = path.join(commandsPath, file);
                const command = require(filePath);
                if ('data' in command && 'execute' in command) {
                    client.commands.set(command.data.name, command);
                    commands.push(command.data.toJSON());
                }
            }
        }
    }
}

// --- 2. CHARGEMENT DES ÉVÉNEMENTS (NOUVEAU) ---
const eventsPath = path.join(__dirname, 'events');
if (fs.existsSync(eventsPath)) {
    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
    for (const file of eventFiles) {
        const filePath = path.join(eventsPath, file);
        const event = require(filePath);
        if (event.once) {
            client.once(event.name, (...args) => event.execute(...args));
        } else {
            client.on(event.name, (...args) => event.execute(...args));
        }
    }
    console.log(`🌸 ${eventFiles.length} événements chargés.`);
}

// --- DÉMARRAGE ---
(async () => {
    try {
        // DB Connect
        client.db = mysql.createPool({
            uri: process.env.MYSQL_URL,
            waitForConnections: true,
            connectionLimit: 5,
            queueLimit: 0,
            enableKeepAlive: true
        });
        await client.db.query('SELECT 1');
        console.log('💾 Base de données connectée !');

        // Création Tables
        await client.db.execute(`CREATE TABLE IF NOT EXISTS levels (user_id VARCHAR(255), guild_id VARCHAR(255), xp INT DEFAULT 0, level INT DEFAULT 0, PRIMARY KEY (user_id, guild_id))`);
        await client.db.execute(`CREATE TABLE IF NOT EXISTS guild_settings (guild_id VARCHAR(255) PRIMARY KEY, antiraid_enabled BOOLEAN DEFAULT FALSE, antiraid_account_age_days INT DEFAULT 7, log_channel_id VARCHAR(255), welcome_channel_id VARCHAR(255), welcome_message VARCHAR(1000) DEFAULT "Bienvenue {user} ! 🌸", autorole_id VARCHAR(255) DEFAULT NULL)`);

        // Login & Register
        await client.login(process.env.DISCORD_TOKEN);
        const rest = new REST().setToken(process.env.DISCORD_TOKEN);
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log(`✨ ${client.user.tag} est prêt !`);

    } catch (error) {
        console.error('❌ Erreur :', error);
    }
})();