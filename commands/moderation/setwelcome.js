const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setwelcome')
        .setDescription('Définit le salon de bienvenue')
        .addChannelOption(option => 
            option.setName('salon')
                .setDescription('Le salon où envoyer les images')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const channel = interaction.options.getChannel('salon');
        
        // On sauvegarde dans la DB (INSERT si ça n'existe pas, UPDATE sinon)
        await interaction.client.db.query(`
            INSERT INTO guild_settings (guild_id, welcome_channel_id) 
            VALUES (?, ?) 
            ON DUPLICATE KEY UPDATE welcome_channel_id = ?
        `, [interaction.guild.id, channel.id, channel.id]);

        await interaction.reply({ 
            content: `🌸 C'est noté ! Les images de bienvenue seront envoyées dans ${channel}.`, 
            ephemeral: true 
        });
    }
};