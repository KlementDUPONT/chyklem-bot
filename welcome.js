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

    // TEXTES
    // ALIGNEMENT GAUCHE (Important !)
    ctx.textAlign = 'left';

    // Titre : GRAND (50px)
    ctx.fillStyle = colTitle;
    ctx.font = 'bold 50px "MyCustomFont"'; 
    // X passé de 250 à 230 pour coller à gauche
    ctx.fillText(titleText, 230, 110); 

    // Pseudo : PLUS PETIT (32px max)
    ctx.fillStyle = colUser;
    ctx.font = '32px "MyCustomFont"';
    
    let fontSize = 32;
    const name = member.displayName.toUpperCase();
    // Ajustement de la largeur max disponible (450px)
    do {
        ctx.font = `${fontSize -= 2}px "MyCustomFont"`;
    } while (ctx.measureText(name).width > 450 && fontSize > 10);
    
    // X passé de 250 à 230 pour coller à gauche
    ctx.fillText(name, 230, 175);

    return canvas.toBuffer('image/png');
};