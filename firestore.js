'use strict';

// Charger les variables d'environnement depuis .env
require('dotenv').config();

const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getFirestore: _getFirestore }  = require('firebase-admin/firestore');
const fs   = require('fs').promises;
const path = require('path');

const DB_FILE = path.join(__dirname, 'database.json');

// ─── Initialisation Firebase Admin ───────────────────────────────────────────

let _db = null; // instance Firestore (lazy)

function getFirestore() {
    if (_db) return _db;

    if (!getApps().length) {
        let credential;

        // Sur Cloud Run (K_SERVICE est injecté automatiquement),
        // utiliser les identités GCloud natives (pas de fichier de clé nécessaire)
        if (process.env.K_SERVICE) {
            const { applicationDefault } = require('firebase-admin/app');
            credential = applicationDefault();
            console.log('[Firestore] Mode Cloud Run — Application Default Credentials');
        } else {
            // En local : charger le fichier de clé de service
            const keyPath = path.resolve(__dirname, 'serviceAccountKey.json');
            // eslint-disable-next-line global-require
            const serviceAccount = require(keyPath);
            credential = cert(serviceAccount);
            console.log('[Firestore] Mode local — serviceAccountKey.json');
        }

        initializeApp({
            credential,
            projectId: process.env.FIRESTORE_PROJECT_ID
        });
    }

    _db = _getFirestore();
    return _db;
}

// ─── Helpers internes ─────────────────────────────────────────────────────────

/**
 * Lire la DB depuis Firestore.
 * Structure : collection "users", chaque document = { wishes: [...] }
 * @returns {Promise<Object>} { username: [wishes] }
 */
async function readFromFirestore() {
    const db = getFirestore();
    const snapshot = await db.collection('users').get();
    const result = {};
    snapshot.forEach(doc => {
        result[doc.id] = doc.data().wishes || [];
    });
    return result;
}

/**
 * Écrire la DB dans Firestore (batch write).
 * @param {Object} data { username: [wishes] }
 */
async function writeToFirestore(data) {
    const db = getFirestore();
    const batch = db.batch();

    for (const [username, wishes] of Object.entries(data)) {
        const ref = db.collection('users').doc(username);
        batch.set(ref, { wishes }, { merge: false });
    }

    await batch.commit();
}

/**
 * Lire depuis le fichier JSON local (fallback).
 * @returns {Promise<Object>}
 */
async function readFromFile() {
    try {
        const data = await fs.readFile(DB_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        if (err.code === 'ENOENT') return {};
        throw err;
    }
}

/**
 * Écrire dans le fichier JSON local (fallback / backup).
 * @param {Object} data
 */
async function writeToFile(data) {
    await fs.writeFile(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// ─── Interface publique (identique à l'ancienne readDB/writeDB) ───────────────

/**
 * Lire la base de données.
 * Tente Firestore en priorité, bascule sur le fichier JSON si indisponible.
 * @returns {Promise<Object>}
 */
async function readDB() {
    try {
        return await readFromFirestore();
    } catch (err) {
        console.warn('[Firestore] Lecture impossible, fallback JSON :', err.message);
        return readFromFile();
    }
}

/**
 * Écrire dans la base de données.
 * Dual-write : Firestore + fichier JSON local (backup).
 * @param {Object} data
 */
async function writeDB(data) {
    // Sur Cloud Run : Firestore uniquement (pas de filesystem persistant)
    if (process.env.K_SERVICE) {
        await writeToFirestore(data);
        return;
    }

    // En local : dual-write Firestore + JSON (backup)
    const results = await Promise.allSettled([
        writeToFirestore(data),
        writeToFile(data)
    ]);

    const [firestoreResult, fileResult] = results;

    if (firestoreResult.status === 'rejected') {
        console.error('[Firestore] Écriture impossible :', firestoreResult.reason?.message);
    }
    if (fileResult.status === 'rejected') {
        console.error('[JSON fallback] Écriture impossible :', fileResult.reason?.message);
    }

    // Lever une erreur seulement si les DEUX ont échoué
    if (firestoreResult.status === 'rejected' && fileResult.status === 'rejected') {
        throw new Error('Échec total de persistence (Firestore + JSON)');
    }
}

// ─── Sélection du backend selon USE_JSON ─────────────────────────────────────

if (process.env.USE_JSON === 'true') {
    // Mode JSON pur : Firestore n'est jamais initialisé
    console.log('[DB] Mode JSON pur — Firestore désactivé');
    module.exports = { readDB: readFromFile, writeDB: writeToFile };
} else {
    // Mode par défaut : Firestore avec fallback JSON
    module.exports = { readDB, writeDB };
}
