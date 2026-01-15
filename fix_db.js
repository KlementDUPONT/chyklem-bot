require('dotenv').config();
const mysql = require('mysql2/promise');

(async () => {
    const db = mysql.createPool({ uri: process.env.MYSQL_URL });
    console.log("🔧 Réparation de la base de données...");

    try {
        // Ajout des colonnes manquantes pour les Rôles-Réactions et la nouvelle structure
        const columns = [
            "ADD COLUMN module_reactionroles BOOLEAN DEFAULT TRUE",
            "ADD COLUMN module_music BOOLEAN DEFAULT FALSE",
            "ADD COLUMN module_alerts BOOLEAN DEFAULT FALSE",
            "ADD COLUMN module_timers BOOLEAN DEFAULT FALSE",
            "ADD COLUMN module_tempvoice BOOLEAN DEFAULT FALSE"
        ];

        for (const col of columns) {
            try {
                await db.execute(`ALTER TABLE guild_settings ${col}`);
                console.log(`✅ Colonne ajoutée : ${col}`);
            } catch (e) {
                // Erreur 1060 = Duplicate column name (la colonne existe déjà), on ignore
                if (e.errno === 1060) console.log(`ℹ️ Colonne déjà présente (Ignoré)`);
                else console.error(`❌ Erreur sur ${col}:`, e.message);
            }
        }
        
        // Création de la table reaction_roles si elle n'existe pas
        await db.execute(`
            CREATE TABLE IF NOT EXISTS reaction_roles (
                id INT AUTO_INCREMENT PRIMARY KEY,
                guild_id VARCHAR(32),
                channel_id VARCHAR(32),
                message_id VARCHAR(32),
                emoji VARCHAR(255),
                role_id VARCHAR(32)
            )
        `);
        console.log("✅ Table reaction_roles vérifiée.");

        console.log("✨ Terminé ! Tu peux redémarrer ton bot.");
        process.exit();

    } catch (err) {
        console.error("Erreur critique:", err);
        process.exit(1);
    }
})();