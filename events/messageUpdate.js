const { Events, EmbedBuilder } = require('discord.js');

module.exports = {
    name: Events.MessageUpdate,
    async execute(oldMessage, newMessage) {
        // Ignorer les bots, les messages sans guilde, ou si le contenu n'a pas changé (ex: chargement d'image)
        if (newMessage.author?.bot || !newMessage.guild) return;
        if (oldMessage.content === newMessage.content) return;

        const client = newMessage.client;

        try {
            // 1. Trouver le salon de logs dans la DB
            const [rows] = await client.db.query('SELECT log_channel_id FROM guild_settings WHERE guild_id = ?', [newMessage.guild.id]);
            if (rows.length === 0 || !rows[0].log_channel_id) return;

            const logChannel = newMessage.guild.channels.cache.get(rows[0].log_channel_id);
            if (!logChannel) return;

            // 2. Créer l'Embed
            const embed = new EmbedBuilder()
                .setColor('#FFA500') // Orange
                .setTitle('✏️ Message Modifié')
                .addFields(
                    { name: 'Auteur', value: `${newMessage.author.tag}`, inline: true },
                    { name: 'Salon', value: `${newMessage.channel}`, inline: true },
                    { name: 'Avant', value: oldMessage.content || "*Inconnu / Média*", inline: false },
                    { name: 'Après', value: newMessage.content || "*Inconnu / Média*", inline: false }
                )
                .setTimestamp()
                .setFooter({ text: `ID: ${newMessage.author.id}` });

            // 3. Envoyer
            await logChannel.send({ embeds: [embed] });

        } catch (error) {
            console.error("Erreur Log Update:", error);
        }
    },
};