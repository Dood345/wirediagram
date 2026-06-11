# Aperture Diagrammer

A premium, modular wiring diagram builder designed for maximum flexibility, featuring custom Dijkstra-based obstacle avoidance wire routing, premium glassmorphic context menus, and a containerized deployment setup.

---

## 🚀 Features

- **Modular ES6 Architecture**: Decomposed from a single monolith into clean, single-responsibility native ES6 modules located in the `js/` directory.
- **Obstacle Avoidance Wire Routing**: Connection wires automatically navigate around blocking shape boxes using a localized Dijkstra/A* grid pathfinder.
- **Dynamic Wire Spacing & Snapping**: Multiple parallel wires between boxes space themselves out at 20px intervals. When a shape side's capacity is exhausted, extra connections automatically snap to alternative faces (e.g. Top/Bottom instead of Left/Right).
- **Clipboard & Context Menu**: Seamlessly copy (`Ctrl+C`), paste (`Ctrl+V`), and delete components using either keyboard shortcuts or a glassmorphic right-click context menu.
- **High-Res PNG Export**: Exports the entire diagram canvas into a transparent PNG with bounding dimensions that adapt to wire stroke thicknesses and terminal markers (arrows/circles) to prevent boundary clipping.
- **Robust Text Inline Editor**: Fixes stuck focus loops during panning by explicitly blurring active label inputs when clicking or dragging anywhere on the canvas background.
- **Docker Ready**: Fully dockerized with a lightweight Nginx Alpine container, serving the application on host port `1337`.

---

## 📁 Project Structure

All modules are loaded as a native ES6 import tree starting from the entry point:

- **[index.html](file:///c:/Users/dood3/Documents/Projects/wirediagram/index.html)**: Main HTML structure, importing `js/app.js` with `type="module"`.
- **[styles.css](file:///c:/Users/dood3/Documents/Projects/wirediagram/styles.css)**: General styles and premium glassmorphic overrides for menus.
- **[js/app.js](file:///c:/Users/dood3/Documents/Projects/wirediagram/js/app.js)**: Orchestrates lifecycle initialization.
- **[js/routing.js](file:///c:/Users/dood3/Documents/Projects/wirediagram/js/routing.js)**: Contains port assignment calculations and the Dijkstra obstacle avoidance pathfinder.
- **[js/editor.js](file:///c:/Users/dood3/Documents/Projects/wirediagram/js/editor.js)**: Core mutations (adding, deleting, and deep-cloning nodes).
- **[js/events.js](file:///c:/Users/dood3/Documents/Projects/wirediagram/js/events.js)**: Centralizes keyboard event hooks, canvas pan/zoom mouse handlers, and context menu rendering.
- **[js/state.js](file:///c:/Users/dood3/Documents/Projects/wirediagram/js/state.js)**: Global reactive state store.
- **[js/renderer.js](file:///c:/Users/dood3/Documents/Projects/wirediagram/js/renderer.js)**: Draws grid grids, canvas shapes, and connections.
- **[js/exporter.js](file:///c:/Users/dood3/Documents/Projects/wirediagram/js/exporter.js)**: Logic for the transparent PNG bounding-box calculation and downloading.
- **[js/viewport.js](file:///c:/Users/dood3/Documents/Projects/wirediagram/js/viewport.js)**: Pan, zoom, and coordinate transform helpers.
- **[js/inspector.js](file:///c:/Users/dood3/Documents/Projects/wirediagram/js/inspector.js)**: Controls the property configuration sidebar panel.
- **[js/dom.js](file:///c:/Users/dood3/Documents/Projects/wirediagram/js/dom.js)**: DOM element references.
- **[js/config.js](file:///c:/Users/dood3/Documents/Projects/wirediagram/js/config.js)**: Static styling configuration.

---

## 🛠️ Getting Started

### Option A: Running Locally (Local Dev Server)

Since this app uses ES6 Modules, it must be run via an HTTP server.

1. Start a simple Python HTTP server:
   ```bash
   python -m http.server 8000
   ```
2. Open **`http://localhost:8000`** in your browser.

### Option B: Running with Docker (Containerized)

We use Nginx Alpine to host the built assets on port `1337`.

1. Build and spin up the container:
   ```bash
   docker compose up -d --build
   ```
2. Open **`http://localhost:1337`** in your browser.
3. Stop the container with:
   ```bash
   docker compose down
   ```

---

## ⌨️ Controls & Shortcuts

| Action | Shortcut / Control |
|---|---|
| **Pan Canvas** | Middle-click and drag (or hold Spacebar + Left-click and drag) |
| **Zoom Canvas** | Scroll wheel |
| **Select Shape** | Left-click shape |
| **Resize Shape** | Drag the bottom-right resize handle of a selected shape |
| **Create Connection** | Shift + Click and drag from one shape edge to another |
| **Copy Selected** | `Ctrl + C` or Right-click -> Copy |
| **Paste Copied** | `Ctrl + V` or Right-click -> Paste |
| **Delete Selected** | `Delete` key or Right-click -> Delete |
| **Double Click text/label**| Inline rename wire/shape labels |

---

## 📄 License

This project is licensed under the Apache License, Version 2.0. See the [LICENSE](file:///c:/Users/dood3/Documents/Projects/wirediagram/LICENSE) file for the full license text.
