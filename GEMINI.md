# Magie de Noël — Guide Projet pour Gemini CLI

## Description du projet

**Magie de Noël** est une application web de gestion de listes de souhaits de Noël partagées.
Elle permet à chaque utilisateur d'un groupe (famille, amis) de :

- créer et gérer sa propre liste de cadeaux souhaités ;
- consulter les listes des autres membres ;
- réserver discrètement un cadeau sur la liste d'un autre (sans que le propriétaire sache qui réserve) ;
- annuler une réservation ;
- visualiser l'ensemble de ses réservations en cours.

L'application est une **PWA** (Progressive Web App) : elle dispose d'un `manifest.json` et d'un service worker (`sw.js`) permettant une installation sur mobile.

---

## Architecture

```
magie-de-noel-main/
├── server.js          # Serveur Express (API REST + service de fichiers statiques)
├── database.json      # Base de données JSON (générée à l'exécution, à ne PAS committer)
├── package.json       # Dépendances Node.js
└── public/            # Frontend statique servi par Express
    ├── index.html     # SPA HTML avec toutes les vues (login, dashboard, etc.)
    ├── app.js         # Logique frontend (vanilla JS, manipulation du DOM)
    ├── style.css      # Styles (thème de Noël, glassmorphism, responsive)
    ├── icon.png       # Icône PWA
    ├── manifest.json  # Manifeste PWA
    └── sw.js          # Service Worker (cache offline)
```

### Stack technique

| Couche      | Technologie                              |
|-------------|------------------------------------------|
| Backend     | Node.js + Express 5 (CommonJS)           |
| Persistance | Fichier `database.json` (lecture/écriture via `fs.promises`) |
| Frontend    | HTML / CSS / JavaScript vanilla (pas de framework) |
| Icônes      | Phosphor Icons (CDN)                     |
| Polices     | Google Fonts — Outfit + Playfair Display |
| PWA         | `manifest.json` + Service Worker         |

---

## API REST (server.js)

Toutes les routes sont préfixées par `/api`.

| Méthode | Route | Description |
|---------|-------|-------------|
| `POST` | `/api/login` | Connexion / création d'un utilisateur. Le nom est normalisé (1ère lettre majuscule). |
| `GET` | `/api/users` | Liste de tous les utilisateurs enregistrés. |
| `GET` | `/api/users/:username/wishes` | Récupère la liste de souhaits d'un utilisateur (recherche insensible à la casse). |
| `POST` | `/api/users/:username/wishes` | Ajoute un souhait à la liste d'un utilisateur. |
| `DELETE` | `/api/users/:username/wishes/:wishIndex` | Supprime un souhait par son index. |
| `POST` | `/api/users/:username/wishes/:wishIndex/reserve` | Réserve ou annule la réservation d'un souhait (`action: 'reserve'` ou `'unreserve'`). |
| `POST` | `/api/users/:username/wishes/:wishIndex/share` | Crée un souhait commun entre deux utilisateurs (`sharedWith: "NomUtilisateur"`). |
| `GET` | `/api/users/:username/reservations` | Retourne tous les souhaits réservés **par** cet utilisateur sur les autres listes. |

### Structure d'un souhait (objet `wish`)

```json
{
  "id": "1234567890.456",
  "name": "Un livre de recettes",
  "reservedBy": null,
  "url": "https://example.com/product",
  "comment": "Préférence : édition reliée"
}
```

- `reservedBy` : `null` si non réservé, sinon le nom de l'utilisateur réservant.
- `url` : lien hypertexte optionnel (ex: vers un produit en ligne).
- `comment` : texte libre optionnel (ex: précisions sur le souhait, taille, couleur, etc.).

### Structure de `database.json`

```json
{
  "Alice": [
    { "id": "...", "name": "Un livre", "reservedBy": "Bob" }
  ],
  "Bob": [
    { "id": "...", "name": "Une console", "reservedBy": null }
  ]
}
```

