const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const Canvas = require('canvas');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rank')
        .setDescription('Affiche ton niveau actuel ou celui d\'un membre')
        .addUserOption(option => option.setName('membre').setDescription('Le membre à voir')),
    
    async execute(interaction) {
        await interaction.deferReply(); // On prend le temps de dessiner

        const target = interaction.options.getUser('membre') || interaction.user;
        
        // Récupérer les données DB
        const [rows] = await interaction.client.db.query(
            'SELECT xp, level FROM levels WHERE user_id = ? AND guild_id = ?', 
            [target.id, interaction.guild.id]
        );

        const xp = rows.length ? rows[0].xp : 0;
        const level = rows.length ? rows[0].level : 0;

        // Calcul XP pour le prochain niveau (inverse de la formule précédente)
        // XP requis pour le niveau actuel et le suivant
        const currentLevelXp = Math.pow(level / 0.1, 2);
        const nextLevelXp = Math.pow((level + 1) / 0.1, 2);
        
        // XP dans la barre de progression
        const xpNeeded = nextLevelXp - currentLevelXp;
        const xpCurrentInLevel = xp - currentLevelXp;
        const progress = Math.max(0, Math.min(1, xpCurrentInLevel / xpNeeded));

        // --- DESSIN CANVAS ---
        const canvas = Canvas.createCanvas(700, 200);
        const ctx = canvas.getContext('2d');

        // Fond sombre
        ctx.fillStyle = '#23272A';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Fond dégradé Kawaii (barre du haut)
        const gradient = ctx.createLinearGradient(0, 0, 700, 0);
        gradient.addColorStop(0, '#FFB6C1'); // Rose
        gradient.addColorStop(1, '#A0C4FF'); // Bleu pastel
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 700, 10);

        // Texte Pseudo
        ctx.font = 'bold 40px sans-serif';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(target.username, 200, 80);

        // Texte Niveau
        ctx.font = '30px sans-serif';
        ctx.fillStyle = '#FFB6C1';
        ctx.fillText(`Niveau ${level}`, 200, 120);
        
        // Texte XP (petit)
        ctx.font = '20px sans-serif';
        ctx.fillStyle = '#AAAAAA';
        ctx.fillText(`${Math.floor(xpCurrentInLevel)} / ${Math.floor(xpNeeded)} XP`, 550, 120);

        // Barre de progression (Fond gris)
        ctx.fillStyle = '#40444B';
        ctx.fillRect(200, 140, 450, 30);

        // Barre de progression (Remplissage rose)
        ctx.fillStyle = '#FFB6C1';
        ctx.fillRect(200, 140, 450 * progress, 30);

        // Avatar (Rond)
        ctx.beginPath();
        ctx.arc(100, 100, 75, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.clip();
        
        const avatar = await Canvas.loadImage(target.displayAvatarURL({ extension: 'jpg' }));
        ctx.drawImage(avatar, 25, 25, 150, 150);

        // Envoi
        const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'rank.png' });
        await interaction.editReply({ files: [attachment] });
    }
};