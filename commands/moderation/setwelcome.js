const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setwelcome')
        .setDescription('Configure le système de bienvenue')
        .addChannelOption(option => 
            option.setName('salon')
                .setDescription('Le salon où envoyer le message')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('image')
                .setDescription('Lien de l\'image de fond (http...)')
                .setRequired(false))
        .addStringOption(option => 
            option.setName('couleur')
                .setDescription('Couleur du texte et du cercle (ex: #ff0000 ou rouge)')
                .setRequired(false)),

    async execute(interaction) {
        // Vérification des permissions (Admin seulement)
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: "⛔ Tu n'as pas la permission !", ephemeral: true });
        }

        const channel = interaction.options.getChannel('salon');
        const imageUrl = interaction.options.getString('image');
        const color = interaction.options.getString('couleur') || '#ffffff'; // Blanc par défaut

        // Vérification basique du lien image
        if (imageUrl && !imageUrl.startsWith('http')) {
            return interaction.reply({ content: "❌ L'image doit être un lien valide (commençant par http).", ephemeral: true });
        }

        try {
            // Mise à jour de la Base de Données
            // On utilise ON DUPLICATE KEY UPDATE pour créer ou mettre à jour
            await interaction.client.db.query(`
                INSERT INTO guild_settings (guild_id, module_welcome, welcome_channel_id, welcome_bg, welcome_color) 
                VALUES (?, 1, ?, ?, ?)
                ON DUPLICATE KEY UPDATE 
                module_welcome = 1,
                welcome_channel_id = ?, 
                welcome_bg = COALESCE(?, welcome_bg), 
                welcome_color = ?
            `, [
                interaction.guild.id, channel.id, imageUrl, color, // Insert values
                channel.id, imageUrl, color // Update values
            ]);

            let replyMsg = `✅ **Bienvenue configuré !**\n\n📜 Salon : ${channel}\n🎨 Couleur : \`${color}\``;
            if (imageUrl) replyMsg += `\n🖼️ Fond : [Voir l'image](${imageUrl})`;
            else replyMsg += `\n🖼️ Fond : *(Celui actuel ou par défaut)*`;

            await interaction.reply({ content: replyMsg, ephemeral: true });

        } catch (error) {
            console.error(error);
            await interaction.reply({ content: "❌ Erreur lors de la sauvegarde en base de données.", ephemeral: true });
        }
    },
};