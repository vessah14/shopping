This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Authentification locale

L’espace client utilise Better Auth avec une base PostgreSQL locale. La création de compte, la connexion, la session sécurisée et la déconnexion sont disponibles par e-mail et mot de passe.

1. Créez une base PostgreSQL nommée `espace_shopping_plus` dans votre installation locale.
2. Copiez `.env.example` vers `.env`, puis remplacez `YOUR_POSTGRES_PASSWORD` par le mot de passe PostgreSQL local.
3. Générez un secret privé avec `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` et utilisez-le comme `BETTER_AUTH_SECRET`.
4. Appliquez le schéma d’authentification et de boutique avec `npm run db:migrate`.
5. Inscrivez-vous sur `/inscription` avec l’adresse `SUPERADMIN_EMAIL` que vous avez configurée.
6. Dans un terminal local, exécutez `npm run db:promote-superadmin` pour accorder le rôle superadmin au compte créé.
7. Démarrez la boutique avec `npm run dev`. Dans un deuxième terminal, allez dans `../superadmin`, copiez `.env.example` vers `.env`, installez les dépendances avec `npm install`, puis lancez `npm run dev`. Ouvrez ensuite `http://localhost:3001` et connectez-vous sur l’écran dédié à l’administration avec le compte superadmin.

## API .NET du catalogue

La connexion, l’inscription et la validation des sessions restent gérées par Better Auth dans l’API Next.js. Le catalogue et les commandes client sont servis par le backend .NET, qui lit et met à jour les mêmes tables PostgreSQL. Les appels de commande passent par Next.js, qui transmet l’identité Better Auth au backend avec une clé partagée gardée côté serveur.

1. Configurez `ConnectionStrings__Store` pour le backend .NET, par exemple `Host=localhost;Port=5432;Database=espace_shopping_plus;Username=postgres;Password=VOTRE_MOT_DE_PASSE`.
2. Créez une clé privée aléatoire d’au moins 32 caractères. Configurez la même valeur dans `StoreApi__Key` pour le backend et `STORE_API_KEY` dans le `.env` du frontend, avec `STORE_API_URL=http://localhost:5277`.
3. Depuis la racine du projet, démarrez le backend avec `dotnet run --project backend --launch-profile http`, puis lancez le frontend avec `npm run dev` depuis `frontend`.

Le backend expose `GET /api/store/products` pour le catalogue, `GET /api/store/products/{slug}` pour une fiche produit, ainsi que `GET` et `POST /api/store/orders` pour l’historique et la création de commandes. Le code est organisé dans `backend/Controllers`, `backend/DTOs`, `backend/Interfaces` et `backend/Services`. Les routes de commandes du navigateur restent sur Next.js (`/api/orders`) : le secret interne de l’API n’est jamais envoyé au navigateur. Les commandes vérifient le stock et le décrémentent dans une transaction PostgreSQL. Sans `STORE_API_URL`, le catalogue lit PostgreSQL directement. Il n’existe pas de catalogue de produits de secours codé en dur : si ni l’API ni `DATABASE_URL` ne sont configurés, le chargement du catalogue échoue au lieu d’afficher des articles qui ne viennent pas de la base. La création et la consultation des commandes nécessitent le backend .NET.

Le panneau d’administration, ses contrôles d’accès et ses opérations de gestion sont dans l’application indépendante `../superadmin`. Le rôle superadmin se règle uniquement depuis la machine qui héberge la base.

Elle utilise les mêmes variables `DATABASE_URL`, `BETTER_AUTH_SECRET` et `SUPERADMIN_EMAIL`; en local, configurez aussi `SUPERADMIN_URL=http://localhost:3001` dans les deux applications. Elle écoute sur `http://localhost:3001` et la route `/superadmin` de la boutique redirige vers cette application.

Les produits importés commencent avec un stock à zéro et sont marqués indisponibles : renseignez les quantités réelles avant de les publier comme disponibles. Les commandes exigent un compte client; l’inventaire est vérifié puis décrémenté dans une transaction PostgreSQL. Une annulation approuvée par un administrateur restitue le stock. Les paiements Mobile Money sont enregistrés comme en attente jusqu’à leur confirmation manuelle.

### Paiement SasPay

Le checkout hébergé SasPay est disponible pour les commandes au Cameroun (XAF). Configurez le backend .NET avec `SasPay__ApiKey`, `SasPay__WebhookSecret` et `SasPay__ReturnBaseUrl` (par exemple `http://localhost:3000` en développement). Utilisez une clé `sk_test_...` pour les essais, puis une clé `sk_live_...` en production; ne placez jamais ces secrets dans le frontend.

Le suivi des versements vendeurs est actuellement une simulation : configurez le nom et le numéro Mobile Money dans la fiche produit du superadmin, puis consultez **Versements vendeurs** après une commande payée et confirmée. Aucun transfert au vendeur n’est déclenché. Exécutez `npm run db:migrate` pour ajouter les colonnes vendeur et la table de suivi à une base existante.

Après configuration, relancez `npm run db:migrate` pour ajouter les champs de session SasPay et autoriser ce moyen de paiement. Dans le tableau de bord SasPay, configurez l’URL publique `https://<hôte-backend>/api/webhooks/saspay`, copiez son secret de signature dans `SasPay__WebhookSecret`, et abonnez le webhook à `transaction.success`, `transaction.failed` et `transaction.cancelled`. Le backend vérifie la signature horodatée puis revérifie l’état, le montant et la devise via l’API SasPay avant de mettre à jour la commande. Le retour navigateur ne confirme jamais un paiement à lui seul.

### Annonces de la boutique
Dans le superadmin, ouvrez **Annonces** pour consulter le tableau, créer une annonce, modifier ses dates ou son texte, la désactiver ou la supprimer. Toutes les annonces actives défilent dans le bandeau de la boutique. Les annonces déjà enregistrées sont reprises lors de la migration.
Après cette mise à jour, exécutez `npm run db:migrate` depuis `frontend` pour créer la table des annonces et migrer la configuration existante.
Dans le superadmin, ouvrez **Annonces** pour modifier le bandeau, choisir ses dates de début et de fin, puis le publier ou le désactiver. Le visiteur peut fermer le bandeau pour sa session; une annonce modifiée s’affiche de nouveau. Après la mise à jour, exécutez `npm run db:migrate` depuis `frontend` pour créer la configuration des annonces.

La section commentaires de l’accueil est publique : chacun peut publier un nom et un message, conservés dans PostgreSQL. Après l’ajout de cette fonctionnalité, relancez `npm run db:migrate` pour créer la table des commentaires dans une base existante.

### Galerie photos des produits

Dans **Produits & stock** du superadmin, ajoutez jusqu’à 10 images JPG, PNG ou WebP à un produit. La première image est utilisée dans les cartes de la boutique; les autres apparaissent dans la fiche produit après avoir ouvert **Détail**. Vous pouvez retirer des images; la première restante devient la photo principale. Après la mise à jour, exécutez `npm run db:migrate` depuis `frontend` pour ajouter la colonne des images à une base existante.

La vérification de l’adresse e-mail et la réinitialisation du mot de passe nécessitent un service d’envoi d’e-mails et ne sont pas activées. Configurez ces fonctions et une base PostgreSQL hébergée avant de publier le site en production; ne déployez pas les identifiants de votre base locale.
