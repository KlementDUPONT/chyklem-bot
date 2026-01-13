const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('antiraid')
        .setDescription('Configure la protection contre les nouveaux comptes')
        .addBooleanOption(option => 
            option.setName('active')
                .setDescription('Activer ou désactiver l\'Anti-Raid')
                .setRequired(true))
        .addIntegerOption(option => 
            option.setName('jours')
                .setDescription('Âge minimum du compte en jours (ex: 7)')
                .setMinValue(1)
                .setMaxValue(30))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const enabled = interaction.options.getBoolean('active');
        const days = interaction.options.getInteger('jours') || 7; // 7 jours par défaut si pas précisé

        try {
            // Mise à jour de la configuration dans la DB
            await interaction.client.db.query(`
                INSERT INTO guild_settings (guild_id, antiraid_enabled, antiraid_account_age_days) 
                VALUES (?, ?, ?) 
                ON DUPLICATE KEY UPDATE antiraid_enabled = ?, antiraid_account_age_days = ?
            `, [interaction.guild.id, enabled, days, enabled, days]);

            const status = enabled ? '✅ **ACTIVÉ**' : '❌ **DÉSACTIVÉ**';
            await interaction.editReply(`${status} : Les comptes créés il y a moins de **${days} jours** seront expulsés automatiquement.`);
            
        } catch (error) {
            console.error(error);
            await interaction.editReply("❌ Erreur lors de la sauvegarde.");
        }
    }
};