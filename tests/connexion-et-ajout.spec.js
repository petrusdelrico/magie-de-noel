// Tests Playwright — Magie de Noël
// Couvre : connexion, ajout de souhait, groupes familiaux de test
//
// Stratégie de nettoyage :
//   - Les utilisateurs de test (Testalpha1/2, Testbeta1/2) sont permanents dans database.json
//   - Seuls les SOUHAITS ajoutés pendant les tests sont supprimés en afterEach via l'API
//   - Aucun utilisateur n'est créé ni supprimé par les tests

const { test, expect } = require('@playwright/test');
const { login, logout, addWish, deleteWishesOf, TEST_PASSWORD, TEST_GROUPS } = require('./helpers');

// Utilisateurs dont on nettoie les souhaits après chaque test
const USERS_TO_CLEAN = ['Testalpha1', 'Testalpha2', 'Testbeta1', 'Testbeta2'];

test.afterEach(async () => {
    // Vider uniquement les souhaits des utilisateurs de test — pas les utilisateurs eux-mêmes
    await Promise.all(USERS_TO_CLEAN.map(deleteWishesOf));
});

// ─── Suite 1 : Connexion ─────────────────────────────────────────────────────

test.describe('Connexion', () => {

    test('doit afficher le formulaire de login au démarrage', async ({ page }) => {
        await page.goto('/');

        await expect(page.locator('#login-view')).toBeVisible();
        await expect(page.locator('#username-input')).toBeVisible();
        await expect(page.locator('#dashboard-view')).toBeHidden();
    });

    test('doit se connecter avec un pseudo valide', async ({ page }) => {
        await login(page, 'Testalpha1');

        await expect(page.locator('#dashboard-view')).toBeVisible();
        await expect(page.locator('#current-user-display')).toHaveText('Testalpha1');
    });

    test('doit accepter une saisie insensible à la casse pour un utilisateur inscrit', async ({ page }) => {
        // "testalpha1" (minuscule) doit matcher "Testalpha1" dans la DB
        await login(page, 'testalpha1');
        await expect(page.locator('#current-user-display')).toHaveText('Testalpha1');
    });

    test('doit refuser un utilisateur inconnu', async ({ page }) => {
        await page.goto('/');
        await page.locator('#username-input').fill('UtilisateurInconnu');
        await page.locator('#password-input').fill(TEST_PASSWORD);
        await page.locator('#login-form button[type="submit"]').click();

        await expect(page.locator('#dashboard-view')).toBeHidden();
        await expect(page.locator('#toast')).toContainText('incorrect');
    });

    test('doit refuser un mauvais mot de passe', async ({ page }) => {
        await page.goto('/');
        await page.locator('#username-input').fill('Testalpha1');
        await page.locator('#password-input').fill('mauvais_mot_de_passe');
        await page.locator('#login-form button[type="submit"]').click();

        await expect(page.locator('#dashboard-view')).toBeHidden();
        await expect(page.locator('#toast')).toContainText('incorrect');
    });

    test('doit se déconnecter et revenir au login', async ({ page }) => {
        await login(page, 'Testalpha1');
        await logout(page);

        await expect(page.locator('#login-view')).toBeVisible();
        await expect(page.locator('#dashboard-view')).toBeHidden();
    });

});

// ─── Suite 1b : Navigation — Annuaire ────────────────────────────────────────

