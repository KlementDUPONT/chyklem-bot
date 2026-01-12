const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clear')
        .setDescription('Supprime des messages (Max 100)')
        .addIntegerOption(option => 
            option.setName('nombre')
                .setDescription('Nombre de messages à supprimer')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(100))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction) {
        const amount = interaction.options.getInteger('nombre');

        // Suppression
        await interaction.channel.bulkDelete(amount, true).catch(err => {
            console.error(err);
            return interaction.reply({ content: '❌ Je ne peux supprimer que les messages datant de moins de 14 jours.', ephemeral: true });
        });

        return interaction.reply({ content: `🧹 J'ai supprimé **${amount}** messages !`, ephemeral: true });
    }
};