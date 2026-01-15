module.exports = {
    name: 'messageReactionAdd',
    async execute(reaction, user) {
        if (user.bot) return;

        // Si le message est ancien, on le charge partiellement pour lire la réaction
        if (reaction.partial) {
            try { await reaction.fetch(); } catch (error) { return; }
        }

        const { message, emoji } = reaction;
        const guild = message.guild;
        if (!guild) return;

        // Vérification DB : Est-ce un Reaction Role ?
        const emojiId = emoji.id || emoji.name; // ID si custom, emoji sinon
        const [rows] = await message.client.db.query(
            'SELECT role_id FROM reaction_roles WHERE message_id = ? AND (emoji = ? OR emoji = ?)', 
            [message.id, emojiId, emoji.name]
        );

        if (rows.length > 0) {
            const roleId = rows[0].role_id;
            const member = await guild.members.fetch(user.id).catch(() => null);
            if (member) {
                await member.roles.add(roleId).catch(err => console.error("Impossible de donner le rôle (Permissions ?)", err));
                // Petit feedback en console (optionnel)
                console.log(`[ReactionRole] Ajout du rôle ${roleId} à ${user.username}`);
            }
        }
    }
};

// On doit aussi gérer le RETRAIT du rôle quand on enlève la réaction
// Tu peux ajouter ce bloc dans un autre fichier ou à la suite si tu gères les événements multiples.
// Pour faire simple, crée un DEUXIEME fichier "events/reactionRemove.js" avec ce code :
/*
module.exports = {
    name: 'messageReactionRemove',
    async execute(reaction, user) {
        if (user.bot) return;
        if (reaction.partial) { try { await reaction.fetch(); } catch (error) { return; } }

        const { message, emoji } = reaction;
        const guild = message.guild;
        if (!guild) return;

        const emojiId = emoji.id || emoji.name;
        const [rows] = await message.client.db.query(
            'SELECT role_id FROM reaction_roles WHERE message_id = ? AND (emoji = ? OR emoji = ?)', 
            [message.id, emojiId, emoji.name]
        );

        if (rows.length > 0) {
            const roleId = rows[0].role_id;
            const member = await guild.members.fetch(user.id).catch(() => null);
            if (member) {
                await member.roles.remove(roleId).catch(() => {});
            }
        }
    }
};
*/