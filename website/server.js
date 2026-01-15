const express = require('express');
const session = require('express-session');
const passport = require('passport');
const { Strategy } = require('passport-discord');
const path = require('path');

module.exports = (client) => {
    const app = express();
    const port = process.env.PORT || 3000;

    // --- PASSPORT ---
    passport.serializeUser((user, done) => done(null, user));
    passport.deserializeUser((obj, done) => done(null, obj));
    passport.use(new Strategy({
        clientID: client.user.id,
        clientSecret: process.env.DISCORD_CLIENT_SECRET,
        callbackURL: process.env.CALLBACK_URL,
        scope: ['identify', 'guilds']
    }, (accessToken, refreshToken, profile, done) => process.nextTick(() => done(null, profile))));

    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, 'views'));
    app.use(express.urlencoded({ extended: true }));
    app.use(session({ secret: 'kawaai-secret', resave: false, saveUninitialized: false }));
    app.use(passport.initialize());
    app.use(passport.session());

    // ROUTES BASE
    app.get('/', (req, res) => res.render('index', { user: req.user, bot: client.user }));
    app.get('/login', passport.authenticate('discord'));
    app.get('/auth/discord/callback', passport.authenticate('discord', { failureRedirect: '/' }), (req, res) => res.redirect('/dashboard'));
    app.get('/logout', (req, res) => { req.logout(() => {}); res.redirect('/'); });

    // DASHBOARD
    app.get('/dashboard', (req, res) => {
        if (!req.user) return res.redirect('/login');
        const adminGuilds = req.user.guilds.filter(g => (g.permissions & 0x8) === 0x8);
        const finalGuilds = adminGuilds.map(guild => ({ ...guild, botInGuild: client.guilds.cache.has(guild.id) }));
        res.render('dashboard', { user: req.user, bot: client.user, guilds: finalGuilds });
    });

    // SETTINGS (Affichage)
    app.get('/settings/:guildId', async (req, res) => {
        if (!req.user) return res.redirect('/login');
        const guildId = req.params.guildId;
        const guild = client.guilds.cache.get(guildId);
        if (!guild) return res.redirect('/dashboard');

        // Récupération de TOUTES les données
        const [settings] = await client.db.query('SELECT * FROM guild_settings WHERE guild_id = ?', [guildId]);
        const [customCommands] = await client.db.query('SELECT * FROM custom_commands WHERE guild_id = ?', [guildId]);
        const [economyTop] = await client.db.query('SELECT * FROM economy WHERE guild_id = ? ORDER BY money DESC LIMIT 5', [guildId]);
        const [timers] = await client.db.query('SELECT * FROM timers WHERE guild_id = ?', [guildId]);
        const [reactionRoles] = await client.db.query('SELECT * FROM reaction_roles WHERE guild_id = ?', [guildId]);

        res.render('settings', {
            user: req.user, guild, 
            settings: settings[0] || {}, 
            customCommands, economyTop, timers, reactionRoles,
            channels: guild.channels.cache, roles: guild.roles.cache,
            success: req.query.success === 'true',
            activeTab: req.query.tab || 'overview' // On récupère l'onglet actif
        });
    });

    // SAUVEGARDE GÉNÉRALE (Modules & Configs)
    app.post('/settings/:guildId', async (req, res) => {
        if (!req.user) return res.redirect('/login');
        const d = req.body;
        
        // Conversion des checkbox "on" en booléens true/false
        const mods = {
            welcome: d.module_welcome === 'on',
            levels: d.module_levels === 'on',
            economy: d.module_economy === 'on',
            moderation: d.module_moderation === 'on',
            social: d.module_social === 'on',
            customcmds: d.module_customcmds === 'on',
            timers: d.module_timers === 'on',
            tempvoice: d.module_tempvoice === 'on',
            reactionroles: d.module_reactionroles === 'on'
        };

        try {
            await client.db.query(`
                UPDATE guild_settings SET 
                module_welcome=?, module_levels=?, module_economy=?, module_moderation=?, module_social=?, module_customcmds=?, module_timers=?, module_tempvoice=?, module_reactionroles=?,
                welcome_channel_id=?, welcome_bg=?, welcome_color=?, log_channel_id=?, autorole_id=?, 
                level_up_message=?, automod_enabled=?, automod_words=?, 
                tempvoice_channel_id=?, tempvoice_category_id=?
                WHERE guild_id=?
            `, [
                mods.welcome, mods.levels, mods.economy, mods.moderation, mods.social, mods.customcmds, mods.timers, mods.tempvoice, mods.reactionroles,
                d.welcome_channel_id||null, d.welcome_bg||'', d.welcome_color||'#fff', d.log_channel_id||null, d.autorole_id||null,
                d.level_up_message, d.automod_enabled==='on', d.automod_words,
                d.tempvoice_channel_id||null, d.tempvoice_category_id||null,
                req.params.guildId
            ]);
            
            // On redirige vers l'onglet actuel (envoyé par un champ caché input 'current_tab')
            const tab = d.current_tab || 'overview';
            res.redirect(`/settings/${req.params.guildId}?success=true&tab=${tab}`);
        } catch (error) {
            console.error(error);
            res.send("Erreur SQL: " + error.message);
        }
    });

    // --- ROUTES ACTIONS SPECIFIQUES (Avec redirection Tab) ---

    // Timers
    app.post('/settings/:guildId/timers/add', async (req, res) => {
        const { channel_id, interval, message, role_id } = req.body;
        // Insertion avec role_id
        await client.db.query(
            'INSERT INTO timers (guild_id, channel_id, message, interval_minutes, role_id) VALUES (?, ?, ?, ?, ?)', 
            [req.params.guildId, channel_id, message, interval, role_id || null]
        );
        res.redirect(`/settings/${req.params.guildId}?tab=timers`);
    });
    
    app.post('/settings/:guildId/timers/delete', async (req, res) => {
        await client.db.query('DELETE FROM timers WHERE id = ?', [req.body.id]);
        res.redirect(`/settings/${req.params.guildId}?tab=timers`);
    });

    // Reaction Roles
    app.post('/settings/:guildId/rr/add', async (req, res) => {
        const { channel_id, message_id, emoji, role_id } = req.body;
        await client.db.query('INSERT INTO reaction_roles (guild_id, channel_id, message_id, emoji, role_id) VALUES (?, ?, ?, ?, ?)', [req.params.guildId, channel_id, message_id, emoji, role_id]);
        // Le bot réagit
        try {
            const guild = client.guilds.cache.get(req.params.guildId);
            const channel = guild.channels.cache.get(channel_id);
            const msg = await channel.messages.fetch(message_id);
            await msg.react(emoji);
        } catch(e){}
        res.redirect(`/settings/${req.params.guildId}?tab=reactionroles`);
    });
    app.post('/settings/:guildId/rr/delete', async (req, res) => {
        await client.db.query('DELETE FROM reaction_roles WHERE id = ?', [req.body.id]);
        res.redirect(`/settings/${req.params.guildId}?tab=reactionroles`);
    });

    // Commandes
    app.post('/settings/:guildId/commands/add', async (req, res) => {
        await client.db.query('INSERT INTO custom_commands (guild_id, trigger_word, response_text) VALUES (?, ?, ?)', [req.params.guildId, req.body.trigger, req.body.response]);
        res.redirect(`/settings/${req.params.guildId}?tab=customcmds`);
    });
    app.post('/settings/:guildId/commands/delete', async (req, res) => {
        await client.db.query('DELETE FROM custom_commands WHERE id = ?', [req.body.command_id]);
        res.redirect(`/settings/${req.params.guildId}?tab=customcmds`);
    });

    // Eco
    app.post('/settings/:guildId/economy/update', async (req, res) => {
        const { user_id, amount, action } = req.body;
        const val = parseInt(amount);
        let sql = '';
        if (action === 'add') sql = 'INSERT INTO economy (user_id, guild_id, money) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE money = money + ?';
        if (action === 'remove') sql = 'UPDATE economy SET money = GREATEST(0, money - ?) WHERE user_id = ? AND guild_id = ?';
        if (action === 'set') sql = 'INSERT INTO economy (user_id, guild_id, money) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE money = ?';
        if (action === 'add' || action === 'set') await client.db.query(sql, [user_id, req.params.guildId, val, val]);
        else await client.db.query(sql, [val, user_id, req.params.guildId]);
        
        res.redirect(`/settings/${req.params.guildId}?tab=economy`);
    });

    app.listen(port, () => console.log(`🌍 Dashboard sur ${port}`));
};