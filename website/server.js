const express = require('express');
const session = require('express-session');
const passport = require('passport');
const { Strategy } = require('passport-discord');
const path = require('path');

module.exports = (client) => {
    const app = express();
    const port = 3000;

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

    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, 'views'));
    app.use(express.urlencoded({ extended: true }));
    
    app.use(session({ secret: 'kawaai-secret', resave: false, saveUninitialized: false }));
    app.use(passport.initialize());
    app.use(passport.session());

    // Routes
    app.get('/', (req, res) => res.render('index', { user: req.user, bot: client.user }));
    app.get('/login', passport.authenticate('discord'));
    app.get('/auth/discord/callback', passport.authenticate('discord', { failureRedirect: '/' }), (req, res) => res.redirect('/dashboard'));
    app.get('/logout', (req, res) => { req.logout(() => {}); res.redirect('/'); });

    // Dashboard Liste
    app.get('/dashboard', (req, res) => {
        if (!req.user) return res.redirect('/login');
        const adminGuilds = req.user.guilds.filter(g => (g.permissions & 0x8) === 0x8);
        const finalGuilds = adminGuilds.map(guild => ({ ...guild, botInGuild: client.guilds.cache.has(guild.id) }));
        res.render('dashboard', { user: req.user, bot: client.user, guilds: finalGuilds });
    });

    // --- PAGE DE CONFIGURATION COMPLETE ---
    app.get('/settings/:guildId', async (req, res) => {
        if (!req.user) return res.redirect('/login');
        const guildId = req.params.guildId;
        const isOwner = req.user.guilds.find(g => g.id === guildId && (g.permissions & 0x8) === 0x8);
        if (!isOwner) return res.redirect('/dashboard');

        const guild = client.guilds.cache.get(guildId);
        if (!guild) return res.redirect('/dashboard');

        const [rows] = await client.db.query('SELECT * FROM guild_settings WHERE guild_id = ?', [guildId]);
        
        // Stats pour l'Overview
        const stats = {
            memberCount: guild.memberCount,
            channelCount: guild.channels.cache.size,
            roleCount: guild.roles.cache.size,
            botPing: client.ws.ping
        };

        res.render('settings', {
            user: req.user,
            guild: guild,
            settings: rows[0] || {},
            channels: guild.channels.cache,
            roles: guild.roles.cache,
            stats: stats, // On envoie les stats à la page
            success: req.query.success === 'true'
        });
    });

    // SAUVEGARDE TOUT
    app.post('/settings/:guildId', async (req, res) => {
        if (!req.user) return res.redirect('/login');
        const guildId = req.params.guildId;
        const isOwner = req.user.guilds.find(g => g.id === guildId && (g.permissions & 0x8) === 0x8);
        if (!isOwner) return res.status(403).send('Forbidden');

        // Récupération de TOUTES les données
        const d = req.body;
        
        const welcomeChannel = d.welcome_channel_id || null;
        const welcomeBg = d.welcome_bg || 'https://i.imgur.com/vH1W4Qc.jpeg';
        const welcomeColor = d.welcome_color || '#ffffff';
        const logChannel = d.log_channel_id || null;
        const autoRole = d.autorole_id || null;
        const antiRaidEnabled = d.antiraid_enabled === 'on';
        const antiRaidDays = parseInt(d.antiraid_days) || 7;
        
        // Nouveau : Levels
        const levelsEnabled = d.levels_enabled === 'on';
        const levelMsg = d.level_up_message || "🎉 Bravo {user}, tu passes au Niveau {level} !";

        try {
            await client.db.query(`
                INSERT INTO guild_settings 
                (guild_id, welcome_channel_id, welcome_bg, welcome_color, log_channel_id, autorole_id, antiraid_enabled, antiraid_account_age_days, levels_enabled, level_up_message)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE 
                welcome_channel_id=?, welcome_bg=?, welcome_color=?, log_channel_id=?, autorole_id=?, antiraid_enabled=?, antiraid_account_age_days=?, levels_enabled=?, level_up_message=?
            `, [
                guildId, welcomeChannel, welcomeBg, welcomeColor, logChannel, autoRole, antiRaidEnabled, antiRaidDays, levelsEnabled, levelMsg,
                welcomeChannel, welcomeBg, welcomeColor, logChannel, autoRole, antiRaidEnabled, antiRaidDays, levelsEnabled, levelMsg
            ]);
            res.redirect(`/settings/${guildId}?success=true`);
        } catch (error) {
            console.error(error);
            res.send("Erreur.");
        }
    });

    app.listen(port, () => console.log(`🌍 Dashboard sur le port ${port}`));
};