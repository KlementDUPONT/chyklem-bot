require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, Collection, GatewayIntentBits, REST, Routes, EmbedBuilder } = require('discord.js');
const mysql = require('mysql2/promise');

const BOT_COLOR = '#FFB6C1'; 
const PORT = process.env.PORT || 3000;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildVoiceStates
    ]
});

client.commands = new Collection();
client.color = BOT_COLOR;

// --- 1. CHARGEMENT COMMANDES ---
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

// --- 2. CHARGEMENT ÉVÉNEMENTS ---
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

// --- 3. DÉMARRAGE & DB ---
(async () => {
    try {
        client.db = mysql.createPool({
            uri: process.env.MYSQL_URL,
            waitForConnections: true, connectionLimit: 5, queueLimit: 0, enableKeepAlive: true, keepAliveInitialDelay: 0
        });

        await client.db.query('SELECT 1');
        console.log('💾 Base de données connectée !');

        setInterval(async () => { try { await client.db.query('SELECT 1'); } catch (err) {} }, 60000);

        // --- TABLES SQL (Toutes les clés IDs en VARCHAR(32)) ---
        
        await client.db.execute(`CREATE TABLE IF NOT EXISTS levels (user_id VARCHAR(32), guild_id VARCHAR(32), xp INT DEFAULT 0, level INT DEFAULT 0, PRIMARY KEY (user_id, guild_id))`);
        await client.db.execute(`CREATE TABLE IF NOT EXISTS level_rewards (guild_id VARCHAR(32), level INT, role_id VARCHAR(32), PRIMARY KEY (guild_id, level))`);
        await client.db.execute(`CREATE TABLE IF NOT EXISTS warnings (id INT AUTO_INCREMENT PRIMARY KEY, guild_id VARCHAR(32), user_id VARCHAR(32), moderator_id VARCHAR(32), reason TEXT, date TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
        await client.db.execute(`CREATE TABLE IF NOT EXISTS custom_commands (id INT AUTO_INCREMENT PRIMARY KEY, guild_id VARCHAR(32), trigger_word VARCHAR(255), response_text TEXT)`);
        await client.db.execute(`CREATE TABLE IF NOT EXISTS economy (user_id VARCHAR(32), guild_id VARCHAR(32), money BIGINT DEFAULT 0, last_daily BIGINT DEFAULT 0, last_work BIGINT DEFAULT 0, PRIMARY KEY (user_id, guild_id))`);
        await client.db.execute(`CREATE TABLE IF NOT EXISTS action_counts (guild_id VARCHAR(32), user_from VARCHAR(32), user_to VARCHAR(32), action_type VARCHAR(50), count INT DEFAULT 0, PRIMARY KEY (guild_id, user_from, user_to, action_type))`);

        // NOUVEAU : Table Anniversaires
        await client.db.execute(`
            CREATE TABLE IF NOT EXISTS birthdays (
                user_id VARCHAR(32), 
                guild_id VARCHAR(32), 
                day INT, 
                month INT, 
                PRIMARY KEY (user_id, guild_id)
            )
        `);

        // Settings (Mise à jour pour inclure birthday_channel_id)
        await client.db.execute(`
            CREATE TABLE IF NOT EXISTS guild_settings (
                guild_id VARCHAR(32) PRIMARY KEY, 
                antiraid_enabled BOOLEAN DEFAULT FALSE, 
                antiraid_account_age_days INT DEFAULT 7, 
                log_channel_id VARCHAR(32), 
                automod_enabled BOOLEAN DEFAULT FALSE,
                automod_words TEXT DEFAULT NULL,
                welcome_channel_id VARCHAR(32), 
                welcome_message VARCHAR(1000) DEFAULT "Bienvenue {user} ! 🌸", 
                welcome_bg VARCHAR(500) DEFAULT 'https://i.imgur.com/vH1W4Qc.jpeg',
                welcome_color VARCHAR(10) DEFAULT '#ffffff',
                autorole_id VARCHAR(32) DEFAULT NULL,
                levels_enabled BOOLEAN DEFAULT TRUE,
                level_up_message VARCHAR(1000) DEFAULT "🎉 Bravo {user}, tu passes au Niveau {level} !",
                birthday_channel_id VARCHAR(32) DEFAULT NULL
            )
        `);

        // Migrations
        const migrations = [
            "ALTER TABLE guild_settings ADD COLUMN welcome_bg VARCHAR(500) DEFAULT 'https://i.imgur.com/vH1W4Qc.jpeg'",
            "ALTER TABLE guild_settings ADD COLUMN welcome_color VARCHAR(10) DEFAULT '#ffffff'",
            "ALTER TABLE guild_settings ADD COLUMN levels_enabled BOOLEAN DEFAULT TRUE",
            "ALTER TABLE guild_settings ADD COLUMN level_up_message VARCHAR(1000) DEFAULT '🎉 Bravo {user}, tu passes au Niveau {level} !'",
            "ALTER TABLE guild_settings ADD COLUMN automod_enabled BOOLEAN DEFAULT FALSE",
            "ALTER TABLE guild_settings ADD COLUMN automod_words TEXT DEFAULT NULL",
            "ALTER TABLE guild_settings ADD COLUMN birthday_channel_id VARCHAR(32) DEFAULT NULL"
        ];
        for (const sql of migrations) { try { await client.db.execute(sql); } catch(e) {} }

        await client.login(process.env.DISCORD_TOKEN);
        
        const commandsData = [];
        client.commands.forEach(cmd => commandsData.push(cmd.data.toJSON()));
        const rest = new REST().setToken(process.env.DISCORD_TOKEN);
        await rest.put(Routes.applicationCommands(client.user.id), { body: commandsData });
        
        console.log(`✨ ${client.user.tag} est en ligne !`);

        // --- SYSTÈME D'ANNIVERSAIRE AUTOMATIQUE ---
        // Vérifie toutes les minutes s'il est 08:00
        let lastCheckDate = ""; // Pour ne pas spammer si la boucle tourne plusieurs fois à 08:00

        setInterval(async () => {
            const now = new Date();
            // On vérifie s'il est 08h00 (Heure du serveur)
            // Tu peux changer l'heure ici (ex: now.getHours() === 8)
            if (now.getHours() === 8 && now.getMinutes() === 0) {
                
                const todayStr = now.toDateString();
                if (lastCheckDate === todayStr) return; // Déjà fait aujourd'hui
                lastCheckDate = todayStr;

                console.log("🎂 Vérification des anniversaires...");
                const currentDay = now.getDate();
                const currentMonth = now.getMonth() + 1; // Janvier = 0 en JS, donc +1

                // On cherche qui fête son anniv aujourd'hui
                const [birthdays] = await client.db.query(
                    'SELECT * FROM birthdays WHERE day = ? AND month = ?', 
                    [currentDay, currentMonth]
                );

                for (const b of birthdays) {
                    const guild = client.guilds.cache.get(b.guild_id);
                    if (!guild) continue;

                    // On cherche le salon configuré
                    const [settings] = await client.db.query(
                        'SELECT birthday_channel_id FROM guild_settings WHERE guild_id = ?', 
                        [b.guild_id]
                    );

                    // Si pas de salon configuré, on ne fait rien (ou on envoie dans le systemChannel)
                    if (!settings.length || !settings[0].birthday_channel_id) continue;

                    const channel = guild.channels.cache.get(settings[0].birthday_channel_id);
                    if (channel) {
                        const embed = new EmbedBuilder()
                            .setColor('#FFD700')
                            .setTitle('🎉 JOYEUX ANNIVERSAIRE ! 🎂')
                            .setDescription(`Aujourd'hui, c'est l'anniversaire de <@${b.user_id}> !\nSouhaitez-lui une merveilleuse journée ! 🎈`)
                            .setThumbnail('https://cdn-icons-png.flaticon.com/512/2488/2488980.png');
                        
                        channel.send({ content: `<@${b.user_id}>`, embeds: [embed] }).catch(()=>{});
                    }
                }
            }
        }, 60000); // Check toutes les 60 secondes

        require('./website/server')(client);

    } catch (error) {
        console.error('❌ Erreur Critique au démarrage :', error);
    }
})();

client.on('interactionCreate', async i => { if (!i.isChatInputCommand()) return; });