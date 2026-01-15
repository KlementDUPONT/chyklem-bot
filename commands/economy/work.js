const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder().setName('work').setDescription('Travaille pour gagner un peu d\'argent (Toutes les 30 min)'),

    async execute(interaction) {
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;
        
        // Gain aléatoire entre 50 et 150
        const earnings = Math.floor(Math.random() * 101) + 50;
        
        // Métiers aléatoires
        const jobs = ["Programmeur", "Pêcheur", "Cuisinier", "Modérateur Discord", "Livreur de Pizza"];
        const job = jobs[Math.floor(Math.random() * jobs.length)];

        // Vérification DB
        const [rows] = await interaction.client.db.query('SELECT last_work FROM economy WHERE user_id = ? AND guild_id = ?', [userId, guildId]);
        const lastWork = rows.length ? rows[0].last_work : 0;
        const now = Date.now();
        const cooldown = 1800000; // 30 minutes

        if (now - lastWork < cooldown) {
            const minutesLeft = Math.ceil((lastWork + cooldown - now) / 60000);
            return interaction.reply({ content: `⏱️ Tu es fatigué... Repose-toi encore **${minutesLeft} minutes**.`, ephemeral: true });
        }

        // Mise à jour
        await interaction.client.db.query(`
            INSERT INTO economy (user_id, guild_id, money, last_work) VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE money = money + ?, last_work = ?
        `, [userId, guildId, earnings, now, earnings, now]);

        interaction.reply(`🔨 Tu as travaillé comme **${job}** et gagné **${earnings} $** !`);
    }
};