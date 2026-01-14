const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('userinfo')
        .setDescription('Affiche les informations d\'un utilisateur')
        .addUserOption(option => option.setName('membre').setDescription('Le membre visé')),

    async execute(interaction) {
        const member = interaction.options.getMember('membre') || interaction.member;
        
        // Liste des rôles (on enlève @everyone)
        const roles = member.roles.cache
            .filter(r => r.name !== '@everyone')
            .map(r => r)
            .join(' ') || "Aucun rôle";

        const embed = new EmbedBuilder()
            .setColor(member.displayHexColor === '#000000' ? '#ffffff' : member.displayHexColor)
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 512 }))
            .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
            .addFields(
                { name: '🆔 ID', value: member.id, inline: true },
                { name: '📅 Création du compte', value: `<t:${parseInt(member.user.createdTimestamp / 1000)}:R>`, inline: true },
                { name: '📥 Rejoint le serveur', value: `<t:${parseInt(member.joinedTimestamp / 1000)}:R>`, inline: true },
                { name: '🎭 Rôles', value: roles.length > 1024 ? "Trop de rôles..." : roles }
            )
            .setFooter({ text: `Demandé par ${interaction.user.username}` })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};