import { dom } from './dom.js';
import { state, saveStateToLocalStorage, getRootNodesAndConnections } from './state.js';
import { renderDiagram } from './renderer.js';
import { updateInspector } from './inspector.js';
import { resizeCanvasIfNeeded } from './viewport.js';
import { calculatePathPoints } from './routing.js';
import { hideFloatingPlus } from './editor.js';

/**
 * Download the current diagram model as a local JSON file
 */
export function saveJson() {
    const root = getRootNodesAndConnections();
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
        nodes: root.nodes,
        connections: root.connections
    }, null, 2));
    
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", "aperture_wiring_diagram.json");
    dlAnchorElem.click();
}

/**
 * Recursively validates a hierarchical diagram tree structure.
 * Prevents loops, duplicate node IDs, and infinite recursion (max depth 5).
 */
export function validateDiagramTree(level, seenNodeIds = new Set(), depth = 0) {
    if (depth > 5) {
        throw new Error("Maximum diagram nesting depth (5) exceeded.");
    }
    if (!level || typeof level !== 'object') {
        throw new Error("Invalid level structure: must be an object.");
    }
    if (!Array.isArray(level.nodes) || !Array.isArray(level.connections)) {
        throw new Error("Invalid diagram structure: nodes and connections must be arrays.");
    }
    
    // Validate each node
    level.nodes.forEach(node => {
        if (!node.id || typeof node.id !== 'string') {
            throw new Error("Node missing valid string ID.");
        }
        if (seenNodeIds.has(node.id)) {
            throw new Error(`Duplicate Node ID detected: ${node.id}. IDs must be unique across all levels.`);
        }
        seenNodeIds.add(node.id);
        
        if (typeof node.x !== 'number' || typeof node.y !== 'number' ||
            typeof node.w !== 'number' || typeof node.h !== 'number') {
            throw new Error(`Node ${node.id} has invalid dimensions or coordinates.`);
        }
        
        if (node.childDiagram) {
            validateDiagramTree(node.childDiagram, seenNodeIds, depth + 1);
        }
    });
    
    // Validate each connection
    level.connections.forEach(conn => {
        if (!conn.id || typeof conn.id !== 'string') {
            throw new Error("Connection missing valid string ID.");
        }
        if (!conn.fromId || typeof conn.fromId !== 'string' ||
            !conn.toId || typeof conn.toId !== 'string') {
            throw new Error("Connection missing fromId or toId string identifiers.");
        }
    });
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
            validateDiagramTree(data);
            
            // Reinitialize navigation state since we are loading a new root level
            state.nodes = data.nodes;
            state.connections = data.connections;
            state.currentParentNodeId = null;
            state.navigationStack = [];
            state.selectedNodeIds = [];
            state.selectedConnectionId = null;
            state.shiftSelectedNodeIds = [];
            
            // Hide breadcrumbs bar since we're back at root
            const breadcrumbs = document.getElementById('diagram-breadcrumbs');
            if (breadcrumbs) {
                breadcrumbs.style.display = 'none';
                breadcrumbs.innerHTML = '';
            }
            
            hideFloatingPlus();
            saveStateToLocalStorage();
            renderDiagram();
            updateInspector();
            resizeCanvasIfNeeded();
            alert("Diagram loaded and validated successfully!");
        } catch(err) {
            console.error("JSON diagram load validation failed:", err);
            alert("Invalid diagram file: " + err.message);
        }
    };
    reader.readAsText(file);
    e.target.value = ''; // reset uploader
}

/**
 * Capture elements, crop canvas padding, and download high-res transparent PNG
 */
