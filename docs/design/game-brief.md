# ClickWars: Territory - Game Brief

**Document Version:** 1.0  
**Date:** 2026-01-22  
**Status:** Draft  
**Facilitator:** Alex - Game Design Specialist (B-MAD)

---

## 1. Game Vision

### Core Concept

**ClickWars: Territory** est un jeu de conquête multijoueur local en réseau où deux équipes de 2 joueurs s'affrontent pour le contrôle de territoires. Chaque clic contribue à remplir la jauge de son équipe - la première à atteindre 100 remporte le territoire. Simple à comprendre, intense à jouer, le jeu crée des moments de tension collective et de célébration d'équipe.

### Elevator Pitch

**"Cliquez ensemble, conquérez ensemble - une bataille de territoire où chaque clic compte !"**

### Vision Statement

Créer une expérience multijoueur locale accessible qui génère des moments de compétition intense, de collaboration spontanée et de célébration collective. Le jeu doit être suffisamment simple pour être compris en 10 secondes, mais suffisamment profond pour créer des souvenirs mémorables entre amis.

---

## 2. Target Market

### Primary Audience

| Critère | Description |
|---------|-------------|
| **Démographique** | Joueurs PC, 12-35 ans, jouant en groupe |
| **Psychographique** | Recherche d'expériences sociales, compétitifs mais amicaux |
| **Préférences** | Sessions courtes (5-15 min), parties rapides |

### Market Context

| Élément | Valeur |
|---------|--------|
| **Genre** | Party Game / Clicker Compétitif |
| **Plateforme** | PC (Windows, macOS, Linux) |
| **Positionnement** | Alternative locale aux party games en ligne |

---

## 3. Game Fundamentals

### Core Gameplay Pillars

1. **Simplicité Immédiate** - Une seule action : cliquer. Zéro courbe d'apprentissage.
2. **Tension Collective** - L'état de la bataille visible par tous crée une montée d'adrénaline partagée.
3. **Contribution Visible** - Chaque joueur voit son impact sur la jauge de l'équipe.
4. **Feedback Satisfaisant** - Chaque clic est récompensé visuellement et auditivement.
5. **Rejouabilité Rapide** - Défaite ou victoire, on relance immédiatement.

### Primary Mechanics

#### Mécanique 1: Système de Clic et Jauge

| Aspect | Description |
|--------|-------------|
| **Description** | Chaque clic augmente la jauge de l'équipe de 1 point (max 100) |
| **Player Value** | Gratification immédiate, contribution tangible |
| **Scope** | Simple - Core du gameplay |

#### Mécanique 2: Système de Score Personnel

| Aspect | Description |
|--------|-------------|
| **Description** | Chaque clic avant jauge pleine = +1 point personnel |
| **Player Value** | Motivation individuelle, comparaison entre joueurs |
| **Scope** | Simple - Tracking de données |

#### Mécanique 3: IA Adversaire

| Aspect | Description |
|--------|-------------|
| **Description** | Bots simulant des clics à vitesses variables (2-8 clics/sec) |
| **Player Value** | Permet le jeu même sans 4 humains |
| **Scope** | Modéré - Timing et randomisation |

#### Mécanique 4: Cycle de Territoires

| Aspect | Description |
|--------|-------------|
| **Description** | Après victoire, nouveau territoire avec thème visuel différent |
| **Player Value** | Variété, progression, découverte |
| **Scope** | Modéré - Assets et gestion d'état |

#### Mécanique 5: Réseau Local

| Aspect | Description |
|--------|-------------|
| **Description** | 4 PC connectés sur le même réseau local |
| **Player Value** | Chacun son écran, expérience dédiée |
| **Scope** | Complexe - Synchronisation réseau |

### Player Experience Goals

| Type | Description |
|------|-------------|
| **Émotion Principale** | Tension/Excitation pendant la bataille |
| **Émotions Secondaires** | Fierté (contribution), Euphorie (victoire), Espoir (comeback) |
| **Pattern d'Engagement** | Montée en tension → Climax → Célébration/Reset → Repeat |

---

## 4. Scope and Constraints

### Project Scope

| Élément | Valeur |
|---------|--------|
| **Durée de Session** | 5-15 minutes par session complète |
| **Volume de Contenu** | 8-12 territoires thématiques |
| **Complexité** | Simple (1 mécanique principale) |
| **Comparaison** | "Comme un mini-jeu Mario Party mais dédié au clic" |

### Technical Constraints

