const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Expulse un membre du serveur')
        .addUserOption(option =>
            option.setName('membre')
                .setDescription('Le membre à expulser')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('raison')
                .setDescription('La raison de l\'expulsion'))
        .setDefaultMemberPermission(PermissionFlagsBits.KickMembers),

    async execute(interaction) {
        const target = interaction.options.getMember('membre');
        const reason = interaction.options.getString('raison') || 'Aucune raison fournie';

        if (!target) {
            return interaction.reply({ content: '❌ Je ne trouve pas ce membre sur le serveur.', ephemeral: true });
        }

        // Vérification Hiérarchie (On ne peut pas kick un admin ou le propriétaire)
        if (!target.kickable) {
            return interaction.reply({ content: '❌ Je ne peux pas expulser ce membre. Il a probablement un rôle supérieur au mien ou est administrateur.', ephemeral: true });
        }

        await target.kick(reason);
        return interaction.reply({ content:`👢 **${target.user.tag}** a été expulsé.\n📝 Raison : ${reason}` });
    }
};