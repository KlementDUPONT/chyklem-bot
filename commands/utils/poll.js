const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('poll')
        .setDescription('Créer un sondage simple')
        .addStringOption(o => o.setName('question').setDescription('La question').setRequired(true))
        .addStringOption(o => o.setName('choix1').setDescription('Option 1').setRequired(true))
        .addStringOption(o => o.setName('choix2').setDescription('Option 2').setRequired(true))
        .addStringOption(o => o.setName('choix3').setDescription('Option 3'))
        .addStringOption(o => o.setName('choix4').setDescription('Option 4')),

    async execute(interaction) {
        const question = interaction.options.getString('question');
        const options = [
            interaction.options.getString('choix1'),
            interaction.options.getString('choix2'),
            interaction.options.getString('choix3'),
            interaction.options.getString('choix4')
        ].filter(Boolean); // Enlève les options vides

        const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'];
        
        let description = '';
        options.forEach((opt, index) => {
            description += `${emojis[index]} : **${opt}**\n\n`;
        });

        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle(`📊 Sondage : ${question}`)
            .setDescription(description)
            .setFooter({ text: `Proposé par ${interaction.user.username}` })
            .setTimestamp();

        const message = await interaction.reply({ embeds: [embed], fetchReply: true });

        // Le bot ajoute les réactions tout seul
        for (let i = 0; i < options.length; i++) {
            await message.react(emojis[i]);
        }
    }
};