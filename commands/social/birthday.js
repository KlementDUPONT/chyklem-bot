const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('birthday')
        .setDescription('Gérer son anniversaire')
        .addSubcommand(s => s
            .setName('set')
            .setDescription('Enregistrer sa date d\'anniversaire')
            .addIntegerOption(o => o.setName('jour').setDescription('Le jour (1-31)').setRequired(true).setMinValue(1).setMaxValue(31))
            .addIntegerOption(o => o.setName('mois').setDescription('Le mois (1-12)').setRequired(true).setMinValue(1).setMaxValue(12))
        )
        .addSubcommand(s => s
            .setName('check')
            .setDescription('Voir l\'anniversaire d\'un membre')
            .addUserOption(o => o.setName('membre').setDescription('Le membre').setRequired(false))
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        // Récupérer le membre ciblé ou soi-même
        // .member donne accès au surnom spécifique au serveur
        let targetMember = interaction.member; 
        const targetUserOption = interaction.options.getUser('membre');
        
        if (targetUserOption) {
            targetMember = await interaction.guild.members.fetch(targetUserOption.id).catch(() => null);
        }

        // Nom d'affichage à utiliser (Surnom serveur > Pseudo global > "Inconnu")
        const displayName = targetMember ? targetMember.displayName : (targetUserOption ? targetUserOption.username : interaction.user.username);
        const targetId = targetMember ? targetMember.id : (targetUserOption ? targetUserOption.id : interaction.user.id);

        if (sub === 'set') {
            const day = interaction.options.getInteger('jour');
            const month = interaction.options.getInteger('mois');

            if ((month === 2 && day > 29) || ([4, 6, 9, 11].includes(month) && day > 30)) {
                return interaction.reply({ content: '❌ Cette date n\'existe pas !', ephemeral: true });
            }

            try {
                await interaction.client.db.query(`
                    INSERT INTO birthdays (user_id, guild_id, day, month) 
                    VALUES (?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE day = ?, month = ?
                `, [interaction.user.id, guildId, day, month, day, month]);

                interaction.reply(`✅ C'est noté ! Je souhaiterai l'anniversaire de **${displayName}** le **${day}/${month}** ! 🎂`);
            } catch (e) {
                console.error(e);
                interaction.reply({ content: '❌ Erreur base de données.', ephemeral: true });
            }
        }

        if (sub === 'check') {
            const [rows] = await interaction.client.db.query(
                'SELECT day, month FROM birthdays WHERE user_id = ? AND guild_id = ?', 
                [targetId, guildId]
            );

            if (rows.length === 0) {
                return interaction.reply(`${displayName} n'a pas encore configuré son anniversaire.`);
            }

            const { day, month } = rows[0];
            interaction.reply(`🎂 L'anniversaire de **${displayName}** est le **${day}/${month}** !`);
        }
    }
};