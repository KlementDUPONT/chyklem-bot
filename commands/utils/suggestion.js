const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('suggestion')
        .setDescription('Propose une idée pour le serveur')
        .addStringOption(option => 
            option.setName('idee')
                .setDescription('Ta proposition')
                .setRequired(true)),

    async execute(interaction) {
        const idea = interaction.options.getString('idee');

        // Création de l'Embed
        const embed = new EmbedBuilder()
            .setColor('#FEE75C') // Jaune
            .setAuthor({ name: `Suggestion de ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
            .setDescription(`**Proposition :**\n${idea}`)
            .addFields(
                { name: '📊 Votes', value: 'Réagissez avec ✅ ou ❌', inline: false }
            )
            .setThumbnail(interaction.guild.iconURL())
            .setTimestamp()
            .setFooter({ text: 'ChyKlem Suggestions' });

        // On envoie le message dans le salon actuel
        // (L'auteur reçoit une confirmation cachée, mais tout le monde voit la suggestion)
        await interaction.reply({ content: '✅ Ta suggestion a été envoyée !', ephemeral: true });
        
        const message = await interaction.channel.send({ embeds: [embed] });

        // Ajout des réactions
        await message.react('✅');
        await message.react('❌');

        // Création automatique d'un Fil de Discussion (Thread)
        // Cela permet de discuter de l'idée sans spammer le salon principal
        try {
            await message.startThread({
                name: `Débat : ${idea.length > 20 ? idea.substring(0, 20) + '...' : idea}`,
                autoArchiveDuration: 1440, // Archive après 24h d'inactivité
            });
        } catch (error) {
            console.error("Impossible de créer le thread (Manque de permissions ?)");
        }
    }
};