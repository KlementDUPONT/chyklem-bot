const { ContextMenuCommandBuilder, ApplicationCommandType, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new ContextMenuCommandBuilder()
        .setName('🖼️ Voir l\'Avatar')
        .setType(ApplicationCommandType.User), // Type USER pour un clic sur un membre

    async execute(interaction) {
        const target = interaction.targetUser;

        const embed = new EmbedBuilder()
            .setColor('#2f3136')
            .setTitle(`Avatar de ${target.username}`)
            .setImage(target.displayAvatarURL({ dynamic: true, size: 1024 })) // HD et Animé
            .setDescription(`[Lien direct](${target.displayAvatarURL({ dynamic: true, size: 1024 })})`)
            .setFooter({ text: `ID: ${target.id}` });

        await interaction.reply({ embeds: [embed], ephemeral: true }); // Ephemeral = seul toi le voit
    }
};