require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, Collection, GatewayIntentBits, REST, Routes } = require('discord.js');
const mysql = require('mysql2/promise');

const BOT_COLOR = '#FFB6C1';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences
    ]
});

client.commands = new Collection();
client.color = BOT_COLOR;

// --- CHARGEMENT ---
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
                if ('data' in command && 'execute' in command) client.commands.set(command.data.name, command);
            }
        }
    }
}

const eventsPath = path.join(__dirname, 'events');
if (fs.existsSync(eventsPath)) {
    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
    for (const file of eventFiles) {
        const filePath = path.join(eventsPath, file);
        const event = require(filePath);
        if (event.once) client.once(event.name, (...args) => event.execute(...args));
        else client.on(event.name, (...args) => event.execute(...args));
    }
}

// --- DÉMARRAGE ---
(async () => {
    try {
        client.db = mysql.createPool({
            uri: process.env.MYSQL_URL,
            waitForConnections: true, connectionLimit: 5, queueLimit: 0, enableKeepAlive: true, keepAliveInitialDelay: 0
        });

        await client.db.query('SELECT 1');
        console.log('💾 DB Connectée');

        setInterval(async () => { try { await client.db.query('SELECT 1'); } catch (err) {} }, 60000);

        // --- TABLES SQL ---
        
        // 1. Levels & Rewards
        await client.db.execute(`CREATE TABLE IF NOT EXISTS levels (user_id VARCHAR(255), guild_id VARCHAR(255), xp INT DEFAULT 0, level INT DEFAULT 0, PRIMARY KEY (user_id, guild_id))`);
        await client.db.execute(`CREATE TABLE IF NOT EXISTS level_rewards (guild_id VARCHAR(255), level INT, role_id VARCHAR(255), PRIMARY KEY (guild_id, level))`);

        // 2. Warns
        await client.db.execute(`CREATE TABLE IF NOT EXISTS warnings (id INT AUTO_INCREMENT PRIMARY KEY, guild_id VARCHAR(255), user_id VARCHAR(255), moderator_id VARCHAR(255), reason TEXT, date TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);

        // 3. Settings Complets
        await client.db.execute(`
            CREATE TABLE IF NOT EXISTS guild_settings (
                guild_id VARCHAR(255) PRIMARY KEY, 
                antiraid_enabled BOOLEAN DEFAULT FALSE, 
                antiraid_account_age_days INT DEFAULT 7, 
                log_channel_id VARCHAR(255), 
                autorole_id VARCHAR(255) DEFAULT NULL,
                welcome_channel_id VARCHAR(255), 
                welcome_message VARCHAR(1000) DEFAULT "Bienvenue {user} ! 🌸", 
                welcome_bg VARCHAR(500) DEFAULT 'https://i.imgur.com/vH1W4Qc.jpeg',
                welcome_color VARCHAR(10) DEFAULT '#ffffff',
                levels_enabled BOOLEAN DEFAULT TRUE,
                level_up_message VARCHAR(1000) DEFAULT "🎉 Bravo {user}, tu passes au Niveau {level} !",
                automod_enabled BOOLEAN DEFAULT FALSE,
                automod_words TEXT DEFAULT NULL
            )
        `);

        // Migrations
        const migrations = [
            "ALTER TABLE guild_settings ADD COLUMN welcome_bg VARCHAR(500) DEFAULT 'https://i.imgur.com/vH1W4Qc.jpeg'",
            "ALTER TABLE guild_settings ADD COLUMN welcome_color VARCHAR(10) DEFAULT '#ffffff'",
            "ALTER TABLE guild_settings ADD COLUMN levels_enabled BOOLEAN DEFAULT TRUE",
            "ALTER TABLE guild_settings ADD COLUMN level_up_message VARCHAR(1000) DEFAULT '🎉 Bravo {user}, tu passes au Niveau {level} !'",
            "ALTER TABLE guild_settings ADD COLUMN automod_enabled BOOLEAN DEFAULT FALSE",
            "ALTER TABLE guild_settings ADD COLUMN automod_words TEXT DEFAULT NULL"
        ];
        for (const sql of migrations) { try { await client.db.execute(sql); } catch(e) {} }

        await client.login(process.env.DISCORD_TOKEN);
        
        const commandsData = [];
        client.commands.forEach(cmd => commandsData.push(cmd.data.toJSON()));
        const rest = new REST().setToken(process.env.DISCORD_TOKEN);
        await rest.put(Routes.applicationCommands(client.user.id), { body: commandsData });
        
        console.log(`✨ ${client.user.tag} Ready!`);
        require('./website/server')(client);

    } catch (error) { console.error(error); }
})();

client.on('interactionCreate', async i => { /* Fallback */ });