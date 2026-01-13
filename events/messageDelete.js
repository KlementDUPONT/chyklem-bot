const { Events, EmbedBuilder } = require('discord.js');

module.exports = {
    name: Events.MessageDelete,
    async execute(message) {
        // Ignorer les messages partiels (trop vieux), les bots ou les MP
        if (message.partial || message.author?.bot || !message.guild) return;

        const client = message.client;

        try {
            // 1. Trouver le salon de logs dans la DB
            const [rows] = await client.db.query('SELECT log_channel_id FROM guild_settings WHERE guild_id = ?', [message.guild.id]);
            if (rows.length === 0 || !rows[0].log_channel_id) return;

            const logChannel = message.guild.channels.cache.get(rows[0].log_channel_id);
            if (!logChannel) return;

            // 2. Créer l'Embed d'alerte
            const embed = new EmbedBuilder()
                .setColor('#FF0000') // Rouge
                .setTitle('🗑️ Message Supprimé')
                .setDescription(`**Auteur :** ${message.author.tag}\n**Salon :** ${message.channel}\n\n**Contenu :**\n${message.content || "*Aucun contenu texte (Image ?)*"}`)
                .setTimestamp()
                .setFooter({ text: `ID: ${message.author.id}` });

            // 3. Envoyer
            await logChannel.send({ embeds: [embed] });

        } catch (error) {
            console.error("Erreur Log Delete:", error);
        }
    },
};