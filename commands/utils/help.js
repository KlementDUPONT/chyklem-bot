const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Affiche la liste de toutes les commandes disponibles'),

    async execute(interaction) {
        // Emojis pour décorer les catégories
        const emojis = {
            moderation: '🛡️',
            social: '✨',
            utils: '🛠️',
            defaut: '📂'
        };

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('📚 Menu d\'Aide')
            .setDescription(`Voici la liste des commandes disponibles sur **${interaction.guild.name}**.`)
            .setThumbnail(interaction.client.user.displayAvatarURL())
            .setTimestamp();

        // 1. Lire le dossier "commands"
        const commandsPath = path.join(__dirname, '../../commands');
        const commandFolders = fs.readdirSync(commandsPath);

        // 2. Parcourir chaque dossier (catégorie)
        for (const folder of commandFolders) {
            const folderPath = path.join(commandsPath, folder);
            
            // On s'assure que c'est bien un dossier
            if (fs.lstatSync(folderPath).isDirectory()) {
                
                // Récupérer les fichiers .js
                const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
                
                // Si le dossier n'est pas vide
                if (commandFiles.length > 0) {
                    // On prépare la liste des commandes : "• `/ping` : Pong !"
                    const commandList = commandFiles.map(file => {
                        const command = require(path.join(folderPath, file));
                        if (command.data && command.data.name) {
                            return `• \`/${command.data.name}\` : ${command.data.description}`;
                        }
                        return null;
                    }).filter(Boolean).join('\n'); // On retire les null et on saute des lignes

                    // On ajoute la catégorie à l'Embed
                    const categoryName = folder.charAt(0).toUpperCase() + folder.slice(1); // Majuscule
                    const emoji = emojis[folder] || emojis['defaut'];
                    
                    embed.addFields({ 
                        name: `${emoji} ${categoryName}`, 
                        value: commandList 
                    });
                }
            }
        }

        await interaction.reply({ embeds: [embed] });
    }
};