test.describe('Annuaire', () => {

    test('le formulaire de recherche ne doit pas exister', async ({ page }) => {
        await login(page, 'Testalpha1');

        await expect(page.locator('#search-form')).toHaveCount(0);
        await expect(page.locator('#search-input')).toHaveCount(0);
    });

    test('le bouton "Voir la liste des membres" doit être visible', async ({ page }) => {
        await login(page, 'Testalpha1');

        await expect(page.locator('#show-all-users-btn')).toBeVisible();
    });

    test('le clic sur "Voir la liste des membres" affiche la liste des membres', async ({ page }) => {
        await login(page, 'Testalpha1');

        await page.locator('#show-all-users-btn').click();

        await expect(page.locator('#all-users-area')).toBeVisible();
        // Au moins un membre visible listé
        await expect(page.locator('#directory-list .wish-item').first()).toBeVisible();
    });

    test("les utilisateurs cachés (hidden) ne doivent pas apparaître dans l'annuaire", async ({ page }) => {
        await login(page, 'Testalpha1');

        await page.locator('#show-all-users-btn').click();
        await expect(page.locator('#all-users-area')).toBeVisible();

        // Testalpha1, Testalpha2, Testbeta1, Testbeta2 sont hidden
        await expect(page.locator('#directory-list .wish-item', { hasText: 'Testalpha2' })).toHaveCount(0);
        await expect(page.locator('#directory-list .wish-item', { hasText: 'Testbeta1' })).toHaveCount(0);
        await expect(page.locator('#directory-list .wish-item', { hasText: 'Testbeta2' })).toHaveCount(0);
    });

    test("le clic sur un membre de l'annuaire affiche sa liste de souhaits", async ({ page }) => {
        await login(page, 'Testalpha1');

        await page.locator('#show-all-users-btn').click();
        await expect(page.locator('#all-users-area')).toBeVisible();

        // Cliquer sur le premier membre de la liste
        await page.locator('#directory-list .wish-item').first().click();

        // La zone "liste d'un autre" doit s'afficher
        await expect(page.locator('#other-list-area')).toBeVisible();
    });

});

// ─── Suite 2 : Ajout de souhaits ─────────────────────────────────────────────

test.describe('Ajout de souhaits', () => {

    test('doit ajouter un souhait simple', async ({ page }) => {
        await login(page, 'Testalpha1');
        await addWish(page, 'Un livre de Noël');

        const wishItem = page.locator('#my-wishes .wish-item', { hasText: 'Un livre de Noël' });
        await expect(wishItem).toBeVisible();
    });

    test('doit ajouter un souhait avec URL et commentaire', async ({ page }) => {
        await login(page, 'Testalpha1');
        await addWish(
            page,
            'Une montre connectée',
            'https://example.com/montre',
            'Préférence couleur noire'
        );

        const wishItem = page.locator('#my-wishes .wish-item', { hasText: 'Une montre connectée' });
        await expect(wishItem).toBeVisible();
        await expect(wishItem.locator('.wish-url')).toBeVisible();
        await expect(wishItem.locator('.wish-url')).toHaveAttribute('href', 'https://example.com/montre');
        await expect(wishItem.locator('.wish-comment')).toHaveText('Préférence couleur noire');
    });

    test('doit vider les champs après ajout', async ({ page }) => {
        await login(page, 'Testalpha1');
        await addWish(page, 'Un jeu de société');

        await expect(page.locator('#item-name')).toHaveValue('');
        await expect(page.locator('#item-url')).toHaveValue('');
        await expect(page.locator('#item-comment')).toHaveValue('');
    });

    test('doit pouvoir ajouter plusieurs souhaits', async ({ page }) => {
        await login(page, 'Testalpha1');
        await addWish(page, 'Souhait numéro un');
        await addWish(page, 'Souhait numéro deux');

        await expect(page.locator('#my-wishes .wish-item')).toHaveCount(2);
    });

});

// ─── Suite 3 : Groupes familiaux de test ─────────────────────────────────────

test.describe('Groupes familiaux — Groupe Test Alpha', () => {
    const groupe = TEST_GROUPS[0]; // { members: ['Testalpha1', 'Testalpha2'] }

    test('doit afficher le group-switcher pour un membre du groupe', async ({ page }) => {
        await login(page, groupe.members[0]);

        await expect(page.locator('#group-switcher')).toBeVisible();
    });

    test('doit afficher un bouton par membre du groupe', async ({ page }) => {
        await login(page, groupe.members[0]);

        await expect(page.locator('#group-switcher button')).toHaveCount(groupe.members.length);
    });

    test('doit basculer sur la liste du 2ème membre', async ({ page }) => {
        await login(page, groupe.members[0]); // Testalpha1
        const autreMembre = groupe.members[1]; // Testalpha2

        // Cliquer sur le bouton exact du 2ème membre (texte exact, pas de "(moi)")
        await page.locator('#group-switcher button', { hasText: new RegExp(`^${autreMembre}$`) }).click();

        await expect(page.locator('#my-list-title')).toHaveText(`Liste de ${autreMembre}`);
    });

    test('doit ajouter un souhait pour le 2ème membre depuis le 1er', async ({ page }) => {
        await login(page, groupe.members[0]); // Testalpha1
        const autreMembre = groupe.members[1]; // Testalpha2

        // Basculer sur la liste de Testalpha2
        await page.locator('#group-switcher button', { hasText: new RegExp(`^${autreMembre}$`) }).click();
        await expect(page.locator('#my-list-title')).toHaveText(`Liste de ${autreMembre}`);

        // Ajouter un souhait pour Testalpha2
        await addWish(page, 'Cadeau pour Testalpha2');

        await expect(page.locator('#my-wishes .wish-item', { hasText: 'Cadeau pour Testalpha2' })).toBeVisible();
    });

});

