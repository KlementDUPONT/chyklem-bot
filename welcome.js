const { GlobalFonts, Canvas, Image, loadImage } = require('@napi-rs/canvas');
const fs = require('fs');
const path = require('path');

// Charge la police (Indispensable)
const fontPath = path.join(process.cwd(), 'assets', 'font.ttf');
if (fs.existsSync(fontPath)) GlobalFonts.registerFromPath(fontPath, 'MyCustomFont');

function applyRoundedCorners(ctx, x, y, width, height, radius) {
    ctx.beginPath(); ctx.moveTo(x + radius, y); ctx.lineTo(x + width - radius, y); ctx.quadraticCurveTo(x + width, y, x + width, y + radius); ctx.lineTo(x + width, y + height - radius); ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height); ctx.lineTo(x + radius, y + height); ctx.quadraticCurveTo(x, y + height, x, y + height - radius); ctx.lineTo(x, y + radius); ctx.quadraticCurveTo(x, y, x + radius, y); ctx.closePath(); ctx.clip();
}

module.exports = async (member, settings) => {
    // 1. CONFIGURATION
    const canvas = new Canvas(700, 250);
    const ctx = canvas.getContext('2d');

    // Récupération des données DB
    const opacity = settings.welcome_opacity !== undefined ? Number(settings.welcome_opacity) : 0.5;
    const align = settings.welcome_align || 'left';
    
    // Si pas d'image DB, on prend la locale
    let bgUrl = settings.welcome_bg;
    const localFallback = path.join(process.cwd(), 'assets', 'banner.png');

    // 2. FOND
    try {
        let bgImage;
        if (bgUrl && bgUrl.startsWith('/uploads/')) {
            // Fichier uploadé
            bgImage = await loadImage(path.join(process.cwd(), 'public', bgUrl));
        } else if (bgUrl && bgUrl.startsWith('http')) {
            // Lien Web
            bgImage = await loadImage(bgUrl);
        } else if (fs.existsSync(localFallback)) {
            // Fichier Local par défaut
            bgImage = await loadImage(localFallback);
        }

        applyRoundedCorners(ctx, 0, 0, 700, 250, 30);
        if (bgImage) ctx.drawImage(bgImage, 0, 0, 700, 250);
        else { ctx.fillStyle = '#ff9aa2'; ctx.fillRect(0, 0, 700, 250); }

    } catch (e) { console.error("Erreur Fond:", e); ctx.fillStyle = '#333'; ctx.fillRect(0,0,700,250); }

    // 3. OVERLAY
    ctx.save();
    ctx.fillStyle = `rgba(0, 0, 0, ${opacity})`;
    ctx.fillRect(0, 0, 700, 250);
    ctx.restore();

    // 4. AVATAR CONFIGURABLE
    const ax = settings.welcome_avatar_x || 45;
    const ay = settings.welcome_avatar_y || 45;
    const as = settings.welcome_avatar_size || 160;
    
    try {
        const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 256 });
        const avatar = await loadImage(avatarUrl);
        ctx.save();
        ctx.beginPath();
        if (settings.welcome_shape === 'circle') ctx.arc(ax + as/2, ay + as/2, as/2, 0, Math.PI * 2, true);
        else ctx.roundRect(ax, ay, as, as, 20);
        ctx.closePath();
        ctx.lineWidth = 6;
        ctx.strokeStyle = settings.welcome_border_color || '#fff';
        ctx.stroke();
        ctx.clip();
        ctx.drawImage(avatar, ax, ay, as, as);
        ctx.restore();
    } catch (e) {}

    // 5. TEXTES ULTIMES
    ctx.textAlign = align;
    ctx.shadowColor = "rgba(0,0,0,0.8)"; // Ombre portée pour lisibilité
    ctx.shadowBlur = 4;

    // Titre
    const tx = settings.welcome_title_x || 230;
    const ty = settings.welcome_title_y || 110;
    const ts = settings.welcome_title_size || 50;
    
    ctx.fillStyle = settings.welcome_title_color || '#fff';
    ctx.font = `bold ${ts}px "MyCustomFont"`;
    ctx.fillText(settings.welcome_title || 'BIENVENUE', tx, ty);

    // Pseudo
    const ux = settings.welcome_user_x || 230;
    const uy = settings.welcome_user_y || 175;
    let us = settings.welcome_user_size || 32;
    
    ctx.fillStyle = settings.welcome_user_color || '#fff';
    // Auto-resize pseudo
    do {
        ctx.font = `${us}px "MyCustomFont"`;
        us -= 1;
    } while (ctx.measureText(member.displayName).width > (align==='center'?600:400) && us > 10);
    
    ctx.fillText(member.displayName.toUpperCase(), ux, uy);

    return canvas.toBuffer('image/png');
};