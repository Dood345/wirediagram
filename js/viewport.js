import { dom } from './dom.js';
import { state } from './state.js';

/**
 * Wraps canvas layers in a viewport group to allow unified zoom/pan
 */
export function setupViewport() {
    dom.viewportG = document.createElementNS("http://www.w3.org/2000/svg", "g");
    dom.viewportG.id = "viewport-g";
    
    // Move layout elements into the viewport group
    dom.viewportG.appendChild(dom.canvasGrid);
    dom.viewportG.appendChild(dom.connectionsGroup);
    dom.viewportG.appendChild(dom.nodesGroup);
    dom.viewportG.appendChild(dom.overlaysGroup);
    
    dom.svg.appendChild(dom.viewportG);
    updateViewportTransform();
}

/**
 * Center viewport on the middle of the 3000x3000px base canvas
 */
export function centerViewport() {
    const rect = dom.canvasContainer.getBoundingClientRect();
    state.panX = Math.round(rect.width / 2 - 1500 * state.zoom);
    state.panY = Math.round(rect.height / 2 - 1500 * state.zoom);
    updateViewportTransform();
}

/**
 * Render zoom/pan transformations
 */
export function updateViewportTransform() {
    if (dom.viewportG) {
        dom.viewportG.setAttribute('transform', `translate(${state.panX}, ${state.panY}) scale(${state.zoom})`);
    }
    const zoomLevelEl = document.getElementById('zoom-level');
    if (zoomLevelEl) {
        zoomLevelEl.textContent = `${Math.round(state.zoom * 100)}%`;
    }
}

/**
 * Convert screen client coordinates to SVG coordinates
 */
export function getSvgCoords(clientX, clientY) {
    const rect = dom.svg.getBoundingClientRect();
    const x = (clientX - rect.left - state.panX) / state.zoom;
    const y = (clientY - rect.top - state.panY) / state.zoom;
    return { x, y };
}

/**
 * Perform zoom operation on the canvas
 */
export function zoomCanvas(delta, clientX = null, clientY = null) {
    const oldZoom = state.zoom;
    let newZoom = oldZoom + delta;
    newZoom = Math.max(0.2, Math.min(3.0, newZoom)); // limits between 20% and 300%
    
    if (clientX !== null && clientY !== null) {
        // Zoom centered on mouse cursor
        const rect = dom.svg.getBoundingClientRect();
        const mouseX = clientX - rect.left;
        const mouseY = clientY - rect.top;
        
        const svgX = (mouseX - state.panX) / oldZoom;
        const svgY = (mouseY - state.panY) / oldZoom;
        
        state.zoom = newZoom;
        state.panX = mouseX - svgX * newZoom;
        state.panY = mouseY - svgY * newZoom;
    } else {
        // Zoom centered on canvas viewport midpoint
        const rect = dom.canvasContainer.getBoundingClientRect();
        const midX = rect.width / 2;
        const midY = rect.height / 2;
        
        const svgX = (midX - state.panX) / oldZoom;
        const svgY = (midY - state.panY) / oldZoom;
        
        state.zoom = newZoom;
        state.panX = midX - svgX * newZoom;
        state.panY = midY - svgY * newZoom;
    }
    
    updateViewportTransform();
}

/**
 * Auto-expand SVG canvas dimensions if nodes are moved near boundaries
 */
export function resizeCanvasIfNeeded() {
    let currentW = parseInt(dom.svg.getAttribute('width'));
    let currentH = parseInt(dom.svg.getAttribute('height'));
    let maxNodeX = 3000;
    let maxNodeY = 3000;
    
    state.nodes.forEach(n => {
        if (n.x + n.w + 300 > maxNodeX) maxNodeX = n.x + n.w + 300;
        if (n.y + n.h + 300 > maxNodeY) maxNodeY = n.y + n.h + 300;
    });
    
    if (maxNodeX > currentW || maxNodeY > currentH) {
        const nextW = Math.max(currentW, maxNodeX);
        const nextH = Math.max(currentH, maxNodeY);
        dom.svg.setAttribute('width', nextW);
        dom.svg.setAttribute('height', nextH);
    }
}

