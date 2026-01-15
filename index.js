require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, Collection, GatewayIntentBits, REST, Routes } = require('discord.js');
const mysql = require('mysql2/promise');

const BOT_COLOR = '#FFB6C1'; // Couleur par défaut des Embeds

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildVoiceStates // Important pour les logs vocaux
    ]
});

client.commands = new Collection();
client.color = BOT_COLOR;

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
                const command = require(filePath);
                if ('data' in command && 'execute' in command) {
                    client.commands.set(command.data.name, command);
                } else {
                    console.warn(`[AVERTISSEMENT] La commande ${filePath} est invalide (manque data ou execute).`);
                }
            }
        }
    }
}

// ============================================================
// 2. CHARGEMENT DES ÉVÉNEMENTS
// ============================================================
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
}

// ============================================================
// 3. DÉMARRAGE & BASE DE DONNÉES
// ============================================================
(async () => {
    try {
        // --- A. Connexion Base de Données ---
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

        // Heartbeat Anti-Crash (Maintient la connexion active)
        setInterval(async () => { 
            try { await client.db.query('SELECT 1'); } catch (err) { console.error('DB Heartbeat Failed'); } 
        }, 60000);

        // --- B. Création des Tables SQL ---
        
        // 1. Niveaux (XP)
        await client.db.execute(`
            CREATE TABLE IF NOT EXISTS levels (
                user_id VARCHAR(255), 
                guild_id VARCHAR(255), 
                xp INT DEFAULT 0, 
                level INT DEFAULT 0, 
                PRIMARY KEY (user_id, guild_id)
            )
        `);

        // 2. Récompenses de Niveaux (Rôles)
        await client.db.execute(`
            CREATE TABLE IF NOT EXISTS level_rewards (
                guild_id VARCHAR(255), 
                level INT, 
                role_id VARCHAR(255), 
                PRIMARY KEY (guild_id, level)
            )
        `);

        // 3. Avertissements (Warns)
        await client.db.execute(`
            CREATE TABLE IF NOT EXISTS warnings (
                id INT AUTO_INCREMENT PRIMARY KEY, 
                guild_id VARCHAR(255), 
                user_id VARCHAR(255), 
                moderator_id VARCHAR(255), 
                reason TEXT, 
                date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 4. Commandes Personnalisées
        await client.db.execute(`
            CREATE TABLE IF NOT EXISTS custom_commands (
                id INT AUTO_INCREMENT PRIMARY KEY, 
                guild_id VARCHAR(255), 
                trigger_word VARCHAR(255), 
                response_text TEXT
            )
        `);

        // 5. Économie
        await client.db.execute(`
            CREATE TABLE IF NOT EXISTS economy (
                user_id VARCHAR(255),
                guild_id VARCHAR(255),
                money BIGINT DEFAULT 0,
                last_daily BIGINT DEFAULT 0,
                last_work BIGINT DEFAULT 0,
                PRIMARY KEY (user_id, guild_id)
            )
        `);

        // 6. Compteur d'Actions (Câlins, Bisous...) - NOUVEAU
        await client.db.execute(`
            CREATE TABLE IF NOT EXISTS action_counts (
                guild_id VARCHAR(255),
                user_from VARCHAR(255),
                user_to VARCHAR(255),
                action_type VARCHAR(50),
                count INT DEFAULT 0,
                PRIMARY KEY (guild_id, user_from, user_to, action_type)
            )
        `);

        // 7. Paramètres Serveur (Configuration Complète)
        await client.db.execute(`
            CREATE TABLE IF NOT EXISTS guild_settings (
                guild_id VARCHAR(255) PRIMARY KEY, 
                
                -- SÉCURITÉ
                antiraid_enabled BOOLEAN DEFAULT FALSE, 
                antiraid_account_age_days INT DEFAULT 7, 
                
                -- MODÉRATION
                log_channel_id VARCHAR(255), 
                automod_enabled BOOLEAN DEFAULT FALSE,
                automod_words TEXT DEFAULT NULL,

                -- BIENVENUE & DESIGN
                welcome_channel_id VARCHAR(255), 
                welcome_message VARCHAR(1000) DEFAULT "Bienvenue {user} ! 🌸", 
                welcome_bg VARCHAR(500) DEFAULT 'https://i.imgur.com/vH1W4Qc.jpeg',
                welcome_color VARCHAR(10) DEFAULT '#ffffff',
                autorole_id VARCHAR(255) DEFAULT NULL,

                -- NIVEAUX
                levels_enabled BOOLEAN DEFAULT TRUE,
                level_up_message VARCHAR(1000) DEFAULT "🎉 Bravo {user}, tu passes au Niveau {level} !"
            )
        `);

        // --- C. Migrations Automatiques ---
        // Ajoute les colonnes si elles manquent (évite de devoir supprimer la DB)
        const migrations = [
            "ALTER TABLE guild_settings ADD COLUMN welcome_bg VARCHAR(500) DEFAULT 'https://i.imgur.com/vH1W4Qc.jpeg'",
            "ALTER TABLE guild_settings ADD COLUMN welcome_color VARCHAR(10) DEFAULT '#ffffff'",
            "ALTER TABLE guild_settings ADD COLUMN levels_enabled BOOLEAN DEFAULT TRUE",
            "ALTER TABLE guild_settings ADD COLUMN level_up_message VARCHAR(1000) DEFAULT '🎉 Bravo {user}, tu passes au Niveau {level} !'",
            "ALTER TABLE guild_settings ADD COLUMN automod_enabled BOOLEAN DEFAULT FALSE",
            "ALTER TABLE guild_settings ADD COLUMN automod_words TEXT DEFAULT NULL"
        ];
        
        for (const sql of migrations) {
            try { await client.db.execute(sql); } catch(e) { /* Ignore erreur si colonne existe */ }
        }

        // --- D. Connexion Discord ---
        await client.login(process.env.DISCORD_TOKEN);
        
        // Enregistrement des commandes Slash
        const commandsData = [];
        client.commands.forEach(cmd => commandsData.push(cmd.data.toJSON()));
        
        const rest = new REST().setToken(process.env.DISCORD_TOKEN);
        console.log('⏳ Enregistrement des commandes slash...');
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commandsData }
        );
        
        console.log(`✨ ${client.user.tag} est en ligne !`);

        // --- E. Lancement du Site Web ---
        require('./website/server')(client);

    } catch (error) {
        console.error('❌ Erreur Critique au démarrage :', error);
    }
})();

// Anti-crash simple pour interactions non gérées
client.on('interactionCreate', async i => {
    if (!i.isChatInputCommand()) return;
    // Les erreurs sont gérées dans events/interactionCreate.js
});