require('dotenv').config();

const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { readDB, writeDB } = require('./firestore');

const app = express();
const PORT = process.env.PORT || 3000;
const GROUPS_FILE = path.join(__dirname, 'groups.json');
const USERS_CONFIG_FILE = path.join(__dirname, 'users-config.json');

let groups = [];
let usersConfig = {}; // { "Testalpha1": { hidden: true }, ... }

// Charger les groupes au démarrage
fs.readFile(GROUPS_FILE, 'utf8')
    .then(data => {
        groups = JSON.parse(data);
        console.log(`Groupes chargés : ${groups.length} groupe(s)`);
    })
    .catch(err => {
        console.warn(`Impossible de charger ${GROUPS_FILE} :`, err.message);
        groups = [];
    });

// Charger la configuration des utilisateurs au démarrage
fs.readFile(USERS_CONFIG_FILE, 'utf8')
    .then(data => {
        usersConfig = JSON.parse(data);
        console.log(`Config utilisateurs chargée : ${Object.keys(usersConfig).length} entrée(s)`);
    })
    .catch(err => {
        console.warn(`Impossible de charger ${USERS_CONFIG_FILE} :`, err.message);
        usersConfig = {};
    });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Migration (pour s'assurer que tous les souhaits sont des objets)
async function migrateDB(db) {
    let migrated = false;
    for (let user in db) {
        db[user] = db[user].map(wish => {
            if (typeof wish === 'string') {
                migrated = true;
                return { id: Date.now().toString() + Math.random().toString(), name: wish, reservedBy: null };
            }
            return wish;
        });
    }
    if (migrated) await writeDB(db);
    return db;
}

// Routes de l'API

// 1. Obtenir les cadeaux d'un utilisateur
app.get('/api/users/:username/wishes', async (req, res) => {
    try {
        let db = await readDB();
        db = await migrateDB(db);

        const reqUsername = req.params.username.toLowerCase();

        // Recherche insensible à la casse
        const userKey = Object.keys(db).find(k => k.toLowerCase() === reqUsername);

        if (userKey) {
            res.json({ username: userKey, wishes: db[userKey] });
        } else {
            res.status(404).json({ error: "Utilisateur non trouvé" });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Connexion — seuls les utilisateurs inscrits dans database.json peuvent se connecter
app.post('/api/login', async (req, res) => {
    try {
        const { username, token } = req.body;
        if (!username) return res.status(400).json({ error: "Nom d'utilisateur requis" });
        if (!token)    return res.status(400).json({ error: "Token d'authentification requis" });

        let db = await readDB();
        db = await migrateDB(db);

        // Recherche insensible à la casse parmi les utilisateurs inscrits
        const userKey = Object.keys(db).find(k => k.toLowerCase() === username.toLowerCase());

        if (!userKey) {
            return res.status(403).json({ error: "Identifiant ou mot de passe incorrect." });
        }

        // Récupérer le hash stocké pour cet utilisateur
        const userConfig = Object.entries(usersConfig)
            .find(([k]) => k.toLowerCase() === userKey.toLowerCase());
        const storedHash = userConfig ? userConfig[1].password : null;

        if (!storedHash) {
            return res.status(403).json({ error: "Aucun mot de passe configuré pour cet utilisateur." });
        }

        // Recalculer le token attendu : sha256(storedHash + roundedTimestamp)
        // Tolérer la fenêtre courante ET la fenêtre précédente (bord de tranche)
        const TEN_MINUTES = 10 * 60 * 1000;
        const now = Date.now();
        const currentWindow  = String(Math.floor(now / TEN_MINUTES) * TEN_MINUTES);
        const previousWindow = String(Math.floor(now / TEN_MINUTES) * TEN_MINUTES - TEN_MINUTES);

        const expectedCurrent  = crypto.createHash('sha256').update(storedHash + currentWindow).digest('hex');
        const expectedPrevious = crypto.createHash('sha256').update(storedHash + previousWindow).digest('hex');

        if (token !== expectedCurrent && token !== expectedPrevious) {
            return res.status(401).json({ error: "Identifiant ou mot de passe incorrect." });
        }

        // Initialiser automatiquement les autres membres du groupe s'ils n'existent pas encore
        const userGroup = groups.find(g =>
            g.members.some(m => m.toLowerCase() === userKey.toLowerCase())
        );
        if (userGroup) {
            let dirty = false;
            for (const member of userGroup.members) {
                if (!db[member]) {
                    db[member] = [];
                    dirty = true;
                }
            }
            if (dirty) await writeDB(db);
        }

        res.json({ username: userKey, wishes: db[userKey] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Ajouter un souhait
app.post('/api/users/:username/wishes', async (req, res) => {
    try {
        const { username } = req.params;
        const { item, addedBy } = req.body;

        if (!item) return res.status(400).json({ error: "L'item est requis" });

        let db = await readDB();

        // Recherche insensible à la casse
        const userKey = Object.keys(db).find(k => k.toLowerCase() === username.toLowerCase());
        if (!userKey) {
            return res.status(404).json({ error: "Utilisateur non trouvé" });
        }

        const newWish = {
            id: Date.now().toString(),
            name: item,
            reservedBy: null
        };

        // Ajouter addedBy si fourni
        if (addedBy) {
            newWish.addedBy = addedBy;
        }

        // Ajouter url et comment si fournis
        const { url, comment } = req.body;
        if (url) {
            newWish.url = url;
        }
        if (comment) {
            newWish.comment = comment;
        }

        db[userKey].push(newWish);
        await writeDB(db);

        res.json({ success: true, wish: newWish });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. Supprimer un souhait
app.delete('/api/users/:username/wishes/:wishIndex', async (req, res) => {
    try {
        const { username, wishIndex } = req.params;
        const index = parseInt(wishIndex, 10);

        let db = await readDB();

        // Recherche insensible à la casse
        const userKey = Object.keys(db).find(k => k.toLowerCase() === username.toLowerCase());
        if (!userKey) {
            return res.status(404).json({ error: "Utilisateur non trouvé" });
        }

        if (index >= 0 && index < db[userKey].length) {
            const wish = db[userKey][index];

            // Supprimer le souhait miroir chez le partenaire
            if (wish.sharedWith && db[wish.sharedWith]) {
                db[wish.sharedWith] = db[wish.sharedWith].filter(w => w.sharedSourceId !== wish.id);
            } else if (wish.sharedFrom && db[wish.sharedFrom]) {
                db[wish.sharedFrom] = db[wish.sharedFrom].filter(w => w.id !== wish.sharedSourceId);
            }

            db[userKey].splice(index, 1);
            await writeDB(db);
            res.json({ success: true });
        } else {
            res.status(400).json({ error: "Index invalide" });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 5. Réserver ou annuler la réservation d'un souhait
app.post('/api/users/:username/wishes/:wishIndex/reserve', async (req, res) => {
    try {
        const { username, wishIndex } = req.params;
        const { reserveBy, action } = req.body; // action: 'reserve' ou 'unreserve'
        const index = parseInt(wishIndex, 10);

        if (!reserveBy || !action) return res.status(400).json({ error: "reserveBy et action requis" });

        let db = await readDB();

        // Recherche insensible à la casse
        const userKey = Object.keys(db).find(k => k.toLowerCase() === username.toLowerCase());
        if (!userKey) {
            return res.status(404).json({ error: "Utilisateur introuvable" });
        }
        if (index < 0 || index >= db[userKey].length) {
            return res.status(404).json({ error: "Souhait introuvable" });
        }

        const wish = db[userKey][index];

        if (action === 'reserve') {
            if (wish.reservedBy) {
                return res.status(400).json({ error: "Déjà réservé" });
            }
            wish.reservedBy = reserveBy;
        } else if (action === 'unreserve') {
            if (wish.reservedBy !== reserveBy) {
                return res.status(400).json({ error: "Vous n'êtes pas celui qui a réservé" });
            }
            wish.reservedBy = null;
        }

        // Synchroniser la réservation sur le souhait jumeau (souhait commun)
        if (wish.sharedWith && db[wish.sharedWith]) {
            // Ce souhait est la source → mettre à jour le miroir chez sharedWith
            const mirror = db[wish.sharedWith].find(w => w.sharedSourceId === wish.id);
            if (mirror) mirror.reservedBy = wish.reservedBy;
        } else if (wish.sharedFrom && db[wish.sharedFrom]) {
            // Ce souhait est un miroir → mettre à jour la source chez sharedFrom
            const source = db[wish.sharedFrom].find(w => w.id === wish.sharedSourceId);
            if (source) source.reservedBy = wish.reservedBy;
        }

        await writeDB(db);
        res.json({ success: true, wish });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 6. Partager un souhait avec un autre utilisateur (souhait commun)
app.post('/api/users/:username/wishes/:wishIndex/share', async (req, res) => {
    try {
        const { username, wishIndex } = req.params;
        const { sharedWith } = req.body;
        const index = parseInt(wishIndex, 10);

        if (!sharedWith) return res.status(400).json({ error: "sharedWith est requis" });

        let db = await readDB();

        // Recherche insensible à la casse pour les deux utilisateurs
        const userKey = Object.keys(db).find(k => k.toLowerCase() === username.toLowerCase());
        const partnerKey = Object.keys(db).find(k => k.toLowerCase() === sharedWith.toLowerCase());

        if (!userKey) {
            return res.status(404).json({ error: "Utilisateur introuvable" });
        }
        if (index < 0 || index >= db[userKey].length) {
            return res.status(404).json({ error: "Souhait introuvable" });
        }
        if (!partnerKey) {
            return res.status(404).json({ error: "Utilisateur partenaire introuvable" });
        }
        if (userKey === partnerKey) {
            return res.status(400).json({ error: "Impossible de partager avec soi-même" });
        }

        const wish = db[userKey][index];

        if (wish.sharedWith || wish.sharedFrom) {
            return res.status(400).json({ error: "Ce souhait est déjà partagé" });
        }

        // Marquer le souhait source avec la casse canonique du partenaire
        wish.sharedWith = partnerKey;

        // Créer le souhait miroir dans la liste du partenaire
        const mirror = {
            id: wish.id + '-mirror',
            name: wish.name,
            reservedBy: wish.reservedBy,
            sharedFrom: userKey,
            sharedSourceId: wish.id
        };

        // Copier url et comment s'ils existent
        if (wish.url) mirror.url = wish.url;
        if (wish.comment) mirror.comment = wish.comment;

        db[partnerKey].push(mirror);

        await writeDB(db);
        res.json({ success: true, wish, mirror });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 7. Obtenir tous les groupes
app.get('/api/groups', async (req, res) => {
    try {
        res.json({ groups });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 8. Obtenir le groupe d'un utilisateur
app.get('/api/users/:username/group', async (req, res) => {
    try {
        const { username } = req.params;
        const reqUsername = username.toLowerCase();

        const userGroup = groups.find(g =>
            g.members.some(m => m.toLowerCase() === reqUsername)
        );

        if (userGroup) {
            res.json({ group: userGroup });
        } else {
            res.json({ group: null });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 9. Obtenir la liste de tous les utilisateurs
app.get('/api/users', async (req, res) => {
    try {
        let db = await readDB();

        // Exclure les utilisateurs masqués (hidden: true dans users-config.json)
        // et la clé technique _metadata si elle existe
        const users = Object.keys(db).filter(user => {
            if (user === '_metadata') return false;
            const config = Object.entries(usersConfig)
                .find(([k]) => k.toLowerCase() === user.toLowerCase());
            return !config || !config[1].hidden;
        });

        res.json({ users });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 7. Obtenir tous les cadeaux réservés par un utilisateur
app.get('/api/users/:username/reservations', async (req, res) => {
    try {
        const { username } = req.params;
        const reqUsername = username.toLowerCase();

        let db = await readDB();
        const reservations = [];

        for (let listOwner in db) {
            db[listOwner].forEach((wish, index) => {
                if (wish.reservedBy && wish.reservedBy.toLowerCase() === reqUsername) {
                    reservations.push({
                        listOwner: listOwner,
                        wishIndex: index,
                        wish: wish
                    });
                }
            });
        }

        res.json({ reservations });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 11. Exporter la base de données (réservé à l'administrateur)
app.get('/api/admin/export', async (req, res) => {
    try {
        const data = await readDB();
        const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="database-${date}.json"`);
        res.send(JSON.stringify(data, null, 2));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 12. Supprimer un utilisateur et toutes ses données (usage test uniquement)
app.delete('/api/users/:username', async (req, res) => {
    try {
        const { username } = req.params;

        let db = await readDB();

        // Recherche insensible à la casse
        const userKey = Object.keys(db).find(k => k.toLowerCase() === username.toLowerCase());
        if (!userKey) {
            return res.status(404).json({ error: "Utilisateur non trouvé" });
        }

        // Nettoyer les souhaits miroirs liés à cet utilisateur chez les autres
        for (const otherUser in db) {
            if (otherUser === userKey) continue;
            db[otherUser] = db[otherUser].filter(w => {
                // Supprimer les miroirs dont la source appartient à userKey
                if (w.sharedFrom === userKey) return false;
                // Supprimer les sources qui pointaient vers userKey
                if (w.sharedWith === userKey) { delete w.sharedWith; }
                return true;
            });
        }

        // Supprimer l'utilisateur
        delete db[userKey];
        await writeDB(db);

        res.json({ success: true, deleted: userKey });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Serveur démarré sur http://localhost:${PORT}`);
});
