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
                if ('data' in command && 'execute' in command) {
                    client.commands.set(command.data.name, command);
                }
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

// --- 3. DÉMARRAGE ET BASE DE DONNÉES ---
(async () => {
    try {
        client.db = mysql.createPool({
            uri: process.env.MYSQL_URL,
            waitForConnections: true,
            connectionLimit: 5,
            queueLimit: 0,
            enableKeepAlive: true,
            keepAliveInitialDelay: 0
        });

        await client.db.query('SELECT 1');
        console.log('💾 Base de données connectée !');

        // Heartbeat Anti-Crash DB
        setInterval(async () => {
            try { await client.db.query('SELECT 1'); } catch (err) { console.error('⚠️ Heartbeat DB retry...'); }
        }, 60000);

        // --- CRÉATION / MISE À JOUR DES TABLES ---
        
        // Table XP
        await client.db.execute(`CREATE TABLE IF NOT EXISTS levels (user_id VARCHAR(255), guild_id VARCHAR(255), xp INT DEFAULT 0, level INT DEFAULT 0, PRIMARY KEY (user_id, guild_id))`);
        
        // Table Settings (Avec les nouvelles colonnes Design)
        await client.db.execute(`
            CREATE TABLE IF NOT EXISTS guild_settings (
                guild_id VARCHAR(255) PRIMARY KEY, 
                antiraid_enabled BOOLEAN DEFAULT FALSE, 
                antiraid_account_age_days INT DEFAULT 7, 
                log_channel_id VARCHAR(255), 
                welcome_channel_id VARCHAR(255), 
                welcome_message VARCHAR(1000) DEFAULT "Bienvenue {user} ! 🌸", 
                welcome_bg VARCHAR(500) DEFAULT 'https://i.imgur.com/vH1W4Qc.jpeg',
                welcome_color VARCHAR(10) DEFAULT '#ffffff',
                autorole_id VARCHAR(255) DEFAULT NULL
            )
        `);

        // MIGRATION AUTOMATIQUE (Pour mettre à jour ta DB existante sans perte)
        // Si ces colonnes existent déjà, l'erreur est ignorée par le catch
        try { await client.db.execute("ALTER TABLE guild_settings ADD COLUMN welcome_bg VARCHAR(500) DEFAULT 'https://i.imgur.com/vH1W4Qc.jpeg'"); } catch(e){}
        try { await client.db.execute("ALTER TABLE guild_settings ADD COLUMN welcome_color VARCHAR(10) DEFAULT '#ffffff'"); } catch(e){}

        // Connexion Discord
        await client.login(process.env.DISCORD_TOKEN);
        
        // Enregistrement Commandes
        const commandsData = [];
        client.commands.forEach(cmd => commandsData.push(cmd.data.toJSON()));
        const rest = new REST().setToken(process.env.DISCORD_TOKEN);
        await rest.put(Routes.applicationCommands(client.user.id), { body: commandsData });
        
        console.log(`✨ ${client.user.tag} est en ligne !`);

        // Lancement du site web
        require('./website/server')(client);

    } catch (error) {
        console.error('❌ Erreur Critique au démarrage :', error);
    }
})();