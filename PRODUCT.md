# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Particuliers à Douala, surtout des femmes et des jeunes adultes, qui achètent depuis leur téléphone. Ils parcourent le catalogue, puis commandent sur WhatsApp ou paient en Mobile Money via Fapshi.

Audience secondaire : l'équipe de la boutique, qui gère produits, commandes, annonces et versements dans l'application `superadmin/`.

## Product Purpose

Espace Shopping Plus est la boutique en ligne d'un magasin physique de Douala (Marché Cité des Palmiers, en face de l'immeuble Express Exchange). Le site doit amener les clients à trouver un article et à le commander facilement, que ce soit sur WhatsApp ou en payant directement en ligne.

## Positioning

Une seule boutique pour la mode, la beauté et les cheveux : vêtements femmes, hommes et enfants, chaussures, sacs, accessoires, perruques et produits capillaires. Elle est adossée à un vrai magasin à Douala et à un contact direct sur WhatsApp.

## Operating Context

- Achat surtout sur mobile, souvent avec une connexion lente ou limitée.
- La commande passe par WhatsApp (panier envoyé en message) ou par le checkout hébergé Fapshi en XAF.
- Livraison par zones dans Douala (`DeliveryZone`), avec la possibilité de venir au magasin.
- Comptes clients via Better Auth (`/compte`, `/connexion`, `/inscription`).

## Capabilities and Constraints

- Trois applications : `frontend/` (boutique Next.js), `backend/` (API ASP.NET Core pour le catalogue et les commandes) et `superadmin/` (administration Next.js).
- Le français est la langue principale ; l'anglais est secondaire (sélecteur de langue existant).
- Les pages doivent rester légères et rapides sur mobile et sur réseau lent.
- Les versements vendeurs sont en simulation seulement : aucun transfert d'argent réel n'est en place.

## Brand Commitments

- Le nom « Espace Shopping Plus » et le logo actuel (`frontend/public/espace-shopping-plus/logo-principal.png`, variante `logo-alternatif.png`) ne doivent pas changer.

## Evidence on Hand

- Photos de catégories, de produits et de hero dans `frontend/public/espace-shopping-plus/`.
- Les avis clients sont de vrais commentaires laissés par les visiteurs et chargés depuis `/api/comments`.
- Il n'existe aucun témoignage, client, chiffre de vente ou presse vérifié en dehors de ces données. Il ne faut jamais en inventer.

## Product Principles

1. La commande d'abord : chaque page doit rapprocher le client d'une commande sur WhatsApp ou d'un paiement.
2. Mobile et réseau lent avant tout : le poids des pages et la lisibilité sur petit écran priment sur l'effet visuel.
3. Tout-en-un mais facile à parcourir : mode, beauté et cheveux restent faciles à distinguer.
4. Uniquement du vrai : seuls des produits, avis et informations réels sont affichés.

## Accessibility & Inclusion

Le français est la langue par défaut et les textes doivent rester simples. Les boutons et liens doivent être assez grands pour être touchés au doigt sur téléphone.
