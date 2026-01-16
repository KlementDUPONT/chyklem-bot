const { GlobalFonts, Canvas, Image, loadImage } = require('@napi-rs/canvas');
const fs = require('fs');
const path = require('path');

// CHARGEMENT DE LA POLICE (Vital pour Docker/Coolify)
const fontPath = path.join(process.cwd(), 'assets', 'font.ttf');
if (fs.existsSync(fontPath)) {
    GlobalFonts.registerFromPath(fontPath, 'MyCustomFont');
} else {
    console.error("[ERREUR] Fichier 'assets/font.ttf' manquant ! Le texte ne s'affichera pas.");
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
    // 1. CHEMINS LOCAUX
    const localBgPath = path.join(process.cwd(), 'assets', 'banner.png');

    // 2. RÉGLAGES
    let opacity = settings.welcome_opacity;
    if (typeof opacity === 'string') opacity = opacity.replace(',', '.');
    opacity = parseFloat(opacity) || 0.5;

    const titleText = settings.welcome_title || 'BIENVENUE';
    const colTitle = settings.welcome_title_color || '#ffffff';
    const colUser = settings.welcome_user_color || '#ffffff';
    const colBorder = settings.welcome_border_color || '#ffffff';
    const isCircle = settings.welcome_shape !== 'square';

    // 3. CRÉATION CANVAS
    const canvas = new Canvas(700, 250);
    const ctx = canvas.getContext('2d');

    // FOND IMAGE
    try {
        if (fs.existsSync(localBgPath)) {
            const bg = await loadImage(localBgPath);
            applyRoundedCorners(ctx, 0, 0, 700, 250, 30);
            ctx.drawImage(bg, 0, 0, 700, 250);
        } else {
            // Fond rose si image absente
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
            ctx.roundRect(x, y, w, h, r); // Méthode simplifiée si dispo, sinon tracer manuel
        }
        ctx.closePath();
        ctx.lineWidth = 8;
        ctx.strokeStyle = colBorder;
        ctx.stroke();
        ctx.clip();
        ctx.drawImage(avatar, 45, 45, 160, 160);
        ctx.restore();
    } catch (e) { console.error("Erreur Avatar:", e); }

    // TEXTES (Avec la police chargée)
    // On utilise 'MyCustomFont' qu'on a enregistré en haut
    ctx.fillStyle = colTitle;
    ctx.font = 'bold 40px "MyCustomFont"'; 
    ctx.fillText(titleText, 250, 110);

    ctx.fillStyle = colUser;
    ctx.font = '48px "MyCustomFont"';
    
    // Auto-Resize du pseudo
    let fontSize = 60;
    const name = member.displayName.toUpperCase();
    do {
        ctx.font = `${fontSize -= 2}px "MyCustomFont"`;
    } while (ctx.measureText(name).width > 400 && fontSize > 10);
    
    ctx.fillText(name, 250, 175);

    return canvas.toBuffer('image/png');
};