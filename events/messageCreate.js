const { Events } = require('discord.js');
const cooldowns = new Set(); 

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        if (message.author.bot || !message.guild) return;

        const client = message.client;
        const guildId = message.guild.id;

        // --- 0. RÉCUPÉRATION CONFIG ---
        const [rows] = await client.db.query('SELECT * FROM guild_settings WHERE guild_id = ?', [guildId]);
        const config = rows[0] || {};

        // --- 1. AUTO-MOD (Anti-Insultes) ---
        if (config.automod_enabled && config.automod_words) {
            const badWords = config.automod_words.split(',').map(w => w.trim().toLowerCase());
            const content = message.content.toLowerCase();
            
            if (badWords.some(word => content.includes(word))) {
                if (!message.member.permissions.has('Administrator')) {
                    await message.delete().catch(()=>{});
                    const warningMsg = await message.channel.send(`⚠️ ${message.author}, surveille ton langage !`);
                    setTimeout(() => warningMsg.delete().catch(()=>{}), 5000);
                    return; 
                }
            }
        }

        // --- 2. COMMANDES PERSONNALISÉES (CUSTOM COMMANDS) ---
        // On vérifie si le message correspond exactement à un déclencheur
        try {
            const [customCmds] = await client.db.query('SELECT response_text FROM custom_commands WHERE guild_id = ? AND trigger_word = ?', [guildId, message.content]);
            
            if (customCmds.length > 0) {
                return message.channel.send(customCmds[0].response_text);
            }
        } catch (e) { console.error(e); }

        // --- 3. SYSTÈME XP ---
        if (!config.levels_enabled) return;

        const key = `${guildId}-${message.author.id}`;
        if (cooldowns.has(key)) return;

        const xpAdd = Math.floor(Math.random() * 11) + 15;

        try {
            let [userStats] = await client.db.query('SELECT * FROM levels WHERE user_id = ? AND guild_id = ?', [message.author.id, guildId]);
            let xp = userStats.length ? userStats[0].xp : 0;
            let level = userStats.length ? userStats[0].level : 0;

            xp += xpAdd;
            const nextLevel = Math.floor(0.1 * Math.sqrt(xp));

            if (nextLevel > level) {
                level = nextLevel;
                let msg = config.level_up_message || "🎉 Bravo {user}, tu passes au Niveau {level} !";
                message.channel.send(msg.replace('{user}', message.author).replace('{level}', level));

                // Récompense de Rôle
                const [rewards] = await client.db.query('SELECT role_id FROM level_rewards WHERE guild_id = ? AND level = ?', [guildId, level]);
                if (rewards.length > 0) {
                    const roleId = rewards[0].role_id;
                    const role = message.guild.roles.cache.get(roleId);
                    if (role) {
                        await message.member.roles.add(role).catch(e => console.error("Erreur role:", e));
                        message.channel.send(`🎁 Félicitations ! Tu as débloqué le rôle **${role.name}** !`);
                    }
                }
            }

            await client.db.query(`INSERT INTO levels (user_id, guild_id, xp, level) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE xp=?, level=?`, [message.author.id, guildId, xp, level, xp, level]);
            
            cooldowns.add(key);
            setTimeout(() => cooldowns.delete(key), 60000);
        } catch (e) { console.error(e); }
    },
};