const { GlobalFonts, Canvas, Image, SKRSContext2D, loadImage } = require('@napi-rs/canvas');

// Fonction utilitaire pour les rectangles arrondis
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

/**
 * Génère l'image de bienvenue avec les paramètres avancés
 * @param {GuildMember} member - Le membre qui rejoint
 * @param {Object} settings - La configuration DB (couleurs, textes, etc.)
 */
module.exports = async (member, settings) => {
    // 1. Récupération des options (avec valeurs par défaut si vide)
    const bgUrl = settings.welcome_bg || 'https://i.imgur.com/vH1W4Qc.jpeg';
    const titleText = settings.welcome_title || 'BIENVENUE';
    const colTitle = settings.welcome_title_color || '#ffffff';
    const colUser = settings.welcome_user_color || '#ffffff';
    const colBorder = settings.welcome_border_color || '#ffffff';
    // Opacité : si indéfini, on met 0.3 par sécurité
    const opacity = settings.welcome_opacity !== undefined ? Number(settings.welcome_opacity) : 0.3;
    const isCircle = settings.welcome_shape !== 'square'; // Par défaut 'circle'

    // 2. Initialisation Canvas (700x250)
    const canvas = new Canvas(700, 250);
    const ctx = canvas.getContext('2d');

    // 3. Dessin du Fond
    try {
        const bg = await loadImage(bgUrl);
        // On coupe les coins du canvas global
        applyRoundedCorners(ctx, 0, 0, 700, 250, 30);
        ctx.drawImage(bg, 0, 0, 700, 250);
    } catch (e) {
        // Fallback couleur unie si l'image est cassée
        ctx.fillStyle = '#ff9aa2';
        ctx.fillRect(0, 0, 700, 250);
    }

    // 4. Overlay (Calque sombre ou coloré pour la lisibilité)
    // On réapplique le clip pour être sûr que le calque ne dépasse pas
    ctx.save();
    ctx.fillStyle = `rgba(0, 0, 0, ${opacity})`;
    ctx.fillRect(0, 0, 700, 250);
    ctx.restore();

    // 5. Avatar
    const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 256 });
    const avatar = await loadImage(avatarUrl);
    
    ctx.save();
    ctx.beginPath();
    
    // Logique Forme : Rond ou Carré Arrondi
    if (isCircle) {
        // Cercle (x=125, y=125, r=80)
        ctx.arc(125, 125, 80, 0, Math.PI * 2, true);
    } else {
        // Carré arrondi (x=45, y=45, w=160, h=160)
        const r = 20; // Rayon des coins du carré
        const x=45, y=45, w=160, h=160;
        ctx.moveTo(x+r, y); ctx.lineTo(x+w-r, y); ctx.quadraticCurveTo(x+w, y, x+w, y+r);
        ctx.lineTo(x+w, y+h-r); ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
        ctx.lineTo(x+r, y+h); ctx.quadraticCurveTo(x, y+h, x, y+h-r);
        ctx.lineTo(x, y+r); ctx.quadraticCurveTo(x, y, x+r, y);
    }
    
    ctx.closePath();
    
    // Bordure
    ctx.lineWidth = 8;
    ctx.strokeStyle = colBorder;
    ctx.stroke();
    
    // Coupure et dessin de l'image
    ctx.clip();
    ctx.drawImage(avatar, 45, 45, 160, 160);
    ctx.restore();

    // 6. Textes
    // Titre (BIENVENUE)
    ctx.fillStyle = colTitle;
    ctx.font = 'bold 40px Sans-serif';
    ctx.fillText(titleText, 250, 110);

    // Pseudo (Auto-scaling)
    ctx.fillStyle = colUser;
    ctx.font = '60px Sans-serif';
    let fontSize = 60;
    const name = member.displayName.toUpperCase();
    
    // Réduit la police tant que le texte est trop large (> 400px)
    do {
        ctx.font = `${fontSize -= 2}px Sans-serif`;
    } while (ctx.measureText(name).width > 400 && fontSize > 10);
    
    ctx.fillText(name, 250, 175);

    return canvas.toBuffer('image/png');
};