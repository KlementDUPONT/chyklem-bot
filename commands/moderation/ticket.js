const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('Affiche le panneau de création de tickets')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator), // Réservé aux admins

    async execute(interaction) {
        // L'Embed (Le panneau visuel)
        const embed = new EmbedBuilder()
            .setColor('#2f3136')
            .setTitle('📞 Support / Ticket')
            .setDescription('Clique sur le bouton ci-dessous pour ouvrir un ticket privé avec le staff.\n\n*Abus = Sanction*')
            .setThumbnail(interaction.guild.iconURL())
            .setFooter({ text: 'Système sécurisé par ChyKlem Bot' });

        // Le Bouton
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('create_ticket') // ID utilisé dans l'étape 2
                    .setLabel('Ouvrir un Ticket')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('📩')
            );

        await interaction.channel.send({ embeds: [embed], components: [row] });
        return interaction.reply({ content: '✅ Panneau ticket envoyé !', ephemeral: true });
    }
};