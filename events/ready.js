const { Events, ActivityType } = require('discord.js');

module.exports = {
    name: Events.ClientReady,
    once: true, // S'exécute une seule fois au démarrage
    execute(client) {
        
        // Liste des statuts
        const activities = [
            { name: '/help | ChyKlem Bot', type: ActivityType.Playing },
            { name: 'le Dashboard Web', type: ActivityType.Watching },
            { name: 'les membres', type: ActivityType.Listening },
            { name: 'la sécurité du serveur', type: ActivityType.Competing }
        ];

        let i = 0;

        // On change le statut toutes les 10 secondes (10000 ms)
        setInterval(() => {
            // Mise à jour de l'activité
            const activity = activities[i];
            
            // Si on veut afficher le nombre de membres total (Optionnel)
            // On peut modifier le texte dynamiquement
            let text = activity.name;
            if (text === 'les membres') {
                const totalMembers = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
                text = `${totalMembers} membres`;
            }

            client.user.setPresence({
                activities: [{ name: text, type: activity.type }],
                status: 'online',
            });

            // On passe au suivant, ou on revient au début
            i = ++i % activities.length;

        }, 10_000);

        console.log(`✅ Système de statut dynamique activé pour ${client.user.tag}`);
    },
};