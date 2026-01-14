const { 
    Events, 
    ChannelType, 
    PermissionFlagsBits, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle 
} = require('discord.js');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        
        // ====================================================
        // 1. GESTION DES COMMANDES (Chat & Clic-Droit)
        // ====================================================
        if (interaction.isChatInputCommand() || interaction.isContextMenuCommand()) {
            const command = interaction.client.commands.get(interaction.commandName);

            if (!command) {
                console.error(`⚠️ Aucune commande trouvée pour ${interaction.commandName}`);
                return;
            }

            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(`❌ Erreur commande ${interaction.commandName}:`, error);
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: '❌ Erreur lors de l\'exécution !', ephemeral: true });
                } else {
                    await interaction.reply({ content: '❌ Erreur lors de l\'exécution !', ephemeral: true });
                }
            }
            return; // On arrête là pour les commandes
        }

        // ====================================================
        // 2. GESTION DES BOUTONS
        // ====================================================
        if (interaction.isButton()) {
            
            // --- A. SYSTÈME DE TICKETS ---
            
            // 1. Ouvrir un Ticket
            if (interaction.customId === 'create_ticket') {
                await interaction.deferReply({ ephemeral: true });

                // Vérifier si un ticket existe déjà
                // (On cherche un salon qui commence par "ticket-" et qui contient le pseudo)
                // Note : Simplifié pour l'exemple. Idéalement, on stocke en DB.
                const channelName = `ticket-${interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
                const existingChannel = interaction.guild.channels.cache.find(c => c.name === channelName);
                
                if (existingChannel) {
                    return interaction.editReply(`❌ Tu as déjà un ticket ouvert ici : ${existingChannel}`);
                }

                try {
                    // Création du salon
                    const ticketChannel = await interaction.guild.channels.create({
                        name: channelName,
                        type: ChannelType.GuildText,
                        permissionOverwrites: [
                            {
                                id: interaction.guild.id, // @everyone ne voit rien
                                deny: [PermissionFlagsBits.ViewChannel],
                            },
                            {
                                id: interaction.user.id, // L'auteur voit tout
                                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles],
                            },
                            {
                                id: interaction.client.user.id, // Le bot voit tout
                                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
                            },
                            // Tu peux ajouter ici le rôle Modérateur si nécessaire
                        ],
                    });

                    // Message de bienvenue
                    const ticketEmbed = new EmbedBuilder()
                        .setColor('#5865F2')
                        .setTitle(`Ticket de ${interaction.user.username}`)
                        .setDescription('Un membre du staff va bientôt prendre en charge ta demande.\nEn attendant, décris ton problème ici.')
                        .setTimestamp();

                    const closeButton = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId('close_ticket')
                                .setLabel('Fermer le Ticket')
                                .setStyle(ButtonStyle.Danger)
                                .setEmoji('🔒')
                        );

                    await ticketChannel.send({ 
                        content: `${interaction.user}`, 
                        embeds: [ticketEmbed], 
                        components: [closeButton] 
                    });
                    
                    return interaction.editReply(`✅ Ton ticket a été créé : ${ticketChannel}`);

                } catch (error) {
                    console.error("Erreur création ticket:", error);
                    return interaction.editReply("❌ Erreur lors de la création du ticket (Vérifie mes permissions !).");
                }
            }

            // 2. Fermer un Ticket
            if (interaction.customId === 'close_ticket') {
                await interaction.reply('🔒 Le ticket va être supprimé dans 5 secondes...');
                setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
            }

            // --- B. RÔLES BOUTONS (Reaction Roles) ---
            
            // Format du CustomID : "role_IDDUROLE"
            if (interaction.customId.startsWith('role_')) {
                const roleId = interaction.customId.split('_')[1];
                const role = interaction.guild.roles.cache.get(roleId);

                if (!role) {
                    return interaction.reply({ content: '❌ Ce rôle semble avoir été supprimé.', ephemeral: true });
                }

                const member = interaction.member;

                // Logique Toggle : Si on l'a, on l'enlève. Si on l'a pas, on le donne.
                if (member.roles.cache.has(roleId)) {
                    try {
                        await member.roles.remove(role);
                        return interaction.reply({ content: `➖ Rôle **${role.name}** retiré !`, ephemeral: true });
                    } catch (err) {
                        return interaction.reply({ content: '❌ Je n\'ai pas la permission de retirer ce rôle (il est peut-être au-dessus du mien).', ephemeral: true });
                    }
                } else {
                    try {
                        await member.roles.add(role);
                        return interaction.reply({ content: `➕ Rôle **${role.name}** ajouté !`, ephemeral: true });
                    } catch (err) {
                        return interaction.reply({ content: '❌ Je n\'ai pas la permission de donner ce rôle (il est peut-être au-dessus du mien).', ephemeral: true });
                    }
                }
            }
        }
    },
};