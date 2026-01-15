const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('action')
        .setDescription('Faire une action animée vers quelqu\'un')
        .addSubcommand(s => s.setName('hug').setDescription('Faire un câlin').addUserOption(o => o.setName('membre').setDescription('Cible').setRequired(true)))
        .addSubcommand(s => s.setName('kiss').setDescription('Embrasser').addUserOption(o => o.setName('membre').setDescription('Cible').setRequired(true)))
        .addSubcommand(s => s.setName('slap').setDescription('Donner une baffe').addUserOption(o => o.setName('membre').setDescription('Cible').setRequired(true)))
        .addSubcommand(s => s.setName('dance').setDescription('Danser de joie'))
        .addSubcommand(s => s.setName('pat').setDescription('Tapoter la tête (Pat)')),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const target = interaction.options.getUser('membre');
        
        await interaction.deferReply(); // On fait patienter car l'API peut prendre 1 seconde

        // Correspondance entre nos commandes et l'API waifu.pics
        let category = sub;
        
        try {
            // Appel API
            const response = await fetch(`https://api.waifu.pics/sfw/${category}`);
            const data = await response.json();

            // Construction du message
            let text = "";
            if (sub === 'hug') text = `🤗 **${interaction.user.username}** fait un gros câlin à **${target.username}** !`;
            if (sub === 'kiss') text = `😘 **${interaction.user.username}** fait un bisou à **${target.username}** !`;
            if (sub === 'slap') text = `👋 **${interaction.user.username}** gifle **${target.username}** ! Aïe !`;
            if (sub === 'pat') text = `🤚 **${interaction.user.username}** tapote la tête de **${target.username}** *pat pat*`;
            if (sub === 'dance') text = `💃 **${interaction.user.username}** se met à danser !`;

            const embed = new EmbedBuilder()
                .setColor('#FF69B4') // Rose HotPink
                .setDescription(text)
                .setImage(data.url)
                .setFooter({ text: 'Powered by waifu.pics' });

            await interaction.editReply({ content: target ? `${target}` : null, embeds: [embed] });

        } catch (error) {
            console.error(error);
            await interaction.editReply("❌ Impossible de charger l'image (API hors ligne ?).");
        }
    }
};