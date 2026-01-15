const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('money')
        .setDescription('Voir ton solde ou celui d\'un autre membre')
        .addUserOption(option => option.setName('membre').setDescription('Le membre')),

    async execute(interaction) {
        const target = interaction.options.getUser('membre') || interaction.user;
        
        const [rows] = await interaction.client.db.query(
            'SELECT money FROM economy WHERE user_id = ? AND guild_id = ?', 
            [target.id, interaction.guild.id]
        );
        
        const money = rows.length ? rows[0].money : 0;

        const embed = new EmbedBuilder()
            .setColor('#FFD700') // Or
            .setTitle(`💰 Banque de ${target.username}`)
            .setDescription(`Solde actuel : **${money} $**`)
            .setThumbnail(target.displayAvatarURL());

        interaction.reply({ embeds: [embed] });
    }
};