const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'database.json');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helper pour lire la DB
async function readDB() {
    try {
        const data = await fs.readFile(DB_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        // Si le fichier n'existe pas, on retourne un objet vide
        if (err.code === 'ENOENT') {
            return {};
        }
        throw err;
    }
}

// Helper pour sauvegarder la DB
async function writeDB(data) {
    await fs.writeFile(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

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

// 2. Initialiser un utilisateur ou récupérer ses cadeaux (Login)
app.post('/api/login', async (req, res) => {
    try {
        const { username } = req.body;
        if (!username) return res.status(400).json({ error: "Nom d'utilisateur requis" });

        const formattedName = username.charAt(0).toUpperCase() + username.slice(1).toLowerCase();

        let db = await readDB();
        db = await migrateDB(db);

        if (!db[formattedName]) {
            db[formattedName] = [];
            await writeDB(db);
        }

        res.json({ username: formattedName, wishes: db[formattedName] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Ajouter un souhait
app.post('/api/users/:username/wishes', async (req, res) => {
    try {
        const { username } = req.params;
        const { item } = req.body;

        if (!item) return res.status(400).json({ error: "L'item est requis" });

        let db = await readDB();
        if (!db[username]) {
            return res.status(404).json({ error: "Utilisateur non trouvé" });
        }

        const newWish = {
            id: Date.now().toString(),
            name: item,
            reservedBy: null
        };

        db[username].push(newWish);
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
        if (!db[username]) {
            return res.status(404).json({ error: "Utilisateur non trouvé" });
        }

        if (index >= 0 && index < db[username].length) {
            db[username].splice(index, 1);
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
        if (!db[username] || !db[username][index]) {
            return res.status(404).json({ error: "Souhait introuvable" });
        }

        const wish = db[username][index];

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

        await writeDB(db);
        res.json({ success: true, wish });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 6. Obtenir la liste de tous les utilisateurs
app.get('/api/users', async (req, res) => {
    try {
        let db = await readDB();
        // Optionnel : ne pas renvoyer de listes vides
        const users = Object.keys(db).filter(user => db[user].length > 0 || true);
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

app.listen(PORT, () => {
    console.log(`Serveur démarré sur http://localhost:${PORT}`);
});
