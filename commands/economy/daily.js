const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder().setName('daily').setDescription('Récupère ton argent quotidien (Toutes les 24h)'),

    async execute(interaction) {
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;
        const reward = 500; // Montant du daily

        // Vérification DB
        const [rows] = await interaction.client.db.query('SELECT last_daily, money FROM economy WHERE user_id = ? AND guild_id = ?', [userId, guildId]);
        const data = rows[0] || { last_daily: 0, money: 0 };

        const now = Date.now();
        const cooldown = 86400000; // 24 heures en ms

        if (now - data.last_daily < cooldown) {
            const hoursLeft = Math.ceil((data.last_daily + cooldown - now) / 3600000);
            return interaction.reply({ content: `⏱️ Reviens dans environ **${hoursLeft} heures** pour ton salaire !`, ephemeral: true });
        }

        // Mise à jour
        await interaction.client.db.query(`
            INSERT INTO economy (user_id, guild_id, money, last_daily) VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE money = money + ?, last_daily = ?
        `, [userId, guildId, reward, now, reward, now]);

        interaction.reply(`📅 Tu as récupéré ton salaire quotidien de **${reward} $** !`);
    }
};