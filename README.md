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

Ajoutez la variable `DATABASE_URL` fournie par Neon dans Vercel (Production, Preview et Development). Au premier démarrage, l'application crée la table `gl_collector_state` et importe automatiquement l'état local ; les comptes et la progression sont ensuite persistés dans Neon.
