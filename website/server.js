const express = require('express');
const session = require('express-session');
const passport = require('passport');
const { Strategy } = require('passport-discord');
const path = require('path');

module.exports = (client) => {
    const app = express();
    const port = 3000;

    // --- CONFIGURATIONS ---
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
    
    // IMPORTANT : Permet de lire les données du formulaire POST
    app.use(express.urlencoded({ extended: true }));
    
    app.use(session({
        secret: 'kawaai-secret-key-change-me',
        resave: false,
        saveUninitialized: false
    }));
    app.use(passport.initialize());
    app.use(passport.session());

    // --- ROUTES ---

    // Login / Logout
    app.get('/', (req, res) => res.render('index', { user: req.user, bot: client.user }));
    app.get('/login', passport.authenticate('discord'));
    app.get('/auth/discord/callback', passport.authenticate('discord', { failureRedirect: '/' }), (req, res) => res.redirect('/dashboard'));
    app.get('/logout', (req, res) => { req.logout(() => {}); res.redirect('/'); });

    // Dashboard : Liste des serveurs
    app.get('/dashboard', (req, res) => {
        if (!req.user) return res.redirect('/login');
        const adminGuilds = req.user.guilds.filter(g => (g.permissions & 0x8) === 0x8);
        const finalGuilds = adminGuilds.map(guild => ({ ...guild, botInGuild: client.guilds.cache.has(guild.id) }));
        res.render('dashboard', { user: req.user, bot: client.user, guilds: finalGuilds });
    });

    // --- PAGE DE RÉGLAGES (GET) ---
    app.get('/settings/:guildId', async (req, res) => {
        if (!req.user) return res.redirect('/login');
        const guildId = req.params.guildId;

        // 1. Sécurité
        const isOwner = req.user.guilds.find(g => g.id === guildId && (g.permissions & 0x8) === 0x8);
        if (!isOwner) return res.redirect('/dashboard');

        // 2. Récupérer le serveur
        const guild = client.guilds.cache.get(guildId);
        if (!guild) return res.redirect('/dashboard');

        // 3. Récupérer les réglages depuis la DB
        const [rows] = await client.db.query('SELECT * FROM guild_settings WHERE guild_id = ?', [guildId]);
        const settings = rows[0] || {};

        // 4. Rendu de la page
        res.render('settings', {
            user: req.user,
            guild: guild,
            settings: settings,
            channels: guild.channels.cache,
            roles: guild.roles.cache,
            success: req.query.success === 'true'
        });
    });

    // --- SAUVEGARDE DES RÉGLAGES (POST) ---
    app.post('/settings/:guildId', async (req, res) => {
        if (!req.user) return res.redirect('/login');
        const guildId = req.params.guildId;

        const isOwner = req.user.guilds.find(g => g.id === guildId && (g.permissions & 0x8) === 0x8);
        if (!isOwner) return res.status(403).send('Forbidden');

        // Récupération des données du formulaire
        const welcomeChannel = req.body.welcome_channel_id || null;
        const logChannel = req.body.log_channel_id || null; // <--- LE VOILA
        const autoRole = req.body.autorole_id || null;
        const antiRaidEnabled = req.body.antiraid_enabled === 'on';
        const antiRaidDays = parseInt(req.body.antiraid_days) || 7;

        try {
            await client.db.query(`
                INSERT INTO guild_settings (guild_id, welcome_channel_id, log_channel_id, autorole_id, antiraid_enabled, antiraid_account_age_days)
                VALUES (?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE 
                welcome_channel_id = ?, log_channel_id = ?, autorole_id = ?, antiraid_enabled = ?, antiraid_account_age_days = ?
            `, [
                guildId, welcomeChannel, logChannel, autoRole, antiRaidEnabled, antiRaidDays, // Valeurs INSERT
                welcomeChannel, logChannel, autoRole, antiRaidEnabled, antiRaidDays           // Valeurs UPDATE
            ]);

            res.redirect(`/settings/${guildId}?success=true`);
        } catch (error) {
            console.error(error);
            res.send("Erreur lors de la sauvegarde.");
        }
    });

    app.listen(port, () => {
        console.log(`🌍 Dashboard en ligne sur le port ${port}`);
    });
};