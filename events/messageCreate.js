const { Events } = require('discord.js');
const cooldowns = new Set(); 

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        if (message.author.bot || !message.guild) return;

        const client = message.client;
        const guildId = message.guild.id;
        const userId = message.author.id;

        // 1. VÉRIFICATION : Est-ce que les niveaux sont activés ?
        const [settings] = await client.db.query('SELECT levels_enabled, level_up_message FROM guild_settings WHERE guild_id = ?', [guildId]);
        
        // Si pas de config ou module désactivé, on arrête tout
        if (settings.length === 0 || !settings[0].levels_enabled) return;
        const config = settings[0];

        // 2. ANTI-SPAM
        const key = `${guildId}-${userId}`;
        if (cooldowns.has(key)) return;

        // 3. LOGIQUE XP
        const xpAdd = Math.floor(Math.random() * 11) + 15;

        try {
            let [rows] = await client.db.query('SELECT * FROM levels WHERE user_id = ? AND guild_id = ?', [userId, guildId]);
            let xp = rows.length ? rows[0].xp : 0;
            let level = rows.length ? rows[0].level : 0;

            xp += xpAdd;
            const nextLevel = Math.floor(0.1 * Math.sqrt(xp));

            if (nextLevel > level) {
                level = nextLevel;
                // Message personnalisé
                let msg = config.level_up_message || "🎉 Bravo {user}, tu passes au Niveau {level} !";
                msg = msg.replace('{user}', message.author).replace('{level}', level);
                message.channel.send(msg);
            }

            await client.db.query(`INSERT INTO levels (user_id, guild_id, xp, level) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE xp=?, level=?`, [userId, guildId, xp, level, xp, level]);
            
            cooldowns.add(key);
            setTimeout(() => cooldowns.delete(key), 60000);
        } catch (e) { console.error(e); }
    },
};