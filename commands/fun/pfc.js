const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pfc')
        .setDescription('Joue à Pierre-Feuille-Ciseaux contre le bot'),

    async execute(interaction) {
        // 1. Création des boutons
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('pierre').setLabel('Pierre').setEmoji('🪨').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('feuille').setLabel('Feuille').setEmoji('📄').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('ciseaux').setLabel('Ciseaux').setEmoji('✂️').setStyle(ButtonStyle.Danger)
        );

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('Pierre, Feuille, Ciseaux !')
            .setDescription('Fais ton choix en cliquant sur un bouton ci-dessous 👇');

        const response = await interaction.reply({ embeds: [embed], components: [row] });

        // 2. Le Collecteur (Écoute les clics uniquement de celui qui a lancé la commande)
        const collector = response.createMessageComponentCollector({ 
            filter: i => i.user.id === interaction.user.id, 
            time: 30000 // 30 secondes pour jouer
        });

        collector.on('collect', async i => {
            const choices = ['pierre', 'feuille', 'ciseaux'];
            const botChoice = choices[Math.floor(Math.random() * choices.length)];
            const userChoice = i.customId;

            let result;
            if (userChoice === botChoice) result = "🤝 Égalité !";
            else if (
                (userChoice === 'pierre' && botChoice === 'ciseaux') ||
                (userChoice === 'feuille' && botChoice === 'pierre') ||
                (userChoice === 'ciseaux' && botChoice === 'feuille')
            ) {
                result = "🎉 Tu as gagné !";
            } else {
                result = "🤖 J'ai gagné !";
            }

            // Jolis noms pour l'affichage
            const emojis = { pierre: '🪨', feuille: '📄', ciseaux: '✂️' };

            const resultEmbed = new EmbedBuilder()
                .setColor(result.includes('gagné') ? '#00FF00' : '#FF0000')
                .setTitle(result)
                .addFields(
                    { name: 'Toi', value: `${emojis[userChoice]} ${userChoice}`, inline: true },
                    { name: 'Moi', value: `${emojis[botChoice]} ${botChoice}`, inline: true }
                );

            // On met à jour le message et on enlève les boutons
            await i.update({ embeds: [resultEmbed], components: [] });
            collector.stop();
        });

        collector.on('end', collected => {
            if (collected.size === 0) {
                interaction.editReply({ content: '⏱️ Trop lent ! Partie annulée.', components: [] });
            }
        });
    }
};