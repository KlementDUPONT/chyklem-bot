const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('announce')
        .setDescription('Faire une annonce officielle')
        .addChannelOption(o => o.setName('salon').setDescription('Où poster ?').setRequired(true))
        .addStringOption(o => o.setName('titre').setDescription('Titre de l\'annonce').setRequired(true))
        .addStringOption(o => o.setName('message').setDescription('Contenu (tu peux utiliser \\n pour sauter des lignes)').setRequired(true))
        .addStringOption(o => o.setName('image').setDescription('URL d\'une image (Optionnel)'))
        .addStringOption(o => o.setName('couleur').setDescription('Code HEX (ex: #FF0000)'))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const channel = interaction.options.getChannel('salon');
        const title = interaction.options.getString('titre');
        const content = interaction.options.getString('message');
        const image = interaction.options.getString('image');
        const color = interaction.options.getString('couleur') || '#5865F2';

        // Vérification que c'est un salon textuel
        if (!channel.isTextBased()) {
            return interaction.reply({ content: '❌ Je ne peux poster que dans un salon textuel.', ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setColor(color)
            .setTitle(title)
            .setDescription(content.replace(/\\n/g, '\n')) // Gère les sauts de ligne
            .setFooter({ text: `Annonce par ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
            .setTimestamp();

        if (image) embed.setImage(image);

        try {
            await channel.send({ embeds: [embed] });
            await interaction.reply({ content: `✅ Annonce postée dans ${channel} !`, ephemeral: true });
        } catch (error) {
            await interaction.reply({ content: '❌ Je n\'ai pas la permission d\'écrire dans ce salon.', ephemeral: true });
        }
    }
};