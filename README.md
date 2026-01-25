# ⚔️ ClickWars: Territory

> Un party game multijoueur local où deux équipes s'affrontent pour conquérir des territoires à coups de clics !

## 🎮 Gameplay

- **2 équipes** de 2 joueurs s'affrontent
- Chaque **clic** remplit la jauge de votre équipe
- La première équipe à **100** gagne le territoire
- Support de **bots IA** pour compléter les équipes
- Jouez en **réseau local (LAN)**

## 📋 Prérequis

- [Qt 6.8.3](https://www.qt.io/download) ou supérieur
- [Felgo SDK 4.0](https://felgo.com/download) (branche Qt 6) - optionnel
- Un compilateur C++ (Clang sur macOS, GCC sur Linux, MSVC sur Windows)
- CMake 3.16+

## 🚀 Installation

### 1. Cloner le repository

```bash
git clone <repository-url>
cd clickwars-territory
```

### 2. Configurer l'environnement

```bash
# Si vous utilisez Felgo, définissez le chemin du SDK
export FELGO_SDK_PATH=/chemin/vers/felgo/sdk


```

### 3. Compilation

```bash
# Configuration
cmake -S . -B build

# Compilation
cmake --build build
```

## 📁 Structure du Projet

```
clickwars-territory/
├── src/
│   ├── Main.cpp          # Point d'entrée C++
│   ├── main.qml          # Point d'entrée QML
│   ├── qml/
│   │   ├── screens/      # Écrans de l'application
│   │   ├── components/   # Composants réutilisables
│   │   ├── overlays/     # Overlays et modals
│   │   └── styles/       # Thème et styles
│   ├── js/               # Logique JavaScript
│   └── assets/           # Images, sons, polices
├── tests/                # Tests unitaires et intégration
├── docs/                 # Documentation
└── CMakeLists.txt        # Configuration CMake
```

## 📖 Documentation

- [Game Brief](docs/design/game-brief.md) - Vision du jeu
- [PRD](docs/prd.md) - Requirements détaillés
- [Architecture](docs/architecture/game-architecture.md) - Architecture technique
- [Backlog](docs/BACKLOG.md) - User stories

## 🛠️ Développement

### Ajouter un nouveau composant QML

1. Créer le fichier dans `src/qml/components/`
2. Modifier le `CMakeLists.txt` (dans la section `qt_add_qml_module`)
3. L'importer dans les fichiers qui l'utilisent

### Exécuter les tests

```bash
cd build && ctest
```

## 📄 License

MIT License - voir [LICENSE](LICENSE) pour plus de détails.

---

Créé avec ❤️ et le framework [B-MAD](https://github.com/bmad-method)
