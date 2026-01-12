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
        // 1. On dit à Discord de patienter (évite l'erreur "ne répond plus")
        await interaction.deferReply({ ephemeral: true });

        try {
            const channel = interaction.options.getChannel('salon');
            
            // 2. On tente l'écriture en base de données
            // Note : On utilise 'INSERT ... ON DUPLICATE KEY UPDATE' pour gérer la création ou la mise à jour
            await interaction.client.db.query(`
                INSERT INTO guild_settings (guild_id, welcome_channel_id) 
                VALUES (?, ?) 
                ON DUPLICATE KEY UPDATE welcome_channel_id = ?
            `, [interaction.guild.id, channel.id, channel.id]);

            // 3. Succès !
            await interaction.editReply({ 
                content: `✅ C'est configuré ! Les images de bienvenue iront dans ${channel}.` 
            });

        } catch (error) {
            console.error('❌ Erreur Database :', error); // Affiche l'erreur dans les logs Coolify
            await interaction.editReply({ 
                content: `❌ Oups, erreur de base de données : \n\`${error.message}\`` 
            });
        }
    }
};