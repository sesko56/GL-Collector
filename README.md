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

Le catalogue (~7959 cartes) est **embarqué** dans l’application (`server/data/wikiFullCatalog.json`). Neon ne stocke que les comptes, collections, boosters, enchères et la config.

1. Dans Vercel, liez le store **Neon** au projet (Storage → Connect) ou collez `DATABASE_URL` dans Settings → Environment Variables, pour **Production**, **Preview** et **Development**.
2. L’URL doit ressembler à `postgresql://...@....neon.tech/neondb?sslmode=require`.
3. Redéployez, puis ouvrez le site une fois : la table `gl_collector_state` est créée (progression uniquement).

Pour copier vos comptes / collections locales vers Neon :

```
# Dans .env local, mettez l’URL Neon de Vercel, puis :
npm run seed:neon
```
