const { Events, ChannelType, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        
        // --- 1. GESTION DES COMMANDES (/chat) ---
        if (interaction.isChatInputCommand()) {
            const command = interaction.client.commands.get(interaction.commandName);
            if (!command) return;
            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(error);
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: '❌ Erreur lors de l\'exécution !', ephemeral: true });
                } else {
                    await interaction.reply({ content: '❌ Erreur lors de l\'exécution !', ephemeral: true });
                }
            }
            return;
        }

        // --- 2. GESTION DES BOUTONS (Tickets) ---
        if (interaction.isButton()) {
            
            // CAS A : OUVRIR UN TICKET
            if (interaction.customId === 'create_ticket') {
                await interaction.deferReply({ ephemeral: true });

                // Vérifier si le gars a déjà un ticket ouvert (optionnel, pour éviter le spam)
                const existingChannel = interaction.guild.channels.cache.find(c => c.name === `ticket-${interaction.user.username.toLowerCase()}`);
                if (existingChannel) {
                    return interaction.editReply(`❌ Tu as déjà un ticket ouvert ici : ${existingChannel}`);
                }

                // Création du salon
                const ticketChannel = await interaction.guild.channels.create({
                    name: `ticket-${interaction.user.username}`,
                    type: ChannelType.GuildText,
                    permissionOverwrites: [
                        {
                            id: interaction.guild.id, // @everyone ne voit rien
                            deny: [PermissionFlagsBits.ViewChannel],
                        },
                        {
                            id: interaction.user.id, // L'utilisateur voit son ticket
                            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
                        },
                        {
                            id: interaction.client.user.id, // Le bot voit le ticket
                            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
                        },
                        // Ici, on pourrait ajouter le rôle Modérateur si tu en as configuré un
                    ],
                });

                // Message de bienvenue dans le ticket
                const ticketEmbed = new EmbedBuilder()
                    .setColor('#5865F2')
                    .setTitle(`Ticket de ${interaction.user.username}`)
                    .setDescription('Un membre du staff va bientôt prendre en charge ta demande.\nEn attendant, décris ton problème ici.');

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
            }

            // CAS B : FERMER UN TICKET
            if (interaction.customId === 'close_ticket') {
                await interaction.reply('🔒 Le ticket va être supprimé dans 5 secondes...');
                setTimeout(() => interaction.channel.delete(), 5000);
            }
        }
    },
};