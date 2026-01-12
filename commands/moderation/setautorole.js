const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setautorole')
        .setDescription('Définit le rôle donné automatiquement aux nouveaux')
        .addRoleOption(option => 
            option.setName('role')
                .setDescription('Le rôle à donner')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const role = interaction.options.getRole('role');

        // Vérification de sécurité : Le bot ne peut pas donner un rôle supérieur au sien
        const botMember = interaction.guild.members.me;
        if (role.position >= botMember.roles.highest.position) {
            return interaction.editReply(`❌ Impossible : Le rôle ${role} est placé **plus haut** que mon propre rôle (ChyKlem Bot) dans la liste des rôles du serveur. Descends-le un peu !`);
        }

        // Sauvegarde DB
        try {
            await interaction.client.db.query(`
                INSERT INTO guild_settings (guild_id, autorole_id) 
                VALUES (?, ?) 
                ON DUPLICATE KEY UPDATE autorole_id = ?
            `, [interaction.guild.id, role.id, role.id]);

            await interaction.editReply(`✅ C'est configuré ! Les nouveaux recevront automatiquement le rôle ${role}.`);
        } catch (error) {
            console.error(error);
            await interaction.editReply("❌ Erreur de base de données.");
        }
    }
};