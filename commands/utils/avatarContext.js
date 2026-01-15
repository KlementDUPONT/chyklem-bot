const { ContextMenuCommandBuilder, ApplicationCommandType, EmbedBuilder } = require('discord.js');

module.exports = {
    // Configuration du menu contextuel (Clic-Droit > Applications)
    data: new ContextMenuCommandBuilder()
        .setName('🖼️ Voir l\'Avatar')
        .setType(ApplicationCommandType.User), // Type USER car on clique sur un membre

    async execute(interaction) {
        // La personne sur qui on a cliqué
        const target = interaction.targetUser;

        const avatarUrl = target.displayAvatarURL({ dynamic: true, size: 1024 });

        const embed = new EmbedBuilder()
            .setColor('#2f3136')
            .setTitle(`Avatar de ${target.username}`)
            .setImage(avatarUrl)
            .setDescription(`[📂 Télécharger l'image](${avatarUrl})`)
            .setFooter({ text: `ID: ${target.id}` });

        // On répond en "Ephemeral" (seul toi vois le résultat) pour ne pas spammer le chat
        // Si tu veux que tout le monde le voie, enlève "ephemeral: true"
        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
};