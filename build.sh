#!/bin/bash
set -e

echo "Building for branch: $CF_PAGES_BRANCH"

# `main` est la seule branche de production (voir CLAUDE.md). Cloudflare
# Pages construit TOUTE autre branche en Preview (préférence de projet
# "preview_branch_includes: *"), y compris chaque branche de PR — et
# l'environnement Preview du dashboard n'a AUCUNE variable configurée
# (vérifié via l'API Cloudflare). Sans repli ici, `nuxt.config.ts` fait
# échouer le build de toute PR au démarrage : "Missing
# NUXT_PUBLIC_FIREBASE_API_KEY". Le repli visait uniquement `recette`
# jusqu'ici ; il s'applique maintenant à toute branche non-production, pour
# qu'ouvrir une PR ne casse plus son propre build Preview.
if [ "$CF_PAGES_BRANCH" != "main" ]; then
  echo "→ Applying recette (preview) environment"
  export NUXT_PUBLIC_FIREBASE_API_KEY="AIzaSyDMDdQ-Dfg-ScO5xCKytl52iHCnO4Qcu7Y"
  export NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN="eglise-cieux-ouverts-rec.firebaseapp.com"
  export NUXT_PUBLIC_FIREBASE_PROJECT_ID="eglise-cieux-ouverts-rec"
  export NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET="eglise-cieux-ouverts-rec.firebasestorage.app"
  export NUXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="32860980186"
  export NUXT_PUBLIC_FIREBASE_APP_ID="1:32860980186:web:ba5609bfd7a3e8484136e3"
  export NUXT_FIREBASE_PROJECT_ID="${NUXT_FIREBASE_PROJECT_ID:-eglise-cieux-ouverts-rec}"
  export NUXT_FIREBASE_CLIENT_EMAIL="${NUXT_FIREBASE_CLIENT_EMAIL:-firebase-adminsdk-fbsvc@eglise-cieux-ouverts-rec.iam.gserviceaccount.com}"
  # Lire depuis les variables d'environnement Cloudflare Pages (set dans le dashboard)
  # Si non défini, utiliser une valeur factice qui échouera gracieusement à l'exécution
  export NUXT_FIREBASE_PRIVATE_KEY="${NUXT_FIREBASE_PRIVATE_KEY:-dummy-key-set-in-cloudflare-dashboard}"
fi

# Installation STRICTE depuis package-lock.json (npm ci), comme la CI GitHub.
# Avant, ce script supprimait le lockfile pour forcer une résolution fraîche
# (le lockfile, généré sur macOS, ne contenait alors que les bindings natifs
# darwin). Il contient aujourd'hui les variantes linux-x64 (rollup, esbuild,
# oxc, lightningcss…), et la résolution fraîche s'est retournée contre nous :
# chaque build prenait les dernières versions publiées, et le 16/10/2026 une
# nouvelle version de dépendance a fait planter `npm install` lui-même
# (« Cannot read properties of null (reading 'edgesOut') ») — tous les
# déploiements Cloudflare échouaient, sans aucun changement de code.
# Si un binding de plateforme venait à manquer, régénérer le lockfile
# (npm install) et le commiter, plutôt que de revenir à une résolution libre.
rm -rf node_modules
npm ci --no-audit --no-fund
npm run build
