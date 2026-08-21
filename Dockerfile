# Image Node.js LTS slim
FROM node:24-slim

# Répertoire de travail dans le conteneur
WORKDIR /app

# Copier les fichiers de dépendances en premier (cache Docker)
COPY package.json package-lock.json ./

# Installer uniquement les dépendances de production
RUN npm ci --omit=dev

# Copier le reste du code source
COPY . .

# Exposer le port (Cloud Run injecte PORT automatiquement)
EXPOSE 8080

# Démarrer le serveur
CMD ["node", "server.js"]
