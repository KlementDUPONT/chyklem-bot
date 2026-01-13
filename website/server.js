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
        scope: ['identify', 'guilds'] // On demande l'accès au profil et à la liste des serveurs
    }, (accessToken, refreshToken, profile, done) => {
        process.nextTick(() => done(null, profile));
    }));

    // --- 2. CONFIGURATION EXPRESS ---
    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, 'views'));
    
    // Fichiers statiques (CSS, images) si besoin plus tard
    app.use(express.static(path.join(__dirname, 'public')));

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

    // Login (Redirection vers Discord)
    app.get('/login', passport.authenticate('discord'));

    // Callback (Retour de Discord après connexion)
    app.get('/auth/discord/callback', passport.authenticate('discord', {
        failureRedirect: '/'
    }), (req, res) => {
        res.redirect('/dashboard');
    });

    // Logout
    app.get('/logout', (req, res) => {
        req.logout(() => {});
        res.redirect('/');
    });

    // --- DASHBOARD : LISTE DES SERVEURS ---
    app.get('/dashboard', (req, res) => {
        // 1. Si pas connecté, on dégage
        if (!req.user) return res.redirect('/login');

        // 2. Filtrer : On ne garde que les serveurs où l'utilisateur est ADMIN
        // (La permission 'Administrator' est le bit 0x8)
        const adminGuilds = req.user.guilds.filter(g => (g.permissions & 0x8) === 0x8);

        // 3. Vérifier la présence du bot
        // On regarde pour chaque serveur si l'ID existe dans le cache du bot
        const finalGuilds = adminGuilds.map(guild => {
            const botInGuild = client.guilds.cache.has(guild.id);
            return { 
                ...guild, 
                botInGuild // true ou false
            };
        });

        // 4. On envoie tout à la page dashboard.ejs
        res.render('dashboard', { 
            user: req.user,
            bot: client.user,
            guilds: finalGuilds
        });
    });

    // --- PAGE DE CONFIGURATION (Placeholder pour la suite) ---
    app.get('/settings/:guildId', (req, res) => {
        if (!req.user) return res.redirect('/login');
        const guildId = req.params.guildId;
        
        // Sécurité : Vérifier que le mec est bien admin de CE serveur
        const isOwner = req.user.guilds.find(g => g.id === guildId && (g.permissions & 0x8) === 0x8);
        if (!isOwner) return res.redirect('/dashboard');

        // Pour l'instant, on affiche juste un texte
        res.send(`<h1>Configuration du serveur ${guildId}</h1><p>On va bientôt mettre les boutons ici !</p>`);
    });

    // --- 4. LANCEMENT ---
    app.listen(port, () => {
        console.log(`🌍 Dashboard en ligne sur le port ${port}`);
    });
};