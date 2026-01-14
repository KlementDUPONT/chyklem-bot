const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lockdown')
        .setDescription('Gérer le verrouillage des salons')
        .addSubcommand(s => s.setName('lock').setDescription('Verrouiller le salon actuel'))
        .addSubcommand(s => s.setName('unlock').setDescription('Déverrouiller le salon actuel'))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const channel = interaction.channel;
        const everyone = interaction.guild.roles.everyone;

        if (subcommand === 'lock') {
            // On refuse l'envoi de messages pour @everyone
            await channel.permissionOverwrites.edit(everyone, { SendMessages: false });
            
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('🔒 Salon Verrouillé')
                .setDescription('Ce salon a été mis en pause par un administrateur.\nMerci de patienter.');
            
            await interaction.reply({ embeds: [embed] });
        } 
        else if (subcommand === 'unlock') {
            // On remet la permission par défaut (null = hérite des réglages du serveur)
            // Ou true si tu veux forcer l'autorisation
            await channel.permissionOverwrites.edit(everyone, { SendMessages: null });

            const embed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('🔓 Salon Déverrouillé')
                .setDescription('Vous pouvez à nouveau discuter.');

            await interaction.reply({ embeds: [embed] });
        }
    }
};