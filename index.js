require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, Collection, GatewayIntentBits, REST, Routes } = require('discord.js');
const mysql = require('mysql2/promise');

// --- CONFIGURATION KAWAII ---
const BOT_COLOR = '#FFB6C1'; // Rose pastel pour les embeds

// 1. Client Discord
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers, // Important pour l'Auto-Role et Bienvenue
        GatewayIntentBits.GuildPresences
    ]
});

client.commands = new Collection();
client.color = BOT_COLOR; // On attache la couleur au client pour l'utiliser partout

// --- CHARGEMENT DES COMMANDES (Structure vide pour l'instant) ---
// Nous créerons le dossier 'commands' à l'étape suivante

// --- DÉMARRAGE DU SYSTÈME ---
(async () => {
    try {
        console.log('🌸 Démarrage de ChyKlem BOT...');

        // 1. Connexion Base de Données (Pool Robuste)
        client.db = mysql.createPool({
            uri: process.env.MYSQL_URL,
            waitForConnections: true,
            connectionLimit: 5,
            queueLimit: 0,
            enableKeepAlive: true
        });

        await client.db.query('SELECT 1');
        console.log('💾 Base de données connectée !');

        // 2. Création des Tables (Schéma V1)
        
        // Table XP
        await client.db.execute(`
            CREATE TABLE IF NOT EXISTS levels (
                user_id VARCHAR(255),
                guild_id VARCHAR(255),
                xp INT DEFAULT 0,
                level INT DEFAULT 0,
                PRIMARY KEY (user_id, guild_id)
            )
        `);

        // Table Configuration (Avec Auto-Role !)
        await client.db.execute(`
            CREATE TABLE IF NOT EXISTS guild_settings (
                guild_id VARCHAR(255) PRIMARY KEY,
                antiraid_enabled BOOLEAN DEFAULT FALSE,
                antiraid_account_age_days INT DEFAULT 7,
                log_channel_id VARCHAR(255),
                welcome_channel_id VARCHAR(255),
                welcome_message VARCHAR(1000) DEFAULT "Bienvenue {user} ! 🌸",
                autorole_id VARCHAR(255) DEFAULT NULL
            )
        `);
        console.log('📋 Tables SQL vérifiées (XP, Settings, AutoRole).');

        // 3. Connexion Discord
        await client.login(process.env.DISCORD_TOKEN);
        console.log(`✨ ${client.user.tag} est en ligne et prêt à être Kawaii !`);

        // Ici, on lancera le Dashboard plus tard
        // require('./website/server')(client);

    } catch (error) {
        console.error('❌ Erreur au démarrage :', error);
    }
})();