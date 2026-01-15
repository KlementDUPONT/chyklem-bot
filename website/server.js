const express = require('express');
const session = require('express-session');
const passport = require('passport');
const { Strategy } = require('passport-discord');
const path = require('path');

module.exports = (client) => {
    const app = express();
    const port = process.env.PORT || 3000;

    // --- CONFIGURATION PASSPORT ---
    passport.serializeUser((user, done) => done(null, user));
    passport.deserializeUser((obj, done) => done(null, obj));

    passport.use(new Strategy({
        clientID: client.user.id,
        clientSecret: process.env.DISCORD_CLIENT_SECRET,
        callbackURL: process.env.CALLBACK_URL,
        scope: ['identify', 'guilds']
    }, (accessToken, refreshToken, profile, done) => {
        process.nextTick(() => done(null, profile));
    }));

    // --- CONFIGURATION EXPRESS ---
    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, 'views'));
    app.use(express.urlencoded({ extended: true }));
    
    app.use(session({
        secret: 'kawaai-secret-super-secure',
        resave: false,
        saveUninitialized: false
    }));
    
    app.use(passport.initialize());
    app.use(passport.session());

    // --- ROUTES DE BASE ---
    app.get('/', (req, res) => res.render('index', { user: req.user, bot: client.user }));
    app.get('/login', passport.authenticate('discord'));
    app.get('/auth/discord/callback', passport.authenticate('discord', { failureRedirect: '/' }), (req, res) => res.redirect('/dashboard'));
    app.get('/logout', (req, res) => { req.logout(() => {}); res.redirect('/'); });

    // --- DASHBOARD (LISTE DES SERVEURS) ---
    app.get('/dashboard', (req, res) => {
        if (!req.user) return res.redirect('/login');
        const adminGuilds = req.user.guilds.filter(g => (g.permissions & 0x8) === 0x8);
        const finalGuilds = adminGuilds.map(guild => ({ ...guild, botInGuild: client.guilds.cache.has(guild.id) }));
        res.render('dashboard', { user: req.user, bot: client.user, guilds: finalGuilds });
    });

    // --- PAGE DE CONFIGURATION (GET) ---
    app.get('/settings/:guildId', async (req, res) => {
        if (!req.user) return res.redirect('/login');
        const guildId = req.params.guildId;
        
        // Vérif Admin
        const isOwner = req.user.guilds.find(g => g.id === guildId && (g.permissions & 0x8) === 0x8);
        if (!isOwner) return res.redirect('/dashboard');

        const guild = client.guilds.cache.get(guildId);
        if (!guild) return res.redirect('/dashboard');

        // Récupération des données DB
        const [settings] = await client.db.query('SELECT * FROM guild_settings WHERE guild_id = ?', [guildId]);
        const [customCommands] = await client.db.query('SELECT * FROM custom_commands WHERE guild_id = ?', [guildId]);
        const [economyTop] = await client.db.query('SELECT * FROM economy WHERE guild_id = ? ORDER BY money DESC LIMIT 5', [guildId]);
        const [warnings] = await client.db.query('SELECT * FROM warnings WHERE guild_id = ? ORDER BY date DESC LIMIT 20', [guildId]);
        const [timers] = await client.db.query('SELECT * FROM timers WHERE guild_id = ?', [guildId]);
        const [reactionRoles] = await client.db.query('SELECT * FROM reaction_roles WHERE guild_id = ?', [guildId]);

        const stats = {
            memberCount: guild.memberCount,
            channelCount: guild.channels.cache.size,
            roleCount: guild.roles.cache.size,
            botPing: client.ws.ping
        };

        res.render('settings', {
            user: req.user,
            guild: guild,
            settings: settings[0] || {},
            customCommands: customCommands,
            economyTop: economyTop,
            warnings: warnings,
            timers: timers,
            reactionRoles: reactionRoles, // Envoi des rôles-réactions à la vue
            channels: guild.channels.cache,
            roles: guild.roles.cache,
            stats: stats,
            success: req.query.success === 'true'
        });
    });

    // --- SAUVEGARDE PARAMÈTRES GÉNÉRAUX (POST) ---
    app.post('/settings/:guildId', async (req, res) => {
        if (!req.user) return res.redirect('/login');
        const guildId = req.params.guildId;
        const d = req.body;
        
        // Gestion des modules (Checkbox)
        const mods = {
            welcome: d.module_welcome === 'on',
            levels: d.module_levels === 'on',
            economy: d.module_economy === 'on',
            moderation: d.module_moderation === 'on',
            security: d.module_security === 'on',
            social: d.module_social === 'on',
            customcmds: d.module_customcmds === 'on',
            timers: d.module_timers === 'on',
            tempvoice: d.module_tempvoice === 'on',
            reactionroles: d.module_reactionroles === 'on'
        };

        try {
            await client.db.query(`
                INSERT INTO guild_settings 
                (guild_id, module_welcome, module_levels, module_economy, module_moderation, module_security, module_social, module_customcmds, module_timers, module_tempvoice, module_reactionroles, welcome_channel_id, welcome_bg, welcome_color, log_channel_id, autorole_id, antiraid_enabled, antiraid_account_age_days, levels_enabled, level_up_message, automod_enabled, automod_words, birthday_channel_id, tempvoice_channel_id, tempvoice_category_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE 
                module_welcome=?, module_levels=?, module_economy=?, module_moderation=?, module_security=?, module_social=?, module_customcmds=?, module_timers=?, module_tempvoice=?, module_reactionroles=?,
                welcome_channel_id=?, welcome_bg=?, welcome_color=?, log_channel_id=?, autorole_id=?, antiraid_enabled=?, antiraid_account_age_days=?, levels_enabled=?, level_up_message=?, automod_enabled=?, automod_words=?, birthday_channel_id=?, tempvoice_channel_id=?, tempvoice_category_id=?
            `, [
                // INSERT
                guildId, mods.welcome, mods.levels, mods.economy, mods.moderation, mods.security, mods.social, mods.customcmds, mods.timers, mods.tempvoice, mods.reactionroles, d.welcome_channel_id||null, d.welcome_bg||'', d.welcome_color||'#fff', d.log_channel_id||null, d.autorole_id||null, d.antiraid_enabled==='on', parseInt(d.antiraid_days)||7, d.levels_enabled==='on', d.level_up_message, d.automod_enabled==='on', d.automod_words, d.birthday_channel_id||null, d.tempvoice_channel_id||null, d.tempvoice_category_id||null,
                // UPDATE
                mods.welcome, mods.levels, mods.economy, mods.moderation, mods.security, mods.social, mods.customcmds, mods.timers, mods.tempvoice, mods.reactionroles, d.welcome_channel_id||null, d.welcome_bg||'', d.welcome_color||'#fff', d.log_channel_id||null, d.autorole_id||null, d.antiraid_enabled==='on', parseInt(d.antiraid_days)||7, d.levels_enabled==='on', d.level_up_message, d.automod_enabled==='on', d.automod_words, d.birthday_channel_id||null, d.tempvoice_channel_id||null, d.tempvoice_category_id||null
            ]);
            res.redirect(`/settings/${guildId}?success=true`);
        } catch (error) {
            console.error(error);
            res.send("Erreur de sauvegarde SQL.");
        }
    });

    // --- ROUTE : RÔLES RÉACTIONS (AJOUT) ---
    app.post('/settings/:guildId/rr/add', async (req, res) => {
        if (!req.user) return res.redirect('/login');
        const { channel_id, message_id, emoji, role_id } = req.body;
        
        if (channel_id && message_id && emoji && role_id) {
            // 1. Sauvegarde DB
            await client.db.query(`INSERT INTO reaction_roles (guild_id, channel_id, message_id, emoji, role_id) VALUES (?, ?, ?, ?, ?)`, [req.params.guildId, channel_id, message_id, emoji, role_id]);
            
            // 2. Le bot réagit au message
            try {
                const guild = client.guilds.cache.get(req.params.guildId);
                const channel = guild.channels.cache.get(channel_id);
                if (channel) {
                    const msg = await channel.messages.fetch(message_id);
                    if (msg) await msg.react(emoji);
                }
            } catch (e) {
                console.error("Erreur Reaction Role:", e);
            }
        }
        res.redirect(`/settings/${req.params.guildId}`);
    });

    // --- ROUTE : RÔLES RÉACTIONS (SUPPRESSION) ---
    app.post('/settings/:guildId/rr/delete', async (req, res) => {
        if (!req.user) return res.redirect('/login');
        await client.db.query('DELETE FROM reaction_roles WHERE id = ? AND guild_id = ?', [req.body.id, req.params.guildId]);
        res.redirect(`/settings/${req.params.guildId}`);
    });

    // --- ROUTE : TIMERS (AJOUT/SUPPR) ---
    app.post('/settings/:guildId/timers/add', async (req, res) => {
        if (!req.user) return res.redirect('/login');
        const { channel_id, interval, message } = req.body;
        if (channel_id && interval && message) {
            await client.db.query('INSERT INTO timers (guild_id, channel_id, message, interval_minutes) VALUES (?, ?, ?, ?)', [req.params.guildId, channel_id, message, parseInt(interval)]);
        }
        res.redirect(`/settings/${req.params.guildId}`);
    });
    app.post('/settings/:guildId/timers/delete', async (req, res) => {
        if (!req.user) return res.redirect('/login');
        await client.db.query('DELETE FROM timers WHERE id = ? AND guild_id = ?', [req.body.id, req.params.guildId]);
        res.redirect(`/settings/${req.params.guildId}`);
    });

    // --- ROUTE : COMMANDES PERSO ---
    app.post('/settings/:guildId/commands/add', async (req, res) => {
        if (!req.user) return res.redirect('/login');
        const { trigger, response } = req.body;
        if (trigger && response) await client.db.query('INSERT INTO custom_commands (guild_id, trigger_word, response_text) VALUES (?, ?, ?)', [req.params.guildId, trigger, response]);
        res.redirect(`/settings/${req.params.guildId}`);
    });
    app.post('/settings/:guildId/commands/delete', async (req, res) => {
        if (!req.user) return res.redirect('/login');
        await client.db.query('DELETE FROM custom_commands WHERE id = ? AND guild_id = ?', [req.body.command_id, req.params.guildId]);
        res.redirect(`/settings/${req.params.guildId}`);
    });

    // --- ROUTE : ÉCONOMIE ---
    app.post('/settings/:guildId/economy/update', async (req, res) => {
        if (!req.user) return res.redirect('/login');
        const { user_id, amount, action } = req.body;
        const val = parseInt(amount);
        let sql = '';
        if (action === 'add') sql = 'INSERT INTO economy (user_id, guild_id, money) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE money = money + ?';
        if (action === 'remove') sql = 'UPDATE economy SET money = GREATEST(0, money - ?) WHERE user_id = ? AND guild_id = ?';
        if (action === 'set') sql = 'INSERT INTO economy (user_id, guild_id, money) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE money = ?';
        
        if (action === 'add' || action === 'set') await client.db.query(sql, [user_id, req.params.guildId, val, val]);
        else await client.db.query(sql, [val, user_id, req.params.guildId]);
        res.redirect(`/settings/${req.params.guildId}`);
    });

    app.listen(port, () => console.log(`🌍 Dashboard en ligne sur le port ${port}`));
};