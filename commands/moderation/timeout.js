const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('timeout')
        .setDescription('Exclut temporairement un membre (Mute)')
        .addUserOption(option => 
            option.setName('membre')
                .setDescription('Le membre à rendre muet')
                .setRequired(true))
        .addIntegerOption(option => 
            option.setName('duree')
                .setDescription('Durée en minutes')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(40320)) // 4 semaines max (limite Discord)
        .addStringOption(option => 
            option.setName('raison')
                .setDescription('La raison de la sanction'))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        const target = interaction.options.getMember('membre');
        const minutes = interaction.options.getInteger('duree');
        const reason = interaction.options.getString('raison') || 'Aucune raison fournie';

        // Vérifications de base
        if (!target) return interaction.reply({ content: '❌ Membre introuvable.', ephemeral: true });
        
        if (!target.moderatable) {
            return interaction.reply({ content: '❌ Je ne peux pas rendre muet ce membre (Rôle supérieur ou Admin).', ephemeral: true });
        }

        // Conversion des minutes en millisecondes
        const durationMs = minutes * 60 * 1000;

        try {
            // Envoi d'un MP pour prévenir
            await target.send(`🤐 Tu as été mis en exclusion temporaire sur **${interaction.guild.name}** pendant **${minutes} minutes**.\n📝 Raison : ${reason}`).catch(() => {});

            // Application du Timeout
            await target.timeout(durationMs, reason);

            const embed = new EmbedBuilder()
                .setColor('#FF9900')
                .setTitle('🤐 Membre Exclu (Timeout)')
                .setDescription(`**${target.user.tag}** est muet pendant **${minutes} minutes**.\n📝 Raison : ${reason}`)
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error(error);
            return interaction.reply({ content: '❌ Une erreur est survenue lors du timeout.', ephemeral: true });
        }
    }
};