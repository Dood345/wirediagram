import { dom } from './dom.js';
import { state, saveStateToLocalStorage } from './state.js';
import { renderDiagram } from './renderer.js';
import { updateInspector } from './inspector.js';
import { resizeCanvasIfNeeded } from './viewport.js';
import { calculatePathPoints } from './routing.js';
import { hideFloatingPlus } from './editor.js';

/**
 * Download the current diagram model as a local JSON file
 */
export function saveJson() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
        nodes: state.nodes,
        connections: state.connections
    }, null, 2));
    
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", "aperture_wiring_diagram.json");
    dlAnchorElem.click();
}

/**
 * Load a diagram model from a local JSON file
 */
export function loadJson(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const data = JSON.parse(event.target.result);
            if (Array.isArray(data.nodes) && Array.isArray(data.connections)) {
                state.nodes = data.nodes;
                state.connections = data.connections;
                state.selectedNodeIds = [];
                state.selectedConnectionId = null;
                state.shiftSelectedNodeIds = [];
                hideFloatingPlus();
                
                saveStateToLocalStorage();
                renderDiagram();
                updateInspector();
                resizeCanvasIfNeeded();
                alert("Diagram loaded successfully!");
            } else {
                alert("Invalid diagram JSON file structure!");
            }
        } catch(err) {
            alert("Error parsing JSON file!");
        }
    };
    reader.readAsText(file);
    e.target.value = ''; // reset uploader
}

/**
 * Capture elements, crop canvas padding, and download high-res transparent PNG
 */
export function exportPng() {
    if (state.nodes.length === 0) {
        alert("Cannot export an empty canvas!");
        return;
    }
    
    // 1. Calculate boundaries of diagram elements plus padding
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    
    state.nodes.forEach(n => {
        if (n.x < minX) minX = n.x;
        if (n.y < minY) minY = n.y;
        if (n.x + n.w > maxX) maxX = n.x + n.w;
        const actualH = n.type === 'image' ? n.h + 50 : n.h;
        if (n.y + actualH > maxY) maxY = n.y + actualH;
    });
    
    state.connections.forEach(conn => {
        const nodeA = state.nodes.find(n => n.id === conn.fromId);
        const nodeB = state.nodes.find(n => n.id === conn.toId);
        if (nodeA && nodeB) {
            const points = calculatePathPoints(nodeA, nodeB, conn);
            points.forEach(pt => {
                if (pt.x < minX) minX = pt.x;
                if (pt.y < minY) minY = pt.y;
                if (pt.x > maxX) maxX = pt.x;
                if (pt.y > maxY) maxY = pt.y;
            });
        }
    });
    
    const padding = 40;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;
    
    const cropW = maxX - minX;
    const cropH = maxY - minY;
    
    // 2. Clone the SVG element
    const clone = dom.svg.cloneNode(true);
    
    clone.setAttribute('width', cropW);
    clone.setAttribute('height', cropH);
    clone.setAttribute('viewBox', `${minX} ${minY} ${cropW} ${cropH}`);
    
    // 3. Remove non-export items (Grid patterns, selection outline classes)
    const clonedGrid = clone.querySelector('#canvas-grid');
    if (clonedGrid) clonedGrid.remove();
    
    const clonedViewport = clone.querySelector('#viewport-g');
    if (clonedViewport) {
        clonedViewport.removeAttribute('transform');
    }
    
    clone.querySelectorAll('.svg-node').forEach(node => {
        node.setAttribute('class', 'svg-node');
        const handle = node.querySelector('.resize-handle');
        if (handle) handle.remove();
    });
    clone.querySelectorAll('.svg-connection').forEach(conn => {
        conn.setAttribute('class', 'svg-connection');
    });
    
    // 4. Load cloned SVG XML into off-screen canvas to convert to PNG
    const serializer = new XMLSerializer();
    
    const styleEl = document.createElement('style');
    styleEl.textContent = `
        .node-shape-rect { fill-opacity: 1; }
        .conn-label-bg { fill: #0d121f; rx: 4px; }
        .conn-label-text { fill: #f8fafc; font-size: 11px; font-family: 'Outfit', sans-serif; font-weight: 500; text-anchor: middle; }
        .node-label-editor { color: #f8fafc; font-family: 'Outfit', sans-serif; font-weight: 500; text-align: center; display: flex; align-items: center; justify-content: center; line-height: 1.3; }
        .conn-path { fill: none; }
        .conn-path-bg { fill: none; display: none; }
    `;
    clone.querySelector('defs').appendChild(styleEl);
    
    const updatedSvgString = serializer.serializeToString(clone);
    const svgBlob = new Blob([updatedSvgString], { type: 'image/svg+xml;charset=utf-8' });
    const URL = window.URL || window.webkitURL || window;
    const blobURL = URL.createObjectURL(svgBlob);
    
    const image = new Image();
    image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = cropW;
        canvas.height = cropH;
        const ctx = canvas.getContext('2d');
        
        ctx.clearRect(0, 0, cropW, cropH);
        ctx.drawImage(image, 0, 0);
        
        const pngUrl = canvas.toDataURL('image/png');
        const dlLink = document.createElement('a');
        dlLink.download = 'aperture_wiring_diagram.png';
        dlLink.href = pngUrl;
        dlLink.click();
        
        URL.revokeObjectURL(blobURL);
    };
    image.src = blobURL;
}
