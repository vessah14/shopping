# Déploiement Railway

Le dépôt se déploie comme trois services applicatifs indépendants et un service PostgreSQL.

## Services

Créez un projet Railway, ajoutez un service PostgreSQL, puis ajoutez trois services depuis le dépôt GitHub `vessah14/shopping`, branche `master` :

| Service | Root Directory | Dockerfile |
| --- | --- | --- |
| `frontend` | `/frontend` | détecté automatiquement |
| `backend` | `/backend` | détecté automatiquement |
| `superadmin` | `/superadmin` | détecté automatiquement |

Générez un domaine public HTTPS pour `frontend` et `superadmin`. Le backend peut rester privé, mais il lui faut un domaine public si SasPay doit appeler son webhook. Ajoutez un volume persistant au service `frontend`, monté sur `/app/public/uploads`.

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

`superadmin` :

| Variable | Valeur |
| --- | --- |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `BETTER_AUTH_SECRET` | La même valeur que dans `frontend` |
| `BETTER_AUTH_URL` | `https://<domaine-superadmin>` |
| `SUPERADMIN_URL` | `https://<domaine-superadmin>` |
| `SUPERADMIN_EMAIL` | La même adresse que dans `frontend` |
| `FRONTEND_URL` | `https://<domaine-frontend>` |
| `NEXT_PUBLIC_FRONTEND_URL` | `https://<domaine-frontend>` |

`backend` :

| Variable | Valeur |
| --- | --- |
| `ConnectionStrings__Store` | `Host=${{Postgres.PGHOST}};Port=${{Postgres.PGPORT}};Database=${{Postgres.PGDATABASE}};Username=${{Postgres.PGUSER}};Password=${{Postgres.PGPASSWORD}}` |
| `StoreApi__Key` | Même valeur que `STORE_API_KEY` du frontend |
| `ForwardedHeaders__Enabled` | `true` |
| `SasPay__ApiKey` | Clé SasPay, si les paiements sont activés |
| `SasPay__WebhookSecret` | Secret du webhook SasPay, si les paiements sont activés |
| `SasPay__ReturnBaseUrl` | `https://<domaine-frontend>/paiement/retour` |

Définissez `BETTER_AUTH_SECRET` et `StoreApi__Key` comme secrets Railway, pas dans Git. Les variables `NEXT_PUBLIC_FRONTEND_URL` doivent être présentes avant le build; si les domaines Railway ne sont connus qu’après le premier déploiement, mettez-les à jour puis redéployez les deux services Next.js.

Quand `ForwardedHeaders__Enabled=true`, le backend ne redirige pas lui-même vers HTTPS : Railway termine TLS à l’entrée et les appels frontend-vers-backend utilisent HTTP sur le réseau privé Railway.

## Initialisation

Après le premier déploiement, exécutez une fois `npm run db:migrate` dans le contexte du service `frontend`. Créez ensuite le compte avec l’adresse `SUPERADMIN_EMAIL`, puis exécutez `npm run db:promote-superadmin` pour lui attribuer le rôle superadmin.

Pour SasPay, configurez le webhook `https://<domaine-backend>/api/webhooks/saspay` et les événements `transaction.success`, `transaction.failed` et `transaction.cancelled`.

Le volume conserve les images téléversées et les images initiales présentes dans `frontend/public/uploads`. Les fichiers `.env` ne doivent pas être importés comme variables Railway; configurez les valeurs réelles dans l’onglet Variables de chaque service.