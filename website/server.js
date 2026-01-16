const express = require('express');
const session = require('express-session');
const passport = require('passport');
const { Strategy } = require('passport-discord');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

// --- CONFIGURATION UPLOAD ---
const uploadDir = path.join(__dirname, '../public/uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const uniqueName = Date.now() + '-' + file.originalname.replace(/[^a-zA-Z0-9.]/g, "_");
        cb(null, uniqueName);
    }
});
const upload = multer({ storage: storage });

module.exports = (client) => {
    const app = express();
    const port = process.env.PORT || 3000;

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
    app.use(express.static(path.join(__dirname, '../public'))); 
    app.use(express.urlencoded({ extended: true }));
    app.use(session({ secret: 'kawaai-secret', resave: false, saveUninitialized: false }));
    app.use(passport.initialize());
    app.use(passport.session());

    // --- ROUTES ---
    app.get('/', (req, res) => res.render('index', { user: req.user, bot: client.user }));
    app.get('/login', passport.authenticate('discord'));
    app.get('/auth/discord/callback', passport.authenticate('discord', { failureRedirect: '/' }), (req, res) => res.redirect('/dashboard'));
    app.get('/logout', (req, res) => { req.logout(() => {}); res.redirect('/'); });

    app.get('/dashboard', (req, res) => {
        if (!req.user) return res.redirect('/login');
        const adminGuilds = req.user.guilds.filter(g => (g.permissions & 0x8) === 0x8);
        const finalGuilds = adminGuilds.map(guild => ({ ...guild, botInGuild: client.guilds.cache.has(guild.id) }));
        res.render('dashboard', { user: req.user, bot: client.user, guilds: finalGuilds });
    });

    // Helper pour enrichir les données
    async function enrichData(guild, data, idField) {
        return await Promise.all(data.map(async (item) => {
            try {
                const userId = item[idField];
                if (!userId) return { ...item, displayName: 'Inconnu', avatar: 'https://cdn.discordapp.com/embed/avatars/0.png' };
                const member = await guild.members.fetch(userId).catch(() => null);
                if (member) return { ...item, displayName: member.displayName, avatar: member.displayAvatarURL({ dynamic: true, size: 64 }) };
                const user = await client.users.fetch(userId).catch(() => null);
                return { ...item, displayName: user ? user.username : 'Ancien Membre', avatar: user ? user.displayAvatarURL({ dynamic: true, size: 64 }) : 'https://cdn.discordapp.com/embed/avatars/0.png' };
            } catch (e) { return { ...item, displayName: 'Erreur', avatar: 'https://cdn.discordapp.com/embed/avatars/0.png' }; }
        }));
    }

    // PAGE PARAMÈTRES
    app.get('/settings/:guildId', async (req, res) => {
        if (!req.user) return res.redirect('/login');
        const guildId = req.params.guildId;
        const guild = client.guilds.cache.get(guildId);
        if (!guild) return res.redirect('/dashboard');

        const [settings] = await client.db.query('SELECT * FROM guild_settings WHERE guild_id = ?', [guildId]);
        const [customCommands] = await client.db.query('SELECT * FROM custom_commands WHERE guild_id = ?', [guildId]);
        const [timers] = await client.db.query('SELECT * FROM timers WHERE guild_id = ?', [guildId]);
        const [reactionRoles] = await client.db.query('SELECT * FROM reaction_roles WHERE guild_id = ?', [guildId]);
        const [botActivities] = await client.db.query('SELECT * FROM bot_activities');
        const [botSettings] = await client.db.query("SELECT setting_value FROM bot_settings WHERE setting_key = 'presence_interval'");
        const presenceInterval = botSettings.length ? botSettings[0].setting_value : 10;
        
        const [economyRaw] = await client.db.query('SELECT * FROM economy WHERE guild_id = ? ORDER BY money DESC LIMIT 5', [guildId]);
        const economyTop = await enrichData(guild, economyRaw, 'user_id');
        const [warningsRaw] = await client.db.query('SELECT * FROM warnings WHERE guild_id = ? ORDER BY date DESC LIMIT 10', [guildId]);
        const warnings = await enrichData(guild, warningsRaw, 'user_id');

        res.render('settings', {
            user: req.user, guild, 
            settings: settings[0] || {}, 
            customCommands, economyTop, warnings, timers, reactionRoles, botActivities, presenceInterval,
            channels: guild.channels.cache, roles: guild.roles.cache,
            success: req.query.success === 'true',
            activeTab: req.query.tab || 'overview'
        });
    });

    // --- SAUVEGARDE COMPLÈTE ---
    app.post('/settings/:guildId', upload.single('welcome_bg_file'), async (req, res) => {
        if (!req.user) return res.redirect('/login');
        const d = req.body;
        
        // Gestion Image
        let finalBg = d.welcome_bg; 
        if (req.file) finalBg = `/uploads/${req.file.filename}`;
        if (!finalBg || finalBg.trim() === '') finalBg = null;

        // Conversion Types
        const welcome_opacity = parseFloat(d.welcome_opacity) || 0.5;
        const t_x = parseInt(d.welcome_title_x) || 230;
        const t_y = parseInt(d.welcome_title_y) || 110;
        const t_s = parseInt(d.welcome_title_size) || 50;
        const u_x = parseInt(d.welcome_user_x) || 230;
        const u_y = parseInt(d.welcome_user_y) || 175;
        const u_s = parseInt(d.welcome_user_size) || 32;
        const a_x = parseInt(d.welcome_avatar_x) || 45;
        const a_y = parseInt(d.welcome_avatar_y) || 45;
        const a_s = parseInt(d.welcome_avatar_size) || 160;

        try {
            await client.db.query(`
                UPDATE guild_settings SET 
                module_welcome=?, module_levels=?, module_economy=?, module_moderation=?, module_social=?, module_customcmds=?, module_timers=?, module_tempvoice=?, module_reactionroles=?, 
                welcome_channel_id=?, welcome_bg=?, welcome_opacity=?, welcome_align=?,
                welcome_title=?, welcome_title_color=?, welcome_title_size=?, welcome_title_x=?, welcome_title_y=?,
                welcome_user_color=?, welcome_user_size=?, welcome_user_x=?, welcome_user_y=?,
                welcome_avatar_x=?, welcome_avatar_y=?, welcome_avatar_size=?, welcome_shape=?, welcome_border_color=?,
                welcome_message=?, autorole_id=?, 
                log_channel_id=?, level_up_message=?, automod_enabled=?, automod_words=?, tempvoice_channel_id=?, tempvoice_category_id=? 
                WHERE guild_id=?`, 
            [
                d.module_welcome==='on', d.module_levels==='on', d.module_economy==='on', d.module_moderation==='on', d.module_social==='on', d.module_customcmds==='on', d.module_timers==='on', d.module_tempvoice==='on', d.module_reactionroles==='on', 
                d.welcome_channel_id||null, finalBg, welcome_opacity, d.welcome_align||'left',
                d.welcome_title, d.welcome_title_color, t_s, t_x, t_y,
                d.welcome_user_color, u_s, u_x, u_y,
                a_x, a_y, a_s, d.welcome_shape||'circle', d.welcome_border_color,
                d.welcome_message, d.autorole_id||null, 
                d.log_channel_id||null, d.level_up_message, d.automod_enabled==='on', d.automod_words, d.tempvoice_channel_id||null, d.tempvoice_category_id||null, 
                req.params.guildId
            ]);
            res.redirect(`/settings/${req.params.guildId}?success=true&tab=${d.current_tab||'overview'}`);
        } catch (error) { console.error(error); res.send("Erreur SQL: " + error.message); }
    });

    // Autres routes POST (inchangées mais nécessaires)
    app.post('/settings/:guildId/presence/add', async (req, res) => { await client.db.query('INSERT INTO bot_activities (type, name) VALUES (?, ?)', [req.body.type, req.body.name]); res.redirect(`/settings/${req.params.guildId}?tab=presence`); });
    app.post('/settings/:guildId/presence/delete', async (req, res) => { await client.db.query('DELETE FROM bot_activities WHERE id = ?', [req.body.id]); res.redirect(`/settings/${req.params.guildId}?tab=presence`); });
    app.post('/settings/:guildId/presence/config', async (req, res) => { const i = parseInt(req.body.interval); if (i >= 5) await client.db.query("INSERT INTO bot_settings (setting_key, setting_value) VALUES ('presence_interval', ?) ON DUPLICATE KEY UPDATE setting_value = ?", [i, i]); res.redirect(`/settings/${req.params.guildId}?tab=presence`); });
    app.post('/settings/:guildId/timers/add', async (req, res) => { await client.db.query('INSERT INTO timers (guild_id, channel_id, message, interval_minutes, role_id) VALUES (?, ?, ?, ?, ?)', [req.params.guildId, req.body.channel_id, req.body.message, req.body.interval, req.body.role_id || null]); res.redirect(`/settings/${req.params.guildId}?tab=timers`); });
    app.post('/settings/:guildId/timers/delete', async (req, res) => { await client.db.query('DELETE FROM timers WHERE id = ?', [req.body.id]); res.redirect(`/settings/${req.params.guildId}?tab=timers`); });
    app.post('/settings/:guildId/rr/add', async (req, res) => { await client.db.query('INSERT INTO reaction_roles (guild_id, channel_id, message_id, emoji, role_id) VALUES (?, ?, ?, ?, ?)', [req.params.guildId, req.body.channel_id, req.body.message_id, req.body.emoji, req.body.role_id]); try{const c=client.guilds.cache.get(req.params.guildId).channels.cache.get(req.body.channel_id);(await c.messages.fetch(req.body.message_id)).react(req.body.emoji);}catch(e){} res.redirect(`/settings/${req.params.guildId}?tab=reactionroles`); });
    app.post('/settings/:guildId/rr/delete', async (req, res) => { await client.db.query('DELETE FROM reaction_roles WHERE id = ?', [req.body.id]); res.redirect(`/settings/${req.params.guildId}?tab=reactionroles`); });
    app.post('/settings/:guildId/commands/add', async (req, res) => { await client.db.query('INSERT INTO custom_commands (guild_id, trigger_word, response_text) VALUES (?, ?, ?)', [req.params.guildId, req.body.trigger, req.body.response]); res.redirect(`/settings/${req.params.guildId}?tab=customcmds`); });
    app.post('/settings/:guildId/commands/delete', async (req, res) => { await client.db.query('DELETE FROM custom_commands WHERE id = ?', [req.body.command_id]); res.redirect(`/settings/${req.params.guildId}?tab=customcmds`); });
    app.post('/settings/:guildId/economy/update', async (req, res) => { const { user_id, amount, action } = req.body; const val = parseInt(amount); let sql = ''; if (action === 'add') sql = 'INSERT INTO economy (user_id, guild_id, money) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE money = money + ?'; if (action === 'remove') sql = 'UPDATE economy SET money = GREATEST(0, money - ?) WHERE user_id = ? AND guild_id = ?'; if (action === 'set') sql = 'INSERT INTO economy (user_id, guild_id, money) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE money = ?'; if (action === 'add' || action === 'set') await client.db.query(sql, [user_id, req.params.guildId, val, val]); else await client.db.query(sql, [val, user_id, req.params.guildId]); res.redirect(`/settings/${req.params.guildId}?tab=economy`); });

    app.listen(port, () => console.log(`🌍 Dashboard sur ${port}`));
};