# Déploiement Railway

Le dépôt se déploie comme trois services applicatifs indépendants et un service PostgreSQL.

## Services

Créez un projet Railway, ajoutez un service PostgreSQL, puis ajoutez trois services depuis le dépôt GitHub `vessah14/shopping`, branche `master` :

| Service | Root Directory | Dockerfile |
| --- | --- | --- |
| `frontend` | `/frontend` | détecté automatiquement |
| `backend` | `/backend` | détecté automatiquement |
| `superadmin` | `/superadmin` | détecté automatiquement |

Générez un domaine public HTTPS pour `frontend` et `superadmin`. Le backend peut rester privé, mais il lui faut un domaine public si Fapshi doit appeler son webhook. Ajoutez un volume persistant au service `frontend`, monté sur `/app/public/uploads`.

## Variables

Dans les valeurs ci-dessous, remplacez `Postgres` par le nom exact du service PostgreSQL et remplacez les domaines par ceux créés dans Railway.

`frontend` :

| Variable | Valeur |
| --- | --- |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `BETTER_AUTH_SECRET` | Secret aléatoire d’au moins 32 caractères |
| `BETTER_AUTH_URL` | `https://<domaine-frontend>` |
| `SUPERADMIN_URL` | `https://<domaine-superadmin>` |
| `SUPERADMIN_EMAIL` | Adresse du compte administrateur |
| `NEXT_PUBLIC_FRONTEND_URL` | `https://<domaine-frontend>` |
| `STORE_API_URL` | `http://${{backend.RAILWAY_PRIVATE_DOMAIN}}:${{backend.PORT}}` |
| `STORE_API_KEY` | Même valeur que `StoreApi__Key` du backend |
| `UPLOADS_API_KEY` | Secret aléatoire d’au moins 32 caractères, identique dans `superadmin` |

`superadmin` :

| Variable | Valeur |
| --- | --- |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `BETTER_AUTH_SECRET` | La même valeur que dans `frontend` |
| `BETTER_AUTH_URL` | `https://<domaine-superadmin>` |
| `SUPERADMIN_URL` | `https://<domaine-superadmin>` |
| `SUPERADMIN_EMAIL` | La même adresse que dans `frontend` |
| `FRONTEND_URL` | `https://<domaine-frontend>` |
| `UPLOADS_API_KEY` | La même valeur que dans `frontend` |
| `NEXT_PUBLIC_FRONTEND_URL` | `https://<domaine-frontend>` |

`backend` :

| Variable | Valeur |
| --- | --- |
| `ConnectionStrings__Store` | `Host=${{Postgres.PGHOST}};Port=${{Postgres.PGPORT}};Database=${{Postgres.PGDATABASE}};Username=${{Postgres.PGUSER}};Password=${{Postgres.PGPASSWORD}}` |
| `StoreApi__Key` | Même valeur que `STORE_API_KEY` du frontend |
| `ForwardedHeaders__Enabled` | `true` |
| `Fapshi__ApiUser` | `apiuser` Fapshi, si les paiements sont activés |
| `Fapshi__ApiKey` | `apikey` Fapshi, si les paiements sont activés |
| `Fapshi__WebhookSecret` | Secret du webhook défini dans le tableau de bord Fapshi |
| `Fapshi__BaseUrl` | Optionnel, `https://live.fapshi.com` par défaut (`https://sandbox.fapshi.com` pour les tests) |
| `Fapshi__ReturnBaseUrl` | `https://<domaine-frontend>` (le chemin `/paiement/retour` est ajouté automatiquement) |
| `Fapshi__PendingOrderTimeoutMinutes` | Optionnel, `120` par défaut : délai avant de libérer le stock d’une commande non payée |
| `Fapshi__Payout__Enabled` | `false` par défaut. Ne passer à `true` qu’après les tests sandbox et l’activation Live des décaissements par Fapshi |
| `Fapshi__Payout__BaseUrl` | `https://sandbox.fapshi.com` pour les tests; `https://live.fapshi.com` uniquement après activation Live |
| `Fapshi__Payout__ApiUser` | API User du service **Disbursement**, distinct de celui de l’encaissement |
| `Fapshi__Payout__ApiKey` | API Key du service **Disbursement**, distincte de celle de l’encaissement |
| `Fapshi__Payout__PhoneNumber` | Numéro Orange Money du propriétaire au format accepté par Fapshi |
| `Fapshi__Payout__RecipientName` | Optionnel, nom du bénéficiaire |
| `Fapshi__Payout__WebhookSecret` | Secret du webhook configuré sur le service **Disbursement** |

Définissez `BETTER_AUTH_SECRET`, `StoreApi__Key`, `UPLOADS_API_KEY` et les clés Fapshi comme secrets Railway, pas dans Git. Les variables `NEXT_PUBLIC_FRONTEND_URL` doivent être présentes avant le build; si les domaines Railway ne sont connus qu’après le premier déploiement, mettez-les à jour puis redéployez les deux services Next.js.

Quand `ForwardedHeaders__Enabled=true`, le backend ne redirige pas lui-même vers HTTPS : Railway termine TLS à l’entrée et les appels frontend-vers-backend utilisent HTTP sur le réseau privé Railway.

## Initialisation

Après le premier déploiement, exécutez une fois `npm run db:migrate` dans le contexte du service `frontend`. Créez ensuite le compte avec l’adresse `SUPERADMIN_EMAIL`, puis exécutez `npm run db:promote-superadmin` pour lui attribuer le rôle superadmin.

Pour Fapshi, configurez sur le service d’encaissement le webhook `https://<domaine-backend>/api/webhooks/fapshi` et son secret (identique à `Fapshi__WebhookSecret`). Le service Disbursement doit utiliser séparément `https://<domaine-backend>/api/webhooks/fapshi/payout` et son propre secret. Les clés des deux services ne doivent pas être interchangées.

Les décaissements sont désactivés par défaut. Fapshi ne déduplique pas les requêtes de payout : si l’issue d’un appel est incertaine, le système bloque une nouvelle tentative automatique et place le versement en vérification manuelle pour éviter un double paiement. Le service Disbursement doit être alimenté séparément et Live doit être activé par Fapshi avant toute utilisation en production.

Pour tout changement de schéma, exécutez `npm run db:migrate` dans le contexte du service `frontend` avant de déployer les services qui utilisent les nouvelles colonnes ou tables. La colonne `product_type` attribue par défaut « Pièce unique » aux produits existants.

Le volume conserve les images téléversées et les images initiales présentes dans `frontend/public/uploads`. Les fichiers `.env` ne doivent pas être importés comme variables Railway; configurez les valeurs réelles dans l’onglet Variables de chaque service.