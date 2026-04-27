# Positionnement Actuel Du Projet

## Décision Produit

ClickWars n'est plus priorisé comme un jeu Qt/QML destiné à des utilisateurs finaux.

Le projet est désormais un laboratoire de stress test pour serveurs WebSocket temps réel. Le gameplay de clics reste utile uniquement parce qu'il produit une charge applicative crédible : connexions, actions fréquentes, broadcasts, sessions, reconnexions, persistance et cohérence multi-instance.

## Livrable Principal

Le livrable principal est dans `server/` :

- serveur WebSocket multi-instance ;
- sessions isolées par `sessionId` ;
- persistance Redis ;
- endpoints `/healthz`, `/readyz`, `/metrics` ;
- harnais `extreme-stress-test.js` ;
- tests de routing/failure recovery ;
- rapports JSON exploitables par DevOps.

## Ce Qui Est Secondaire

Le client Qt/QML reste dans le repo pour démonstration visuelle et contexte historique.

Il n'est pas requis pour :

- lancer une campagne de stress ;
- valider la cohérence multi-instance ;
- prouver la récupération de session ;
- produire les métriques DevOps ;
- générer les rapports JSON.

Un échec de build Qt local ne bloque donc pas les objectifs actuels du projet.

## Documentation Legacy

Les documents suivants décrivent encore la vision initiale “party game local” :

- `docs/prd.md`
- `docs/design/game-brief.md`
- `docs/architecture/game-architecture.md`
- `docs/stories/*`

Ils sont conservés pour contexte, mais ne sont plus la source principale de vérité produit.

Pour le travail actuel, utiliser en priorité :

- `README.md`
- `server/README.md`
- `docs/STRESS_TEST_RUNBOOK.md`
- les rapports JSON générés par les tests
- les métriques `/metrics`

## Critère De Réussite Actuel

Le projet réussit s'il permet à DevOps de répondre factuellement à ces questions :

- combien de clients concurrents le serveur supporte ;
- à quel point de charge il se dégrade ;
- si les sessions restent cohérentes entre instances ;
- si une session survit à la perte d'une instance ;
- si les reconnexions conservent joueur, équipe et score ;
- si les erreurs sous surcharge sont explicites et mesurées.
