require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, Collection, GatewayIntentBits, REST, Routes, Partials, ActivityType, ChannelType, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const mysql = require('mysql2/promise');
const generateWelcomeImage = require('./welcome'); 

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences, 
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessageReactions
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

client.commands = new Collection();

// 1. CHARGEMENT COMMANDES
const foldersPath = path.join(__dirname, 'commands');
if (fs.existsSync(foldersPath)) {
    const commandFolders = fs.readdirSync(foldersPath);
    for (const folder of commandFolders) {
        const commandsPath = path.join(foldersPath, folder);
        if (fs.lstatSync(commandsPath).isDirectory()) {
            const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
            for (const file of commandFiles) {
                const filePath = path.join(commandsPath, file);
                try { 
                    const command = require(filePath); 
                    if ('data' in command && 'execute' in command) client.commands.set(command.data.name, command); 
                } catch (err) { console.error(`[CMD] Erreur ${file}:`, err); }
            }
        }
    }
}

// 2. INITIALISATION DB & BOT
(async () => {
    try {
        client.db = mysql.createPool({ uri: process.env.MYSQL_URL, waitForConnections: true, connectionLimit: 10, queueLimit: 0, enableKeepAlive: true, keepAliveInitialDelay: 0 });
        await client.db.query('SELECT 1');
        console.log('💾 Base de données connectée.');

        // Tables de base
        const tables = [
            `CREATE TABLE IF NOT EXISTS guild_settings (guild_id VARCHAR(32) PRIMARY KEY)`,
            `CREATE TABLE IF NOT EXISTS levels (user_id VARCHAR(32), guild_id VARCHAR(32), xp INT DEFAULT 0, level INT DEFAULT 0, PRIMARY KEY (user_id, guild_id))`,
            `CREATE TABLE IF NOT EXISTS level_rewards (guild_id VARCHAR(32), level INT, role_id VARCHAR(32), PRIMARY KEY (guild_id, level))`,
            `CREATE TABLE IF NOT EXISTS warnings (id INT AUTO_INCREMENT PRIMARY KEY, guild_id VARCHAR(32), user_id VARCHAR(32), moderator_id VARCHAR(32), reason TEXT, date TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
            `CREATE TABLE IF NOT EXISTS custom_commands (id INT AUTO_INCREMENT PRIMARY KEY, guild_id VARCHAR(32), trigger_word VARCHAR(255), response_text TEXT)`,
            `CREATE TABLE IF NOT EXISTS economy (user_id VARCHAR(32), guild_id VARCHAR(32), money BIGINT DEFAULT 0, last_daily BIGINT DEFAULT 0, last_work BIGINT DEFAULT 0, PRIMARY KEY (user_id, guild_id))`,
            `CREATE TABLE IF NOT EXISTS timers (id INT AUTO_INCREMENT PRIMARY KEY, guild_id VARCHAR(32), channel_id VARCHAR(32), role_id VARCHAR(32), message TEXT, interval_minutes INT, last_sent BIGINT DEFAULT 0)`,
            `CREATE TABLE IF NOT EXISTS reaction_roles (id INT AUTO_INCREMENT PRIMARY KEY, guild_id VARCHAR(32), channel_id VARCHAR(32), message_id VARCHAR(32), emoji VARCHAR(255), role_id VARCHAR(32))`,
            `CREATE TABLE IF NOT EXISTS bot_activities (id INT AUTO_INCREMENT PRIMARY KEY, type INT, name VARCHAR(255))`,
            `CREATE TABLE IF NOT EXISTS bot_settings (setting_key VARCHAR(50) PRIMARY KEY, setting_value VARCHAR(255))`
        ];
        for (const sql of tables) await client.db.execute(sql);

        // --- MIGRATION MASSIVE : AJOUT DES COLONNES DE CONFIGURATION ---
        const requiredColumns = [
            // Modules
            "ADD COLUMN module_welcome BOOLEAN DEFAULT TRUE", "ADD COLUMN module_levels BOOLEAN DEFAULT TRUE", "ADD COLUMN module_economy BOOLEAN DEFAULT TRUE",
            "ADD COLUMN module_moderation BOOLEAN DEFAULT TRUE", "ADD COLUMN module_social BOOLEAN DEFAULT TRUE", "ADD COLUMN module_customcmds BOOLEAN DEFAULT TRUE",
            "ADD COLUMN module_timers BOOLEAN DEFAULT FALSE", "ADD COLUMN module_tempvoice BOOLEAN DEFAULT FALSE", "ADD COLUMN module_reactionroles BOOLEAN DEFAULT TRUE",
            
            // Welcome Basic
            "ADD COLUMN welcome_channel_id VARCHAR(32) DEFAULT NULL", 
            "ADD COLUMN welcome_message VARCHAR(1000) DEFAULT 'Bienvenue {user} ! 🌸'", 
            "ADD COLUMN welcome_bg VARCHAR(500) DEFAULT NULL", // NULL = Utilise image locale par défaut
            "ADD COLUMN autorole_id VARCHAR(32) DEFAULT NULL", 
            
            // Welcome AVANCÉ (Positions & Tailles)
            "ADD COLUMN welcome_opacity DECIMAL(2,1) DEFAULT 0.5",
            "ADD COLUMN welcome_align VARCHAR(10) DEFAULT 'left'", // left, center, right
            
            // Titre
            "ADD COLUMN welcome_title VARCHAR(50) DEFAULT 'BIENVENUE'",
            "ADD COLUMN welcome_title_color VARCHAR(10) DEFAULT '#ffffff'",
            "ADD COLUMN welcome_title_size INT DEFAULT 50",
            "ADD COLUMN welcome_title_x INT DEFAULT 230",
            "ADD COLUMN welcome_title_y INT DEFAULT 110",

            // Pseudo
            "ADD COLUMN welcome_user_color VARCHAR(10) DEFAULT '#ffffff'",
            "ADD COLUMN welcome_user_size INT DEFAULT 32",
            "ADD COLUMN welcome_user_x INT DEFAULT 230",
            "ADD COLUMN welcome_user_y INT DEFAULT 175",

            // Avatar
            "ADD COLUMN welcome_avatar_x INT DEFAULT 45",
            "ADD COLUMN welcome_avatar_y INT DEFAULT 45",
            "ADD COLUMN welcome_avatar_size INT DEFAULT 160",
            "ADD COLUMN welcome_shape VARCHAR(10) DEFAULT 'circle'",
            "ADD COLUMN welcome_border_color VARCHAR(10) DEFAULT '#ffffff'",
            
            // Autres modules
            "ADD COLUMN levels_enabled BOOLEAN DEFAULT TRUE", "ADD COLUMN level_up_message VARCHAR(1000) DEFAULT '🎉 Bravo {user}, tu passes au Niveau {level} !'", 
            "ADD COLUMN log_channel_id VARCHAR(32) DEFAULT NULL", "ADD COLUMN automod_enabled BOOLEAN DEFAULT FALSE", "ADD COLUMN automod_words TEXT DEFAULT NULL", 
            "ADD COLUMN tempvoice_channel_id VARCHAR(32) DEFAULT NULL", "ADD COLUMN tempvoice_category_id VARCHAR(32) DEFAULT NULL"
        ];
        
        for (const colSql of requiredColumns) { try { await client.db.execute(`ALTER TABLE guild_settings ${colSql}`); } catch (e) { if (e.errno !== 1060) {} } }
        
        await client.login(process.env.DISCORD_TOKEN);
        
        // Sync Serveurs
        client.guilds.cache.forEach(async guild => { await client.db.query("INSERT IGNORE INTO guild_settings (guild_id) VALUES (?)", [guild.id]); });
        
        // Slash Commands
        const commandsData = [];
        client.commands.forEach(cmd => commandsData.push(cmd.data.toJSON()));
        const rest = new REST().setToken(process.env.DISCORD_TOKEN);
        await rest.put(Routes.applicationCommands(client.user.id), { body: commandsData });
        
        console.log(`✨ ${client.user.tag} est en ligne (Système Avancé) !`);
        
        require('./website/server')(client);
        startBackgroundServices(client);
        startStatusRotation(client);

    } catch (error) { console.error('❌ ERREUR :', error); }
})();

// ... (Reste des Events : interactionCreate, guildMemberAdd, voiceStateUpdate, Services) ...
// NOTE : Garde tes events actuels ici, je ne les ai pas changés pour gagner de la place, 
// mais assure-toi de garder le bloc 'guildMemberAdd' sécurisé qu'on a fait avant.

// --- FIN DU FICHIER (Copie tes events ici) ---
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    try { await command.execute(interaction); } 
    catch (error) { if(!interaction.replied) interaction.reply({content:'Erreur!', ephemeral:true}); }
});

client.on('guildMemberAdd', async member => {
    let conf;
    try {
        const [settings] = await client.db.query('SELECT * FROM guild_settings WHERE guild_id = ?', [member.guild.id]);
        if (!settings.length || !settings[0].module_welcome || !settings[0].welcome_channel_id) return;
        conf = settings[0];
    } catch (e) { return console.error("Erreur DB:", e); }

    const channel = member.guild.channels.cache.get(conf.welcome_channel_id);
    if (!channel) return;

    let messageText = (conf.welcome_message || 'Bienvenue {user} !').replace('{user}', `<@${member.id}>`).replace('{server}', member.guild.name).replace('{count}', member.guild.memberCount);
    
    let attachment = null;
    try {
        const buffer = await generateWelcomeImage(member, conf);
        attachment = new AttachmentBuilder(buffer, { name: 'welcome.png' });
    } catch (error) { console.error("Erreur Image:", error.message); }

    try {
        const payload = { content: messageText };
        if (attachment) payload.files = [attachment];
        await channel.send(payload);
    } catch (e) { console.error("Erreur Envoi:", e.message); }

    if (conf.autorole_id) {
        try {
            const role = member.guild.roles.cache.get(conf.autorole_id);
            if (role) await member.roles.add(role);
        } catch (e) {}
    }
});

client.on('voiceStateUpdate', async (oldState, newState) => { /* Ton code vocal temp */ });

function startStatusRotation(client) { /* Ton code status */ }
function startBackgroundServices(client) { /* Ton code timer */ }