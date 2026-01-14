const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Avertir un membre')
        .addUserOption(o => o.setName('membre').setDescription('Cible').setRequired(true))
        .addStringOption(o => o.setName('raison').setDescription('Raison').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        const target = interaction.options.getUser('membre');
        const reason = interaction.options.getString('raison');

        await interaction.client.db.query(
            'INSERT INTO warnings (guild_id, user_id, moderator_id, reason) VALUES (?, ?, ?, ?)',
            [interaction.guild.id, target.id, interaction.user.id, reason]
        );

        const embed = new EmbedBuilder()
            .setColor('#FFA500')
            .setTitle('⚠️ Avertissement (Warn)')
            .setDescription(`**Membre :** ${target}\n**Raison :** ${reason}`)
            .setFooter({ text: `Modérateur : ${interaction.user.tag}` });

        interaction.reply({ embeds: [embed] });
        target.send(`⚠️ Tu as reçu un avertissement sur **${interaction.guild.name}** pour : ${reason}`).catch(()=>{});
    }
};