// ─── Suite 4 : Export des données (Pierre) ───────────────────────────────────

test.describe('Export des données', () => {

    test('le bouton export est visible uniquement pour Pierre', async ({ page }) => {
        // Vérifier que le bouton est caché pour un utilisateur ordinaire
        await login(page, 'Testalpha1');
        await expect(page.locator('#export-btn')).toBeHidden();
        await logout(page);

        // Vérifier que le bouton est visible pour Pierre
        await login(page, 'Pierre');
        await expect(page.locator('#export-btn')).toBeVisible();
    });

    test('le clic sur le bouton export télécharge un fichier JSON valide', async ({ page }) => {
        await login(page, 'Pierre');
        await expect(page.locator('#export-btn')).toBeVisible();

        // Intercepter l'événement de téléchargement déclenché par le clic
        const [download] = await Promise.all([
            page.waitForEvent('download'),
            page.locator('#export-btn').click(),
        ]);

        // Vérifier le nom du fichier (format database-YYYY-MM-DD.json)
        expect(download.suggestedFilename()).toMatch(/^database-\d{4}-\d{2}-\d{2}\.json$/);

        // Vérifier que le contenu est du JSON valide avec au moins un utilisateur
        const stream = await download.createReadStream();
        const chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        const content = Buffer.concat(chunks).toString('utf8');
        const parsed = JSON.parse(content); // Lève une erreur si JSON invalide
        expect(typeof parsed).toBe('object');
        expect(Object.keys(parsed).length).toBeGreaterThan(0);
    });

});

// ─── Suite 5 : Réservation inter-groupes ─────────────────────────────────────

