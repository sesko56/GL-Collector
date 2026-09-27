# GL Collector

Application de cartes de collection **GL Collector** avec marché d'enchères en temps réel, système d'ouverture de boosters, inventaire persistant et raretés annuelles.

## Lancement Local

1. Installer les dépendances :
   `npm install`
2. Lancer l'application :
   `npm run dev`

## Déploiement Vercel

Les routes `/api/*` sont exposées par `api/[...path].ts` et le front est servi depuis `dist`.
Après avoir poussé ces fichiers, redéployez le projet Vercel (sans modifier la commande de build).

> Important : le stockage actuel utilise `server/data/runtime-db.json`, qui n'est pas persistant sur Vercel. Pour un service public, configurez une base PostgreSQL et migrez le stockage avant d'ouvrir les inscriptions.
