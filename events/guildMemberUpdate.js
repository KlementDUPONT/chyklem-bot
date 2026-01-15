const { Events, EmbedBuilder } = require('discord.js');

module.exports = {
    name: Events.GuildMemberUpdate,
    async execute(oldMember, newMember) {
        const guild = newMember.guild;
        const client = guild.client;

        const [rows] = await client.db.query('SELECT log_channel_id FROM guild_settings WHERE guild_id = ?', [guild.id]);
        if (rows.length === 0 || !rows[0].log_channel_id) return;

        const logChannel = guild.channels.cache.get(rows[0].log_channel_id);
        if (!logChannel) return;

        // 1. CHANGEMENT DE PSEUDO
        if (oldMember.nickname !== newMember.nickname) {
            const embed = new EmbedBuilder()
                .setColor('#5865F2') // Bleu
                .setAuthor({ name: newMember.user.tag, iconURL: newMember.user.displayAvatarURL() })
                .setTitle('📝 Changement de Pseudo')
                .addFields(
                    { name: 'Avant', value: oldMember.nickname || oldMember.user.username, inline: true },
                    { name: 'Après', value: newMember.nickname || newMember.user.username, inline: true }
                )
                .setTimestamp();
            logChannel.send({ embeds: [embed] });
        }

        // 2. CHANGEMENT DE RÔLES
        const oldRoles = oldMember.roles.cache;
        const newRoles = newMember.roles.cache;

        // Rôle Ajouté ?
        const addedRole = newRoles.find(role => !oldRoles.has(role.id));
        if (addedRole) {
            const embed = new EmbedBuilder()
                .setColor('#00FF00')
                .setAuthor({ name: newMember.user.tag, iconURL: newMember.user.displayAvatarURL() })
                .setDescription(`➕ **Rôle Ajouté :** ${addedRole}`)
                .setTimestamp();
            logChannel.send({ embeds: [embed] });
        }

        // Rôle Retiré ?
        const removedRole = oldRoles.find(role => !newRoles.has(role.id));
        if (removedRole) {
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setAuthor({ name: newMember.user.tag, iconURL: newMember.user.displayAvatarURL() })
                .setDescription(`➖ **Rôle Retiré :** ${removedRole}`)
                .setTimestamp();
            logChannel.send({ embeds: [embed] });
        }
    },
};