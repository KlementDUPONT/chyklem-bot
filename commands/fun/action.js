const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('action')
        .setDescription('Faire une action animée (Câlin, Bisou, Baffe...)')
        // 1. On remplace les sous-commandes par une liste de choix (String Option)
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Le type d\'action à effectuer')
                .setRequired(true)
                .addChoices(
                    { name: '🤗 Câlin (Hug)', value: 'hug' },
                    { name: '😘 Bisou (Kiss)', value: 'kiss' },
                    { name: '👋 Baffe (Slap)', value: 'slap' },
                    { name: '🤚 Pat (Tapoter)', value: 'pat' },
                    { name: '💃 Danser (Dance)', value: 'dance' }
                ))
        // 2. Le membre devient une option unique (Optionnel pour "Danser")
        .addUserOption(option => 
            option.setName('membre')
                .setDescription('La personne visée (Obligatoire sauf pour Danser)')
                .setRequired(false)),

    async execute(interaction) {
        const actionType = interaction.options.getString('type');
        const targetUser = interaction.options.getUser('membre');

        // --- VÉRIFICATION : Cible obligatoire ? ---
        // Si l'action n'est pas "dance" ET qu'il n'y a pas de membre mentionné -> Erreur
        if (actionType !== 'dance' && !targetUser) {
            return interaction.reply({ 
                content: '❌ Tu dois mentionner quelqu\'un pour faire cette action !', 
                ephemeral: true 
            });
        }

        // Si on essaie de se faire l'action à soi-même (optionnel, pour éviter les bugs bizarres)
        /* if (targetUser && targetUser.id === interaction.user.id) {
            return interaction.reply({ content: "Tu ne peux pas te faire ça à toi-même !", ephemeral: true });
        } */

        await interaction.deferReply();

        // --- Gestion des Noms d'Affichage (Nicknames) ---
        const authorMember = interaction.member;
        let targetMember = null;
        if (targetUser) {
            targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
        }

        const authorName = authorMember.displayName; 
        const targetName = targetMember ? targetMember.displayName : (targetUser ? targetUser.username : "le vide");

        try {
            // --- Gestion du Compteur en DB ---
            let countText = "";
            
            // On compte seulement si ce n'est pas "dance" et qu'il y a une cible
            if (actionType !== 'dance' && targetUser) {
                const db = interaction.client.db;
                const guildId = interaction.guild.id;

                // Ajout +1
                await db.query(`
                    INSERT INTO action_counts (guild_id, user_from, user_to, action_type, count)
                    VALUES (?, ?, ?, ?, 1)
                    ON DUPLICATE KEY UPDATE count = count + 1
                `, [guildId, interaction.user.id, targetUser.id, actionType]);

                // Récupération du total
                const [rows] = await db.query(`
                    SELECT count FROM action_counts 
                    WHERE guild_id = ? AND user_from = ? AND user_to = ? AND action_type = ?
                `, [guildId, interaction.user.id, targetUser.id, actionType]);

                const total = rows[0]?.count || 1;
                countText = total === 1 ? `\n\n*C'est la 1ère fois !*` : `\n\n*C'est la ${total}ème fois !*`;
            }

            // --- Appel API ---
            // L'API utilise les mêmes mots clés (hug, kiss, slap...) que nos 'values'
            const response = await fetch(`https://api.waifu.pics/sfw/${actionType}`);
            const data = await response.json();

            // --- Textes ---
            let text = "";
            switch (actionType) {
                case 'hug': text = `🤗 **${authorName}** fait un gros câlin à **${targetName}** !`; break;
                case 'kiss': text = `😘 **${authorName}** fait un bisou à **${targetName}** !`; break;
                case 'slap': text = `👋 **${authorName}** gifle **${targetName}** ! Aïe !`; break;
                case 'pat': text = `🤚 **${authorName}** tapote la tête de **${targetName}** *pat pat*`; break;
                case 'dance': text = `💃 **${authorName}** se met à danser !`; break;
            }

            const embed = new EmbedBuilder()
                .setColor('#FF69B4') 
                .setDescription(text)
                .setImage(data.url);

            // Footer avec le compteur
            if (countText) {
                embed.setFooter({ text: countText.replace('\n\n*', '').replace('*', '') + ` • Powered by waifu.pics` });
            } else {
                embed.setFooter({ text: 'Powered by waifu.pics' });
            }

            await interaction.editReply({ content: targetUser ? `${targetUser}` : null, embeds: [embed] });

        } catch (error) {
            console.error(error);
            await interaction.editReply("❌ Oups, petit problème technique (API ou DB).");
        }
    }
};