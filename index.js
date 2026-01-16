require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, Collection, GatewayIntentBits, REST, Routes, Partials, ActivityType, ChannelType, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const mysql = require('mysql2/promise');
const generateWelcomeImage = require('./welcome'); 

const BOT_COLOR = '#FFB6C1'; 

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

// ============================================================
// 1. CHARGEMENT DES COMMANDES
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
                    if ('data' in command && 'execute' in command) client.commands.set(command.data.name, command); 
                } catch (err) { console.error(`[CMD] Erreur chargement ${file}:`, err); }
            }
        }
    }
}

// ============================================================
// 2. INITIALISATION BASE DE DONNÉES & BOT
// ============================================================
(async () => {
    try {
        // Connexion DB
        client.db = mysql.createPool({ uri: process.env.MYSQL_URL, waitForConnections: true, connectionLimit: 10, queueLimit: 0, enableKeepAlive: true, keepAliveInitialDelay: 0 });
        await client.db.query('SELECT 1');
        console.log('💾 Base de données connectée.');

        // Création Tables
        const tables = [
            `CREATE TABLE IF NOT EXISTS guild_settings (guild_id VARCHAR(32) PRIMARY KEY)`,
            `CREATE TABLE IF NOT EXISTS levels (user_id VARCHAR(32), guild_id VARCHAR(32), xp INT DEFAULT 0, level INT DEFAULT 0, PRIMARY KEY (user_id, guild_id))`,
            `CREATE TABLE IF NOT EXISTS level_rewards (guild_id VARCHAR(32), level INT, role_id VARCHAR(32), PRIMARY KEY (guild_id, level))`,
            `CREATE TABLE IF NOT EXISTS warnings (id INT AUTO_INCREMENT PRIMARY KEY, guild_id VARCHAR(32), user_id VARCHAR(32), moderator_id VARCHAR(32), reason TEXT, date TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
            `CREATE TABLE IF NOT EXISTS custom_commands (id INT AUTO_INCREMENT PRIMARY KEY, guild_id VARCHAR(32), trigger_word VARCHAR(255), response_text TEXT)`,
            `CREATE TABLE IF NOT EXISTS economy (user_id VARCHAR(32), guild_id VARCHAR(32), money BIGINT DEFAULT 0, last_daily BIGINT DEFAULT 0, last_work BIGINT DEFAULT 0, PRIMARY KEY (user_id, guild_id))`,
            `CREATE TABLE IF NOT EXISTS birthdays (user_id VARCHAR(32), guild_id VARCHAR(32), day INT, month INT, PRIMARY KEY (user_id, guild_id))`,
            `CREATE TABLE IF NOT EXISTS timers (id INT AUTO_INCREMENT PRIMARY KEY, guild_id VARCHAR(32), channel_id VARCHAR(32), role_id VARCHAR(32), message TEXT, interval_minutes INT, last_sent BIGINT DEFAULT 0)`,
            `CREATE TABLE IF NOT EXISTS reaction_roles (id INT AUTO_INCREMENT PRIMARY KEY, guild_id VARCHAR(32), channel_id VARCHAR(32), message_id VARCHAR(32), emoji VARCHAR(255), role_id VARCHAR(32))`,
            `CREATE TABLE IF NOT EXISTS bot_activities (id INT AUTO_INCREMENT PRIMARY KEY, type INT, name VARCHAR(255))`,
            `CREATE TABLE IF NOT EXISTS bot_settings (setting_key VARCHAR(50) PRIMARY KEY, setting_value VARCHAR(255))`
        ];
        for (const sql of tables) await client.db.execute(sql);

        // Mises à jour Colonnes (Migrations)
        const requiredColumns = [
            "ADD COLUMN module_welcome BOOLEAN DEFAULT TRUE", "ADD COLUMN module_levels BOOLEAN DEFAULT TRUE", "ADD COLUMN module_economy BOOLEAN DEFAULT TRUE",
            "ADD COLUMN module_moderation BOOLEAN DEFAULT TRUE", "ADD COLUMN module_social BOOLEAN DEFAULT TRUE", "ADD COLUMN module_customcmds BOOLEAN DEFAULT TRUE",
            "ADD COLUMN module_timers BOOLEAN DEFAULT FALSE", "ADD COLUMN module_tempvoice BOOLEAN DEFAULT FALSE", "ADD COLUMN module_reactionroles BOOLEAN DEFAULT TRUE",
            "ADD COLUMN welcome_channel_id VARCHAR(32) DEFAULT NULL", 
            "ADD COLUMN welcome_message VARCHAR(1000) DEFAULT 'Bienvenue {user} ! 🌸'", 
            "ADD COLUMN welcome_bg VARCHAR(500) DEFAULT 'https://i.imgur.com/vH1W4Qc.jpeg'", 
            "ADD COLUMN welcome_title VARCHAR(50) DEFAULT 'BIENVENUE'",
            "ADD COLUMN welcome_title_color VARCHAR(10) DEFAULT '#ffffff'",
            "ADD COLUMN welcome_user_color VARCHAR(10) DEFAULT '#ffffff'",
            "ADD COLUMN welcome_border_color VARCHAR(10) DEFAULT '#ffffff'",
            "ADD COLUMN welcome_opacity DECIMAL(2,1) DEFAULT 0.3",
            "ADD COLUMN welcome_shape VARCHAR(10) DEFAULT 'circle'",
            "ADD COLUMN autorole_id VARCHAR(32) DEFAULT NULL", 
            "ADD COLUMN levels_enabled BOOLEAN DEFAULT TRUE",
            "ADD COLUMN level_up_message VARCHAR(1000) DEFAULT '🎉 Bravo {user}, tu passes au Niveau {level} !'", "ADD COLUMN log_channel_id VARCHAR(32) DEFAULT NULL",
            "ADD COLUMN automod_enabled BOOLEAN DEFAULT FALSE", "ADD COLUMN automod_words TEXT DEFAULT NULL", "ADD COLUMN birthday_channel_id VARCHAR(32) DEFAULT NULL",
            "ADD COLUMN tempvoice_channel_id VARCHAR(32) DEFAULT NULL", "ADD COLUMN tempvoice_category_id VARCHAR(32) DEFAULT NULL"
        ];
        for (const colSql of requiredColumns) { try { await client.db.execute(`ALTER TABLE guild_settings ${colSql}`); } catch (e) { if (e.errno !== 1060) {} } }
        
        // Login Discord
        await client.login(process.env.DISCORD_TOKEN);
        
        // SYNCHRONISATION SERVEURS (Évite l'erreur "Non Configuré")
        console.log("🔄 Vérification des serveurs...");
        client.guilds.cache.forEach(async guild => {
            await client.db.query("INSERT IGNORE INTO guild_settings (guild_id) VALUES (?)", [guild.id]);
        });
        
        // Enregistrement Commandes Slash
        const commandsData = [];
        client.commands.forEach(cmd => commandsData.push(cmd.data.toJSON()));
        const rest = new REST().setToken(process.env.DISCORD_TOKEN);
        await rest.put(Routes.applicationCommands(client.user.id), { body: commandsData });
        
        console.log(`✨ ${client.user.tag} est en ligne !`);
        
        // Lancement Dashboard & Services
        require('./website/server')(client);
        startBackgroundServices(client);
        startStatusRotation(client);

    } catch (error) { console.error('❌ ERREUR CRITIQUE :', error); }
})();

// ============================================================
// 3. GESTION DES EVENTS
// ============================================================

// Interaction (Commandes)
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    try { await command.execute(interaction); } 
    catch (error) { 
        console.error(error); 
        if(!interaction.replied && !interaction.deferred) interaction.reply({content:'Erreur exécution commande.', ephemeral:true});
        else interaction.followUp({content:'Erreur exécution commande.', ephemeral:true});
    }
});

// Nouveau Serveur Rejoint
client.on('guildCreate', async guild => {
    await client.db.query("INSERT IGNORE INTO guild_settings (guild_id) VALUES (?)", [guild.id]);
    console.log(`➕ Nouveau serveur : ${guild.name}`);
});

// ARRIVÉE D'UN MEMBRE (WELCOME SÉCURISÉ)
client.on('guildMemberAdd', async member => {
    // 1. Config
    let conf;
    try {
        const [settings] = await client.db.query('SELECT * FROM guild_settings WHERE guild_id = ?', [member.guild.id]);
        if (!settings.length || !settings[0].module_welcome || !settings[0].welcome_channel_id) return;
        conf = settings[0];
    } catch (e) { return console.error("Erreur DB Welcome:", e); }

    const channel = member.guild.channels.cache.get(conf.welcome_channel_id);
    if (!channel) return;

    // 2. Texte
    let messageText = (conf.welcome_message || 'Bienvenue {user} !')
        .replace('{user}', `<@${member.id}>`)
        .replace('{server}', member.guild.name)
        .replace('{count}', member.guild.memberCount);

    // 3. Image (Try/Catch isolé)
    let attachment = null;
    try {
        const buffer = await generateWelcomeImage(member, conf);
        attachment = new AttachmentBuilder(buffer, { name: 'welcome.png' });
    } catch (error) {
        console.error("❌ Erreur Génération Image (Le texte sera envoyé sans image) :", error.message);
    }

    // 4. Envoi
    try {
        const payload = { content: messageText };
        if (attachment) payload.files = [attachment];
        await channel.send(payload);
    } catch (e) { console.error("❌ Erreur Envoi Message:", e.message); }

    // 5. Auto-Rôle (Try/Catch isolé)
    if (conf.autorole_id) {
        try {
            const role = member.guild.roles.cache.get(conf.autorole_id);
            const botRole = member.guild.members.me.roles.highest;

            if (role) {
                if (role.position >= botRole.position) {
                    console.error(`⚠️ ÉCHEC AUTOROLE : Le rôle '${role.name}' est placé au-dessus du rôle du bot !`);
                } else {
                    await member.roles.add(role);
                    console.log(`✅ AutoRole '${role.name}' donné à ${member.user.tag}`);
                }
            }
        } catch (e) { console.error("❌ Erreur AutoRole:", e.message); }
    }
});

// Vocaux Temporaires
client.on('voiceStateUpdate', async (oldState, newState) => {
    const guild = newState.guild || oldState.guild; if (!guild) return;
    try {
        const [s] = await client.db.query('SELECT module_tempvoice, tempvoice_channel_id, tempvoice_category_id FROM guild_settings WHERE guild_id = ?', [guild.id]);
        if (!s.length || !s[0].module_tempvoice) return;
        const conf = s[0];

        // Création
        if (newState.channelId === conf.tempvoice_channel_id) {
            const channel = await guild.channels.create({
                name: `Salon de ${newState.member.displayName}`, type: ChannelType.GuildVoice, parent: conf.tempvoice_category_id,
                permissionOverwrites: [{ id: newState.member.id, allow: [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.MoveMembers] }]
            });
            await newState.setChannel(channel);
        }
        // Suppression
        if (oldState.channelId && oldState.channel && oldState.channel.members.size === 0 && oldState.channel.parentId === conf.tempvoice_category_id && oldState.channelId !== conf.tempvoice_channel_id) {
            await oldState.channel.delete().catch(() => {});
        }
    } catch (e) {}
});

// ============================================================
// 4. SERVICES
// ============================================================
function startStatusRotation(client) {
    const rotate = async () => {
        try {
            const [acts] = await client.db.query('SELECT * FROM bot_activities');
            const [sets] = await client.db.query("SELECT setting_value FROM bot_settings WHERE setting_key = 'presence_interval'");
            let interval = sets.length ? parseInt(sets[0].setting_value) : 10;
            if (acts.length > 0) {
                const act = acts[Math.floor(Date.now() / (interval * 1000)) % acts.length];
                client.user.setActivity(act.name, { type: act.type });
            } else {
                client.user.setActivity('le Dashboard 🌸', { type: ActivityType.Watching });
            }
            setTimeout(rotate, interval * 1000);
        } catch (e) { setTimeout(rotate, 10000); }
    };
    rotate();
}

function startBackgroundServices(client) {
    setInterval(async () => {
        try {
            const [timers] = await client.db.query('SELECT * FROM timers');
            const now = Date.now();
            for (const t of timers) {
                if (now - t.last_sent >= t.interval_minutes * 60000) {
                    const ch = client.channels.cache.get(t.channel_id);
                    if (ch) {
                        await ch.send(`${t.role_id ? `<@&${t.role_id}> ` : ''}${t.message}`);
                        await client.db.query('UPDATE timers SET last_sent = ? WHERE id = ?', [now, t.id]);
                    }
                }
            }
        } catch (e) {}
    }, 60000);
}

const cleanExit = () => { console.log('🛑 Arrêt...'); client.destroy(); client.db.end(); process.exit(0); };
process.on('SIGTERM', cleanExit); process.on('SIGINT', cleanExit);