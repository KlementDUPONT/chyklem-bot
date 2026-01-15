const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('action')
        .setDescription('Faire une action animée vers quelqu\'un')
        .addSubcommand(s => s.setName('hug').setDescription('Faire un câlin').addUserOption(o => o.setName('membre').setDescription('Cible').setRequired(true)))
        .addSubcommand(s => s.setName('kiss').setDescription('Embrasser').addUserOption(o => o.setName('membre').setDescription('Cible').setRequired(true)))
        .addSubcommand(s => s.setName('slap').setDescription('Donner une baffe').addUserOption(o => o.setName('membre').setDescription('Cible').setRequired(true)))
        .addSubcommand(s => s.setName('dance').setDescription('Danser de joie'))
        .addSubcommand(s => s.setName('pat').setDescription('Tapoter la tête (Pat)').addUserOption(o => o.setName('membre').setDescription('Cible').setRequired(true))),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const targetUser = interaction.options.getUser('membre');
        
        // --- 1. Gestion des Noms d'Affichage (Nicknames) ---
        // On récupère le membre (l'objet dans le serveur) pour avoir son surnom
        const authorMember = interaction.member;
        let targetMember = null;
        
        if (targetUser) {
            targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
        }

        // Si pas de surnom, on prend le pseudo de base
        const authorName = authorMember.displayName; 
        const targetName = targetMember ? targetMember.displayName : (targetUser ? targetUser.username : "le vide");

        await interaction.deferReply(); 

        let category = sub;
        
        try {
            // --- 2. Gestion du Compteur en DB ---
            let countText = "";
            
            // On ne compte que si une cible est visée et que ce n'est pas soi-même (optionnel)
            if (targetUser && targetUser.id !== interaction.user.id && sub !== 'dance') {
                const db = interaction.client.db;
                const guildId = interaction.guild.id;

                // On ajoute +1 au compteur
                await db.query(`
                    INSERT INTO action_counts (guild_id, user_from, user_to, action_type, count)
                    VALUES (?, ?, ?, ?, 1)
                    ON DUPLICATE KEY UPDATE count = count + 1
                `, [guildId, interaction.user.id, targetUser.id, sub]);

                // On récupère le nouveau total
                const [rows] = await db.query(`
                    SELECT count FROM action_counts 
                    WHERE guild_id = ? AND user_from = ? AND user_to = ? AND action_type = ?
                `, [guildId, interaction.user.id, targetUser.id, sub]);

                const total = rows[0]?.count || 1;
                
                // Petit texte personnalisé selon le total
                if (total === 1) countText = `\n\n*C'est la 1ère fois !*`;
                else countText = `\n\n*C'est la ${total}ème fois !*`;
            }

            // --- 3. Appel API Image ---
            const response = await fetch(`https://api.waifu.pics/sfw/${category}`);
            const data = await response.json();

            // --- 4. Textes ---
            let text = "";
            if (sub === 'hug') text = `🤗 **${authorName}** fait un gros câlin à **${targetName}** !`;
            if (sub === 'kiss') text = `😘 **${authorName}** fait un bisou à **${targetName}** !`;
            if (sub === 'slap') text = `👋 **${authorName}** gifle **${targetName}** ! Aïe !`;
            if (sub === 'pat') text = `🤚 **${authorName}** tapote la tête de **${targetName}** *pat pat*`;
            if (sub === 'dance') text = `💃 **${authorName}** se met à danser !`;

            // Ajout du compteur au texte (ou en footer)
            // Option A : Dans la description
            // text += countText; 

            const embed = new EmbedBuilder()
                .setColor('#FF69B4') 
                .setDescription(text)
                .setImage(data.url);

            // Option B : Dans le footer (Plus propre)
            if (countText) {
                // On enlève les sauts de ligne pour le footer
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