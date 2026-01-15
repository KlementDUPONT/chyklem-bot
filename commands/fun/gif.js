const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('gif')
        .setDescription('Envoie un GIF aléatoire selon un thème (via Giphy)')
        .addStringOption(option => 
            option.setName('theme')
                .setDescription('Le thème du GIF (ex: chat, fail, anime, danse...)')
                .setRequired(true)),

    async execute(interaction) {
        const theme = interaction.options.getString('theme');
        const apiKey = process.env.GIPHY_API_KEY;

        if (!apiKey) {
            return interaction.reply({ content: '❌ La clé API Giphy n\'est pas configurée dans le fichier .env !', ephemeral: true });
        }

        await interaction.deferReply(); // On fait patienter

        try {
            // Recherche sur GIPHY (limit=25 résultats pour avoir du choix)
            const url = `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(theme)}&limit=25&rating=g`;
            
            const response = await fetch(url);
            const data = await response.json();

            // Vérification si résultats vides
            if (!data.data || data.data.length === 0) {
                return interaction.editReply(`❌ Aucun GIF trouvé pour le thème : **${theme}**.`);
            }

            // On prend un résultat au hasard
            const randomIndex = Math.floor(Math.random() * data.data.length);
            const randomGif = data.data[randomIndex];
            
            // L'URL de l'image originale
            const gifUrl = randomGif.images.original.url;

            const embed = new EmbedBuilder()
                .setColor('#00ff99') // Vert Giphy
                .setTitle(`🎬 GIF : ${theme}`)
                .setImage(gifUrl)
                .setFooter({ text: `Demandé par ${interaction.user.username} • Via GIPHY`, iconURL: interaction.user.displayAvatarURL() });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error("Erreur Giphy:", error);
            await interaction.editReply('❌ Une erreur est survenue lors de la recherche du GIF.');
        }
    }
};