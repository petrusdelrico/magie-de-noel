#!/bin/bash

# Script de déploiement Cloud Run — Magie de Noël
# Usage : chmod +x deploy.sh && ./deploy.sh

# Couleurs pour le terminal
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
GRAY='\033[0;90m'
NC='\033[0m' # Pas de couleur (Reset)

PROJECT_ID="magiedenoel"
REGION="europe-west1"
SERVICE="magie-de-noel"
IMAGE="europe-west1-docker.pkg.dev/$PROJECT_ID/magie-de-noel/$SERVICE"

echo -e "${CYAN}=== Déploiement Magie de Noël sur Cloud Run ===${NC}"

# 1. Configurer le projet gcloud
echo -e "\n${YELLOW}[1/5] Configuration du projet gcloud...${NC}"
gcloud config set project "$PROJECT_ID"

# 2. Activer les APIs nécessaires
echo -e "\n${YELLOW}[2/5] Activation des APIs Cloud Run et Artifact Registry...${NC}"
gcloud services enable run.googleapis.com artifactregistry.googleapis.com

# 3. Créer le dépôt Artifact Registry (si inexistant)
echo -e "\n${YELLOW}[3/5] Création du dépôt Artifact Registry...${NC}"
if gcloud artifacts repositories create magie-de-noel \
    --repository-format=docker \
    --location="$REGION" \
    --description="Images Docker Magie de Noel" \
    --quiet 2>/dev/null; then
    echo "  (dépôt créé avec succès)"
else
    echo -e "${GRAY}  (dépôt déjà existant ou erreur ignorée, on continue)${NC}"
fi

# 4. Authentifier Docker auprès de Google
echo -e "\n${YELLOW}[4/5] Authentification Docker...${NC}"
gcloud auth configure-docker "$REGION-docker.pkg.dev" --quiet

# 5. Build et push de l'image
echo -e "\n${YELLOW}[5/5] Build et push de l'image Docker...${NC}"
docker build -t "$IMAGE" .
docker push "$IMAGE"

# 6. Déployer sur Cloud Run
echo -e "\n${YELLOW}[6/6] Déploiement sur Cloud Run...${NC}"
gcloud run deploy "$SERVICE" \
    --image="$IMAGE" \
    --region="$REGION" \
    --platform=managed \
    --allow-unauthenticated \
    --port=8080 \
    --set-secrets="FIRESTORE_PROJECT_ID=FIRESTORE_PROJECT_ID:latest" \
    --service-account="magie-de-noel-server@$PROJECT_ID.iam.gserviceaccount.com"

echo -e "\n${GREEN}=== Déploiement terminé ===${NC}"
echo "URL du service :"
gcloud run services describe "$SERVICE" --region="$REGION" --format="value(status.url)"