| Contrainte | Spécification |
|------------|---------------|
| **Plateforme Primaire** | PC Desktop (Windows, macOS, Linux) |
| **Engine** | Qt 6.8.3 + Felgo 4.0 (branche Qt 6) |
| **Langage** | QML + JavaScript |
| **Performance** | 60 FPS constant |
| **Mémoire** | < 200MB |
| **Temps de Chargement** | < 2 secondes |
| **Réseau** | LAN uniquement (pas de serveur distant) |

### Technical Rules (STRICT)

- ❌ **Pas de chemins absolus macOS** (utiliser des chemins relatifs)
- ❌ **Pas d'API spécifiques à macOS** (rester sur Qt/Felgo standard)
- ✅ **QML/Qt standard + Felgo uniquement**
- ✅ **Makefile pour le build**
- ✅ **Cross-platform compatible**

### Resource Constraints

| Ressource | Estimation |
|-----------|------------|
| **Équipe** | 1 développeur |
| **Timeline** | À définir |
| **Assets Art** | Style simple/minimaliste, générables |
| **Assets Audio** | Sons synthétiques, libres de droits |

---

## 5. Reference Framework

### Inspiration Games

| Jeu | Ce qu'on en retient |
|----|---------------------|
| **Cookie Clicker** | Satisfaction du clic, feedback immédiat |
| **Tug of War (mini-games)** | Compétition directe, visuel de barre |
| **Mario Party (mini-jeux)** | Simplicité, multijoueur local, courte durée |
| **Agar.io** | Compétition simple mais addictive |
| **Jackbox Games** | Multijoueur local avec appareils séparés |

### Differentiation Strategy

| Différenciateur | Description |
|-----------------|-------------|
| **Simplicité Extrême** | Une seule action contre des mini-jeux variés |
| **LAN Focus** | Pas besoin d'internet, uniquement réseau local |
| **Open Source Potential** | Peut être partagé et modifié |

---

## 6. Content Framework

### Game Structure

| Élément | Description |
|---------|-------------|
| **Flow** | Linéaire avec cycles (territoire → bataille → victoire → repeat) |
| **Progression** | Score cumulé entre territoires |
| **Session Type** | Batailles de 30-90 secondes, sessions de 5-15 min |

### Territoires Thématiques (8-12)

| # | Territoire | Palette de Couleurs | Ambiance |
|---|------------|---------------------|----------|
| 1 | Forêt Mystique | Verts, bruns | Paisible → Intense |
| 2 | Désert Ardent | Oranges, jaunes | Chaleur, urgence |
| 3 | Glacier Éternel | Bleus, blancs | Froid, cristallin |
| 4 | Volcan Furieux | Rouges, noirs | Danger, puissance |
| 5 | Océan Profond | Bleus sombres, turquoise | Mystère |
| 6 | Cité Céleste | Dorés, blancs | Majestueux |
| 7 | Marais Toxique | Violets, verts | Inquiétant |
| 8 | Plaine Dorée | Jaunes, beiges | Ouvert, libre |

### Difficulty & Accessibility

| Aspect | Approche |
|--------|----------|
| **Difficulté** | Basée sur la vitesse des bots adverses |
| **Accessibilité** | Contrôle à une seule touche/clic |
| **Compétences Requises** | Clic rapide, endurance |

---

## 7. Art and Audio Direction

### Visual Style

