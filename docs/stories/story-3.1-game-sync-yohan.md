# Story 3.1: Game State Synchronization (Clicks & Gauges)

**Epic:** Epic 3 - Stabilization & UX  
**Story ID:** 3.1  
**Developer:** Dev 1  
**Priority:** 🔴 Critical  
**Status:** 📅 To Do  

---

## Context
Currently, there is a major synchronization issue between clients. When a player on Mac (for example) clicks for the Blue team, the score and gauge update on their screen, but **do not update on the Windows client**. The game state appears desynchronized.

The server *seems* to broadcast updates (`GameServer.js` sends `state_update` messages), but the client isn't reflecting them correctly.

## Objectives
1.  **Investigate & Fix Data Flow**: Trace the path from `Click` -> `Server` -> `Broadcast` -> `Client Receive` -> `UI Update`.
2.  **Ensure Real-time Updates**: Verify that when Client A clicks, Client B's gauge increases immediately.
3.  **Fix GameStateManager**: Ensure the `syncFromServer` function in `GameStateManager` correctly updates the properties bound to the UI.

## Technical Tasks
-   [x] **Analyze `GameStateManager.qml`**: Check the `syncFromServer(message)` function. Does it update the `gauge` properties that `GameScreen` is observing?
-   [x] **Verify Network Handling**: In `Main.qml`, ensure `onMessageReceived` passes the data correctly.
-   [x] **Debug UI Bindings**: Ensure `GameScreen.qml` gauges are bound to `GameState.teamAGauge` (or equivalent) and *not* a local variable that never changes.
-   [x] **Test**: Run two clients. Click on one. Verify the other updates within <100ms.

## Files to Modify
-   `src/components/GameStateManager.qml` (Check logic)
-   `src/screens/GameScreen.qml` (Check bindings)
-   `src/Main.qml` (Verify signal passing)

## Definition of Done
-   [x] Clicking on Client A updates Client A's UI.
-   [x] Clicking on Client A updates Client B's UI.
-   [x] Both clients show the exact same score and gauge values at all times.
