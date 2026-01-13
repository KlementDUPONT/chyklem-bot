const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Bannit un membre définitivement')
        .addUserOption(option => 
            option.setName('membre')
                .setDescription('Le membre à bannir')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('raison')
                .setDescription('La raison du bannissement'))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    async execute(interaction) {
        const target = interaction.options.getMember('membre');
        const reason = interaction.options.getString('raison') || 'Aucune raison fournie';

        if (!target) {
            return interaction.reply({ content: '❌ Ce membre n\'est pas sur le serveur.', ephemeral: true });
        }

        if (!target.bannable) {
            return interaction.reply({ content: '❌ Je ne peux pas bannir ce membre (Rôle supérieur ou Admin).', ephemeral: true });
        }

        // On essaie d'envoyer un MP à la personne avant de la bannir (c'est plus pro !)
        await target.send(`🛑 Tu as été banni de **${interaction.guild.name}**.\n📝 Raison : ${reason}`).catch(() => {});

        await target.ban({ reason: reason });
        return interaction.reply({ content: `🔨 **${target.user.tag}** a été banni.\n📝 Raison : ${reason}` });
    }
};