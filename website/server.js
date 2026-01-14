app.post('/settings/:guildId', async (req, res) => {
        if (!req.user) return res.redirect('/login');
        const guildId = req.params.guildId;
        const isOwner = req.user.guilds.find(g => g.id === guildId && (g.permissions & 0x8) === 0x8);
        if (!isOwner) return res.status(403).send('Forbidden');

        const d = req.body;
        
        // Données existantes
        const welcomeChannel = d.welcome_channel_id || null;
        const welcomeBg = d.welcome_bg || 'https://i.imgur.com/vH1W4Qc.jpeg';
        const welcomeColor = d.welcome_color || '#ffffff';
        const logChannel = d.log_channel_id || null;
        const autoRole = d.autorole_id || null;
        const antiRaidEnabled = d.antiraid_enabled === 'on';
        const antiRaidDays = parseInt(d.antiraid_days) || 7;
        const levelsEnabled = d.levels_enabled === 'on';
        const levelMsg = d.level_up_message || "🎉 Bravo {user}, tu passes au Niveau {level} !";
        
        // NOUVEAU : Auto-Mod
        const automodEnabled = d.automod_enabled === 'on';
        const automodWords = d.automod_words || "";

        try {
            await client.db.query(`
                INSERT INTO guild_settings 
                (guild_id, welcome_channel_id, welcome_bg, welcome_color, log_channel_id, autorole_id, antiraid_enabled, antiraid_account_age_days, levels_enabled, level_up_message, automod_enabled, automod_words)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE 
                welcome_channel_id=?, welcome_bg=?, welcome_color=?, log_channel_id=?, autorole_id=?, antiraid_enabled=?, antiraid_account_age_days=?, levels_enabled=?, level_up_message=?, automod_enabled=?, automod_words=?
            `, [
                guildId, welcomeChannel, welcomeBg, welcomeColor, logChannel, autoRole, antiRaidEnabled, antiRaidDays, levelsEnabled, levelMsg, automodEnabled, automodWords,
                welcomeChannel, welcomeBg, welcomeColor, logChannel, autoRole, antiRaidEnabled, antiRaidDays, levelsEnabled, levelMsg, automodEnabled, automodWords
            ]);
            res.redirect(`/settings/${guildId}?success=true`);
        } catch (error) {
            console.error(error);
            res.send("Erreur.");
        }
    });