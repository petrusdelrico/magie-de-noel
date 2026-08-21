# Tests Playwright — Magie de Noël

## Prérequis

- Node.js installé
- Le serveur de l'application démarré sur `http://localhost:3000`

## Installation

```powershell
cd C:\Dev\magie-de-noel-main
npm install
npx playwright install chromium
```

## Lancer les tests

```powershell
# Mode silencieux (terminal)
npm test

# Mode navigateur visible (utile pour déboguer)
npm run test:headed

# Mode UI interactif Playwright
npm run test:ui

# Afficher le rapport HTML du dernier run
npm run test:report
```

## Structure des tests

```
tests/
├── helpers.js                  # Fonctions utilitaires partagées
└── connexion-et-ajout.spec.js  # Fichier de tests principal
```

## Suites de tests

### 1. Connexion (4 tests)
- Affichage du formulaire au démarrage
- Connexion avec un pseudo valide
- Normalisation du pseudo (1ère lettre en majuscule)
- Déconnexion

### 2. Ajout de souhaits (4 tests)
- Ajout d'un souhait simple
- Ajout avec URL et commentaire
- Vidage des champs après ajout
- Ajout de plusieurs souhaits

### 3. Groupes familiaux — Groupe Test Alpha (4 tests)
- Affichage du group-switcher
- Nombre de boutons par membre
- Basculement vers la liste d'un autre membre
- Ajout d'un souhait pour un autre membre

### 4. Groupes familiaux — Groupe Test Beta (3 tests)
- Affichage du group-switcher
- Nombre de boutons
- Basculement de liste

## Utilisateurs de test

Les tests utilisent des pseudos dédiés qui n'entrent pas en conflit avec les utilisateurs réels :

| Pseudo | Groupe |
|--------|--------|
| `Testalpha1` | Groupe Test Alpha |
| `Testalpha2` | Groupe Test Alpha |
| `Testbeta1`  | Groupe Test Beta  |
| `Testbeta2`  | Groupe Test Beta  |

Ces groupes sont définis dans `groups.json` à la racine du projet.

## Nettoyage automatique

Après chaque test, les utilisateurs de test sont supprimés via l'API `DELETE /api/users/:username`.
Cela garantit que les tests sont indépendants et ne s'accumulent pas dans `database.json`.
