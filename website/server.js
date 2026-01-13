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

    // Login
    app.get('/login', passport.authenticate('discord'));
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

    // Dashboard (Simple vérification pour l'instant)
    app.get('/dashboard', (req, res) => {
        if (!req.user) return res.redirect('/login');
        res.send(`<h1>Bienvenue ${req.user.username} !</h1><p>Le dashboard arrive bientôt...</p>`);
    });

    // --- 4. LANCEMENT ---
    app.listen(port, () => {
        console.log(`🌍 Dashboard en ligne sur le port ${port}`);
    });
};