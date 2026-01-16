const { GlobalFonts, Canvas, Image, SKRSContext2D, loadImage } = require('@napi-rs/canvas');

// Fonction pour couper les coins (Arrondis Kawaii)
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

module.exports = async (member, backgroundUrl, textColor) => {
    // 1. Création du Canvas (700px x 250px)
    const canvas = new Canvas(700, 250);
    const ctx = canvas.getContext('2d');

    // 2. Fond (Background)
    try {
        const bg = await loadImage(backgroundUrl || 'https://i.imgur.com/vH1W4Qc.jpeg');
        // On applique des coins arrondis au fond
        applyRoundedCorners(ctx, 0, 0, 700, 250, 30);
        ctx.drawImage(bg, 0, 0, 700, 250);
    } catch (e) {
        // Fallback si l'image est cassée : Fond de couleur
        ctx.fillStyle = '#ff9aa2';
        ctx.fillRect(0, 0, 700, 250);
    }

    // 3. Calque sombre léger pour lisibilité
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(0, 0, 700, 250);

    // 4. Cercle de l'Avatar
    const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 256 });
    const avatar = await loadImage(avatarUrl);
    
    ctx.save(); // On sauvegarde l'état avant de couper
    ctx.beginPath();
    ctx.arc(125, 125, 80, 0, Math.PI * 2, true); // Cercle x=125, y=125, rayon=80
    ctx.closePath();
    ctx.lineWidth = 8;
    ctx.strokeStyle = textColor || '#ffffff';
    ctx.stroke(); // Bordure
    ctx.clip(); // On coupe tout ce qui dépasse
    ctx.drawImage(avatar, 45, 45, 160, 160);
    ctx.restore(); // On annule la coupure pour le texte

    // 5. Textes
    ctx.fillStyle = textColor || '#ffffff';
    
    // "BIENVENUE"
    ctx.font = 'bold 40px Sans-serif';
    ctx.fillText('BIENVENUE', 250, 110);

    // Pseudo
    ctx.font = '60px Sans-serif';
    let fontSize = 60;
    const name = member.displayName.toUpperCase();
    
    // Réduire la taille si le pseudo est trop long
    do {
        ctx.font = `${fontSize -= 2}px Sans-serif`;
    } while (ctx.measureText(name).width > 400);
    
    ctx.fillText(name, 250, 175);

    return canvas.toBuffer('image/png');
};