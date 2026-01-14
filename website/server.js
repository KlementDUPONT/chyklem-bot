const express = require('express');
const session = require('express-session');
const passport = require('passport');
const { Strategy } = require('passport-discord');
const path = require('path');

module.exports = (client) => {
    const app = express();
    const port = 3000;

    // --- CONFIG PASSPORT ---
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

    // --- CONFIG EXPRESS ---
    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, 'views'));
    app.use(express.urlencoded({ extended: true }));
    
    app.use(session({ secret: 'kawaai-secret', resave: false, saveUninitialized: false }));
    app.use(passport.initialize());
    app.use(passport.session());

    // --- ROUTES DE BASE ---
    app.get('/', (req, res) => res.render('index', { user: req.user, bot: client.user }));
    app.get('/login', passport.authenticate('discord'));
    app.get('/auth/discord/callback', passport.authenticate('discord', { failureRedirect: '/' }), (req, res) => res.redirect('/dashboard'));
    app.get('/logout', (req, res) => { req.logout(() => {}); res.redirect('/'); });

    // --- DASHBOARD LISTE ---
    app.get('/dashboard', (req, res) => {
        if (!req.user) return res.redirect('/login');
        const adminGuilds = req.user.guilds.filter(g => (g.permissions & 0x8) === 0x8);
        const finalGuilds = adminGuilds.map(guild => ({ ...guild, botInGuild: client.guilds.cache.has(guild.id) }));
        res.render('dashboard', { user: req.user, bot: client.user, guilds: finalGuilds });
    });

    // --- PAGE SETTINGS (GET) ---
    app.get('/settings/:guildId', async (req, res) => {
        if (!req.user) return res.redirect('/login');
        const guildId = req.params.guildId;
        const isOwner = req.user.guilds.find(g => g.id === guildId && (g.permissions & 0x8) === 0x8);
        if (!isOwner) return res.redirect('/dashboard');

        const guild = client.guilds.cache.get(guildId);
        if (!guild) return res.redirect('/dashboard');

        // Récupérer Settings
        const [settingsRows] = await client.db.query('SELECT * FROM guild_settings WHERE guild_id = ?', [guildId]);
        
        // NOUVEAU : Récupérer les Commandes Personnalisées
        const [customCommands] = await client.db.query('SELECT * FROM custom_commands WHERE guild_id = ?', [guildId]);

        // Stats
        const stats = {
            memberCount: guild.memberCount,
            channelCount: guild.channels.cache.size,
            roleCount: guild.roles.cache.size,
            botPing: client.ws.ping
        };

        res.render('settings', {
            user: req.user,
            guild: guild,
            settings: settingsRows[0] || {},
            customCommands: customCommands, // On envoie la liste à la vue
            channels: guild.channels.cache,
            roles: guild.roles.cache,
            stats: stats,
            success: req.query.success === 'true'
        });
    });

    // --- SAUVEGARDE GLOBALE (POST) ---
    app.post('/settings/:guildId', async (req, res) => {
        if (!req.user) return res.redirect('/login');
        const guildId = req.params.guildId;
        const isOwner = req.user.guilds.find(g => g.id === guildId && (g.permissions & 0x8) === 0x8);
        if (!isOwner) return res.status(403).send('Forbidden');

        const d = req.body;
        
        try {
            await client.db.query(`
                INSERT INTO guild_settings 
                (guild_id, welcome_channel_id, welcome_bg, welcome_color, log_channel_id, autorole_id, antiraid_enabled, antiraid_account_age_days, levels_enabled, level_up_message, automod_enabled, automod_words)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE 
                welcome_channel_id=?, welcome_bg=?, welcome_color=?, log_channel_id=?, autorole_id=?, antiraid_enabled=?, antiraid_account_age_days=?, levels_enabled=?, level_up_message=?, automod_enabled=?, automod_words=?
            `, [
                guildId, d.welcome_channel_id||null, d.welcome_bg||'', d.welcome_color||'#fff', d.log_channel_id||null, d.autorole_id||null, d.antiraid_enabled==='on', parseInt(d.antiraid_days)||7, d.levels_enabled==='on', d.level_up_message, d.automod_enabled==='on', d.automod_words,
                d.welcome_channel_id||null, d.welcome_bg||'', d.welcome_color||'#fff', d.log_channel_id||null, d.autorole_id||null, d.antiraid_enabled==='on', parseInt(d.antiraid_days)||7, d.levels_enabled==='on', d.level_up_message, d.automod_enabled==='on', d.automod_words
            ]);
            res.redirect(`/settings/${guildId}?success=true`);
        } catch (error) {
            console.error(error);
            res.send("Erreur.");
        }
    });

    // --- NOUVEAU : AJOUTER COMMANDE PERSO ---
    app.post('/settings/:guildId/commands/add', async (req, res) => {
        if (!req.user) return res.redirect('/login');
        const guildId = req.params.guildId;
        const isOwner = req.user.guilds.find(g => g.id === guildId && (g.permissions & 0x8) === 0x8);
        if (!isOwner) return res.status(403).send('Forbidden');

        const { trigger, response } = req.body;
        if (trigger && response) {
            await client.db.query('INSERT INTO custom_commands (guild_id, trigger_word, response_text) VALUES (?, ?, ?)', [guildId, trigger, response]);
        }
        res.redirect(`/settings/${guildId}`);
    });

    // --- NOUVEAU : SUPPRIMER COMMANDE PERSO ---
    app.post('/settings/:guildId/commands/delete', async (req, res) => {
        if (!req.user) return res.redirect('/login');
        const guildId = req.params.guildId;
        const isOwner = req.user.guilds.find(g => g.id === guildId && (g.permissions & 0x8) === 0x8);
        if (!isOwner) return res.status(403).send('Forbidden');

        const { command_id } = req.body;
        if (command_id) {
            await client.db.query('DELETE FROM custom_commands WHERE id = ? AND guild_id = ?', [command_id, guildId]);
        }
        res.redirect(`/settings/${guildId}`);
    });

    app.listen(port, () => console.log(`🌍 Dashboard sur le port ${port}`));
};