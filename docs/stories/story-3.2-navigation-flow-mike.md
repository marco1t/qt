# Story 3.2: Navigation Flow (Join to Lobby)

**Epic:** Epic 3 - Stabilization & UX  
**Story ID:** 3.2  
**Developer:** Dev 2  
**Priority:** 🟠 High  
**Status:** 📅 To Do  

---

## Context
The current flow to join a game is confusing and broken.
1.  User clicks "Rejoindre" (Join).
2.  User enters IP/Port and clicks "Connect".
3.  **Problem**: The app returns to the **Main Menu**.
4.  User effectively has to click "Créer Partie" (Create Game) to see the lobby, even though they are a client.

This is counter-intuitive. A roadmap "Join" should lead directly to the Lobby in a "Waiting" state.

## Objectives
1.  **Fix Navigation Logic**: When `joinServer()` is successful, automatically navigate to the `LobbyScreen`.
2.  **Remove "Create" Step for Joiners**: The user should never have to click "Create" after joining.
3.  **Handle Connection Success**: Use the `onConnected` signal to trigger the navigation change.

## Technical Tasks
-   [ ] **Modify `Main.qml`**:
    -   In `ServerBrowserScreen`'s `onJoinServer`, do *not* just `pop()` to menu.
    -   Instead, listen for `NetworkManager.onConnected`.
    -   When connected, navigate directly to `LobbyScreen`.
-   [ ] **Update `NetworkManager`**: Ensure it emits a clear signal when the handshake is complete.
-   [ ] **Error Handling**: If connection fails, stay on Browser screen and show error (don't go to Lobby).

## Files to Modify
-   `src/Main.qml` (Navigation logic)
-   `src/screens/ServerBrowserScreen.qml` (Signal handling)

## Definition of Done
-   [ ] User enters IP and clicks "Se Connecter".
-   [ ] If successful, the screen transitions *directly* to the Lobby.
-   [ ] No interaction with the Main Menu is required after connection.
