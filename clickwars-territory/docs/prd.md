# ClickWars: Territory - Product Requirements Document (PRD)

**Document Version:** 1.0  
**Date:** 2026-01-22  
**Status:** Draft  
**Author:** John - Product Manager (B-MAD)

---

## 1. Goals and Background Context

### 1.1 Goals

- **G1:** Livrer un jeu multijoueur local (LAN) fonctionnel permettant à 4 joueurs de s'affronter en équipes (2v2)
- **G2:** Créer une expérience de jeu simple mais addictive basée sur le clic compétitif
- **G3:** Implémenter un système réseau robuste avec synchronisation précise des jauges entre tous les clients
- **G4:** Offrir un feedback visuel satisfaisant (particules, animations) pour chaque action du joueur
- **G5:** Permettre le jeu contre des bots IA quand moins de 4 joueurs humains sont disponibles
- **G6:** Assurer la qualité via tests unitaires et tests d'intégration réseau
- **G7:** Maintenir la compatibilité cross-platform (Windows, macOS, Linux) via Qt/Felgo standard

### 1.2 Background Context

**ClickWars: Territory** est un party game multijoueur où deux équipes s'affrontent pour conquérir des territoires en cliquant le plus rapidement possible. Chaque clic augmente la jauge de son équipe - la première équipe à atteindre 100 remporte le territoire.

Le jeu répond à un besoin de party games locaux simples et accessibles pour les sessions de jeu entre amis sur PC. Contrairement aux jeux en ligne complexes, ClickWars mise sur l'immédiateté (compréhension en 10 secondes), l'énergie collective (montée en tension partagée), et la rejouabilité (parties courtes de 30-90 secondes).

Le stack technique choisi (Qt 6.8.3 + Felgo 4.0) permet un développement cross-platform natif tout en offrant les outils nécessaires pour le networking LAN et les effets visuels.

### 1.3 Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-01-22 | 1.0 | Création initiale du PRD | John (PM) |

---

## 2. Requirements

### 2.1 Functional Requirements

#### Core Gameplay
- **FR1:** Le système doit afficher deux jauges de territoire (Équipe A et Équipe B), chacune allant de 0 à 100
- **FR2:** Chaque clic d'un joueur doit incrémenter la jauge de son équipe de 1 point
- **FR3:** Le système doit attribuer 1 point de score personnel au joueur pour chaque clic effectué avant que sa jauge d'équipe n'atteigne 100
- **FR4:** Le système doit déclarer la victoire de l'équipe dont la jauge atteint 100 en premier
- **FR5:** Après une victoire, le système doit réinitialiser les jauges à 0 et commencer une nouvelle bataille
- **FR6:** Le système doit afficher le score personnel de chaque joueur en temps réel
- **FR7:** Le système doit afficher l'équipe d'appartenance de chaque joueur clairement (couleur/icône)

#### Réseau LAN
- **FR8:** Le système doit permettre à un joueur de créer une partie en tant qu'hôte (serveur)
- **FR9:** Le système doit permettre à un joueur de rejoindre une partie existante sur le réseau local
- **FR10:** Le système doit découvrir automatiquement les parties disponibles sur le LAN (UDP broadcast)
- **FR11:** Le système doit supporter exactement 4 joueurs (2 par équipe)
- **FR12:** Le système doit synchroniser l'état des jauges entre tous les clients avec une latence < 50ms sur LAN
- **FR13:** Le serveur (hôte) doit être l'autorité pour l'état du jeu (jauges, victoire, scores)
- **FR14:** Le système doit permettre l'assignation des joueurs aux équipes (manuelle ou automatique)
- **FR15:** Le système doit gérer la déconnexion d'un joueur gracieusement (remplacement par bot ou pause)

#### Intelligence Artificielle (Bots)
- **FR16:** Le système doit permettre de remplir les places vides avec des bots IA
- **FR17:** Les bots doivent cliquer automatiquement à des vitesses variables (2-8 clics/seconde)
- **FR18:** Le système doit offrir au moins 3 niveaux de difficulté de bots (Facile: 2-3 cps, Normal: 4-5 cps, Difficile: 6-8 cps)
- **FR19:** Les bots doivent pouvoir être ajoutés/retirés depuis le lobby

