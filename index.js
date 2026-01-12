require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, Collection, GatewayIntentBits, REST, Routes } = require('discord.js');
const mysql = require('mysql2/promise');

// --- CONFIGURATION KAWAII ---
const BOT_COLOR = '#FFB6C1'; // Rose pastel

// 1. Client Discord
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

// --- CHARGEMENT DES COMMANDES ---
const commands = [];
const foldersPath = path.join(__dirname, 'commands');
// Vérifie si le dossier commands existe avant de lire
if (fs.existsSync(foldersPath)) {
    const commandFolders = fs.readdirSync(foldersPath);

    for (const folder of commandFolders) {
        const commandsPath = path.join(foldersPath, folder);
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
        
        for (const file of commandFiles) {
            const filePath = path.join(commandsPath, file);
            const command = require(filePath);
            if ('data' in command && 'execute' in command) {
                client.commands.set(command.data.name, command);
                commands.push(command.data.toJSON());
                console.log(`🌸 Commande chargée : /${command.data.name}`);
            }
        }
    }
}

// --- DÉMARRAGE DU SYSTÈME ---
(async () => {
    try {
        console.log('🌸 Démarrage de ChyKlem BOT...');

        // 1. Connexion Base de Données
        client.db = mysql.createPool({
            uri: process.env.MYSQL_URL,
            waitForConnections: true,
            connectionLimit: 5,
            queueLimit: 0,
            enableKeepAlive: true
        });

        await client.db.query('SELECT 1');
        console.log('💾 Base de données connectée !');

        // 2. Création des Tables
        await client.db.execute(`
            CREATE TABLE IF NOT EXISTS levels (
                user_id VARCHAR(255),
                guild_id VARCHAR(255),
                xp INT DEFAULT 0,
                level INT DEFAULT 0,
                PRIMARY KEY (user_id, guild_id)
            )
        `);
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
        console.log('📋 Tables SQL vérifiées.');

        // 3. Connexion Discord
        await client.login(process.env.DISCORD_TOKEN);

        // 4. Enregistrement des commandes Slash
        const rest = new REST().setToken(process.env.DISCORD_TOKEN);
        console.log('⏳ Enregistrement des commandes...');
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands },
        );
        console.log(`✨ ${client.user.tag} est en ligne et prêt à être Kawaii !`);

    } catch (error) {
        console.error('❌ Erreur au démarrage :', error);
    }
})();

// --- GESTION DES INTERACTIONS (Quand on tape une commande) ---
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        await interaction.reply({ content: '❌ Oups, une erreur est survenue !', ephemeral: true });
    }
});