const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Vérifie si je suis bien réveillée !'),
    
    async execute(interaction) {
        const sent = await interaction.reply({ content: 'Calcul en cours...', fetchReply: true });
        const latency = sent.createdTimestamp - interaction.createdTimestamp;
        
        const embed = new EmbedBuilder()
            .setColor(interaction.client.color) // Utilise notre rose défini dans index.js
            .setTitle('🏓 Pong !')
            .setDescription(`Je suis là !\n\n⏱️ **Latence Bot :** ${latency}ms\n💓 **API Discord :** ${Math.round(interaction.client.ws.ping)}ms`)
            .setFooter({ text: 'ChyKlem Bot • Kawaii Power', iconURL: interaction.client.user.displayAvatarURL() });

        await interaction.editReply({ content: null, embeds: [embed] });
    }
};