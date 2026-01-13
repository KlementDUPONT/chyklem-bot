const { Events, AttachmentBuilder } = require('discord.js');
const Canvas = require('canvas');

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member) {
        const client = member.client;
        
        // 1. RÉCUPÉRATION CONFIGURATION
        const [rows] = await client.db.query(
            'SELECT * FROM guild_settings WHERE guild_id = ?', 
            [member.guild.id]
        );
        
        if (rows.length === 0) return;
        const config = rows[0];

        // ====================================================
        // 🛡️ SÉCURITÉ : ANTI-RAID
        // ====================================================
        if (config.antiraid_enabled) {
            // Calcul de l'âge du compte en jours
            const createdTimestamp = member.user.createdTimestamp;
            const now = Date.now();
            const ageInDays = (now - createdTimestamp) / (1000 * 60 * 60 * 24);

            if (ageInDays < config.antiraid_account_age_days) {
                // TROP JEUNE !
                console.log(`🚨 Anti-Raid: ${member.user.tag} expulsé (Compte de ${Math.floor(ageInDays)} jours).`);
                
                // On essaie de prévenir l'utilisateur
                await member.send(`🛑 **Sécurité** : Tu as été expulsé de **${member.guild.name}**.\n⚠️ Ton compte est trop récent (créé il y a moins de ${config.antiraid_account_age_days} jours). Reviens plus tard !`).catch(() => {});

                // On expulse et ON ARRÊTE TOUT (pas de bienvenue)
                await member.kick('Anti-Raid: Compte trop récent');
                return; 
            }
        }

        // ====================================================
        // 🤖 AUTO-ROLE
        // ====================================================
        if (config.autorole_id) {
            const role = member.guild.roles.cache.get(config.autorole_id);
            if (role) {
                await member.roles.add(role).catch(err => console.error(`Erreur AutoRole pour ${member.user.tag}:`, err.code));
            }
        }

        // ====================================================
        // 🎨 IMAGE DE BIENVENUE
        // ====================================================
        if (!config.welcome_channel_id) return;
        const channel = member.guild.channels.cache.get(config.welcome_channel_id);
        if (!channel) return;

        try {
            const canvas = Canvas.createCanvas(700, 250);
            const ctx = canvas.getContext('2d');

            // Fond
            const background = await Canvas.loadImage('https://i.imgur.com/vH1W4Qc.jpeg');
            ctx.drawImage(background, 0, 0, canvas.width, canvas.height);

            // Filtre sombre
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.fillRect(20, 20, 660, 210);

            // Texte
            ctx.font = 'bold 60px sans-serif';
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.fillText('BIENVENUE', canvas.width / 1.6, 110);

            ctx.font = '35px sans-serif';
            ctx.fillStyle = '#FFB6C1';
            ctx.fillText(member.user.username.toUpperCase(), canvas.width / 1.6, 160);

            // Avatar
            ctx.beginPath();
            ctx.arc(125, 125, 100, 0, Math.PI * 2, true);
            ctx.closePath();
            ctx.clip();

            const avatar = await Canvas.loadImage(member.user.displayAvatarURL({ extension: 'jpg' }));
            ctx.drawImage(avatar, 25, 25, 200, 200);

            const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'welcome-image.png' });
            channel.send({ content: `Bienvenue ${member} ! 🌸`, files: [attachment] });

        } catch (error) {
            console.error("Erreur Canvas:", error);
        }
    },
};