test.describe('Réservation inter-groupes (testgroup1 ↔ testgroup2)', () => {

    const acheteur  = 'Testbeta1';  // membre de testgroup2
    const destinataire = 'Testalpha1'; // membre de testgroup1
    const nomSouhait = 'Cadeau à réserver inter-groupes';

    // Avant chaque test : Testalpha1 ajoute un souhait via l'API directement
    test.beforeEach(async () => {
        await fetch('http://localhost:3000/api/users/Testalpha1/wishes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ item: nomSouhait })
        });
    });

    test('Testbeta1 peut réserver un souhait de Testalpha1', async ({ page }) => {
        // Connexion de l'acheteur (Testbeta1)
        await login(page, acheteur);

        // Testalpha1 est hidden dans l'annuaire — on navigue directement vers sa liste
        await page.evaluate((username) => window.renderOtherList(username), destinataire);

        // La liste de Testalpha1 s'affiche
        await expect(page.locator('#other-list-area')).toBeVisible();

        // Le souhait est présent et disponible (bouton "Réserver" visible)
        const wishItem = page.locator('#other-wishes .wish-item', { hasText: nomSouhait });
        await expect(wishItem).toBeVisible();
        const reserveBtn = wishItem.locator('button', { hasText: 'Réserver' });
        await expect(reserveBtn).toBeVisible();

        // Réserver le souhait
        await reserveBtn.click();

        // Le bouton devient "Annuler réservation"
        await expect(wishItem.locator('button', { hasText: 'Annuler réservation' })).toBeVisible();
    });

    test('Testalpha1 ne voit PAS son souhait comme réservé après réservation par Testbeta1', async ({ page }) => {
        // Réserver via l'API directement
        const data = await fetch('http://localhost:3000/api/users/Testalpha1/wishes').then(r => r.json());
        const idx = data.wishes.findIndex(w => w.name === nomSouhait);
        await fetch(`http://localhost:3000/api/users/Testalpha1/wishes/${idx}/reserve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reserveBy: acheteur, action: 'reserve' })
        });

        // Connexion de Testalpha1 (propriétaire)
        await login(page, destinataire);

        // Le souhait est visible dans sa liste
        const wishItem = page.locator('#my-wishes .wish-item', { hasText: nomSouhait });
        await expect(wishItem).toBeVisible();

        // Le texte du souhait ne doit PAS être barré
        await expect(wishItem.locator('span', { hasText: nomSouhait }))
            .not.toHaveCSS('text-decoration', /line-through/);

        // Aucun badge "Réservé" ne doit être affiché
        await expect(wishItem.locator('.reserved-badge')).toHaveCount(0);
    });

});

test.describe('Groupes familiaux — Groupe Test Beta', () => {
    const groupe = TEST_GROUPS[1]; // { members: ['Testbeta1', 'Testbeta2'] }

    test('doit afficher le group-switcher pour un membre du groupe Beta', async ({ page }) => {
        await login(page, groupe.members[0]);

        await expect(page.locator('#group-switcher')).toBeVisible();
    });

    test('doit afficher un bouton par membre du groupe Beta', async ({ page }) => {
        await login(page, groupe.members[0]);

        await expect(page.locator('#group-switcher button')).toHaveCount(groupe.members.length);
    });

    test('doit basculer sur la liste du 2ème membre du groupe Beta', async ({ page }) => {
        await login(page, groupe.members[0]); // Testbeta1
        const autreMembre = groupe.members[1]; // Testbeta2

        await page.locator('#group-switcher button', { hasText: new RegExp(`^${autreMembre}$`) }).click();

        await expect(page.locator('#my-list-title')).toHaveText(`Liste de ${autreMembre}`);
    });

});

// ─── Suite 6 : Masquage de la réservation pour le propriétaire ───────────────

test.describe('Masquage de la réservation pour le propriétaire', () => {

    const proprietaire = 'Testalpha1'; // membre de testgroup1
    const acheteur     = 'Testbeta1';  // membre de testgroup2
    const tiers        = 'Testbeta2';  // membre de testgroup2, ne réserve pas
    const nomSouhait   = 'Souhait masqué pour test propriétaire';

    /**
     * Utilitaire : ajoute un souhait pour proprietaire et le réserve par acheteur via l'API.
     * Renvoie l'index du souhait dans la liste.
     */
    async function ajouterEtReserver() {
        await fetch('http://localhost:3000/api/users/Testalpha1/wishes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ item: nomSouhait })
        });
        const data = await fetch('http://localhost:3000/api/users/Testalpha1/wishes').then(r => r.json());
        const idx = data.wishes.findIndex(w => w.name === nomSouhait);
        await fetch(`http://localhost:3000/api/users/Testalpha1/wishes/${idx}/reserve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reserveBy: acheteur, action: 'reserve' })
        });
        return idx;
    }

    // ─── Test 1 : le propriétaire ne voit pas son souhait comme réservé ──────

    test('le propriétaire ne voit pas son souhait barré dans sa propre liste', async ({ page }) => {
        // Préparer : créer et réserver le souhait via l'API
        await ajouterEtReserver();

        // Connexion du propriétaire (Testalpha1)
        await login(page, proprietaire);

        // Le souhait est visible dans la liste personnelle
        const wishItem = page.locator('#my-wishes .wish-item', { hasText: nomSouhait });
        await expect(wishItem).toBeVisible();

        // Le texte du souhait ne doit PAS être barré (text-decoration: line-through)
        await expect(wishItem.locator('span', { hasText: nomSouhait }))
            .not.toHaveCSS('text-decoration', /line-through/);

        // Aucun badge "Réservé" ne doit apparaître
        await expect(wishItem.locator('.reserved-badge')).toHaveCount(0);
    });

    // ─── Test 2 : l'acheteur voit bien que le souhait est réservé PAR LUI ────

    test("l'acheteur voit le bouton Annuler réservation sur le souhait qu'il a réservé", async ({ page }) => {
        // Préparer : créer et réserver le souhait via l'API
        await ajouterEtReserver();

        // Connexion de l'acheteur (Testbeta1)
        await login(page, acheteur);

        // Naviguer vers la liste de Testalpha1 (hidden dans l'annuaire)
        await page.evaluate(() => window.renderOtherList('Testalpha1'));
        await expect(page.locator('#other-list-area')).toBeVisible();

        // Le souhait est présent et marqué comme réservé par l'acheteur
        const wishItem = page.locator('#other-wishes .wish-item', { hasText: nomSouhait });
        await expect(wishItem).toBeVisible();

        // Le bouton "Annuler réservation" doit être visible (c'est lui l'acheteur)
        await expect(wishItem.locator('button', { hasText: 'Annuler réservation' })).toBeVisible();
    });

    // ─── Test 3 : un tiers voit que le souhait est "Déjà réservé" ────────────

    test('un tiers voit que le souhait est "Déjà réservé"', async ({ page }) => {
        // Préparer : créer et réserver le souhait via l'API
        await ajouterEtReserver();

        // Connexion du tiers (Testbeta2, ne connaît pas le réservant)
        await login(page, tiers);

        // Naviguer vers la liste de Testalpha1 (hidden dans l'annuaire)
        await page.evaluate(() => window.renderOtherList('Testalpha1'));
        await expect(page.locator('#other-list-area')).toBeVisible();

        // Le souhait est présent et signalé "Déjà réservé"
        const wishItem = page.locator('#other-wishes .wish-item', { hasText: nomSouhait });
        await expect(wishItem).toBeVisible();

        // L'icône cadenas et le texte "Déjà réservé" doivent être affichés
        await expect(wishItem.locator('i.ph-lock-key')).toBeVisible();
        await expect(wishItem).toContainText('Déjà réservé');
    });

    // ─── Test 4 : l'émetteur d'un souhait commun ne voit pas la réservation ──

    test("l'émetteur d'un souhait commun ne voit pas la réservation dans la liste de l'autre", async ({ page }) => {
        // Étape 1 : Testalpha1 crée un souhait via l'API
        await fetch('http://localhost:3000/api/users/Testalpha1/wishes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ item: nomSouhait })
        });

        // Étape 2 : récupérer l'index du souhait créé
        const data = await fetch('http://localhost:3000/api/users/Testalpha1/wishes').then(r => r.json());
        const idx = data.wishes.findIndex(w => w.name === nomSouhait);

        // Étape 3 : partager ce souhait avec Testalpha2 (même groupe testgroup1)
        await fetch(`http://localhost:3000/api/users/Testalpha1/wishes/${idx}/share`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sharedWith: 'Testalpha2' })
        });

        // Étape 4 : récupérer l'index du souhait miroir dans la liste de Testalpha2
        const data2 = await fetch('http://localhost:3000/api/users/Testalpha2/wishes').then(r => r.json());
        const idxMiroir = data2.wishes.findIndex(w => w.name === nomSouhait);

        // Étape 5 : Testbeta1 réserve le souhait dans la liste de Testalpha2
        await fetch(`http://localhost:3000/api/users/Testalpha2/wishes/${idxMiroir}/reserve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reserveBy: acheteur, action: 'reserve' })
        });

        // Étape 6 : Testalpha1 (émetteur du souhait commun) se connecte
        await login(page, proprietaire);

        // Étape 7 : basculer sur la liste de Testalpha2 via le group-switcher
        await page.locator('#group-switcher button', { hasText: /^Testalpha2$/ }).click();
        await expect(page.locator('#my-list-title')).toHaveText('Liste de Testalpha2');

        // Étape 8 : le souhait commun doit être visible
        const wishItem = page.locator('#my-wishes .wish-item', { hasText: nomSouhait });
        await expect(wishItem).toBeVisible();

        // L'émetteur (Testalpha1) ne doit PAS voir le souhait barré (masquage sharedFrom)
        await expect(wishItem.locator('span', { hasText: nomSouhait }))
            .not.toHaveCSS('text-decoration', /line-through/);

        // Aucun badge "Réservé" ne doit apparaître pour l'émetteur
        await expect(wishItem.locator('.reserved-badge')).toHaveCount(0);
    });

});

// ─── Suite 7 : Souhait commun — masquage du bouton Réserver ──────────────────

test.describe('Souhait commun — masquage du bouton Réserver', () => {

    const emetteur   = 'Testalpha1'; // crée le souhait et initie le partage
    const partenaire = 'Testbeta1';  // reçoit le souhait commun (sharedWith)
    const tiers      = 'Testbeta2';  // utilisateur non associé au souhait commun
    const nomSouhait = 'Cadeau commun test';
    let idxSouhait   = -1;           // index du souhait dans la liste de l'émetteur

    // Avant chaque test : créer le souhait et établir le lien commun via l'API
    test.beforeEach(async () => {
        // Créer le souhait pour l'émetteur
        await fetch('http://localhost:3000/api/users/Testalpha1/wishes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ item: nomSouhait })
        });

        // Récupérer l'index du souhait créé
        const data = await fetch('http://localhost:3000/api/users/Testalpha1/wishes').then(r => r.json());
        idxSouhait = data.wishes.findIndex(w => w.name === nomSouhait);

        // Créer le lien commun entre Testalpha1 et Testbeta1
        await fetch(`http://localhost:3000/api/users/Testalpha1/wishes/${idxSouhait}/share`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sharedWith: 'Testbeta1' })
        });
    });

    // ─── Test 1 : vue depuis le partenaire direct (sharedWith) ───────────────

    test('Testbeta1 (sharedWith) ne voit pas le bouton Réserver sur le souhait commun de Testalpha1', async ({ page }) => {
        // Connexion du partenaire (Testbeta1 — sharedWith)
        await login(page, partenaire);

        // Naviguer vers la liste de Testalpha1 (hidden dans l'annuaire)
        await page.evaluate(() => window.renderOtherList('Testalpha1'));
        await expect(page.locator('#other-list-area')).toBeVisible();

        // Localiser le souhait commun dans la liste affichée
        const wishItem = page.locator('#other-wishes .wish-item', { hasText: nomSouhait });
        await expect(wishItem).toBeVisible();

        // Le bouton "Réserver" NE doit PAS être visible
        await expect(wishItem.locator('button', { hasText: 'Réserver' })).not.toBeVisible();

        // Le span "Souhait commun" DOIT être visible
        await expect(wishItem.locator('span', { hasText: 'Souhait commun' })).toBeVisible();
    });

    // ─── Test 2 : vue depuis l'émetteur original (sharedFrom) ───────────────

    test('Testalpha1 (sharedFrom) ne voit pas le bouton Réserver sur le souhait commun dans la liste de Testbeta1', async ({ page }) => {
        // Connexion de l'émetteur (Testalpha1 — le souhait apparaît côté Testbeta1 avec sharedFrom: 'Testalpha1')
        await login(page, emetteur);

        // Naviguer vers la liste de Testbeta1 (hidden dans l'annuaire)
        await page.evaluate(() => window.renderOtherList('Testbeta1'));
        await expect(page.locator('#other-list-area')).toBeVisible();

        // Localiser le souhait commun dans la liste affichée
        const wishItem = page.locator('#other-wishes .wish-item', { hasText: nomSouhait });
        await expect(wishItem).toBeVisible();

        // Le bouton "Réserver" NE doit PAS être visible
        await expect(wishItem.locator('button', { hasText: 'Réserver' })).not.toBeVisible();

        // Le span "Souhait commun" DOIT être visible
        await expect(wishItem.locator('span', { hasText: 'Souhait commun' })).toBeVisible();
    });

    // ─── Test 3 : un tiers peut toujours réserver ce souhait commun ─────────

    test('Testbeta2 (tiers non associé) voit bien le bouton Réserver sur le souhait commun de Testalpha1', async ({ page }) => {
        // Connexion du tiers (Testbeta2 — aucun lien avec ce souhait commun)
        await login(page, tiers);

        // Naviguer vers la liste de Testalpha1 (hidden dans l'annuaire)
        await page.evaluate(() => window.renderOtherList('Testalpha1'));
        await expect(page.locator('#other-list-area')).toBeVisible();

        // Localiser le souhait commun dans la liste affichée
        const wishItem = page.locator('#other-wishes .wish-item', { hasText: nomSouhait });
        await expect(wishItem).toBeVisible();

        // Le bouton "Réserver" DOIT être visible pour un tiers
        await expect(wishItem.locator('button', { hasText: 'Réserver' })).toBeVisible();
    });

});
