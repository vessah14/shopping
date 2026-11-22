# Espace Shopping Plus

Le projet est organisé en trois applications :

- `backend/` : API catalogue et commandes en ASP.NET Core.
- `frontend/` : boutique Next.js, comptes client et authentification Better Auth.
- `superadmin/` : application Next.js indépendante pour la gestion de la boutique.

## Démarrage local

Configurez d’abord PostgreSQL et le fichier `frontend/.env` comme expliqué dans [la documentation frontend](./frontend/README.md), puis ajoutez-y `SUPERADMIN_URL=http://localhost:3001`. Copiez `superadmin/.env.example` vers `superadmin/.env`, renseignez les mêmes valeurs `DATABASE_URL`, `BETTER_AUTH_SECRET` et `SUPERADMIN_EMAIL` que dans le frontend, puis gardez `BETTER_AUTH_URL=http://localhost:3000`, `FRONTEND_URL=http://localhost:3000` et `SUPERADMIN_URL=http://localhost:3001` pour le développement local.

Lancez les trois applications dans des terminaux séparés :

```powershell
# Terminal 1 — backend .NET
dotnet run --project backend --launch-profile http

# Terminal 2 — boutique
Set-Location frontend
npm run dev

# Terminal 3 — administration
Set-Location superadmin
npm install
npm run dev
```

La boutique est disponible sur `http://localhost:3000` et l’administration sur `http://localhost:3001`. La route `/superadmin` de la boutique redirige vers l’application d’administration, qui dispose de son propre écran de connexion. Utilisez le compte superadmin configuré ; Better Auth et PostgreSQL partagés permettent à l’application d’administration de vérifier la session et le rôle.

Pour le déploiement, configurez les variables d’environnement de chaque application et déployez-les derrière des domaines/origines compatibles avec le partage des cookies Better Auth. Ne publiez jamais les fichiers `.env` ni les clés privées.

Les étapes de déploiement sur Railway sont décrites dans [RAILWAY.md](./RAILWAY.md).

Pour les paiements Fapshi, configurez côté backend `Fapshi__ApiUser`, `Fapshi__ApiKey`, `Fapshi__WebhookSecret` et `Fapshi__ReturnBaseUrl`. L’application utilise la page de paiement hébergée Fapshi (MTN Mobile Money et Orange Money, XAF); appliquez également `npm run db:migrate` dans `frontend` et configurez dans le tableau de bord Fapshi le webhook `https://<hôte-backend>/api/webhooks/fapshi` avec son secret. Les détails sont dans [la documentation Fapshi du frontend](./frontend/README.md#paiement-fapshi).

Les champs vendeur et la section **Versements vendeurs** du superadmin préparent un suivi en simulation. Après confirmation du webhook Fapshi, la boutique calcule le montant associé aux produits ayant un numéro Mobile Money configuré. Cette fonction n’envoie aucun argent. L’intégration Fapshi présente ici n’utilise pas l’API de versement (payout); confirmez avec Fapshi le prestataire de versement, les pays et les comptes bénéficiaires autorisés avant toute mise en production de transferts.
