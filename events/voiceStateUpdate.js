const { Events, EmbedBuilder } = require('discord.js');

module.exports = {
    name: Events.VoiceStateUpdate,
    async execute(oldState, newState) {
        const guild = newState.guild;
        const client = guild.client;

        // Récupérer le salon de logs depuis la DB
        const [rows] = await client.db.query('SELECT log_channel_id FROM guild_settings WHERE guild_id = ?', [guild.id]);
        if (rows.length === 0 || !rows[0].log_channel_id) return;

        const logChannel = guild.channels.cache.get(rows[0].log_channel_id);
        if (!logChannel) return;

        const member = newState.member;
        
        // 1. REJOINT UN SALON
        if (!oldState.channelId && newState.channelId) {
            const embed = new EmbedBuilder()
                .setColor('#00FF00') // Vert
                .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
                .setDescription(`📥 **A rejoint le vocal**\nSalon : <#${newState.channelId}>`)
                .setTimestamp();
            return logChannel.send({ embeds: [embed] });
        }

        // 2. QUITTE UN SALON
        if (oldState.channelId && !newState.channelId) {
            const embed = new EmbedBuilder()
                .setColor('#FF0000') // Rouge
                .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
                .setDescription(`📤 **A quitté le vocal**\nSalon : <#${oldState.channelId}>`)
                .setTimestamp();
            return logChannel.send({ embeds: [embed] });
        }

        // 3. CHANGE DE SALON
        if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
            const embed = new EmbedBuilder()
                .setColor('#FFA500') // Orange
                .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
                .setDescription(`➡️ **A changé de salon**\nDe : <#${oldState.channelId}>\nVers : <#${newState.channelId}>`)
                .setTimestamp();
            return logChannel.send({ embeds: [embed] });
        }
    },
};