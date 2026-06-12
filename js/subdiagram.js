import { state, saveStateToLocalStorage } from './state.js';
import { renderDiagram } from './renderer.js';
import { updateInspector } from './inspector.js';
import { resizeCanvasIfNeeded, centerViewport } from './viewport.js';
import { getGlobalPortAssignments } from './routing.js';
import { hideFloatingPlus } from './editor.js';

/**
 * Calculates the bounding box of the sub-diagram workspace container (floating enclosing box).
 * Starts at 400x400, caps at 1200x1200px, and maintains a 100px (5 grid tiles) margin from all internal nodes.
 */
export function getSubDiagramBounds() {
    const centerX = 1500;
    const centerY = 1500;
    
    // Filter out port boundary nodes
    const internalNodes = state.nodes.filter(n => n.type !== 'port');
    if (internalNodes.length === 0) {
        return { x: centerX - 200, y: centerY - 200, w: 400, h: 400 };
    }
    
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    
    internalNodes.forEach(n => {
        if (n.x < minX) minX = n.x;
        if (n.y < minY) minY = n.y;
        if (n.x + n.w > maxX) maxX = n.x + n.w;
        if (n.y + n.h > maxY) maxY = n.y + n.h;
    });
    
    const margin = 100; // 5 grid tiles * 20px
    const reqMinX = minX - margin;
    const reqMaxX = maxX + margin;
    const reqMinY = minY - margin;
    const reqMaxY = maxY + margin;
    
    const reqW = reqMaxX - reqMinX;
    const reqH = reqMaxY - reqMinY;
    
    const w = Math.min(1200, Math.max(400, reqW));
    const h = Math.min(1200, Math.max(400, reqH));
    
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;
    
    // Snap to grid coordinates for visual neatness
    return {
        x: Math.round((midX - w / 2) / 20) * 20,
        y: Math.round((midY - h / 2) / 20) * 20,
        w: Math.round(w / 20) * 20,
        h: Math.round(h / 20) * 20
    };
}

/**
 * Automatically maps and synchronizes the active parent node's external connections
 * as non-draggable boundary port nodes docked directly to the workspace bounding box.
 */
export function syncBoundaryPorts() {
    if (state.navigationStack.length === 0) return;
    
    const parentLevel = state.navigationStack[state.navigationStack.length - 1];
    const parentId = state.currentParentNodeId;
    const parentNode = parentLevel.nodes.find(n => n.id === parentId);
    if (!parentNode) return;
    
    // Find all external connections pointing to/from parent node in outer level
    const extConns = parentLevel.connections.filter(c => c.fromId === parentId || c.toId === parentId);
    
    // Swap state temporarily to run getGlobalPortAssignments on parent level data
    const activeNodes = state.nodes;
    const activeConns = state.connections;
    state.nodes = parentLevel.nodes;
    state.connections = parentLevel.connections;
    
    const parentAssignments = getGlobalPortAssignments();
    
    // Swap state back immediately
    state.nodes = activeNodes;
    state.connections = activeConns;
    
    const portsBySide = { T: [], B: [], L: [], R: [] };
    
    extConns.forEach(c => {
        const ass = parentAssignments[c.id];
        if (!ass) return;
        
        const isFromParent = c.fromId === parentId;
        const side = isFromParent ? ass.sideA : ass.sideB;
        const direction = isFromParent ? 'out' : 'in';
        
        const targetId = isFromParent ? c.toId : c.fromId;
        const targetNode = parentLevel.nodes.find(n => n.id === targetId);
        const targetLabel = targetNode ? targetNode.label : "External";
        
        const dirLabel = direction === 'out' ? "→" : "←";
        const label = c.label ? `${dirLabel} ${c.label} (${targetLabel})` : `${dirLabel} ${targetLabel}`;
        
        portsBySide[side].push({
            connId: c.id,
            label: label,
            direction: direction,
            side: side
        });
    });
    
    const bounds = getSubDiagramBounds();
    const activePortIds = new Set();
    
    // Distribute port nodes along each side boundary
    const sides = ['T', 'B', 'L', 'R'];
    sides.forEach(s => {
        const ports = portsBySide[s].sort((a, b) => a.connId.localeCompare(b.connId));
        const k = ports.length;
        if (k === 0) return;
        
        const L = (s === 'T' || s === 'B') ? bounds.w : bounds.h;
        
        ports.forEach((port, idx) => {
            const portId = `port_${port.connId}`;
            activePortIds.add(portId);
            
            let calculatedX = bounds.x;
            let calculatedY = bounds.y;
            
            if (s === 'L' || s === 'R') {
                calculatedX = s === 'L' ? bounds.x : bounds.x + bounds.w;
                if (k === 1) {
                    calculatedY = bounds.y + bounds.h / 2;
                } else {
                    const spacing = (bounds.h - 80) / (k - 1);
                    calculatedY = bounds.y + 40 + idx * spacing;
                }
            } else {
                calculatedY = s === 'T' ? bounds.y : bounds.y + bounds.h;
                if (k === 1) {
                    calculatedX = bounds.x + bounds.w / 2;
                } else {
                    const spacing = (bounds.w - 80) / (k - 1);
                    calculatedX = bounds.x + 40 + idx * spacing;
                }
            }
            
            // Look for existing port node in active diagram list
            let portNode = state.nodes.find(n => n.id === portId);
            if (portNode) {
                // Update position and label dynamically
                portNode.x = Math.round(calculatedX);
                portNode.y = Math.round(calculatedY);
                portNode.label = port.label;
                portNode.side = port.side;
                portNode.direction = port.direction;
            } else {
                // Create new port representation
                portNode = {
                    id: portId,
                    type: 'port',
                    x: Math.round(calculatedX),
                    y: Math.round(calculatedY),
                    w: 12,
                    h: 12,
                    label: port.label,
                    side: port.side,
                    direction: port.direction,
                    textColor: "#f8fafc",
                    fontSize: 10
                };
                state.nodes.push(portNode);
            }
        });
    });
    
    // Purge any stale ports and clean up orphaned connections
    state.nodes = state.nodes.filter(n => {
        if (n.type === 'port') {
            const keep = activePortIds.has(n.id);
            if (!keep) {
                state.connections = state.connections.filter(c => c.fromId !== n.id && c.toId !== n.id);
            }
            return keep;
        }
        return true;
    });
}

