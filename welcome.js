const { GlobalFonts, Canvas, Image, SKRSContext2D, loadImage } = require('@napi-rs/canvas');
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
    // 1. Récupération des paramètres
    let bgUrl = settings.welcome_bg;
    
    // Si c'est un fichier local (/uploads/...), on construit le chemin complet du disque
    if (bgUrl && bgUrl.startsWith('/uploads/')) {
        bgUrl = path.join(__dirname, 'public', bgUrl); 
    }
    // Si pas d'image définie, fallback sur une couleur
    if (!bgUrl || bgUrl === '') bgUrl = null;

    const titleText = settings.welcome_title || 'BIENVENUE';
    const colTitle = settings.welcome_title_color || '#ffffff';
    const colUser = settings.welcome_user_color || '#ffffff';
    const colBorder = settings.welcome_border_color || '#ffffff';
    const opacity = settings.welcome_opacity !== undefined ? Number(settings.welcome_opacity) : 0.3;
    const isCircle = settings.welcome_shape !== 'square';

    const canvas = new Canvas(700, 250);
    const ctx = canvas.getContext('2d');

    // 2. Dessin du Fond (Sécurisé)
    let bgLoaded = false;
    if (bgUrl) {
        try {
            const bg = await loadImage(bgUrl);
            applyRoundedCorners(ctx, 0, 0, 700, 250, 30);
            ctx.drawImage(bg, 0, 0, 700, 250);
            bgLoaded = true;
        } catch (e) {
            console.error("Erreur chargement image fond:", e.message);
        }
    }

    if (!bgLoaded) {
        // Fond de secours si l'image est cassée ou absente
        applyRoundedCorners(ctx, 0, 0, 700, 250, 30);
        ctx.fillStyle = '#ff9aa2'; // Rose par défaut
        ctx.fillRect(0, 0, 700, 250);
    }

    // 3. Overlay
    ctx.save();
    ctx.fillStyle = `rgba(0, 0, 0, ${opacity})`;
    ctx.fillRect(0, 0, 700, 250);
    ctx.restore();

    // 4. Avatar
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
    } catch (e) {
        console.error("Erreur avatar:", e);
    }

    // 5. Textes
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