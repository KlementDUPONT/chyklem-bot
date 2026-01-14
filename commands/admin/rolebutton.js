const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rolebutton')
        .setDescription('Créer un bouton pour donner un rôle')
        .addRoleOption(o => o.setName('role').setDescription('Le rôle à donner').setRequired(true))
        .addStringOption(o => o.setName('texte').setDescription('Texte du message').setRequired(true))
        .addStringOption(o => o.setName('label').setDescription('Texte sur le bouton').setRequired(true))
        .addStringOption(o => o.setName('emoji').setDescription('Emoji du bouton (ex: 🎮)'))
        .addStringOption(o => o.setName('style').setDescription('Couleur').addChoices(
            { name: 'Bleu', value: 'Primary' },
            { name: 'Gris', value: 'Secondary' },
            { name: 'Vert', value: 'Success' },
            { name: 'Rouge', value: 'Danger' }
        ))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const role = interaction.options.getRole('role');
        const text = interaction.options.getString('texte');
        const label = interaction.options.getString('label');
        const emoji = interaction.options.getString('emoji');
        const style = interaction.options.getString('style') || 'Primary';

        // Sécurité
        if (role.position >= interaction.guild.members.me.roles.highest.position) {
            return interaction.reply({ content: '❌ Ce rôle est supérieur au mien, je ne peux pas le donner !', ephemeral: true });
        }

        // Création de l'Embed
        const embed = new EmbedBuilder()
            .setColor(role.color || '#5865F2')
            .setDescription(text);

        // Création du Bouton
        // L'ID du bouton sera : "role_IDDUROLE"
        const button = new ButtonBuilder()
            .setCustomId(`role_${role.id}`)
            .setLabel(label)
            .setStyle(ButtonStyle[style]);

        if (emoji) button.setEmoji(emoji);

        const row = new ActionRowBuilder().addComponents(button);

        await interaction.channel.send({ embeds: [embed], components: [row] });
        await interaction.reply({ content: '✅ Bouton de rôle créé !', ephemeral: true });
    }
};