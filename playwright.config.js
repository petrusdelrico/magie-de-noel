// @ts-check
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
    // Dossier contenant les fichiers de tests
    testDir: './tests',

    // Timeout par test
    timeout: 15000,

    // Pas de retry (environnement local)
    retries: 0,

    // Rapport lisible dans le terminal
    reporter: 'list',

    use: {
        // URL de base de l'application
        baseURL: 'http://localhost:3000',

        // Autoriser les téléchargements (nécessaire pour le test d'export)
        acceptDownloads: true,

        // Capture d'écran uniquement en cas d'échec
        screenshot: 'only-on-failure',

        // Trace uniquement en cas d'échec
        trace: 'on-first-retry',
    },

    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
});
