// Helpers partagés pour les tests Playwright — Magie de Noël

const crypto = require('crypto');
const BASE_URL = 'http://localhost:3000';

/**
 * Calcule sha256 d'une chaîne (Node.js).
 * @param {string} message
 * @returns {string} Hash hexadécimal
 */
function sha256(message) {
    return crypto.createHash('sha256').update(message).digest('hex');
}

/**
 * Retourne le timestamp arrondi aux 10 dernières minutes (ms).
 * @returns {number}
 */
function roundedTimestamp() {
    const TEN_MINUTES = 10 * 60 * 1000;
    return Math.floor(Date.now() / TEN_MINUTES) * TEN_MINUTES;
}

/**
 * Construit le token d'authentification côté test (même logique que le frontend).
 * sha256( sha256(password) + roundedTimestamp )
 * @param {string} password Mot de passe en clair
 * @returns {string} Token hexadécimal
 */
function buildAuthToken(password) {
    const passwordHash = sha256(password);
    const timestamp = String(roundedTimestamp());
    return sha256(passwordHash + timestamp);
}

// ─── Utilisateurs de test ────────────────────────────────────────────────────

/** Tous les pseudos de test permanents (jamais supprimés) */
const TEST_USERS = ['Testalpha1', 'Testalpha2', 'Testbeta1', 'Testbeta2'];

/**
 * Mot de passe commun à tous les utilisateurs de test.
 * Le SHA-256 de cette valeur doit correspondre au hash dans users-config.json.
 */
const TEST_PASSWORD = 'magicnoel2026';

/** Groupes familiaux de test définis dans groups.json */
const TEST_GROUPS = [
    { id: 'testgroup1', name: 'Groupe Test Alpha', members: ['Testalpha1', 'Testalpha2'] },
    { id: 'testgroup2', name: 'Groupe Test Beta',  members: ['Testbeta1',  'Testbeta2']  },
];

// ─── Helpers de navigation ───────────────────────────────────────────────────

/**
 * Connecte un utilisateur via le formulaire de login.
 * Attend que le dashboard soit visible avant de continuer.
 * @param {import('@playwright/test').Page} page
 * @param {string} username
 */
async function login(page, username, password = TEST_PASSWORD) {
    await page.goto('/');
    await page.locator('#username-input').fill(username);
    await page.locator('#password-input').fill(password);
    await page.locator('#login-form button[type="submit"]').click();
    // Attendre la fin de la transition CSS (400ms) + chargement du groupe
    await page.locator('#dashboard-view').waitFor({ state: 'visible', timeout: 5000 });
}

/**
 * Déconnecte l'utilisateur courant.
 * Attend que la vue login soit de nouveau visible.
 * @param {import('@playwright/test').Page} page
 */
async function logout(page) {
    await page.locator('#logout-btn').click();
    await page.locator('#login-view').waitFor({ state: 'visible', timeout: 5000 });
}

/**
 * Ajoute un souhait via le formulaire.
 * @param {import('@playwright/test').Page} page
 * @param {string} name    Nom du souhait (obligatoire)
 * @param {string} url     Lien hypertexte (optionnel)
 * @param {string} comment Commentaire libre (optionnel)
 */
async function addWish(page, name, url = '', comment = '') {
    await page.locator('#item-name').fill(name);
    if (url)     await page.locator('#item-url').fill(url);
    if (comment) await page.locator('#item-comment').fill(comment);
    await page.locator('#add-item-form button[type="submit"]').click();
    // Attendre qu'au moins un souhait portant ce nom apparaisse
    await page.locator('#my-wishes .wish-item', { hasText: name })
              .waitFor({ state: 'visible', timeout: 5000 });
}

// ─── Helpers API ─────────────────────────────────────────────────────────────

/**
 * Supprime tous les souhaits d'un utilisateur via l'API (nettoyage post-test).
 * NE supprime PAS l'utilisateur lui-même.
 * Récupère la liste puis supprime chaque souhait de la fin vers le début
 * pour éviter les décalages d'index.
 * @param {string} username
 */
async function deleteWishesOf(username) {
    try {
        const res = await fetch(`${BASE_URL}/api/users/${username}/wishes`);
        if (!res.ok) return;
        const data = await res.json();
        const wishes = data.wishes || [];

        // Supprimer de la fin vers le début pour ne pas décaler les index
        for (let i = wishes.length - 1; i >= 0; i--) {
            await fetch(`${BASE_URL}/api/users/${username}/wishes/${i}`, {
                method: 'DELETE'
            });
        }
    } catch {
        // Ignorer si le serveur est inaccessible
    }
}

module.exports = { login, logout, addWish, deleteWishesOf, TEST_USERS, TEST_PASSWORD, TEST_GROUPS };
