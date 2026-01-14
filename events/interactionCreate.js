const { Events, ChannelType, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

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
            return; // On arrête là, pas besoin de vérifier les boutons
        }

        // ====================================================
        // 2. GESTION DES BOUTONS (Système de Tickets)
        // ====================================================
        if (interaction.isButton()) {
            
            // --- CAS A : OUVRIR UN TICKET ---
            if (interaction.customId === 'create_ticket') {
                await interaction.deferReply({ ephemeral: true });

                // Vérifier si un ticket existe déjà (basé sur le nom du salon)
                // Note : Pour être plus précis, on pourrait stocker ça en DB, mais ça suffit pour commencer.
                const existingChannel = interaction.guild.channels.cache.find(c => c.name === `ticket-${interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}`);
                if (existingChannel) {
                    return interaction.editReply(`❌ Tu as déjà un ticket ouvert ici : ${existingChannel}`);
                }

                // Création du salon
                try {
                    const ticketChannel = await interaction.guild.channels.create({
                        name: `ticket-${interaction.user.username}`,
                        type: ChannelType.GuildText,
                        permissionOverwrites: [
                            {
                                id: interaction.guild.id, // @everyone : Interdit de voir
                                deny: [PermissionFlagsBits.ViewChannel],
                            },
                            {
                                id: interaction.user.id, // L'utilisateur : Autorisé
                                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles],
                            },
                            {
                                id: interaction.client.user.id, // Le Bot : Autorisé
                                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
                            },
                            // Tu pourras ajouter ici le rôle "Modérateur" plus tard si besoin
                        ],
                    });

                    // Message de bienvenue dans le ticket
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

                    await ticketChannel.send({ content: `${interaction.user}`, embeds: [ticketEmbed], components: [closeButton] });
                    
                    return interaction.editReply(`✅ Ton ticket a été créé : ${ticketChannel}`);

                } catch (error) {
                    console.error("Erreur création ticket:", error);
                    return interaction.editReply("❌ Erreur lors de la création du ticket (Vérifie mes permissions !).");
                }
            }

            // --- CAS B : FERMER UN TICKET ---
            if (interaction.customId === 'close_ticket') {
                await interaction.reply('🔒 Le ticket va être supprimé dans 5 secondes...');
                setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
            }
        }
    },
};