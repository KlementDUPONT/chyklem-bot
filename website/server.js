const express = require('express');
const session = require('express-session');
const passport = require('passport');
const { Strategy } = require('passport-discord');
const path = require('path');

module.exports = (client) => {
    const app = express();
    const port = 3000;

    // --- 1. CONFIGURATION PASSPORT ---
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

    // --- 2. CONFIGURATION EXPRESS ---
    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, 'views'));
    app.use(express.urlencoded({ extended: true })); // Important pour les formulaires
    
    app.use(session({
        secret: 'kawaai-secret-key-change-me',
        resave: false,
        saveUninitialized: false
    }));
    
    app.use(passport.initialize());
    app.use(passport.session());

    // --- 3. ROUTES ---

    // Accueil & Auth
    app.get('/', (req, res) => res.render('index', { user: req.user, bot: client.user }));
    app.get('/login', passport.authenticate('discord'));
    app.get('/auth/discord/callback', passport.authenticate('discord', { failureRedirect: '/' }), (req, res) => res.redirect('/dashboard'));
    app.get('/logout', (req, res) => { req.logout(() => {}); res.redirect('/'); });

    // Dashboard (Liste Serveurs)
    app.get('/dashboard', (req, res) => {
        if (!req.user) return res.redirect('/login');
        const adminGuilds = req.user.guilds.filter(g => (g.permissions & 0x8) === 0x8);
        const finalGuilds = adminGuilds.map(guild => ({ ...guild, botInGuild: client.guilds.cache.has(guild.id) }));
        res.render('dashboard', { user: req.user, bot: client.user, guilds: finalGuilds });
    });

    // Page de Configuration (GET)
    app.get('/settings/:guildId', async (req, res) => {
        if (!req.user) return res.redirect('/login');
        const guildId = req.params.guildId;

        // Vérification Admin
        const isOwner = req.user.guilds.find(g => g.id === guildId && (g.permissions & 0x8) === 0x8);
        if (!isOwner) return res.redirect('/dashboard');

        // Vérification Bot présent
        const guild = client.guilds.cache.get(guildId);
        if (!guild) return res.redirect('/dashboard');

        // Récupération Données DB
        const [rows] = await client.db.query('SELECT * FROM guild_settings WHERE guild_id = ?', [guildId]);
        const settings = rows[0] || {};

        res.render('settings', {
            user: req.user,
            guild: guild,
            settings: settings,
            channels: guild.channels.cache,
            roles: guild.roles.cache,
            success: req.query.success === 'true'
        });
    });

    // Sauvegarde Configuration (POST)
    app.post('/settings/:guildId', async (req, res) => {
        if (!req.user) return res.redirect('/login');
        const guildId = req.params.guildId;

        const isOwner = req.user.guilds.find(g => g.id === guildId && (g.permissions & 0x8) === 0x8);
        if (!isOwner) return res.status(403).send('Forbidden');

        // Récupération Formulaire (Avec les nouveaux champs Design)
        const welcomeChannel = req.body.welcome_channel_id || null;
        const welcomeBg = req.body.welcome_bg || 'https://i.imgur.com/vH1W4Qc.jpeg';
        const welcomeColor = req.body.welcome_color || '#ffffff';
        
        const logChannel = req.body.log_channel_id || null;
        const autoRole = req.body.autorole_id || null;
        const antiRaidEnabled = req.body.antiraid_enabled === 'on';
        const antiRaidDays = parseInt(req.body.antiraid_days) || 7;

        try {
            await client.db.query(`
                INSERT INTO guild_settings 
                (guild_id, welcome_channel_id, welcome_bg, welcome_color, log_channel_id, autorole_id, antiraid_enabled, antiraid_account_age_days)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE 
                welcome_channel_id = ?, welcome_bg = ?, welcome_color = ?, log_channel_id = ?, autorole_id = ?, antiraid_enabled = ?, antiraid_account_age_days = ?
            `, [
                // INSERT VALUES
                guildId, welcomeChannel, welcomeBg, welcomeColor, logChannel, autoRole, antiRaidEnabled, antiRaidDays, 
                // UPDATE VALUES
                welcomeChannel, welcomeBg, welcomeColor, logChannel, autoRole, antiRaidEnabled, antiRaidDays           
            ]);

            res.redirect(`/settings/${guildId}?success=true`);
        } catch (error) {
            console.error('Erreur sauvegarde:', error);
            res.send("Erreur lors de la sauvegarde.");
        }
    });

    // Lancement
    app.listen(port, () => {
        console.log(`🌍 Dashboard en ligne sur le port ${port}`);
    });
};