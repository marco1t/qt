# Story 1.1: Project Setup & Build System

**Epic:** Epic 1 - Foundation & Core Gameplay  
**Story ID:** 1.1  
**Priority:** 🔴 Critical (Bloquant)  
**Estimation:** 4 heures  
**Status:** 📋 À faire

---

## User Story

**As a** developer,  
**I want** a properly structured Felgo project with a working Makefile,  
**so that** I can build and run the application on any supported platform.

---

## Description

Cette story établit les fondations du projet. Elle crée la structure de dossiers, les fichiers de configuration Qt/Felgo, et le système de build via Makefile. À la fin de cette story, l'application doit démarrer et afficher une fenêtre avec le titre du jeu.

---

## Acceptance Criteria

| # | Critère | Vérifié |
|---|---------|---------|
| AC1 | Le projet Felgo est initialisé avec la structure de dossiers définie (src/qml, src/js, src/assets, tests, docs) | ☐ |
| AC2 | Un fichier `clickwars-territory.pro` valide existe et configure Qt 6.8.3 + Felgo 4.0 | ☐ |
| AC3 | Un `Makefile` avec les targets `build`, `run`, `clean`, `test`, `help` est créé | ☐ |
| AC4 | L'application démarre et affiche une fenêtre avec le titre "ClickWars: Territory" | ☐ |
| AC5 | Le build fonctionne sans chemins absolus (paths relatifs uniquement) | ☐ |
| AC6 | Un `README.md` explique comment builder et lancer le projet | ☐ |
| AC7 | Le projet compile sur macOS (testé sur M4) | ☐ |

---

## Technical Notes

### Fichiers à créer

```
clickwars-territory/
├── Makefile
├── clickwars-territory.pro
├── README.md
├── .gitignore
├── src/
│   ├── Main.cpp
│   ├── main.qml
│   ├── qml/
│   │   ├── screens/
│   │   ├── components/
│   │   └── styles/
│   │       └── Theme.qml
│   ├── js/
│   └── assets/
│       ├── images/
│       ├── sounds/
│       └── fonts/
├── tests/
│   ├── unit/
│   └── integration/
└── qml.qrc
```

### Contraintes techniques

- ❌ Pas de chemins absolus macOS
- ❌ Pas d'API spécifiques à macOS
- ✅ Qt 6.8.3 + Felgo 4.0 (branche Qt 6)
- ✅ Makefile cross-platform

### Dépendances

- Felgo SDK installé (`$FELGO_SDK_PATH` configuré)
- Qt 6.8.3 installé
- qmake6 disponible dans le PATH

---

## Definition of Done

- [ ] Tous les critères d'acceptation sont validés
- [ ] Le code ne contient aucun chemin absolu
- [ ] `make build` compile sans erreur
- [ ] `make run` lance l'application
- [ ] La fenêtre affiche "ClickWars: Territory"
- [ ] README.md contient les instructions de build

---

## Notes de Développement

```bash
# Commandes pour valider la story
cd clickwars-territory
make build
make run
# Vérifier que la fenêtre s'affiche avec le bon titre
```

---

## Références

- [PRD Section 4.1](/docs/prd.md#41-repository-structure)
- [Architecture Section 3](/docs/architecture/game-architecture.md#3-project-structure)
- [Architecture Section 10](/docs/architecture/game-architecture.md#10-build-system)
