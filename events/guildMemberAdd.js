const { Events, AttachmentBuilder } = require('discord.js');
const Canvas = require('canvas');

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member) {
        const client = member.client;
        
        const [rows] = await client.db.query('SELECT * FROM guild_settings WHERE guild_id = ?', [member.guild.id]);
        if (rows.length === 0) return;
        const config = rows[0];

        // --- ANTI-RAID & AUTO-ROLE (Code inchangé, je le raccourcis ici pour la lisibilité) ---
        if (config.antiraid_enabled) { /* ... ton code anti-raid ... */ }
        if (config.autorole_id) { 
            const role = member.guild.roles.cache.get(config.autorole_id);
            if (role) await member.roles.add(role).catch(()=>{});
        }

        // --- IMAGE DE BIENVENUE PERSONNALISÉE ---
        if (!config.welcome_channel_id) return;
        const channel = member.guild.channels.cache.get(config.welcome_channel_id);
        if (!channel) return;

        try {
            const canvas = Canvas.createCanvas(700, 250);
            const ctx = canvas.getContext('2d');

            // 1. Fond Personnalisé (ou par défaut)
            // Si l'URL est cassée, on met le fond par défaut pour éviter le crash
            let background;
            try {
                background = await Canvas.loadImage(config.welcome_bg || 'https://i.imgur.com/vH1W4Qc.jpeg');
            } catch (err) {
                background = await Canvas.loadImage('https://i.imgur.com/vH1W4Qc.jpeg');
            }
            ctx.drawImage(background, 0, 0, canvas.width, canvas.height);

            // Filtre sombre pour lire le texte
            ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
            ctx.fillRect(20, 20, 660, 210);

            // 2. Couleur Personnalisée
            const textColor = config.welcome_color || '#ffffff';

            // Texte BIENVENUE
            ctx.font = 'bold 60px sans-serif';
            ctx.fillStyle = textColor;
            ctx.textAlign = 'center';
            ctx.fillText('BIENVENUE', canvas.width / 1.6, 110);

            // Pseudo
            ctx.font = '35px sans-serif';
            ctx.fillStyle = textColor;
            ctx.fillText(member.user.username.toUpperCase(), canvas.width / 1.6, 160);

            // Avatar
            ctx.beginPath();
            ctx.arc(125, 125, 100, 0, Math.PI * 2, true);
            ctx.closePath();
            ctx.clip();
            const avatar = await Canvas.loadImage(member.user.displayAvatarURL({ extension: 'jpg' }));
            ctx.drawImage(avatar, 25, 25, 200, 200);

            const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'welcome.png' });
            channel.send({ content: `Bienvenue ${member} !`, files: [attachment] });

        } catch (error) {
            console.error("Erreur Canvas:", error);
        }
    },
};