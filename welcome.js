const { Canvas, loadImage } = require('@napi-rs/canvas');
const fs = require('fs');
const path = require('path');

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
    // --- 1. CHEMIN DE L'IMAGE LOCALE ---
    // On construit le chemin vers /app/assets/banner.png
    const localPath = path.join(process.cwd(), 'assets', 'banner.png');

    // --- 2. RÉGLAGES ---
    // On nettoie l'opacité (remplace virgule par point)
    let opacity = settings.welcome_opacity;
    if (typeof opacity === 'string') opacity = opacity.replace(',', '.');
    opacity = parseFloat(opacity);
    if (isNaN(opacity) || opacity < 0 || opacity > 1) opacity = 0.3;

    const titleText = settings.welcome_title || 'BIENVENUE';
    const colTitle = settings.welcome_title_color || '#ffffff';
    const colUser = settings.welcome_user_color || '#ffffff';
    const colBorder = settings.welcome_border_color || '#ffffff';
    const isCircle = settings.welcome_shape !== 'square';

    // --- 3. DESSIN ---
    const canvas = new Canvas(700, 250);
    const ctx = canvas.getContext('2d');

    // Chargement de l'image locale
    let bgLoaded = false;
    if (fs.existsSync(localPath)) {
        try {
            const bg = await loadImage(localPath);
            applyRoundedCorners(ctx, 0, 0, 700, 250, 30);
            ctx.drawImage(bg, 0, 0, 700, 250);
            bgLoaded = true;
        } catch (e) {
            console.error(`[ERREUR] Image locale corrompue : ${localPath}`);
        }
    } else {
        console.error(`[ERREUR] Image introuvable ici : ${localPath}`);
    }

    // Fond de secours (Si tu as oublié de mettre l'image dans le dossier)
    if (!bgLoaded) {
        applyRoundedCorners(ctx, 0, 0, 700, 250, 30);
        ctx.fillStyle = '#ff9aa2'; // Rose
        ctx.fillRect(0, 0, 700, 250);
    }

    // Overlay Sombre
    ctx.save();
    ctx.fillStyle = `rgba(0, 0, 0, ${opacity})`;
    ctx.fillRect(0, 0, 700, 250);
    ctx.restore();

    // Avatar
    try {
        const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 256 });
        const avatar = await loadImage(avatarUrl);
        
        ctx.save();
        ctx.beginPath();
        if (isCircle) {
            ctx.arc(125, 125, 80, 0, Math.PI * 2, true);
        } else {
            const r = 20; const x=45, y=45, w=160, h=160;
            ctx.moveTo(x+r, y); ctx.lineTo(x+w-r, y); ctx.quadraticCurveTo(x+w, y, x+w, y+r);
            ctx.lineTo(x+w, y+h-r); ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
            ctx.lineTo(x+r, y+h); ctx.quadraticCurveTo(x, y+h, x, y+h-r);
            ctx.lineTo(x, y+r); ctx.quadraticCurveTo(x, y, x+r, y);
        }
        ctx.closePath();
        ctx.lineWidth = 8;
        ctx.strokeStyle = colBorder;
        ctx.stroke();
        ctx.clip();
        ctx.drawImage(avatar, 45, 45, 160, 160);
        ctx.restore();
    } catch (e) { console.error("Erreur avatar:", e.message); }

    // Textes
    ctx.fillStyle = colTitle;
    ctx.font = 'bold 40px Sans-serif';
    ctx.fillText(titleText, 250, 110);

    ctx.fillStyle = colUser;
    ctx.font = '60px Sans-serif';
    let fontSize = 60;
    const name = member.displayName.toUpperCase();
    do {
        ctx.font = `${fontSize -= 2}px Sans-serif`;
    } while (ctx.measureText(name).width > 400 && fontSize > 10);
    ctx.fillText(name, 250, 175);

    return canvas.toBuffer('image/png');
};