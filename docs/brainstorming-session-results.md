# Brainstorming Session Results

**Session Date:** 2026-01-22  
**Facilitator:** Alex - Game Design Specialist  
**Participant:** User  

---

## Executive Summary

| Élément | Valeur |
|---------|--------|
| **Topic** | Jeu de conquête de territoire multijoueur local |
| **Session Goals** | Enrichir le concept existant avec des mécaniques émotionnelles |
| **Techniques Used** | Emotion-First Design, Player Experience Goals |
| **Total Ideas Generated** | 18 idées d'amplification |

### Key Themes Identified

- 🔥 **Tension et Urgence** - Créer des moments de panique positive
- 🎯 **Feedback Satisfaisant** - Chaque action doit être gratifiante
- 🤝 **Esprit d'Équipe** - Renforcer la collaboration et la fierté collective
- 🌍 **Variété Visuelle** - Les territoires comme source de découverte

---

## Technique Sessions

### Emotion-First Design - 15 minutes

**Description:** Identification des émotions cibles et conception de mécaniques pour les générer.

#### Ideas Generated

1. Zone de Danger avec pulsation visuelle à 80%+
2. Comeback Mechanic pour l'équipe en retard
3. Ralenti dramatique aux derniers instants (95%+)
4. Musique à tempo adaptatif
5. Système de combo visuel pour clics rapides
6. Screen shake au clic
7. Particules d'explosion couleur équipe
8. Sons de clic avec pitch progressif
9. 8 territoires thématiques uniques
10. Carte du monde pour visualiser les conquêtes
11. Territoires boss avec jauge 200
12. Affichage MVP de la bataille
13. Animation de célébration collective
14. Boutons de messages rapides ("GO!", "DEFEND!")
15. Bonus de synergie pour clics simultanés

#### Insights Discovered

- La simplicité du gameplay permet d'investir dans le polish émotionnel
- Le format LAN crée une expérience sociale unique impossible en ligne
- Les courtes batailles favorisent la rejouabilité

#### Notable Connections

- Zone de Danger + Musique Dynamique = Montée en tension cohérente
- Combo System + Particules = Double feedback satisfaisant
- MVP + Célébration = Reconnaissance individuelle dans victoire collective

---

## Idea Categorization

### Immediate Opportunities

*Ideas ready to implement now*

1. **Système de Jauge Dual**
   - Description: Deux jauges face à face, progression visible
   - Why immediate: Core gameplay, doit être implémenté en premier
   - Resources needed: QML Rectangle + NumberAnimation

2. **Feedback Visuel de Clic**
   - Description: Particules et scale bounce au clic
   - Why immediate: Améliore immédiatement le ressenti
   - Resources needed: Felgo GameParticles ou particules QML custom

3. **Système de Score**
   - Description: Tracking des points par joueur
   - Why immediate: Motivation individuelle essentielle
   - Resources needed: Variables d'état, UI texte

### Future Innovations

*Ideas requiring development/research*

1. **Réseau LAN P2P**
   - Description: Découverte automatique et connexion
   - Development needed: Qt Network, protocole UDP/TCP
   - Timeline estimate: 2-3 semaines

2. **Territoires Thématiques**
   - Description: 8 environnements avec assets uniques
   - Development needed: Design assets, système de sélection
   - Timeline estimate: 1-2 semaines

3. **Musique Adaptive**
   - Description: BPM et intensité liés à la progression
   - Development needed: Système audio multi-pistes
   - Timeline estimate: 1 semaine

### Moonshots

*Ambitious, transformative concepts*

1. **Mode Tournoi**
   - Description: Brackets pour plus de 4 joueurs
   - Transformative potential: Événements gaming locaux
   - Challenges: Gestion de nombreux clients, spectateur mode

2. **Territoires Procéduraux**
   - Description: Génération de nouveaux territoires à l'infini
   - Transformative potential: Rejouabilité infinie
   - Challenges: Algorithmes de génération, balance

---

## Action Planning

### Top 3 Priority Ideas

#### #1 Priority: Core Gameplay Loop

- **Rationale:** Sans le cœur du jeu, rien d'autre ne peut être testé
- **Next Steps:** Créer prototype avec jauges et clics fonctionnels
- **Resources:** QML, Felgo Scene
- **Timeline:** 2-3 jours

#### #2 Priority: Réseau LAN Basique

- **Rationale:** Le multijoueur est le différenciateur clé
- **Next Steps:** Implémenter serveur/client TCP
- **Resources:** Qt.Network, QML
- **Timeline:** 1 semaine

#### #3 Priority: Feedback Visuel/Audio

- **Rationale:** Transforme un prototype en jeu agréable
- **Next Steps:** Ajouter particules, sons, animations
- **Resources:** Assets audio, Felgo effects
- **Timeline:** 3-4 jours

---

## Reflection & Follow-up

### What Worked Well

- Partir du concept existant a permis d'aller vite
- L'approche Emotion-First a généré beaucoup d'idées de polish
- Les contraintes techniques claires (Felgo/Qt) ont cadré les propositions

### Areas for Further Exploration

- **Balance IA:** Comment rendre les bots fun mais pas frustrants
- **Networking edge cases:** Gestion déconnexions, lag
- **Accessibilité:** Support clavier pour joueurs ne pouvant pas cliquer rapidement

### Recommended Follow-up Techniques

- **SCAMPER:** Pour itérer sur les mécaniques si besoin
- **Player Archetype:** Pour s'assurer que le jeu plait à différents profils
- **Constraint-Based Creativity:** Pour le mode minimal/one-button

### Questions That Emerged

- Faut-il un système de chat ou communication vocale ?
- Comment gérer les joueurs qui ragequit ?
- Y a-t-il un end-game ou on joue indéfiniment ?

### Next Session Planning

- **Suggested topics:** Game Design Document détaillé
- **Recommended timeframe:** Immédiat
- **Preparation needed:** Valider les priorités avec le développeur

---

*Session facilitated using the BMAD-METHOD™ brainstorming framework*
