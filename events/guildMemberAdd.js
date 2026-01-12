const { Events, AttachmentBuilder } = require('discord.js');
const Canvas = require('canvas');

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member) {
        const client = member.client;
        
        // 1. Chercher le salon configuré dans la DB
        const [rows] = await client.db.query('SELECT welcome_channel_id FROM guild_settings WHERE guild_id = ?', [member.guild.id]);
        if (rows.length === 0 || !rows[0].welcome_channel_id) return; // Pas de salon configuré

        const channel = member.guild.channels.cache.get(rows[0].welcome_channel_id);
        if (!channel) return;

        // 2. CRÉATION DE L'IMAGE KAWAII 🌸
        const canvas = Canvas.createCanvas(700, 250);
        const ctx = canvas.getContext('2d');

        // Fond (Rose dégradé ou image)
        // Tu peux remplacer cette URL par n'importe quelle image directe
        const background = await Canvas.loadImage('https://i.imgur.com/vH1W4Qc.jpeg'); // Un joli fond rose nuage
        ctx.drawImage(background, 0, 0, canvas.width, canvas.height);

        // Effet "Filtre sombre" pour que le texte ressorte
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(20, 20, 660, 210);

        // Texte "Bienvenue"
        ctx.font = 'bold 60px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText('BIENVENUE', canvas.width / 1.6, 110);

        // Pseudo du membre
        ctx.font = '35px sans-serif';
        ctx.fillStyle = '#FFB6C1'; // Rose clair
        ctx.fillText(member.user.username.toUpperCase(), canvas.width / 1.6, 160);

        // Avatar Rond
        ctx.beginPath();
        ctx.arc(125, 125, 100, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.clip();

        const avatar = await Canvas.loadImage(member.user.displayAvatarURL({ extension: 'jpg' }));
        ctx.drawImage(avatar, 25, 25, 200, 200);

        // 3. ENVOI
        const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'welcome-image.png' });
        channel.send({ content: `Bienvenue ${member} sur le serveur ! 🌸`, files: [attachment] });
    },
};