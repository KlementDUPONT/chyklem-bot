const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder().setName('leaderboard').setDescription('Affiche le classement du serveur'),
    async execute(interaction) {
        const [rows] = await interaction.client.db.query(
            'SELECT * FROM levels WHERE guild_id = ? ORDER BY xp DESC LIMIT 10',
            [interaction.guild.id]
        );

        if (rows.length === 0) return interaction.reply('Personne n\'a encore d\'XP !');

        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle(`🏆 Classement - ${interaction.guild.name}`)
            .setThumbnail(interaction.guild.iconURL());

        let description = '';
        for (let i = 0; i < rows.length; i++) {
            const user = await interaction.client.users.fetch(rows[i].user_id).catch(() => null);
            const tag = user ? user.username : 'Inconnu';
            // Médaille pour les 3 premiers
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;
            description += `**${medal}** ${tag} • Niv ${rows[i].level} (${rows[i].xp} XP)\n`;
        }

        embed.setDescription(description);
        interaction.reply({ embeds: [embed] });
    }
};