# Story 3.4: Victory & Defeat Synchronization

**Epic:** Epic 3 - Stabilization & UX  
**Story ID:** 3.4  
**Developer:** Dev 4  
**Priority:** 🔴 Critical  
**Status:** 📅 To Do  

---

## Context
The user reports: *"ce n'est pas synchro entre qui gagne et qui perd"*.
If the game ends (Timer or Gauge full), one screen might show Victory while the other plays on, or they show different winners. The transition to the End Screen must be atomic and synchronized.

## Objectives
1.  **Centralize Game Over Logic**: Ensure the Server is the *only* authority on who won. Clients should not calculate victory locally.
2.  **Handle `victory` Message**: When server sends `type: "victory"`, all clients must immediately stop input and show the End Screen.
3.  **Fix Winner Display**: Ensure the payload `winner: "A"` or `"B"` is correctly interpreted by all clients so they know if *they* won or lost.

## Technical Tasks
-   [ ] **Server-Side (`GameServer.js`)**: Verify `checkVictory()` logic and the `broadcastVictory` payload.
-   [ ] **Client-Side (`GameScreen.qml`)**:
    -   Disable interactions (`MouseArea`) when `gameOver` is true.
    -   Listen for `onVictory` signal from `GameStateManager`.
    -   Show a clear "VICTOIRE" or "DÉFAITE" overlay based on local team vs winner team.
-   [ ] **Sync State**: Ensure the final scores displayed match exactly what the server sent.

## Files to Modify
-   `src/server/GameServer.js` (Verify broadcast)
-   `src/components/GameStateManager.qml` (Handle victory signal)
-   `src/screens/GameScreen.qml` (UI for Game Over)

## Definition of Done
-   [ ] When the game ends, **both** screens switch to the End Screen simultaneously.
-   [ ] Screen A (Blue Team) sees "Victory" if Blue won.
-   [ ] Screen B (Red Team) sees "Defeat" if Blue won.
-   [ ] No further clicks are registered after game end.
