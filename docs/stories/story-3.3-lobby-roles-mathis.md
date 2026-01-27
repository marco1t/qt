# Story 3.3: Lobby Roles (Host vs Client)

**Epic:** Epic 3 - Stabilization & UX  
**Story ID:** 3.3  
**Developer:** Dev 3  
**Priority:** 🟠 High  
**Status:** 📅 To Do  

---

## Context
Currently, the `LobbyScreen` has a hardcoded property `isHost: true` in `Main.qml`.
This means **everyone** sees the "Start Game" button, even clients who just joined multiple existing games.
In a proper flow, only the Host (Game Creator) should have control over settings and starting the game. Clients should see a "Waiting for Host..." message.

## Objectives
1.  **Dynamic Role Assignment**: Determine if the local player is Host or Client.
2.  **UI Adaptation**:
    -   **Host**: Sees "Start Game", "Add Bot", Settings.
    -   **Client**: Sees "En attente du créateur...", Lobby info (read-only).
3.  **Sync Lobby State**: Ensure clients see the list of players update when people join.

## Technical Tasks
-   [ ] **Update `GameStateManager`**: Add an `isHost` property. Set it to `true` if "Create Game" was clicked, `false` if "Join Game" was used.
-   [ ] **Update `Main.qml`**: Pass `gameState.isHost` to the `LobbyScreen`.
-   [ ] **Modify `LobbyScreen.qml`**:
    -   Hide "Start Game" button if `!isHost`.
    -   Show status text "En attente..." if `!isHost`.
-   [ ] **Network Sync**: Ensure `lobby_update` messages from server correctly populate the player list for non-hosts.

## Files to Modify
-   `src/components/GameStateManager.qml`
-   `src/screens/LobbyScreen.qml`
-   `src/Main.qml`

## Definition of Done
-   [ ] Host sees "Start Game".
-   [ ] Joiner (Client) sees "Waiting for Host".
-   [ ] Start button is hidden for Joiner.
-   [ ] Joiner sees the player list update in real-time.