Une migration automatique (`migrateDB`) convertit les anciens souhaits stockés comme simples chaînes de caractères en objets.

---

## Groupes familiaux (groups.json)

Les groupes familiaux permettent aux membres d'un même groupe de saisir des souhaits pour les autres membres de leur groupe.

**Fichier `groups.json`** (configuration statique, lue au démarrage) :
```json
[
  {
    "id": "aliceetbob",
    "name": "Groupe AliceETBob",
    "members": ["Alice", "Bob"]
  },
  {
    "id": "ricobodet",
    "name": "Groupe RicoBodet",
    "members": ["Pierre", "Gué"]
  }
]
```

### Fonctionnement

- **Au login**, si l'utilisateur est membre d'un groupe, des **boutons d'onglets** apparaissent dans le header (`[Alice (moi)] [Bob]`) pour basculer entre les listes de chaque membre du groupe.
- **Saisie pour les autres** : Alice peut ajouter un souhait directement dans la liste de Bob. Ce souhait a un champ `addedBy: "Alice"`.
- **Badge "Ajouté par"** : les souhaits ajoutés par un autre membre du groupe affichent un badge violet précisant qui l'a ajouté.
- **Suppression** : tout membre du groupe peut supprimer les souhaits de tout autre membre.
- **Pas de groupe** : si un utilisateur n'est dans aucun groupe, l'interface fonctionne normalement (vue classique).

### Routes API pour les groupes

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/groups` | Retourne tous les groupes définis. |
| `GET` | `/api/users/:username/group` | Retourne le groupe de l'utilisateur (ou `null` s'il n'y en a pas). |

### Structure d'un souhait avec `addedBy`

```json
{
  "id": "1234567890",
  "name": "Un vélo",
  "reservedBy": null,
  "addedBy": "Alice"
}
```

Le champ `addedBy` est optionnel. Il n'est renseigné que si un membre du groupe a ajouté le souhait pour quelqu'un d'autre.

---

## Vues du frontend (index.html / app.js)

| Vue | ID DOM | Description |
|-----|--------|-------------|
| Login | `#login-view` | Écran d'accueil, saisie du pseudo |
| Dashboard | `#dashboard-view` | Vue principale après connexion |
| Ma liste | `#my-list-area` | Gestion de ses propres souhaits |
| Liste d'un autre | `#other-list-area` | Consultation et réservation |
| Annuaire | `#all-users-area` | Liste de tous les membres |
| Mes réservations | `#my-reservations-area` | Cadeaux réservés par l'utilisateur courant |

---

## Commandes

```powershell
# Installer les dépendances
npm install

# Démarrer le serveur (port 3000 par défaut)
npm start
# ou
node server.js
```

Le port peut être surchargé via la variable d'environnement `PORT`.

---

## Conventions et règles de développement

- **Langue** : code et commentaires en français, tous les documents Markdown en français.
- **Style PowerShell** : ne jamais utiliser `&&` pour chaîner des commandes, utiliser `;` à la place.
- **Pas de framework frontend** : le projet utilise du JavaScript vanilla, ne pas introduire React, Vue ou autre.
- **Pas de base de données externe** : la persistance repose uniquement sur `database.json`. Ne pas introduire SQLite, MongoDB, etc., sans décision explicite.
- **`database.json` ne doit pas être commité** : ce fichier contient les données utilisateurs. Il est (ou doit être) dans `.gitignore`.
- **Recherches de code** : toujours exclure `node_modules` des recherches (utiliser `exclude_pattern` ou `include_pattern`).
- **Décisions architecturales** : quand plusieurs options sont possibles, ne pas décider seul — exposer le problème, les solutions et la recommandation à l'utilisateur.
- **Sous-agents** : utiliser des sous-agents Gemini CLI dès que possible pour les tâches déléguables.
- **Tests** : aucun framework de test n'est configuré pour l'instant (`npm test` retourne une erreur). Toute addition de tests doit être discutée avant implémentation.
