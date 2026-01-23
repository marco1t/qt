# Story 4.3: Bug Fixing & Polish Pass

**Epic:** Epic 4 - Testing & Hardening  
**Story ID:** 4.3  
**Priority:** 🟡 High  
**Estimation:** 4 heures  
**Status:** 📋 À faire  
**Dépend de:** Toutes les autres stories

---

## User Story

**As a** player,  
**I want** a bug-free experience,  
**so that** nothing breaks my immersion or gameplay.

---

## Description

Phase finale de polish où tous les bugs sont identifiés, triés et corrigés. Inclut des sessions de playtest réel avec 4 joueurs.

---

## Acceptance Criteria

| # | Critère | Vérifié |
|---|---------|---------|
| AC1 | Tous les bugs connus sont listés et priorisés | ☐ |
| AC2 | Bugs critiques et majeurs sont corrigés | ☐ |
| AC3 | Playtesting avec 4 joueurs réels effectué (min 5 sessions) | ☐ |
| AC4 | Feedback des playtesters intégré | ☐ |
| AC5 | Edge cases réseau gérés | ☐ |
| AC6 | L'application ne crash pas dans les scénarios testés | ☐ |

---

## Technical Notes

### Bug Tracking Template

Créer un fichier `docs/BUGS.md`:

```markdown
# Bug Tracker - ClickWars: Territory

## Priority Levels
- 🔴 **Critical** - Crash, data loss, game-breaking
- 🟠 **Major** - Significant functionality broken
- 🟡 **Minor** - Small issues, workarounds exist
- 🟢 **Trivial** - Cosmetic, polish

## Open Bugs

### 🔴 Critical

| ID | Description | Steps to Reproduce | Status |
|----|-------------|-------------------|--------|
| BUG-001 | [Description] | 1. ... 2. ... | Open |

### 🟠 Major

| ID | Description | Steps to Reproduce | Status |
|----|-------------|-------------------|--------|

### 🟡 Minor

| ID | Description | Steps to Reproduce | Status |
|----|-------------|-------------------|--------|

### 🟢 Trivial

| ID | Description | Steps to Reproduce | Status |
|----|-------------|-------------------|--------|

## Fixed Bugs (This Version)

| ID | Description | Fix Commit |
|----|-------------|------------|

## Known Issues (Won't Fix for MVP)

| ID | Description | Reason |
|----|-------------|--------|
```

### Scénarios de Test à Couvrir

#### Gameplay

- [ ] Cliquer très rapidement (>10 clics/sec)
- [ ] Cliquer après victoire (doit être ignoré)
- [ ] Rejouer plusieurs fois sans quitter
- [ ] Bots de toutes difficultés
- [ ] Parties avec seulement des bots

#### Réseau

- [ ] Connexion/déconnexion rapide
- [ ] 4 joueurs simultanés
- [ ] Déconnexion en plein jeu
- [ ] Déconnexion de l'hôte
- [ ] Fermer l'app brutalement
- [ ] Perte de connexion WiFi
- [ ] Latence simulée (si possible)

#### UI

- [ ] Toutes les transitions entre écrans
- [ ] Redimensionner la fenêtre (si autorisé)
- [ ] Minimiser/restaurer l'app
- [ ] Alt+Tab pendant le jeu
- [ ] Clic en dehors de la zone de clic

#### Edge Cases

- [ ] Partie avec 2 joueurs même équipe
- [ ] Partie 4 bots (0 humain)
- [ ] Victoire exactement simultanée (théorique)
- [ ] Noms de joueurs très longs
- [ ] Noms avec caractères spéciaux

### Playtest Session Log

```markdown
# Playtest Session #X

**Date:** YYYY-MM-DD
**Duration:** XX minutes
**Players:** [Names/count]
**Build:** [version/commit]

## Setup
- Device 1: [OS, specs]
- Device 2: [OS, specs]
- Device 3: [OS, specs]
- Device 4: [OS, specs]
- Network: [WiFi/Ethernet]

## Session Flow
1. [Timestamp] - [Event]
2. ...

## Bugs Discovered
- BUG-XXX: [Description]

## Feedback Received
- [Player X]: "[Comment]"
- [Player Y]: "[Comment]"

## Fun Observations
- [What worked well]

## Issues Noted
- [What needs improvement]

## Action Items
- [ ] [Fix/Improve X]
```

### Common Fixes Checklist

```qml
// Éviter les null pointer exceptions
if (object && object.property) {
    // Safe access
}

// Gérer les animations interrompues
SequentialAnimation {
    onStopped: {
        // Reset state if interrupted
    }
}

// Nettoyer les timers
Component.onDestruction: {
    if (timer.running) {
        timer.stop()
    }
}

// Gérer les déconnexions réseau
Connections {
    target: Network
    
    function onError(error) {
        // Afficher message, retourner au menu
    }
    
    function onDisconnected() {
        // Cleanup, retourner au menu
    }
}
```

---

## Definition of Done

- [ ] Tous les critères d'acceptation sont validés
- [ ] 0 bugs critiques ouverts
- [ ] 0 bugs majeurs ouverts
- [ ] Playtest avec 4 joueurs réels effectué
- [ ] Feedback intégré
- [ ] Pas de crash observé

---

## Références

- [PRD - Success Criteria](/docs/prd.md#success-criteria)
