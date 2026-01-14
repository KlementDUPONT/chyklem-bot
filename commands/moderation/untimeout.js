const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('untimeout')
        .setDescription('Rend la parole à un membre exclu')
        .addUserOption(option => 
            option.setName('membre')
                .setDescription('Le membre à libérer')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('raison')
                .setDescription('Raison de l\'annulation'))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        const target = interaction.options.getMember('membre');
        const reason = interaction.options.getString('raison') || 'Sanction levée par un modérateur';

        if (!target) return interaction.reply({ content: '❌ Membre introuvable.', ephemeral: true });

        if (!target.isCommunicationDisabled()) {
            return interaction.reply({ content: '❓ Ce membre n\'est pas exclu actuellement.', ephemeral: true });
        }

        try {
            // Pour enlever le timeout, on met la durée à "null"
            await target.timeout(null, reason);

            const embed = new EmbedBuilder()
                .setColor('#00FF00') // Vert
                .setDescription(`🗣️ **${target.user.tag}** a retrouvé la parole !\n📝 Raison : ${reason}`);

            return interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error(error);
            return interaction.reply({ content: '❌ Erreur lors de l\'annulation du timeout.', ephemeral: true });
        }
    }
};