#### Interface Utilisateur
- **FR20:** Le système doit afficher un écran d'accueil avec les options : Créer Partie, Rejoindre Partie, Quitter
- **FR21:** Le système doit afficher un lobby montrant les joueurs connectés et leurs équipes
- **FR22:** Le système doit afficher un bouton "Lancer la Partie" visible uniquement par l'hôte
- **FR23:** Le système doit afficher une zone de clic clairement identifiée pour chaque joueur
- **FR24:** Le système doit afficher un écran de victoire identifiant l'équipe gagnante et les scores

#### Feedback Visuel
- **FR25:** Le système doit afficher une animation de particules lors de chaque clic (couleur de l'équipe)
- **FR26:** Le système doit animer le remplissage des jauges de manière fluide (interpolation)
- **FR27:** Le système doit afficher une animation de "scale bounce" sur la zone de clic au clic
- **FR28:** Le système doit afficher un effet visuel distinctif lors de la victoire (explosion de particules, flash)
- **FR29:** Les jauges doivent changer de couleur/intensité selon leur progression (plus intense proche de 100)

### 2.2 Non-Functional Requirements

#### Performance
- **NFR1:** Le jeu doit maintenir 60 FPS constants sur les plateformes cibles
- **NFR2:** La latence réseau doit être < 50ms sur LAN pour la synchronisation des jauges
- **NFR3:** L'application doit consommer < 200MB de mémoire RAM
- **NFR4:** Le temps de démarrage de l'application doit être < 3 secondes
- **NFR5:** La découverte des serveurs LAN doit prendre < 2 secondes

#### Compatibilité
- **NFR6:** L'application doit fonctionner sur Windows 10+, macOS 11+, et Linux (Ubuntu 20.04+)
- **NFR7:** Le code ne doit pas contenir de chemins absolus spécifiques à un OS
- **NFR8:** Le code ne doit pas utiliser d'APIs spécifiques à macOS ou Windows
- **NFR9:** Le projet doit être compilable via un Makefile standard

#### Qualité
- **NFR10:** Le code doit avoir une couverture de tests unitaires > 70% sur la logique métier
- **NFR11:** Les fonctionnalités réseau doivent avoir des tests d'intégration dédiés
- **NFR12:** Le code QML doit suivre les conventions de style Felgo/Qt
- **NFR13:** Aucun clic ne doit être perdu - précision de 100% sur le comptage

#### Sécurité Réseau
- **NFR14:** Les communications réseau doivent être limitées au LAN (pas d'exposition internet)
- **NFR15:** Le serveur doit valider les actions des clients pour éviter la triche

#### Maintenabilité
- **NFR16:** Le code doit être organisé en modules séparés (UI, Network, GameLogic, AI)
- **NFR17:** Chaque module doit avoir une documentation inline claire

---

## 3. User Interface Design Goals

### 3.1 Overall UX Vision

L'interface doit être **immédiatement compréhensible** (moins de 10 secondes pour comprendre comment jouer), **énergique** (couleurs vives, animations dynamiques), et **focalisée sur l'action** (la zone de clic et les jauges doivent dominer l'écran pendant le jeu).

L'expérience doit créer une **montée en tension** progressive avec un climax satisfaisant lors de la victoire.

### 3.2 Key Interaction Paradigms

| Paradigme | Description |
|-----------|-------------|
| **One-Click Play** | Une seule action : cliquer. Pas de menus complexes pendant le jeu |
| **Shared Tension** | Tous les joueurs voient les mêmes jauges progresser en temps réel |
| **Immediate Feedback** | Chaque clic produit une réponse visuelle et auditive instantanée |
| **Clear Teams** | Identification immédiate de son équipe par couleur (rouge/bleu) |

### 3.3 Core Screens and Views

| # | Écran | Objectif | Éléments Clés |
|---|-------|----------|---------------|
| 1 | **Écran d'Accueil** | Point d'entrée | Logo, boutons Créer/Rejoindre/Quitter |
| 2 | **Lobby** | Configuration partie | Liste joueurs, assignation équipes, bots, bouton Lancer |
| 3 | **Écran de Jeu** | Gameplay principal | Jauges, zone de clic, scores, timer optionnel |
| 4 | **Écran de Victoire** | Célébration | Équipe gagnante, scores finaux, bouton Rejouer |
| 5 | **Recherche Serveur** | Rejoindre | Liste des serveurs LAN détectés |

### 3.4 Accessibility

**Niveau cible : Basique**
- Contraste suffisant pour les couleurs d'équipe (rouge/bleu distinguables)
- Taille des éléments cliquables > 44x44 pixels
- Support clavier optionnel (Espace = clic) pour accessibilité motrice

### 3.5 Branding

| Élément | Direction |
|---------|-----------|
| **Style** | Flat design moderne, minimaliste mais vibrant |
| **Couleur Équipe A** | Rouge/Orange (#E74C3C, #F39C12) |
| **Couleur Équipe B** | Bleu/Cyan (#3498DB, #1ABC9C) |
| **Fond** | Sombre (#1A1A2E ou #16213E) pour contraste |
| **Typographie** | Sans-serif moderne (Roboto, Inter, ou défaut Qt) |

### 3.6 Target Platforms

**Desktop Only (PC)**
- Windows 10+ (priorité)
- macOS 11+ (Apple Silicon compatible)
- Linux Ubuntu 20.04+

Résolution minimale : 1280x720
Résolution recommandée : 1920x1080

---

## 4. Technical Assumptions

### 4.1 Repository Structure

**Monorepo** - Un seul dépôt contenant :
```
clickwars-territory/
├── src/
│   ├── qml/           # Interface QML
│   ├── js/            # Logique JavaScript
│   └── assets/        # Images, sons, fonts
├── tests/
│   ├── unit/          # Tests unitaires
│   └── integration/   # Tests d'intégration réseau
├── docs/              # Documentation
├── Makefile           # Build system
└── README.md
```

### 4.2 Service Architecture

**Monolith avec Architecture Modulaire**

L'application est une application desktop monolithique utilisant :

| Couche | Technologie | Responsabilité |
|--------|-------------|----------------|
| **UI** | QML + Felgo | Affichage, animations, interactions |
| **Logic** | JavaScript/QML | Règles du jeu, état, scores |
| **Network** | Qt.Network (QML) | Client/Serveur TCP/UDP |
| **AI** | JavaScript | Comportement des bots |

Architecture interne :
```
┌─────────────────────────────────────────────┐
│                  UI Layer                    │
│           (QML Components/Scenes)            │
├─────────────────────────────────────────────┤
│                Game Logic                    │
│     (State Machine, Rules, Scoring)          │
├─────────────────────────────────────────────┤
│         Network Layer        │   AI Layer   │
│    (Server/Client/Sync)      │   (Bots)     │
└─────────────────────────────────────────────┘
```

### 4.3 Testing Requirements

| Type | Scope | Outils | Couverture Cible |
|------|-------|--------|------------------|
| **Unitaires** | GameLogic, AI, State | Qt Test / QML TestCase | > 70% |
| **Intégration Réseau** | Client/Server sync | Tests manuels + scripts | 100% des scénarios critiques |
| **Manuel** | UI/UX, Gameplay feel | Playtest sessions | Avant chaque release |

Scénarios de test réseau obligatoires :
1. Connexion/déconnexion de clients
2. Synchronisation des jauges sous charge (4 joueurs cliquant simultanément)
3. Découverte de serveur (broadcast)
4. Gestion des timeouts
5. Remplacement par bot lors de déconnexion

### 4.4 Additional Technical Assumptions

- **Framework UI** : Felgo 4.0 (branche Qt 6) avec GameWindow, Scene, et composants standard
- **Langage** : QML pour l'UI, JavaScript pour la logique, pas de C++ requis pour le MVP
- **Build System** : Makefile appelant qmake/CMake selon la config Felgo
- **Networking Protocol** : 
  - UDP pour la découverte (broadcast)
  - TCP pour la communication fiable (clics, état)
- **Pas de backend distant** : Tout est en peer-to-peer sur LAN
- **Pas de persistance** : Scores réinitialisés à chaque session
- **Assets** : Générés/simples (formes QML, particules Felgo)

---

## 5. Epic List

Basé sur les requirements et la timeline d'1 mois, voici les epics proposés :

| Epic | Titre | Durée Estimée | Objectif |
|------|-------|---------------|----------|
| **Epic 1** | Foundation & Core Gameplay | 1 semaine | Setup projet + gameplay local fonctionnel (1 joueur + bots) |
| **Epic 2** | Networking LAN | 1.5 semaines | Communication réseau, lobby, synchronisation 4 joueurs |
| **Epic 3** | Visual Polish & Effects | 1 semaine | Particules, animations, feedback visuel complet |
| **Epic 4** | Testing & Hardening | 0.5 semaine | Tests, bug fixes, polish final |

---

## 6. Epic Details

---

### Epic 1: Foundation & Core Gameplay

**Goal:** Établir les fondations du projet (structure, build system, CI) et implémenter le gameplay de base jouable localement avec un joueur contre des bots. À la fin de cet epic, un joueur peut lancer une partie, cliquer pour remplir sa jauge, et voir les bots jouer contre lui.

---

#### Story 1.1: Project Setup & Build System

**As a** developer,  
**I want** a properly structured Felgo project with a working Makefile,  
**so that** I can build and run the application on any supported platform.

**Acceptance Criteria:**

1. Le projet Felgo est initialisé avec la structure de dossiers définie (src/qml, src/js, src/assets, tests, docs)
2. Un fichier `.pro` ou `CMakeLists.txt` Felgo valide existe
3. Un `Makefile` avec les targets `build`, `run`, `clean`, `test` est créé
4. L'application démarre et affiche une fenêtre vide avec le titre "ClickWars: Territory"
5. Le build fonctionne sans chemins absolus (paths relatifs uniquement)
6. Un `README.md` explique comment builder et lancer le projet

---

#### Story 1.2: Main Menu Screen

**As a** player,  
**I want** to see a main menu when I launch the game,  
**so that** I can choose to create a game, join a game, or quit.

**Acceptance Criteria:**

1. L'écran d'accueil affiche le titre du jeu "ClickWars: Territory" avec style
2. Trois boutons sont visibles : "Créer Partie", "Rejoindre Partie", "Quitter"
3. Le bouton "Quitter" ferme l'application
4. Le bouton "Créer Partie" navigue vers l'écran de Lobby (placeholder pour l'instant)
5. Le bouton "Rejoindre Partie" navigue vers l'écran de recherche (placeholder)
6. Le design respecte la palette de couleurs définie (fond sombre, couleurs vives)
7. Les boutons ont des effets hover/press visibles

---

#### Story 1.3: Game State Manager

**As a** developer,  
**I want** a central game state manager,  
**so that** all components can access and modify the game state consistently.

**Acceptance Criteria:**

1. Un singleton `GameState` QML/JS gère l'état global du jeu
2. Les propriétés suivantes sont disponibles : `teamAGauge` (0-100), `teamBGauge` (0-100), `gamePhase` (menu/lobby/playing/victory), `players` (array)
3. Les propriétés sont observables (changements déclenchent des signaux)
4. Des méthodes `incrementGauge(team)`, `resetGame()`, `setPhase(phase)` existent
5. Tests unitaires vérifient le comportement du GameState
6. La logique de victoire détecte quand une jauge atteint 100

---

#### Story 1.4: Core Gameplay Screen - Gauges Display

**As a** player,  
**I want** to see the two team gauges prominently displayed,  
**so that** I can track the battle progress in real-time.

**Acceptance Criteria:**

1. L'écran de jeu affiche deux jauges horizontales (Équipe A en haut, Équipe B en bas ou face-à-face)
2. Chaque jauge affiche sa valeur numérique (ex: "72/100")
3. Les jauges sont colorées selon l'équipe (rouge pour A, bleu pour B)
4. Le remplissage des jauges est animé (transition fluide, ~200ms)
5. Le nom du territoire actuel est affiché (texte placeholder "Territoire 1")
6. Les jauges se connectent au GameState et reflètent ses valeurs

---

#### Story 1.5: Click Zone & Player Interaction

**As a** player,  
**I want** a clickable zone that registers my clicks and increments my team's gauge,  
**so that** I can contribute to my team's victory.

**Acceptance Criteria:**

1. Une zone de clic large est affichée clairement (couleur de l'équipe du joueur)
2. Chaque clic dans la zone incrémente la jauge de l'équipe du joueur de 1
3. Un feedback visuel immédiat confirme le clic (changement de couleur/scale, 100ms)
4. Le score personnel du joueur s'incrémente à chaque clic (si jauge < 100)
5. Les clics sont ignorés si la jauge de l'équipe est à 100
6. Le compteur de clics est affiché (score personnel)
7. Tests unitaires vérifient la logique d'incrémentation

---

#### Story 1.6: AI Bot System

**As a** player,  
**I want** bots to play for missing players,  
**so that** I can play even without 4 humans.

**Acceptance Criteria:**

1. Une classe/module `BotPlayer` simule des clics automatiques
2. Chaque bot a une vitesse de clic configurable (clics par seconde)
3. Trois niveaux de difficulté : Easy (2-3 cps), Normal (4-5 cps), Hard (6-8 cps)
4. Les bots démarrent/arrêtent avec le début/fin de partie
5. Les clics des bots incrémentent la jauge appropriée via GameState
6. Tests unitaires vérifient que les bots cliquent au bon rythme (±10% tolérance)
7. Les bots peuvent être assignés à n'importe quelle équipe

---

#### Story 1.7: Victory Detection & Screen

**As a** player,  
**I want** to see a victory screen when a team wins,  
**so that** I know the battle is over and can see the results.

**Acceptance Criteria:**

1. Quand une jauge atteint 100, le jeu passe en phase "victory"
2. Un écran de victoire s'affiche avec l'équipe gagnante mise en avant
3. Les scores finaux de tous les joueurs sont affichés
4. Un bouton "Rejouer" réinitialise les jauges et relance une bataille
5. Un bouton "Menu Principal" retourne à l'écran d'accueil
6. Une animation de victoire basique est jouée (flash de couleur de l'équipe gagnante)
7. Le GameState est correctement réinitialisé pour une nouvelle partie

---

### Epic 2: Networking LAN

**Goal:** Implémenter la communication réseau permettant à 4 joueurs de jouer ensemble sur le même réseau local. Le serveur (hôte) synchronise l'état du jeu, les clients envoient leurs clics, et chaque joueur voit les jauges progresser en temps réel.

---

#### Story 2.1: Network Module Foundation

**As a** developer,  
**I want** a network module that handles TCP/UDP communication,  
**so that** clients and server can exchange messages.

**Acceptance Criteria:**

1. Un module `NetworkManager` QML/JS est créé
2. Le module peut démarrer un serveur TCP sur un port configurable (défaut: 7777)
3. Le module peut se connecter à un serveur en tant que client
4. Les messages peuvent être envoyés/reçus au format JSON
5. Les événements connexion/déconnexion/erreur sont signalés
6. Tests d'intégration vérifient la communication de base entre 2 instances

---

#### Story 2.2: Server Discovery (UDP Broadcast)

**As a** player,  
**I want** to see available games on my local network automatically,  
**so that** I can join without typing IP addresses.

**Acceptance Criteria:**

1. Le serveur émet un broadcast UDP toutes les 2 secondes avec ses infos (nom partie, joueurs connectés)
2. Les clients écoutent les broadcasts et affichent les serveurs disponibles
3. L'écran "Rejoindre Partie" liste les serveurs détectés avec leur nombre de joueurs
4. Un bouton permet de rafraîchir manuellement la liste
5. Cliquer sur un serveur tente la connexion
6. Timeout de découverte: 5 secondes max

---

#### Story 2.3: Lobby System

**As a** host,  
**I want** to manage players in a lobby before starting the game,  
**so that** everyone is ready and teams are balanced.

**Acceptance Criteria:**

1. L'écran Lobby affiche 4 slots de joueurs (2 par équipe)
2. Les joueurs connectés apparaissent dans leur slot avec leur nom
3. L'hôte peut ajouter/retirer des bots dans les slots vides
4. L'hôte peut réassigner les joueurs entre les équipes
5. Un bouton "Lancer" (visible uniquement par l'hôte) démarre la partie quand ≥2 joueurs (1+ par équipe)
6. Les clients voient le lobby se mettre à jour en temps réel
7. L'état du lobby est synchronisé via le serveur

---

#### Story 2.4: Game State Synchronization

**As a** player,  
**I want** to see the same gauge values as all other players,  
**so that** the game is fair and accurate.

**Acceptance Criteria:**

1. Le serveur maintient l'état autoritaire des jauges
2. Les clients envoient leurs clics au serveur (message: `{type: "click", playerId: X}`)
3. Le serveur valide et incrémente la jauge, puis broadcast l'état à tous
4. Les clients mettent à jour leur affichage à réception de l'état
5. La latence de synchronisation est < 50ms sur LAN
6. Les jauges sont identiques sur tous les écrans (vérifié par test d'intégration)
7. Le serveur détecte la victoire et la broadcast à tous les clients

---

#### Story 2.5: Player Disconnection Handling

**As a** player,  
**I want** the game to handle disconnections gracefully,  
**so that** one player leaving doesn't ruin the experience.

**Acceptance Criteria:**

1. Quand un client se déconnecte, le serveur détecte le timeout (3 secondes)
2. Le slot du joueur déconnecté est remplacé par un bot automatiquement
3. Les autres joueurs reçoivent une notification (message toast)
4. Si l'hôte se déconnecte, les clients retournent au menu avec message d'erreur
5. Un client peut se reconnecter et reprendre sa place (optionnel pour MVP)
6. Tests d'intégration vérifient les scénarios de déconnexion

---

#### Story 2.6: Network Testing Suite

**As a** developer,  
**I want** comprehensive network integration tests,  
**so that** I can verify multiplayer functionality works correctly.

**Acceptance Criteria:**

1. Tests de connexion/déconnexion multiples clients
2. Tests de synchronisation des jauges (4 clients cliquant simultanément)
3. Tests de découverte serveur (broadcast)
4. Tests de charge: 1000 clics répartis sur 4 clients
5. Tests de latence: vérifier < 50ms
6. Tous les tests passent de manière répétable
7. Documentation des procédures de test manuel

---

### Epic 3: Visual Polish & Effects

**Goal:** Ajouter le polish visuel qui transforme un prototype fonctionnel en expérience satisfaisante. Particules, animations, transitions fluides, et feedback immersif à chaque action.

---

#### Story 3.1: Click Particle Effects

**As a** player,  
**I want** to see particles burst when I click,  
**so that** each click feels impactful and satisfying.

**Acceptance Criteria:**

1. Un système de particules (Felgo ou QML custom) est implémenté
2. Chaque clic génère 10-20 particules de la couleur de l'équipe
3. Les particules s'éloignent du point de clic et disparaissent (~500ms)
4. L'effet ne dégrade pas les performances (60 FPS maintenu)
5. Les particules ont une légère variation de taille et vitesse (aléatoire)
6. L'effet peut être désactivé dans les options (accessibilité)

---

#### Story 3.2: Gauge Animation Enhancement

**As a** player,  
**I want** gauges to animate smoothly and dynamically,  
**so that** progress feels alive and exciting.

**Acceptance Criteria:**

1. Les jauges utilisent une animation fluide (NumberAnimation ~150ms)
2. La couleur de la jauge devient plus intense proche de 100 (gradient ou saturation)
3. Une légère pulsation ("breathing") anime les jauges constamment
4. À 80%+, la jauge pulse plus rapidement (effet "zone danger")
5. Un effet de "glow" ou "shadow" renforce l'importance des jauges
6. Les animations sont synchronisées avec la valeur reçue du serveur

---

#### Story 3.3: Click Zone Feedback

**As a** player,  
**I want** the click zone to react visually to my clicks,  
**so that** I feel connected to my actions.

**Acceptance Criteria:**

1. La zone de clic fait un "scale bounce" à chaque clic (1.0 → 1.1 → 1.0, 100ms)
2. Un effet de "ripple" s'étend depuis le point de clic
3. La couleur de la zone s'intensifie brièvement au clic
4. Optional: compteur de combo visible (clics rapides successifs)
5. Les effets sont performants (pas de lag même avec clics rapides)

---

#### Story 3.4: Victory Celebration Effects

**As a** player,  
**I want** an epic victory celebration,  
**so that** winning feels rewarding and memorable.

**Acceptance Criteria:**

1. Une explosion de particules de la couleur gagnante remplit l'écran
2. Le texte "VICTOIRE ÉQUIPE [A/B]!" apparaît avec animation (scale + fade in)
3. Un flash de couleur overlay l'écran brièvement
4. Les jauges font une animation finale (remplissage complet avec effet)
5. Une animation de "confetti" tombe pendant 2-3 secondes
6. Son de victoire (si audio implémenté, sinon skip pour MVP)

---

#### Story 3.5: Screen Transitions

**As a** player,  
**I want** smooth transitions between screens,  
**so that** navigation feels polished and professional.

**Acceptance Criteria:**

1. Transitions fade/slide entre Menu → Lobby → Game → Victory
2. Durée des transitions: 300-500ms
3. Les transitions ne bloquent pas les inputs (ou fournissent feedback visuel)
4. Le loading (si nécessaire) affiche un indicateur
5. Pas de "flash" blanc ou artefacts visuels pendant les transitions

---

### Epic 4: Testing & Hardening

**Goal:** Assurer la qualité et la stabilité du jeu avant release. Corriger les bugs, optimiser les performances, et valider l'expérience utilisateur complète.

---

#### Story 4.1: Unit Test Coverage

**As a** developer,  
**I want** comprehensive unit test coverage,  
**so that** the game logic is verified and regressions are caught.

**Acceptance Criteria:**

1. Tests unitaires pour GameState (toutes les méthodes et edge cases)
2. Tests unitaires pour BotPlayer (timing, comportement)
3. Tests unitaires pour la logique de score (incrémentation, limites)
4. Couverture > 70% sur les fichiers JS/logique
5. Tous les tests passent en CI/make test
6. Documentation des tests et leur objectif

---

#### Story 4.2: Performance Optimization

**As a** player,  
**I want** the game to run smoothly without lag,  
**so that** gameplay is responsive and enjoyable.

**Acceptance Criteria:**

1. Profiling de performance effectué (identifier bottlenecks)
2. 60 FPS maintenu avec 4 joueurs + particules au maximum
3. Mémoire RAM < 200MB en utilisation normale
4. Pas de memory leaks après 10 parties consécutives
5. Network bandwidth optimisé (pas de spam de messages)
6. Rapport de performance documenté

---

#### Story 4.3: Bug Fixing & Polish Pass

**As a** player,  
**I want** a bug-free experience,  
**so that** nothing breaks my immersion or gameplay.

**Acceptance Criteria:**

1. Tous les bugs connus sont listés et priorisés
2. Bugs critiques et majeurs sont corrigés
3. Playtesting avec 4 joueurs réels effectué (minimum 5 sessions)
4. Feedback des playtesters intégré
5. Edge cases réseau gérés (timeout, perte de paquets)
6. L'application ne crash pas dans les scénarios testés

---

#### Story 4.4: Documentation & README

**As a** developer/user,  
**I want** clear documentation,  
**so that** I can build, run, and understand the project.

**Acceptance Criteria:**

1. README.md complet avec: description, screenshots, instructions build/run
2. Documentation des requirements (Qt, Felgo versions)
3. Architecture documentée (diagramme ou description)
4. Guide de contribution (si open source)
5. Changelog maintenu
6. Commentaires inline dans le code pour les parties complexes

---

## 7. Checklist Results Report

*À compléter après exécution du pm-checklist*

---

## 8. Next Steps

### 8.1 UX Expert Prompt

> "Bonjour ! Nous développons ClickWars: Territory, un party game multijoueur local (LAN, 4 joueurs, 2v2). Le PRD est finalisé. Nous avons besoin de créer les maquettes UI pour les 5 écrans principaux (Menu, Lobby, Jeu, Victoire, Recherche Serveur) en respectant la palette rouge/bleu/fond sombre et le style flat design moderne. Merci de créer les wireframes et recommandations UX."

### 8.2 Architect Prompt

> "Bonjour ! Veuillez créer l'architecture technique pour ClickWars: Territory basée sur le PRD ci-joint. Stack: Qt 6.8.3 + Felgo 4.0 (QML/JavaScript, pas de C++ pour MVP). Focus sur: structure modulaire (UI/Logic/Network/AI), networking LAN (TCP+UDP), et testabilité. Contraintes: cross-platform, pas de chemins absolus, Makefile. Merci de produire le document d'architecture complet."

---

## 9. Summary

| Élément | Valeur |
|---------|--------|
| **Projet** | ClickWars: Territory |
| **Type** | Party Game Multijoueur Local |
| **Stack** | Qt 6.8.3 + Felgo 4.0 (QML/JS) |
| **Joueurs** | 4 (2v2), LAN |
| **Timeline** | 1 mois |
| **Epics** | 4 |
| **Stories** | 17 |
| **Functional Requirements** | 29 |
| **Non-Functional Requirements** | 17 |

---

*Document créé avec le framework BMAD-METHOD™*
