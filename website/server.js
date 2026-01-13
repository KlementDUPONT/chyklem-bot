const express = require('express');
const session = require('express-session');
const passport = require('passport');
const { Strategy } = require('passport-discord');
const path = require('path');

module.exports = (client) => {
    const app = express();
    const port = 3000;

    // --- 1. CONFIGURATION PASSPORT (CONNEXION DISCORD) ---
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
    
    // IMPORTANT : Permet de lire les données envoyées par les formulaires (POST)
    app.use(express.urlencoded({ extended: true }));
    
    // Configuration de la session (Mémoire)
    app.use(session({
        secret: 'kawaai-secret-key-change-me',
        resave: false,
        saveUninitialized: false
    }));
    
    app.use(passport.initialize());
    app.use(passport.session());

    // --- 3. LES ROUTES (PAGES) ---

    // Page d'accueil
    app.get('/', (req, res) => {
        res.render('index', { 
            user: req.user,
            bot: client.user
        });
    });

    // Connexion (Redirection vers Discord)
    app.get('/login', passport.authenticate('discord'));

    // Retour de Discord après connexion
    app.get('/auth/discord/callback', passport.authenticate('discord', {
        failureRedirect: '/'
    }), (req, res) => {
        res.redirect('/dashboard');
    });

    // Déconnexion
    app.get('/logout', (req, res) => {
        req.logout(() => {});
        res.redirect('/');
    });

    // --- DASHBOARD : LISTE DES SERVEURS ---
    app.get('/dashboard', (req, res) => {
        // Si pas connecté, on redirige vers le login
        if (!req.user) return res.redirect('/login');

        // 1. Filtrer : On garde uniquement les serveurs où l'utilisateur est ADMIN
        // (La permission 'Administrator' correspond au bit 0x8)
        const adminGuilds = req.user.guilds.filter(g => (g.permissions & 0x8) === 0x8);

        // 2. Vérifier si le bot est présent sur ces serveurs
        const finalGuilds = adminGuilds.map(guild => {
            const botInGuild = client.guilds.cache.has(guild.id);
            return { 
                ...guild, 
                botInGuild // true si le bot est là, false sinon
            };
        });

        res.render('dashboard', { 
            user: req.user,
            bot: client.user,
            guilds: finalGuilds
        });
    });

    // --- PAGE DE RÉGLAGES (AFFICHAGE) ---
    app.get('/settings/:guildId', async (req, res) => {
        if (!req.user) return res.redirect('/login');
        const guildId = req.params.guildId;

        // Sécurité : Vérifier que l'utilisateur est bien admin de CE serveur
        const isOwner = req.user.guilds.find(g => g.id === guildId && (g.permissions & 0x8) === 0x8);
        if (!isOwner) return res.redirect('/dashboard');

        // Récupérer le serveur Discord via le bot (pour avoir la liste des salons/rôles)
        const guild = client.guilds.cache.get(guildId);
        if (!guild) return res.redirect('/dashboard');

        // Récupérer les réglages actuels depuis la Base de Données
        const [rows] = await client.db.query('SELECT * FROM guild_settings WHERE guild_id = ?', [guildId]);
        const settings = rows[0] || {};

        res.render('settings', {
            user: req.user,
            guild: guild,
            settings: settings,
            channels: guild.channels.cache, // Liste des salons pour le menu déroulant
            roles: guild.roles.cache,       // Liste des rôles pour le menu déroulant
            success: req.query.success === 'true' // Affiche le message vert si on vient de sauvegarder
        });
    });

    // --- SAUVEGARDE DES RÉGLAGES (POST) ---
    app.post('/settings/:guildId', async (req, res) => {
        if (!req.user) return res.redirect('/login');
        const guildId = req.params.guildId;

        // Sécurité encore
        const isOwner = req.user.guilds.find(g => g.id === guildId && (g.permissions & 0x8) === 0x8);
        if (!isOwner) return res.status(403).send('Forbidden');

        // Récupération des données du formulaire
        const welcomeChannel = req.body.welcome_channel_id || null;
        const logChannel = req.body.log_channel_id || null; // Gestion du salon de Logs
        const autoRole = req.body.autorole_id || null;
        const antiRaidEnabled = req.body.antiraid_enabled === 'on'; // 'on' si la case est cochée
        const antiRaidDays = parseInt(req.body.antiraid_days) || 7;

        try {
            // Requête SQL pour Insérer ou Mettre à jour (ON DUPLICATE KEY UPDATE)
            await client.db.query(`
                INSERT INTO guild_settings 
                (guild_id, welcome_channel_id, log_channel_id, autorole_id, antiraid_enabled, antiraid_account_age_days)
                VALUES (?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE 
                welcome_channel_id = ?, log_channel_id = ?, autorole_id = ?, antiraid_enabled = ?, antiraid_account_age_days = ?
            `, [
                // Valeurs pour l'INSERT
                guildId, welcomeChannel, logChannel, autoRole, antiRaidEnabled, antiRaidDays, 
                // Valeurs pour l'UPDATE
                welcomeChannel, logChannel, autoRole, antiRaidEnabled, antiRaidDays           
            ]);

            // Recharger la page avec un message de succès
            res.redirect(`/settings/${guildId}?success=true`);
        } catch (error) {
            console.error('Erreur sauvegarde dashboard:', error);
            res.send("Erreur lors de la sauvegarde.");
        }
    });

    // --- 4. LANCEMENT DU SERVEUR WEB ---
    app.listen(port, () => {
        console.log(`🌍 Dashboard en ligne sur le port ${port}`);
    });
};