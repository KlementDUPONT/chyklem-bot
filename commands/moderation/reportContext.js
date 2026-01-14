const { ContextMenuCommandBuilder, ApplicationCommandType, EmbedBuilder } = require('discord.js');

module.exports = {
    // Configuration du menu Clic-Droit
    data: new ContextMenuCommandBuilder()
        .setName('🚩 Signaler le message')
        .setType(ApplicationCommandType.Message),

    async execute(interaction) {
        // Le message qui a été cliqué
        const targetMessage = interaction.targetMessage;
        
        // On récupère le salon de logs depuis la DB
        const [rows] = await interaction.client.db.query(
            'SELECT log_channel_id FROM guild_settings WHERE guild_id = ?', 
            [interaction.guild.id]
        );

        // Si pas de salon de logs configuré, on prévient l'utilisateur
        if (rows.length === 0 || !rows[0].log_channel_id) {
            return interaction.reply({ 
                content: '❌ Le système de signalement n\'est pas encore configuré (Salon de logs manquant).', 
                ephemeral: true 
            });
        }

        const logChannel = interaction.guild.channels.cache.get(rows[0].log_channel_id);
        if (!logChannel) {
            return interaction.reply({ 
                content: '❌ Impossible de trouver le salon de logs.', 
                ephemeral: true 
            });
        }

        // Création de l'Embed pour les admins
        const reportEmbed = new EmbedBuilder()
            .setColor('#FF0000') // Rouge Urgent
            .setTitle('🚨 Nouveau Signalement')
            .setDescription(`**Signalé par :** ${interaction.user}\n**Auteur du message :** ${targetMessage.author}\n**Salon :** ${targetMessage.channel}\n\n**Contenu du message :**\n${targetMessage.content || "*Image ou Média*"}`)
            .addFields(
                { name: 'Lien vers le message', value: `[Cliquez ici](${targetMessage.url})` }
            )
            .setTimestamp()
            .setFooter({ text: `ID Message: ${targetMessage.id}` });

        // S'il y a une image attachée, on l'affiche
        if (targetMessage.attachments.size > 0) {
            const image = targetMessage.attachments.first().url;
            reportEmbed.setImage(image);
        }

        // Envoi dans le salon logs
        await logChannel.send({ embeds: [reportEmbed] });

        // Confirmation à l'utilisateur
        await interaction.reply({ 
            content: '✅ Merci ! Le message a été signalé à l\'équipe de modération.', 
            ephemeral: true 
        });
    }
};