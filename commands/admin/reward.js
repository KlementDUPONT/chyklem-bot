const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reward')
        .setDescription('Ajouter une récompense de rôle pour un niveau')
        .addIntegerOption(o => o.setName('niveau').setDescription('Niveau à atteindre').setRequired(true))
        .addRoleOption(o => o.setName('role').setDescription('Rôle à donner').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const level = interaction.options.getInteger('niveau');
        const role = interaction.options.getRole('role');

        await interaction.client.db.query(
            `INSERT INTO level_rewards (guild_id, level, role_id) VALUES (?, ?, ?) 
             ON DUPLICATE KEY UPDATE role_id = ?`,
            [interaction.guild.id, level, role.id, role.id]
        );

        interaction.reply(`✅ Configuré : Atteindre le niveau **${level}** donnera le rôle **${role.name}**.`);
    }
};