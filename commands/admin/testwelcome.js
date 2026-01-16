const { SlashCommandBuilder, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const generateWelcomeImage = require('../../welcome'); // On charge le moteur de dessin

module.exports = {
    data: new SlashCommandBuilder()
        .setName('testwelcome')
        .setDescription('Teste l\'image de bienvenue avec ma configuration actuelle'),
    
    async execute(interaction) {
        // Sécurité : Admin uniquement
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: "⛔ Pas de permission.", ephemeral: true });
        }

        await interaction.deferReply(); // On dit à Discord "Attends, je réfléchis..."

        try {
            // 1. On va chercher ta config dans la DB
            const [settings] = await interaction.client.db.query(
                'SELECT * FROM guild_settings WHERE guild_id = ?', 
                [interaction.guild.id]
            );

            if (!settings.length) return interaction.editReply("⚠️ Le module n'est pas configuré.");

            const conf = settings[0];
            
            // LOG pour t'aider à comprendre ce qui cloche
            console.log("--- TEST WELCOME ---");
            console.log("Image URL:", conf.welcome_bg);
            console.log("Opacité:", conf.welcome_opacity);

            // 2. On génère l'image
            const buffer = await generateWelcomeImage(interaction.member, conf);
            const attachment = new AttachmentBuilder(buffer, { name: 'test-welcome.png' });

            // 3. On l'envoie
            await interaction.editReply({ 
                content: `🖼️ **Test d'image**\nURL utilisée : \`${conf.welcome_bg}\``, 
                files: [attachment] 
            });

        } catch (error) {
            console.error(error);
            await interaction.editReply(`❌ **Erreur :** ${error.message}`);
        }
    },
};