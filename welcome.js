const { GlobalFonts, Canvas, Image, loadImage } = require('@napi-rs/canvas');
const fs = require('fs');
const path = require('path');

// CHARGEMENT POLICE
const fontPath = path.join(process.cwd(), 'assets', 'font.ttf');
if (fs.existsSync(fontPath)) {
    GlobalFonts.registerFromPath(fontPath, 'MyCustomFont');
} else {
    console.error("[ERREUR] Fichier 'assets/font.ttf' manquant !");
}

function applyRoundedCorners(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.clip();
}

module.exports = async (member, settings) => {
    // 1. CHEMINS
    const localBgPath = path.join(process.cwd(), 'assets', 'banner.png');

    // 2. RÉGLAGES
    const opacity = 0.5;

    const titleText = settings.welcome_title || 'BIENVENUE';
    const colTitle = settings.welcome_title_color || '#ffffff';
    const colUser = settings.welcome_user_color || '#ffffff';
    const colBorder = settings.welcome_border_color || '#ffffff';
    const isCircle = settings.welcome_shape !== 'square';

    // 3. CANVAS
    const canvas = new Canvas(700, 250);
    const ctx = canvas.getContext('2d');

    // FOND
    try {
        if (fs.existsSync(localBgPath)) {
            const bg = await loadImage(localBgPath);
            applyRoundedCorners(ctx, 0, 0, 700, 250, 30);
            ctx.drawImage(bg, 0, 0, 700, 250);
        } else {
            applyRoundedCorners(ctx, 0, 0, 700, 250, 30);
            ctx.fillStyle = '#ff9aa2';
            ctx.fillRect(0, 0, 700, 250);
        }
    } catch (e) { console.error("Erreur Fond:", e); }

    // OVERLAY SOMBRE
    ctx.save();
    ctx.fillStyle = `rgba(0, 0, 0, ${opacity})`;
    ctx.fillRect(0, 0, 700, 250);
    ctx.restore();

    // AVATAR
    try {
        const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 256 });
        const avatar = await loadImage(avatarUrl);
        
        ctx.save();
        ctx.beginPath();
        if (isCircle) ctx.arc(125, 125, 80, 0, Math.PI * 2, true);
        else {
            const r = 20, x=45, y=45, w=160, h=160;
            ctx.roundRect(x, y, w, h, r);
        }
        ctx.closePath();
        ctx.lineWidth = 8;
        ctx.strokeStyle = colBorder;
        ctx.stroke();
        ctx.clip();
        ctx.drawImage(avatar, 45, 45, 160, 160);
        ctx.restore();
    } catch (e) { console.error("Erreur Avatar:", e); }

    // --- TEXTES INTELLIGENTS ---
    
    // Zone de sécurité : Le texte commence à 230px et NE DOIT PAS dépasser 500px (pour ne pas toucher le logo à droite)
    // Largeur Max autorisée = 270px
    const maxTextWidth = 270; 
    const startX = 230;

    ctx.textAlign = 'left';

    // 1. TITRE "BIENVENUE"
    ctx.fillStyle = colTitle;
    let titleSize = 50; // On tente 50px
    do {
        ctx.font = `bold ${titleSize}px "MyCustomFont"`;
        titleSize -= 2;
    } while (ctx.measureText(titleText).width > maxTextWidth && titleSize > 10);
    ctx.fillText(titleText, startX, 110);

    // 2. PSEUDO
    ctx.fillStyle = colUser;
    let nameSize = 32; // On tente 32px
    const name = member.displayName.toUpperCase();
    do {
        ctx.font = `${nameSize}px "MyCustomFont"`;
        nameSize -= 2;
    } while (ctx.measureText(name).width > maxTextWidth && nameSize > 10);
    
    ctx.fillText(name, startX, 175);

    return canvas.toBuffer('image/png');
};