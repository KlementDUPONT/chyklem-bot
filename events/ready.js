const { Events } = require('discord.js');

module.exports = {
    name: Events.ClientReady,
    once: true,
    execute(client) {
        // Juste un log, PAS de setActivity ici car c'est géré par index.js / DB
        console.log(`[EVENT] ${client.user.tag} est prêt via ready.js !`);
    },
};