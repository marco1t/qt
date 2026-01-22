# Story 4.4: Documentation & README

**Epic:** Epic 4 - Testing & Hardening  
**Story ID:** 4.4  
**Priority:** 🟡 High  
**Estimation:** 2 heures  
**Status:** 📋 À faire  
**Dépend de:** Story 1.1

---

## User Story

**As a** developer/user,  
**I want** clear documentation,  
**so that** I can build, run, and understand the project.

---

## Description

Créer une documentation complète du projet incluant README, instructions de build, architecture, et guide de contribution.

---

## Acceptance Criteria

| # | Critère | Vérifié |
|---|---------|---------|
| AC1 | README.md complet avec description, screenshots, instructions build/run | ☐ |
| AC2 | Documentation des requirements (Qt, Felgo versions) | ☐ |
| AC3 | Architecture documentée | ☐ |
| AC4 | Guide de contribution (si open source) | ☐ |
| AC5 | Changelog maintenu | ☐ |
| AC6 | Commentaires inline dans le code pour les parties complexes | ☐ |

---

## Technical Notes

### README.md Template

```markdown
# ⚔️ ClickWars: Territory

[![Qt Version](https://img.shields.io/badge/Qt-6.8.3-green.svg)](https://www.qt.io/)
[![Felgo Version](https://img.shields.io/badge/Felgo-4.0-blue.svg)](https://felgo.com/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

> Un party game multijoueur local où deux équipes s'affrontent pour conquérir des territoires à coups de clics !

![Game Screenshot](docs/images/screenshot.png)

## 🎮 Gameplay

- **2 équipes** de 2 joueurs s'affrontent
- Chaque **clic** remplit la jauge de votre équipe
- La première équipe à **100** gagne le territoire
- Support de **bots IA** pour compléter les équipes
- Jouez en **réseau local (LAN)**

## ✨ Caractéristiques

- 🌐 Multijoueur LAN (4 joueurs)
- 🤖 Bots IA avec 3 niveaux de difficulté
- 🎨 Effets visuels satisfaisants (particules, animations)
- 🎯 Gameplay simple et addictif
- 💻 Cross-platform (Windows, macOS, Linux)

## 📋 Prérequis

- [Qt 6.8.3](https://www.qt.io/download) ou supérieur
- [Felgo SDK 4.0](https://felgo.com/download) (branche Qt 6)
- Un compilateur C++ (GCC, Clang, MSVC)
- Make

## 🚀 Installation

### 1. Cloner le repository

```bash
git clone https://github.com/youruser/clickwars-territory.git
cd clickwars-territory
```

### 2. Configurer l'environnement

```bash
# Assurez-vous que FELGO_SDK_PATH est défini
export FELGO_SDK_PATH=/path/to/felgo/sdk

# Vérifier que qmake6 est disponible
qmake6 --version
```

### 3. Compiler

```bash
make build
```

### 4. Lancer

```bash
make run
```

## 🎲 Comment Jouer

1. **Créer une partie** - Un joueur crée la partie (devient l'hôte)
2. **Rejoindre** - Les autres joueurs rejoignent via la découverte automatique
3. **Configurer les équipes** - L'hôte assigne les joueurs et ajoute des bots si nécessaire
4. **Lancer !** - Cliquez le plus vite possible pour remplir votre jauge
5. **Victoire** - Première équipe à 100 gagne !

## 🏗️ Structure du Projet

```
clickwars-territory/
├── src/
│   ├── qml/          # Composants QML
│   ├── js/           # Logique JavaScript
│   └── assets/       # Images, sons
├── tests/            # Tests unitaires et intégration
├── docs/             # Documentation
└── Makefile          # Build system
```

## 🧪 Tests

```bash
make test
```

## 📖 Documentation

- [Game Brief](docs/design/game-brief.md) - Vision du jeu
- [PRD](docs/prd.md) - Requirements détaillés
- [Architecture](docs/architecture/game-architecture.md) - Architecture technique
- [Stories](docs/stories/) - User stories pour le développement

## 🤝 Contribution

Les contributions sont les bienvenues ! Voir [CONTRIBUTING.md](CONTRIBUTING.md).

1. Fork le projet
2. Créer une branche (`git checkout -b feature/amazing-feature`)
3. Commit (`git commit -m 'Add amazing feature'`)
4. Push (`git push origin feature/amazing-feature`)
5. Ouvrir une Pull Request

## 📝 Changelog

Voir [CHANGELOG.md](CHANGELOG.md) pour l'historique des versions.

## 📄 License

Ce projet est sous licence MIT. Voir [LICENSE](LICENSE) pour plus de détails.

## 🙏 Remerciements

- [Felgo](https://felgo.com/) pour le framework de jeu
- [Qt](https://www.qt.io/) pour le framework cross-platform
- Créé avec ❤️ et le framework [B-MAD](https://github.com/bmad-method)
```

### CONTRIBUTING.md

```markdown
# Contributing to ClickWars: Territory

## Code Style

- Utiliser QML formatting standard
- JavaScript: camelCase pour les fonctions, PascalCase pour les composants
- Commentaires en anglais

## Commit Messages

- Utiliser le format: `type: description`
- Types: feat, fix, docs, style, refactor, test, chore

## Pull Request Process

1. Mettre à jour la documentation si nécessaire
2. S'assurer que tous les tests passent
3. Mettre à jour le CHANGELOG
4. Une review requise avant merge

## Reporting Bugs

Utiliser le template dans docs/BUGS.md
```

### CHANGELOG.md

```markdown
# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- Initial project setup
- Core gameplay (gauges, clicking, victory)
- LAN multiplayer (4 players)
- AI bots (3 difficulty levels)
- Visual effects (particles, animations)

### Changed
- N/A

### Fixed
- N/A

## [1.0.0] - YYYY-MM-DD

### Added
- First release!
```

### Code Comments Standards

```qml
/// GaugeBar displays a team's progress toward victory.
/// 
/// Properties:
/// - value: Current gauge value (0-100)
/// - teamColor: Color associated with the team
/// 
/// Example:
/// ```qml
/// GaugeBar {
///     value: GameState.teamA.gauge
///     teamColor: Theme.teamA
/// }
/// ```
Item {
    id: gaugeBar
    
    // ...
}
```

```javascript
/**
 * Increments the gauge for the specified team.
 * 
 * @param {string} team - Team identifier ("A" or "B")
 * @returns {boolean} True if the click was valid, false if gauge is full
 * 
 * @example
 * var success = GameState.incrementGauge("A");
 * if (!success) console.log("Gauge is full!");
 */
function incrementGauge(team) {
    // ...
}
```

---

## Definition of Done

- [ ] Tous les critères d'acceptation sont validés
- [ ] README complet et formaté
- [ ] Screenshots ajoutés
- [ ] CONTRIBUTING et CHANGELOG créés
- [ ] Code commenté pour les parties complexes
- [ ] `make help` affiche les commandes disponibles

---

## Références

- [PRD NFR16, NFR17](/docs/prd.md)
