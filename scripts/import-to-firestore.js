'use strict';

/**
 * Script d'import one-shot : database.json → Firestore
 * Usage : node scripts/import-to-firestore.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs   = require('fs').promises;
const path = require('path');

const DB_FILE = path.join(__dirname, '..', 'database.json');

async function main() {
    // Initialisation Firebase Admin avec chemin absolu vers la clé de service
    if (!getApps().length) {
        const keyPath = path.resolve(__dirname, '..', 'serviceAccountKey.json');
        const serviceAccount = JSON.parse(await fs.readFile(keyPath, 'utf8'));
        initializeApp({
            credential: cert(serviceAccount),
            projectId: process.env.FIRESTORE_PROJECT_ID
        });
    }

    const db = getFirestore();

    // Lire database.json
    console.log(`Lecture de ${DB_FILE}...`);
    const raw = await fs.readFile(DB_FILE, 'utf8');
    const data = JSON.parse(raw);

    const users = Object.entries(data);
    console.log(`${users.length} utilisateurs à importer.`);

    // Batch write (max 500 opérations par batch Firestore)
    const BATCH_SIZE = 400;
    let count = 0;

    for (let i = 0; i < users.length; i += BATCH_SIZE) {
        const chunk = users.slice(i, i + BATCH_SIZE);
        const batch = db.batch();

        for (const [username, wishes] of chunk) {
            const ref = db.collection('users').doc(username);
            batch.set(ref, { wishes: wishes || [] }, { merge: false });
            count++;
        }

        await batch.commit();
        console.log(`  → ${count}/${users.length} documents importés`);
    }

    console.log(`
✅ Import terminé : ${count} utilisateurs dans Firestore.`);
    process.exit(0);
}

main().catch(err => {
    console.error("❌ Erreur lors de l'import :", err.message);
    process.exit(1);
});