| Élément | Direction |
|---------|-----------|
| **Style Global** | Flat design moderne, couleurs vibrantes |
| **Inspiration** | Material Design + Illustrations vectorielles |
| **Technique** | 2D vectoriel (SVG/QML shapes) |
| **Palette Équipe A** | Nuances de rouge/orange (#E74C3C, #F39C12) |
| **Palette Équipe B** | Nuances de bleu/cyan (#3498DB, #1ABC9C) |

### Audio Direction

| Élément | Direction |
|---------|-----------|
| **Musique** | Électronique énergique, tempo adaptatif |
| **Sound Design** | Clics satisfaisants, montée en intensité |
| **Feedback Sonore** | Sons de combo, alertes de danger, victoire épique |

### UI/UX Approach

| Élément | Direction |
|---------|-----------|
| **Interface** | Grande lisibilité, jauges massives, couleurs vives |
| **UX Goals** | Compréhension en 5 secondes, feedback constant |
| **Animations** | Fluides, réactives, satisfaisantes |

---

## 8. Feature List - Emotion Amplifiers

### 🔥 Tension Amplifiers

| Feature | Description | Priorité |
|---------|-------------|----------|
| **Zone de Danger** | Écran pulse quand une équipe dépasse 80% | Haute |
| **Comeback Mechanic** | Équipe en retard clique 15% plus vite | Moyenne |
| **Derniers Instants** | Ralenti dramatique à 95% | Basse |
| **Musique Dynamique** | Tempo accélère avec progression | Moyenne |

### 🎯 Click Feedback

| Feature | Description | Priorité |
|---------|-------------|----------|
| **Système de Combo** | Clics rapides = effets visuels croissants | Haute |
| **Screen Shake** | Léger tremblement à chaque clic | Moyenne |
| **Particules** | Explosion couleur équipe au clic | Haute |
| **Son Progressif** | Pitch monte pendant combo | Moyenne |

### 🌍 Territory Experience

| Feature | Description | Priorité |
|---------|-------------|----------|
| **Thèmes Visuels** | 8 territoires avec styles uniques | Haute |
| **Carte du Monde** | Visualisation des conquêtes | Basse |
| **Territoires Spéciaux** | Boss avec jauge 200 | Future |

### 👥 Team Spirit

| Feature | Description | Priorité |
|---------|-------------|----------|
| **MVP Display** | Meilleur contributeur affiché | Haute |
| **Célébration Collective** | Animation victoire avec avatars | Moyenne |
| **Messages Rapides** | Boutons "GO!" "DEFEND!" | Future |

---

## 9. Technical Requirements - Network

### Architecture Réseau Local

```
┌─────────────────────────────────────────────────────────┐
│                    RÉSEAU LOCAL (LAN)                   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│   │ PC Host │◄──►│Player 2 │◄──►│Player 3 │◄──►│Player 4 │
│   │(Server) │    │(Client) │    │(Client) │    │(Client) │
│   │Équipe A │    │Équipe A │    │Équipe B │    │Équipe B │
│   └─────────┘    └─────────┘    └─────────┘    └─────────┘
│        ▲              ▲              ▲              ▲    
│        └──────────────┴──────────────┴──────────────┘    
│                    UDP Broadcast                         
└─────────────────────────────────────────────────────────┘
```

### Synchronisation

| Élément | Approche |
|---------|----------|
| **Découverte** | UDP Broadcast pour trouver le serveur |
| **Communication** | TCP pour fiabilité des clics |
| **État du Jeu** | Le serveur (host) est authoritative |
| **Latence Max** | < 50ms sur LAN |

---

## 10. Success Criteria

### Player Experience Metrics

| Métrique | Objectif |
|----------|----------|
| **Temps pour comprendre** | < 10 secondes |
| **Durée moyenne bataille** | 30-90 secondes |
| **Taux de "encore une partie"** | > 80% |
| **Fun factor (subjectif)** | Rires et exclamations pendant le jeu |

### Technical Targets

| Métrique | Objectif |
|----------|----------|
| **FPS** | 60 constant |
| **Précision des clics** | 100% - aucun clic perdu |
| **Sync réseau** | Jauges identiques sur tous les écrans |
| **Temps de connexion** | < 5 secondes |

---

## 11. Next Steps

### Immediate Actions

1. ✅ **Game Brief créé** (ce document)
2. ⏳ **Créer le Game Design Document détaillé**
3. ⏳ **Créer l'Architecture Technique**
4. ⏳ **Initialiser le projet Felgo**
5. ⏳ **Créer le Makefile**

### Development Roadmap

#### Phase 1: Prototype Core (1-2 semaines)
- [ ] Setup projet Felgo + Makefile
- [ ] UI basique avec jauges
- [ ] Système de clic local (1 joueur)
- [ ] Bot IA simple

#### Phase 2: Multijoueur LAN (2-3 semaines)
- [ ] Architecture serveur/client
- [ ] Synchronisation des jauges
- [ ] Lobby et équipes
- [ ] Tests 4 joueurs

#### Phase 3: Polish (1-2 semaines)
- [ ] Effets visuels et particules
- [ ] Sons et musique
- [ ] Territoires thématiques
- [ ] Système de score

---

## 12. Appendices

### Brainstorming Session Notes

- **Date:** 2026-01-22
- **Technique utilisée:** Emotion-First Design
- **Idées clés retenues:** Zone de Danger, Combo System, Territoires thématiques, MVP Display

### Change Log

| Date | Version | Description | Auteur |
|------|---------|-------------|--------|
| 2026-01-22 | 1.0 | Création initiale | Alex (Game Designer) |

---

*Document créé avec le framework BMAD-METHOD™*
