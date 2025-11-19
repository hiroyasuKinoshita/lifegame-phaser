# Life Game with Phaser

[Contributor Guide: AGENTS.md](./AGENTS.md)

This is a simple implementation of Conway's Game of Life using the Phaser 3 game framework.

## Features

*   Generational cell coloring
*   Start/Reset buttons
*   Mouse-draggable camera for exploring a large virtual world
*   Mouse wheel zoom in/out

## How to Run

1. Clone this repository:
   ```bash
   git clone <repository_url>
   cd lifegame
   ```
2. Install dependencies and build:
   ```bash
   npm install
   npm run build
   ```
3. Open `index.html` directly in a browser, or serve statically (recommended):
   ```bash
   npx http-server .
   ```
Then visit the printed local URL.

## Development

- Watch build: recompile on file changes.
  ```bash
  npm run build:watch
  # or
  npm run dev
  ```
- Output: TypeScript compiles to `dist/game.js`. Do not edit files under `dist/`.
- Config: See `tsconfig.json` (`outDir: dist`, CommonJS, DOM libs).

## Controls

*   **Start Button**: Starts the simulation.
*   **Reset Button**: Resets the simulation and grid.
*   **Mouse Drag**: Pan the camera to explore the grid.
*   **Mouse Wheel**: Zoom in and out.