/**
 * Step inside a node's nested diagram workspace
 */
export function enterNodeDiagram(nodeId) {
    const node = state.nodes.find(n => n.id === nodeId);
    if (!node || node.type === 'port') return;
    
    // Check nesting depth limits (max 5)
    if (state.navigationStack.length >= 5) {
        alert("Maximum nested diagram depth reached! (Limit is 5 levels)");
        return;
    }
    
    // Save current active state before entering
    if (!node.childDiagram) {
        node.childDiagram = { nodes: [], connections: [] };
    }
    
    state.navigationStack.push({
        parentId: state.currentParentNodeId,
        nodes: [...state.nodes],
        connections: [...state.connections]
    });
    
    state.nodes = node.childDiagram.nodes;
    state.connections = node.childDiagram.connections;
    state.currentParentNodeId = node.id;
    
    state.selectedNodeIds = [];
    state.selectedConnectionId = null;
    state.shiftSelectedNodeIds = [];
    
    syncBoundaryPorts();
    saveStateToLocalStorage();
    updateBreadcrumbs();
    renderDiagram();
    updateInspector();
    centerViewport();
    resizeCanvasIfNeeded();
}

/**
 * Step back up to the parent diagram workspace
 */
export function exitToParentDiagram() {
    if (state.navigationStack.length === 0) return;
    
    const parentLevel = state.navigationStack[state.navigationStack.length - 1];
    const parentNode = parentLevel.nodes.find(n => n.id === state.currentParentNodeId);
    if (parentNode) {
        // Save current child diagrams back into parent node
        parentNode.childDiagram = {
            nodes: [...state.nodes],
            connections: [...state.connections]
        };
    }
    
    const prevLevel = state.navigationStack.pop();
    state.nodes = prevLevel.nodes;
    state.connections = prevLevel.connections;
    state.currentParentNodeId = prevLevel.parentId;
    
    state.selectedNodeIds = [];
    state.selectedConnectionId = null;
    state.shiftSelectedNodeIds = [];
    
    saveStateToLocalStorage();
    updateBreadcrumbs();
    renderDiagram();
    updateInspector();
    centerViewport();
    resizeCanvasIfNeeded();
}

/**
 * Re-render breadcrumbs navigation elements based on current navigationStack state
 */
export function updateBreadcrumbs() {
    const breadcrumbs = document.getElementById('diagram-breadcrumbs');
    if (!breadcrumbs) return;
    
    if (state.currentParentNodeId === null) {
        breadcrumbs.style.display = 'none';
        breadcrumbs.innerHTML = '';
        return;
    }
    
    breadcrumbs.style.display = 'flex';
    let html = `<a id="breadcrumb-home">Home</a>`;
    
    for (let i = 1; i < state.navigationStack.length; i++) {
        const level = state.navigationStack[i];
        const outerLevel = state.navigationStack[i - 1];
        const parentNode = outerLevel.nodes.find(n => n.id === level.parentId);
        const label = parentNode ? parentNode.label : "Sub-Diagram";
        
        html += ` <span class="separator">/</span> <a class="breadcrumb-level" data-stack-idx="${i}">${label}</a>`;
    }
    
    const parentLevel = state.navigationStack[state.navigationStack.length - 1];
    const parentNode = parentLevel.nodes.find(n => n.id === state.currentParentNodeId);
    const label = parentNode ? parentNode.label : "Sub-Diagram";
    html += ` <span class="separator">/</span> <span class="current">${label}</span>`;
    
    breadcrumbs.innerHTML = html;
    
    // Attach event listeners
    const homeBtn = document.getElementById('breadcrumb-home');
    if (homeBtn) {
        homeBtn.addEventListener('click', () => {
            while (state.navigationStack.length > 0) {
                exitToParentDiagram();
            }
        });
    }
    
    breadcrumbs.querySelectorAll('.breadcrumb-level').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.target.getAttribute('data-stack-idx'));
            while (state.navigationStack.length > idx) {
                exitToParentDiagram();
            }
        });
    });
}
