const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pay')
        .setDescription('Donner de l\'argent à quelqu\'un')
        .addUserOption(o => o.setName('membre').setDescription('Le destinataire').setRequired(true))
        .addIntegerOption(o => o.setName('montant').setDescription('Combien ?').setRequired(true).setMinValue(1)),

    async execute(interaction) {
        const target = interaction.options.getUser('membre');
        const amount = interaction.options.getInteger('montant');
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;

        if (target.id === userId) return interaction.reply("❌ Tu ne peux pas te donner de l'argent à toi-même !");
        if (target.bot) return interaction.reply("❌ Les robots n'ont pas besoin d'argent.");

        // Vérifier le solde de l'envoyeur
        const [senderRows] = await interaction.client.db.query('SELECT money FROM economy WHERE user_id = ? AND guild_id = ?', [userId, guildId]);
        const currentMoney = senderRows.length ? senderRows[0].money : 0;

        if (currentMoney < amount) {
            return interaction.reply({ content: `❌ Tu n'as pas assez d'argent ! (Solde: ${currentMoney} $)`, ephemeral: true });
        }

        // Transaction (On retire à l'un, on donne à l'autre)
        await interaction.client.db.query('UPDATE economy SET money = money - ? WHERE user_id = ? AND guild_id = ?', [amount, userId, guildId]);
        
        await interaction.client.db.query(`
            INSERT INTO economy (user_id, guild_id, money) VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE money = money + ?
        `, [target.id, guildId, amount, amount]);

        interaction.reply(`💸 **Virement réussi !** Tu as envoyé **${amount} $** à ${target}.`);
    }
};