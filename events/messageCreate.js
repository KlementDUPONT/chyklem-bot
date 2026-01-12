const { Events } = require('discord.js');

// Anti-Spam : On garde en mémoire qui a parlé récemment
const cooldowns = new Set(); 

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        // 1. Ignorer les bots et les messages privés
        if (message.author.bot || !message.guild) return;

        // 2. Anti-Spam (1 XP par minute max par personne)
        const userId = message.author.id;
        const guildId = message.guild.id;
        const cooldownKey = `${guildId}-${userId}`;

        if (cooldowns.has(cooldownKey)) return;

        // 3. Calcul de l'XP (Entre 15 et 25)
        const xpToAdd = Math.floor(Math.random() * 11) + 15;

        // 4. Sauvegarde en Base de Données
        const client = message.client;
        
        try {
            // On récupère l'XP actuel
            let [rows] = await client.db.query('SELECT * FROM levels WHERE user_id = ? AND guild_id = ?', [userId, guildId]);
            
            let xp = 0;
            let level = 0;

            if (rows.length > 0) {
                xp = rows[0].xp;
                level = rows[0].level;
            }

            // On ajoute le nouvel XP
            xp += xpToAdd;

            // Formule de niveau : Niveau = Racine carrée de (XP / 100)
            // Exemple: 100xp = Niv 1, 400xp = Niv 2, 900xp = Niv 3
            const nextLevel = Math.floor(0.1 * Math.sqrt(xp));

            // Si on monte de niveau !
            if (nextLevel > level) {
                level = nextLevel;
                message.channel.send(`🎉 Bravo ${message.author}, tu passes au **Niveau ${level}** ! 🌸`);
            }

            // Mise à jour DB (INSERT ou UPDATE)
            await client.db.query(`
                INSERT INTO levels (user_id, guild_id, xp, level) 
                VALUES (?, ?, ?, ?) 
                ON DUPLICATE KEY UPDATE xp = ?, level = ?
            `, [userId, guildId, xp, level, xp, level]);

            // Ajout du cooldown (60 secondes)
            cooldowns.add(cooldownKey);
            setTimeout(() => cooldowns.delete(cooldownKey), 60000);

        } catch (error) {
            console.error("❌ Erreur XP :", error);
        }
    },
};