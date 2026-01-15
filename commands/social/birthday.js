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

        if (sub === 'set') {
            const day = interaction.options.getInteger('jour');
            const month = interaction.options.getInteger('mois');

            // Validation de date basique
            if ((month === 2 && day > 29) || ([4, 6, 9, 11].includes(month) && day > 30)) {
                return interaction.reply({ content: '❌ Cette date n\'existe pas !', ephemeral: true });
            }

            try {
                await interaction.client.db.query(`
                    INSERT INTO birthdays (user_id, guild_id, day, month) 
                    VALUES (?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE day = ?, month = ?
                `, [interaction.user.id, guildId, day, month, day, month]);

                interaction.reply(`✅ C'est noté ! Je te souhaiterai ton anniversaire le **${day}/${month}** ! 🎂`);
            } catch (e) {
                console.error(e);
                interaction.reply({ content: '❌ Erreur base de données.', ephemeral: true });
            }
        }

        if (sub === 'check') {
            // On récupère le membre complet pour avoir le displayName
            const user = interaction.options.getUser('membre') || interaction.user;
            const target = interaction.guild.members.cache.get(user.id) || user;
            
            const [rows] = await interaction.client.db.query(
                'SELECT day, month FROM birthdays WHERE user_id = ? AND guild_id = ?', 
                [user.id, guildId]
            );

            if (rows.length === 0) {
                // Utilisation de displayName
                return interaction.reply(`${target.displayName} n'a pas encore configuré son anniversaire.`);
            }

            const { day, month } = rows[0];
            // Utilisation de displayName
            interaction.reply(`🎂 L'anniversaire de **${target.displayName}** est le **${day}/${month}** !`);
        }
    }
};