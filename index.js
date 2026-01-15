require('dotenv').config();
const fs = require('fs');
const path = require('path');
// AJOUT DE 'Partials' : Indispensable pour détecter les réactions sur les vieux messages
const { Client, Collection, GatewayIntentBits, REST, Routes, Partials } = require('discord.js');
const mysql = require('mysql2/promise');

const BOT_COLOR = '#FFB6C1'; 

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessageReactions // IMPORTANT POUR LES RÔLES-RÉACTIONS
    ],
    // Permet au bot de voir les messages envoyés AVANT son démarrage
    partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

client.commands = new Collection();
client.color = BOT_COLOR;

// --- CHARGEMENT COMMANDES ---
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

// --- CHARGEMENT ÉVÉNEMENTS ---
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

// --- DÉMARRAGE & DB ---
(async () => {
    try {
        client.db = mysql.createPool({
            uri: process.env.MYSQL_URL,
            waitForConnections: true, connectionLimit: 5, queueLimit: 0, enableKeepAlive: true, keepAliveInitialDelay: 0
        });

        await client.db.query('SELECT 1');
        console.log('💾 Base de données connectée !');

        setInterval(async () => { try { await client.db.query('SELECT 1'); } catch (err) {} }, 60000);

        // --- CRÉATION DES TABLES ---
        
        // 1. Tables de Base
        await client.db.execute(`CREATE TABLE IF NOT EXISTS levels (user_id VARCHAR(32), guild_id VARCHAR(32), xp INT DEFAULT 0, level INT DEFAULT 0, PRIMARY KEY (user_id, guild_id))`);
        await client.db.execute(`CREATE TABLE IF NOT EXISTS level_rewards (guild_id VARCHAR(32), level INT, role_id VARCHAR(32), PRIMARY KEY (guild_id, level))`);
        await client.db.execute(`CREATE TABLE IF NOT EXISTS warnings (id INT AUTO_INCREMENT PRIMARY KEY, guild_id VARCHAR(32), user_id VARCHAR(32), moderator_id VARCHAR(32), reason TEXT, date TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
        await client.db.execute(`CREATE TABLE IF NOT EXISTS custom_commands (id INT AUTO_INCREMENT PRIMARY KEY, guild_id VARCHAR(32), trigger_word VARCHAR(255), response_text TEXT)`);
        await client.db.execute(`CREATE TABLE IF NOT EXISTS economy (user_id VARCHAR(32), guild_id VARCHAR(32), money BIGINT DEFAULT 0, last_daily BIGINT DEFAULT 0, last_work BIGINT DEFAULT 0, PRIMARY KEY (user_id, guild_id))`);
        await client.db.execute(`CREATE TABLE IF NOT EXISTS action_counts (guild_id VARCHAR(32), user_from VARCHAR(32), user_to VARCHAR(32), action_type VARCHAR(50), count INT DEFAULT 0, PRIMARY KEY (guild_id, user_from, user_to, action_type))`);
        await client.db.execute(`CREATE TABLE IF NOT EXISTS birthdays (user_id VARCHAR(32), guild_id VARCHAR(32), day INT, month INT, PRIMARY KEY (user_id, guild_id))`);
        await client.db.execute(`CREATE TABLE IF NOT EXISTS timers (id INT AUTO_INCREMENT PRIMARY KEY, guild_id VARCHAR(32), channel_id VARCHAR(32), message TEXT, interval_minutes INT, last_sent BIGINT DEFAULT 0)`);

        // 2. NOUVEAU : Table Rôles-Réactions
        await client.db.execute(`
            CREATE TABLE IF NOT EXISTS reaction_roles (
                id INT AUTO_INCREMENT PRIMARY KEY,
                guild_id VARCHAR(32),
                channel_id VARCHAR(32),
                message_id VARCHAR(32),
                emoji VARCHAR(255),
                role_id VARCHAR(32)
            )
        `);

        // 3. Configuration Serveur (Modules)
        await client.db.execute(`
            CREATE TABLE IF NOT EXISTS guild_settings (
                guild_id VARCHAR(32) PRIMARY KEY, 
                
                module_welcome BOOLEAN DEFAULT TRUE,
                module_levels BOOLEAN DEFAULT TRUE,
                module_economy BOOLEAN DEFAULT TRUE,
                module_moderation BOOLEAN DEFAULT TRUE,
                module_security BOOLEAN DEFAULT FALSE,
                module_social BOOLEAN DEFAULT TRUE,
                module_customcmds BOOLEAN DEFAULT TRUE,
                module_timers BOOLEAN DEFAULT FALSE,
                module_tempvoice BOOLEAN DEFAULT FALSE,
                module_reactionroles BOOLEAN DEFAULT TRUE, -- NOUVEAU MODULE

                welcome_channel_id VARCHAR(32), 
                welcome_message VARCHAR(1000) DEFAULT "Bienvenue {user} ! 🌸", 
                welcome_bg VARCHAR(500) DEFAULT 'https://i.imgur.com/vH1W4Qc.jpeg', 
                welcome_color VARCHAR(10) DEFAULT '#ffffff',
                autorole_id VARCHAR(32) DEFAULT NULL,

                levels_enabled BOOLEAN DEFAULT TRUE,
                level_up_message VARCHAR(1000) DEFAULT "🎉 Bravo {user}, tu passes au Niveau {level} !",
                
                log_channel_id VARCHAR(32), 
                automod_enabled BOOLEAN DEFAULT FALSE,
                automod_words TEXT DEFAULT NULL,

                antiraid_enabled BOOLEAN DEFAULT FALSE, 
                antiraid_account_age_days INT DEFAULT 7,
                
                birthday_channel_id VARCHAR(32) DEFAULT NULL,
                
                tempvoice_channel_id VARCHAR(32) DEFAULT NULL,
                tempvoice_category_id VARCHAR(32) DEFAULT NULL
            )
        `);

        // Migration si besoin
        try { await client.db.execute(`ALTER TABLE guild_settings ADD COLUMN module_reactionroles BOOLEAN DEFAULT TRUE`); } catch(e) {}

        await client.login(process.env.DISCORD_TOKEN);
        
        const commandsData = [];
        client.commands.forEach(cmd => commandsData.push(cmd.data.toJSON()));
        const rest = new REST().setToken(process.env.DISCORD_TOKEN);
        await rest.put(Routes.applicationCommands(client.user.id), { body: commandsData });
        
        console.log(`✨ ${client.user.tag} est en ligne !`);

        // Lancement des systèmes automatiques (Timers, Anniversaires, Web)
        startSystems(client);
        require('./website/server')(client);

    } catch (error) { console.error('❌ Erreur :', error); }
})();

// Fonctions annexes pour alléger le code principal
function startSystems(client) {
    // 1. Timers
    setInterval(async () => {
        const [timers] = await client.db.query('SELECT * FROM timers');
        const now = Date.now();
        for (const timer of timers) {
            const [s] = await client.db.query('SELECT module_timers FROM guild_settings WHERE guild_id = ?', [timer.guild_id]);
            if (!s.length || !s[0].module_timers) continue;
            if (now - timer.last_sent >= timer.interval_minutes * 60000) {
                const guild = client.guilds.cache.get(timer.guild_id);
                if (guild) {
                    const ch = guild.channels.cache.get(timer.channel_id);
                    if (ch) { await ch.send(timer.message).catch(()=>{}); await client.db.query('UPDATE timers SET last_sent = ? WHERE id = ?', [now, timer.id]); }
                }
            }
        }
    }, 60000);

    // 2. Anniversaires
    let lastCheckDate = "";
    setInterval(async () => {
        const now = new Date();
        if (now.getHours() === 8 && now.getMinutes() === 0) {
            const todayStr = now.toDateString();
            if (lastCheckDate === todayStr) return;
            lastCheckDate = todayStr;
            const currentDay = now.getDate();
            const currentMonth = now.getMonth() + 1;
            const [birthdays] = await client.db.query('SELECT * FROM birthdays WHERE day = ? AND month = ?', [currentDay, currentMonth]);
            for (const b of birthdays) {
                const [s] = await client.db.query('SELECT module_social, birthday_channel_id FROM guild_settings WHERE guild_id = ?', [b.guild_id]);
                if (s.length && s[0].module_social && s[0].birthday_channel_id) {
                    const guild = client.guilds.cache.get(b.guild_id);
                    if (guild) {
                        const ch = guild.channels.cache.get(s[0].birthday_channel_id);
                        if (ch) ch.send(`🎉 Joyeux Anniversaire <@${b.user_id}> ! 🎂`);
                    }
                }
            }
        }
    }, 60000);
}

// Interactions & Anti-crash
client.on('interactionCreate', async i => { if (!i.isChatInputCommand()) return; });