
# Cocos Creator Fruit Synthesis Game Setup Guide

This project contains the scripts and structure for a "Synthetic Watermelon" style game. Follow these steps to set up the scene in Cocos Creator (v3.8+).

## 1. Scene Setup
1. Open the project in Cocos Creator.
2. Create a new Scene (or use the default one).
3. Create a **Node** named `GameManager` at the root.
   - Add the `GameManager` component to it.
4. Create a **Node** named `FruitContainer` inside the Canvas (or root). This will hold all the fruits.
5. Create a **Node** named `DeathLine` (e.g., a red sprite line) at the top of the screen (around Y=350).
   - Add a `BoxCollider2D` (Sensor/Trigger) to detect game over (optional, or rely on GameManager logic).

## 2. Prefab Setup
1. Create a **Sprite** node in the scene named `Fruit`.
2. Set its size to something like 40x40.
3. Add the following components:
   - `RigidBody2D`: Type = Dynamic. gravityScale = 1.
   - `CircleCollider2D`: Radius = 20. Restitution = 0.2 (bounciness). Friction = 0.3.
   - `Fruit` script: Drag `assets/Script/Fruit.ts` onto it.
4. Drag the `Fruit` node from the Hierarchy to the Assets panel to create a **Prefab**.
5. Delete the `Fruit` node from the scene.

## 3. UI Setup
1. Create a **Node** named `UIManager` (or attach `UIManager` script to Canvas).
2. Create a **Label** for the Score.
3. Create a **Sprite** for "Next Fruit" display.
4. Create a **Panel** (Node with Sprite background) for "Game Over".
   - Add a Label "Game Over".
   - Add a Button "Restart".
5. Link these UI elements to the `UIManager` component slots in the Inspector.

## 4. Connecting Scripts
1. Select the `GameManager` node.
2. Drag the `Fruit` Prefab to the `Fruit Prefab` slot.
3. Drag the `FruitContainer` node to the `Fruit Container` slot.
4. Drag the node with `UIManager` to the `Ui Manager` slot.
5. Drag the `DeathLine` node to the `Death Line` slot.

## 5. Physics Configuration
1. Go to **Project -> Project Settings -> Physics 2D**.
2. Enable Physics.
3. Set Gravity to (0, -960) or similar.
4. (Optional) Set up Collision Matrix if you want walls to separate from fruits.
   - Create a 'Wall' group and a 'Fruit' group.
   - Ensure Fruit collides with Fruit and Wall.

## 6. WeChat Adaptation
1. The `WXManager.ts` script handles basic login and leaderboard submission.
2. Attach `WXManager` script to a permanent node (like `GameManager`).
3. When building for WeChat Mini Game:
   - Set AppID in Build panel.
   - Ensure "Open Data Context" is set up if you want a leaderboard (requires a separate sub-project).

## 7. Assets
- You need to add sprite images for fruits.
- Rename them according to `Constants.ts` (grape, cherry, orange, etc.) or update the script to match your asset names.
- Place them in `assets/resources` if loading dynamically, or just assign them in the Prefab if using a single atlas.

## Gameplay Logic
- **Touch/Drag**: Move finger to position the fruit.
- **Release**: Fruit drops.
- **Collision**: Same fruits merge into a larger one.
- **Game Over**: If fruits stack up to the red line.

Enjoy your development!
