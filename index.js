require('dotenv').config();
const fs = require('fs');
const path = require('path');
// Import des Partials : Crucial pour les Reaction Roles sur anciens messages
const { Client, Collection, GatewayIntentBits, REST, Routes, Partials, ActivityType, ChannelType, PermissionFlagsBits } = require('discord.js');
const mysql = require('mysql2/promise');

// --- CONFIGURATION ---
const BOT_COLOR = '#FFB6C1'; 

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildMembers,   
        GatewayIntentBits.GuildPresences, 
        GatewayIntentBits.GuildVoiceStates, // Indispensable pour Vocaux Temp
        GatewayIntentBits.GuildMessageReactions // Indispensable pour Reaction Roles
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

client.commands = new Collection();
client.color = BOT_COLOR;

// ============================================================
// 1. CHARGEMENT DYNAMIQUE (COMMANDES & EVENTS)
// ============================================================
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
                    if ('data' in command && 'execute' in command) {
                        client.commands.set(command.data.name, command);
                    }
                } catch (err) { console.error(`[CMD] Erreur ${file}:`, err); }
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

// ============================================================
// 2. CŒUR DU SYSTÈME (DB & LOGIQUE)
// ============================================================
(async () => {
    try {
        // --- A. Connexion Base de Données ---
        client.db = mysql.createPool({
            uri: process.env.MYSQL_URL,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
            enableKeepAlive: true,
            keepAliveInitialDelay: 0
        });

        await client.db.query('SELECT 1');
        console.log('💾 Base de données connectée.');

        // Heartbeat (Anti-Crash DB)
        setInterval(async () => { try { await client.db.query('SELECT 1'); } catch (err) {} }, 60000);

        // --- B. Infrastructure SQL (Tables) ---
        const tables = [
            `CREATE TABLE IF NOT EXISTS levels (user_id VARCHAR(32), guild_id VARCHAR(32), xp INT DEFAULT 0, level INT DEFAULT 0, PRIMARY KEY (user_id, guild_id))`,
            `CREATE TABLE IF NOT EXISTS level_rewards (guild_id VARCHAR(32), level INT, role_id VARCHAR(32), PRIMARY KEY (guild_id, level))`,
            `CREATE TABLE IF NOT EXISTS warnings (id INT AUTO_INCREMENT PRIMARY KEY, guild_id VARCHAR(32), user_id VARCHAR(32), moderator_id VARCHAR(32), reason TEXT, date TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
            `CREATE TABLE IF NOT EXISTS custom_commands (id INT AUTO_INCREMENT PRIMARY KEY, guild_id VARCHAR(32), trigger_word VARCHAR(255), response_text TEXT)`,
            `CREATE TABLE IF NOT EXISTS economy (user_id VARCHAR(32), guild_id VARCHAR(32), money BIGINT DEFAULT 0, last_daily BIGINT DEFAULT 0, last_work BIGINT DEFAULT 0, PRIMARY KEY (user_id, guild_id))`,
            `CREATE TABLE IF NOT EXISTS action_counts (guild_id VARCHAR(32), user_from VARCHAR(32), user_to VARCHAR(32), action_type VARCHAR(50), count INT DEFAULT 0, PRIMARY KEY (guild_id, user_from, user_to, action_type))`,
            `CREATE TABLE IF NOT EXISTS birthdays (user_id VARCHAR(32), guild_id VARCHAR(32), day INT, month INT, PRIMARY KEY (user_id, guild_id))`,
            `CREATE TABLE IF NOT EXISTS timers (id INT AUTO_INCREMENT PRIMARY KEY, guild_id VARCHAR(32), channel_id VARCHAR(32), message TEXT, interval_minutes INT, last_sent BIGINT DEFAULT 0)`,
            `CREATE TABLE IF NOT EXISTS reaction_roles (id INT AUTO_INCREMENT PRIMARY KEY, guild_id VARCHAR(32), channel_id VARCHAR(32), message_id VARCHAR(32), emoji VARCHAR(255), role_id VARCHAR(32))`,
            `CREATE TABLE IF NOT EXISTS guild_settings (guild_id VARCHAR(32) PRIMARY KEY)`
        ];

        for (const sql of tables) await client.db.execute(sql);

        // --- C. Auto-Réparation (Migrations) ---
        // Vérifie et ajoute TOUTES les colonnes nécessaires si elles manquent
        const requiredColumns = [
            // Modules ON/OFF
            "ADD COLUMN module_welcome BOOLEAN DEFAULT TRUE",
            "ADD COLUMN module_levels BOOLEAN DEFAULT TRUE",
            "ADD COLUMN module_economy BOOLEAN DEFAULT TRUE",
            "ADD COLUMN module_moderation BOOLEAN DEFAULT TRUE",
            "ADD COLUMN module_security BOOLEAN DEFAULT FALSE",
            "ADD COLUMN module_social BOOLEAN DEFAULT TRUE",
            "ADD COLUMN module_customcmds BOOLEAN DEFAULT TRUE",
            "ADD COLUMN module_timers BOOLEAN DEFAULT FALSE",
            "ADD COLUMN module_tempvoice BOOLEAN DEFAULT FALSE",
            "ADD COLUMN module_reactionroles BOOLEAN DEFAULT TRUE",
            
            // Configs
            "ADD COLUMN welcome_channel_id VARCHAR(32) DEFAULT NULL",
            "ADD COLUMN welcome_message VARCHAR(1000) DEFAULT 'Bienvenue {user} ! 🌸'",
            "ADD COLUMN welcome_bg VARCHAR(500) DEFAULT 'https://i.imgur.com/vH1W4Qc.jpeg'",
            "ADD COLUMN welcome_color VARCHAR(10) DEFAULT '#ffffff'",
            "ADD COLUMN autorole_id VARCHAR(32) DEFAULT NULL",
            "ADD COLUMN levels_enabled BOOLEAN DEFAULT TRUE",
            "ADD COLUMN level_up_message VARCHAR(1000) DEFAULT '🎉 Bravo {user}, tu passes au Niveau {level} !'",
            "ADD COLUMN log_channel_id VARCHAR(32) DEFAULT NULL",
            "ADD COLUMN automod_enabled BOOLEAN DEFAULT FALSE",
            "ADD COLUMN automod_words TEXT DEFAULT NULL",
            "ADD COLUMN antiraid_enabled BOOLEAN DEFAULT FALSE",
            "ADD COLUMN antiraid_account_age_days INT DEFAULT 7",
            "ADD COLUMN birthday_channel_id VARCHAR(32) DEFAULT NULL",
            "ADD COLUMN tempvoice_channel_id VARCHAR(32) DEFAULT NULL",
            "ADD COLUMN tempvoice_category_id VARCHAR(32) DEFAULT NULL"
        ];

        console.log("🔧 Vérification de la structure DB...");
        for (const colSql of requiredColumns) {
            try {
                await client.db.execute(`ALTER TABLE guild_settings ${colSql}`);
            } catch (e) {
                if (e.errno !== 1060) console.warn(`[DB Warning] ${e.message}`);
            }
        }
        console.log("✅ Structure DB validée.");

        // --- D. Connexion Discord ---
        await client.login(process.env.DISCORD_TOKEN);
        
        // Enregistrement Slash Commands
        const commandsData = [];
        client.commands.forEach(cmd => commandsData.push(cmd.data.toJSON()));
        const rest = new REST().setToken(process.env.DISCORD_TOKEN);
        await rest.put(Routes.applicationCommands(client.user.id), { body: commandsData });
        
        client.user.setActivity('le Dashboard', { type: ActivityType.Watching });
        console.log(`✨ ${client.user.tag} est en ligne !`);

        // --- E. Lancement Services & Web ---
        startBackgroundServices(client);
        require('./website/server')(client);

    } catch (error) {
        console.error('❌ ERREUR CRITIQUE :', error);
    }
})();

// ============================================================
// 3. LOGIQUE VOCAUX TEMPORAIRES (Join to Create)
// ============================================================
client.on('voiceStateUpdate', async (oldState, newState) => {
    try {
        const guild = newState.guild || oldState.guild;
        if (!guild) return;

        // Récupérer la config du serveur
        const [settings] = await client.db.query('SELECT module_tempvoice, tempvoice_channel_id, tempvoice_category_id FROM guild_settings WHERE guild_id = ?', [guild.id]);
        if (!settings.length || !settings[0].module_tempvoice) return;
        const conf = settings[0];

        // 1. CRÉATION : Si l'utilisateur rejoint le salon "Créateur"
        if (newState.channelId === conf.tempvoice_channel_id) {
            const parent = conf.tempvoice_category_id;
            const channel = await guild.channels.create({
                name: `Salon de ${newState.member.user.username}`,
                type: ChannelType.GuildVoice,
                parent: parent,
                permissionOverwrites: [
                    { id: newState.member.id, allow: [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.MoveMembers] }
                ]
            });
            await newState.setChannel(channel);
        }

        // 2. SUPPRESSION : Si l'utilisateur quitte un salon vide (et que ce n'est pas le salon créateur)
        if (oldState.channelId && oldState.channelId !== conf.tempvoice_channel_id) {
            const channel = oldState.channel;
            // Vérifier si le salon est dans la bonne catégorie (pour ne pas supprimer d'autres salons)
            if (channel && channel.members.size === 0 && channel.parentId === conf.tempvoice_category_id) {
                await channel.delete().catch(() => {});
            }
        }
    } catch (e) {
        console.error("Erreur TempVoice:", e);
    }
});

// ============================================================
// 4. SERVICES DE FOND (Timers & Annivs)
// ============================================================
function startBackgroundServices(client) {
    
    // Service Timers
    setInterval(async () => {
        try {
            const [timers] = await client.db.query('SELECT * FROM timers');
            const now = Date.now();
            
            for (const timer of timers) {
                const [s] = await client.db.query('SELECT module_timers FROM guild_settings WHERE guild_id = ?', [timer.guild_id]);
                if (!s.length || !s[0].module_timers) continue;

                if (now - timer.last_sent >= timer.interval_minutes * 60000) {
                    const guild = client.guilds.cache.get(timer.guild_id);
                    if (guild) {
                        const channel = guild.channels.cache.get(timer.channel_id);
                        if (channel) {
                            await channel.send(timer.message).catch(() => {});
                            await client.db.query('UPDATE timers SET last_sent = ? WHERE id = ?', [now, timer.id]);
                        }
                    }
                }
            }
        } catch (e) {}
    }, 60000);

    // Service Anniversaires
    let lastCheckDate = "";
    setInterval(async () => {
        try {
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
                            const channel = guild.channels.cache.get(s[0].birthday_channel_id);
                            if (channel) channel.send(`🎉 **Joyeux Anniversaire** <@${b.user_id}> ! 🎂`);
                        }
                    }
                }
            }
        } catch (e) {}
    }, 60000);
}

// Handler Interactions
client.on('interactionCreate', async i => { if (!i.isChatInputCommand()) return; });