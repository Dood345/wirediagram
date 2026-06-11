import { initDomReferences } from './dom.js';
import { setupViewport, centerViewport } from './viewport.js';
import { setupEventListeners } from './events.js';
import { setupColorPresets } from './inspector.js';
import { state, generateId } from './state.js';
import { renderDiagram } from './renderer.js';

// Initialize app when DOM loaded
document.addEventListener('DOMContentLoaded', () => {
    initDomReferences();
    setupViewport();
    setupEventListeners();
    setupColorPresets();
    loadDemoDiagram();
    centerViewport();
});

/**
 * Load the saved diagram from localStorage, or load a default demo layout
 */
function loadDemoDiagram() {
    const saved = localStorage.getItem('aperture_diagrammer_state');
    if (saved) {
        try {
            const data = JSON.parse(saved);
            state.nodes = data.nodes || [];
            state.connections = data.connections || [];
            renderDiagram();
            return;
        } catch(e) {
            console.error("Failed to parse local storage diagram", e);
        }
    }
    
    // Default demo diagram if none saved
    const id1 = generateId();
    const id2 = generateId();
    const id3 = generateId();
    
    state.nodes = [
        {
            id: id1,
            x: 1300, y: 1450, w: 140, h: 80,
            label: "Control Module",
            fill: "#6366f125",
            border: "#6366f1",
            borderThickness: 2,
            fontSize: 14,
            textColor: "#f8fafc",
            type: "box"
        },
        {
            id: id2,
            x: 1600, y: 1450, w: 140, h: 80,
            label: "Logic Gate A",
            fill: "#0d948825",
            border: "#0d9488",
            borderThickness: 2,
            fontSize: 14,
            textColor: "#f8fafc",
            type: "box"
        },
        {
            id: id3,
            x: 1600, y: 1650, w: 140, h: 80,
            label: "Glow Indicator",
            fill: "#d9770625",
            border: "#d97706",
            borderThickness: 2,
            fontSize: 14,
            textColor: "#f8fafc",
            type: "box"
        }
    ];
    
    state.connections = [
        {
            id: generateId(),
            fromId: id1,
            toId: id2,
            label: "Control Bus",
            color: "#6366f1",
            thickness: 2,
            arrowStart: "none",
            arrowEnd: "arrow",
            routing: "orthogonal",
            radius: 12
        },
        {
            id: generateId(),
            fromId: id2,
            toId: id3,
            label: "Trigger Sign",
            color: "#0d9488",
            thickness: 2,
            arrowStart: "circle",
            arrowEnd: "arrow",
            routing: "smooth",
            radius: 12
        }
    ];
    
    renderDiagram();
}