export function exportPng() {
    try {
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
            let nodeMinX = n.x;
            let nodeMaxX = n.x + n.w;
            let nodeMinY = n.y;
            let nodeMaxY = n.y + (n.type === 'image' ? n.h + 50 : n.h);
            
            if (n.type === 'port') {
                const textLength = (n.label || '').length;
                const charWidth = (n.fontSize || 10) * 0.65; // ~6.5px per char for 10px font size
                const estimatedTextWidth = textLength * charWidth;
                const estimatedTextHeight = (n.fontSize || 10) * 1.2;
                
                if (n.side === 'L') {
                    nodeMinX = n.x - 12 - estimatedTextWidth;
                    nodeMinY = n.y - estimatedTextHeight / 2;
                    nodeMaxY = n.y + estimatedTextHeight / 2;
                } else if (n.side === 'R') {
                    nodeMaxX = n.x + 12 + estimatedTextWidth;
                    nodeMinY = n.y - estimatedTextHeight / 2;
                    nodeMaxY = n.y + estimatedTextHeight / 2;
                } else if (n.side === 'T') {
                    nodeMinX = n.x - estimatedTextWidth / 2;
                    nodeMaxX = n.x + estimatedTextWidth / 2;
                    nodeMinY = n.y - 12 - estimatedTextHeight;
                } else if (n.side === 'B') {
                    nodeMinX = n.x - estimatedTextWidth / 2;
                    nodeMaxX = n.x + estimatedTextWidth / 2;
                    nodeMaxY = n.y + 20 + estimatedTextHeight;
                }
            }
            
            if (nodeMinX < minX) minX = nodeMinX;
            if (nodeMinY < minY) minY = nodeMinY;
            if (nodeMaxX > maxX) maxX = nodeMaxX;
            if (nodeMaxY > maxY) maxY = nodeMaxY;
        });
        
        state.connections.forEach(conn => {
            const nodeA = state.nodes.find(n => n.id === conn.fromId);
            const nodeB = state.nodes.find(n => n.id === conn.toId);
            if (nodeA && nodeB) {
                const points = calculatePathPoints(nodeA, nodeB, conn);
                if (points) {
                    points.forEach((pt, index) => {
                        // Determine layout boundary extension based on thickness and markers
                        let ext = conn.thickness / 2;
                        
                        if (index === 0) {
                            if (conn.arrowStart === 'arrow') {
                                ext = Math.max(ext, 10 * conn.thickness);
                            } else if (conn.arrowStart === 'circle') {
                                ext = Math.max(ext, 8 * conn.thickness);
                            }
                        } else if (index === points.length - 1) {
                            if (conn.arrowEnd === 'arrow') {
                                ext = Math.max(ext, 10 * conn.thickness);
                            } else if (conn.arrowEnd === 'circle') {
                                ext = Math.max(ext, 8 * conn.thickness);
                            }
                        }
                        
                        if (pt.x - ext < minX) minX = pt.x - ext;
                        if (pt.y - ext < minY) minY = pt.y - ext;
                        if (pt.x + ext > maxX) maxX = pt.x + ext;
                        if (pt.y + ext > maxY) maxY = pt.y + ext;
                    });
                }
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
        clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
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
        
        // Resolve relative image URLs to absolute URLs to prevent loading failures in Blob context
        clone.querySelectorAll('image').forEach(img => {
            const href = img.getAttribute('href');
            if (href && !href.startsWith('data:') && !href.startsWith('http:') && !href.startsWith('https:')) {
                const absoluteUrl = new URL(href, window.location.href).href;
                img.setAttribute('href', absoluteUrl);
            }
        });
        
        // Replace foreignObject label wrappers with native SVG <text> nodes to prevent canvas tainting in Chrome/Firefox
        clone.querySelectorAll('.node-label-foreign').forEach(foreign => {
            const span = foreign.querySelector('.label-text-span');
            const textContent = span ? span.textContent : "";
            const parent = foreign.parentNode;
            const nodeId = parent.id;
            const node = state.nodes.find(n => n.id === nodeId);
            
            if (node) {
                const textEl = document.createElementNS("http://www.w3.org/2000/svg", "text");
                textEl.setAttribute("class", "node-label-svg-text");
                
                const ox = node.labelOffsetX || 0;
                const oy = node.labelOffsetY || 0;
                const textX = node.w / 2 + ox;
                const textY = node.type === "image" ? (node.h + 20 + oy) : (node.h / 2 + 5 + oy);
                
                textEl.setAttribute("x", textX);
                textEl.setAttribute("y", textY);
                textEl.setAttribute("fill", node.textColor);
                textEl.setAttribute("font-size", node.fontSize);
                textEl.setAttribute("font-family", "'Outfit', sans-serif");
                textEl.setAttribute("font-weight", "500");
                textEl.setAttribute("text-anchor", "middle");
                
                const words = textContent.split(" ");
                if (words.length <= 1 || textContent.length < 15) {
                    textEl.textContent = textContent;
                } else {
                    const midPoint = Math.ceil(words.length / 2);
                    const line1 = words.slice(0, midPoint).join(" ");
                    const line2 = words.slice(midPoint).join(" ");
                    
                    const tspan1 = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
                    tspan1.setAttribute("x", textX);
                    tspan1.setAttribute("dy", "-0.6em");
                    tspan1.textContent = line1;
                    
                    const tspan2 = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
                    tspan2.setAttribute("x", textX);
                    tspan2.setAttribute("dy", "1.2em");
                    tspan2.textContent = line2;
                    
                    textEl.appendChild(tspan1);
                    textEl.appendChild(tspan2);
                }
                
                parent.replaceChild(textEl, foreign);
            }
        });
        
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
        
        const styleEl = document.createElementNS("http://www.w3.org/2000/svg", "style");
        styleEl.textContent = `
            .node-shape-rect { fill-opacity: 1; }
            .conn-label-bg { fill: #0d121f; rx: 4px; }
            .conn-label-text { fill: #f8fafc; font-size: 11px; font-family: 'Outfit', sans-serif; font-weight: 500; text-anchor: middle; }
            .node-label-editor { color: #f8fafc; font-family: 'Outfit', sans-serif; font-weight: 500; text-align: center; display: flex; align-items: center; justify-content: center; line-height: 1.3; }
            .conn-path { fill: none; }
            .conn-path-bg { fill: none; display: none; }
        `;
        const defs = clone.querySelector('defs');
        if (defs) {
            defs.appendChild(styleEl);
        }
        
        const updatedSvgString = serializer.serializeToString(clone);
        const svgBlob = new Blob([updatedSvgString], { type: 'image/svg+xml;charset=utf-8' });
        const URL = window.URL || window.webkitURL || window;
        const blobURL = URL.createObjectURL(svgBlob);
        
        const image = new Image();
        image.onload = () => {
            try {
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
            } catch (err) {
                console.error("Canvas to PNG generation failed:", err);
                alert("PNG generation failed: " + err.message);
            } finally {
                URL.revokeObjectURL(blobURL);
            }
        };
        image.onerror = (err) => {
            console.error("SVG Image rendering failed:", err);
            alert("Export failed: The browser blocked or failed rendering the SVG to a canvas image. Make sure no external references or untrusted image assets are present on your shapes.");
            URL.revokeObjectURL(blobURL);
        };
        image.src = blobURL;
    } catch (err) {
        console.error("Export process failed:", err);
        alert("Export failed: " + err.message);
    }
}
