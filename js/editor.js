import { dom } from './dom.js';
import { state, generateId, saveStateToLocalStorage } from './state.js';
import { renderDiagram } from './renderer.js';
import { updateInspector } from './inspector.js';
import { resizeCanvasIfNeeded, getSvgCoords } from './viewport.js';

/**
 * Add a new node to the diagram
 */
export function addNode(type = 'box', imageSrc = null, x = null, y = null) {
    let spawnX, spawnY;
    if (x !== null && y !== null) {
        spawnX = x;
        spawnY = y;
    } else {
        const rect = dom.canvasContainer.getBoundingClientRect();
        spawnX = Math.round(((rect.width / 2) - state.panX) / state.zoom / 20) * 20;
        spawnY = Math.round(((rect.height / 2) - state.panY) / state.zoom / 20) * 20;
    }
    
    const id = generateId();
    const newNode = {
        id: id,
        x: spawnX - (type === 'image' ? 50 : 70),
        y: spawnY - (type === 'image' ? 50 : 40),
        w: type === 'image' ? 100 : 140,
        h: type === 'image' ? 100 : 80,
        label: type === 'image' ? "Image Node" : "New Box",
        fill: type === 'image' ? "#ffffff00" : "#6366f125",
        border: "#6366f1",
        borderThickness: 2,
        fontSize: 14,
        textColor: "#f8fafc",
        type: type,
        imageSrc: imageSrc
    };
    
    state.nodes.push(newNode);
    state.selectedNodeIds = [id];
    state.selectedConnectionId = null;
    state.shiftSelectedNodeIds = [];
    
    saveStateToLocalStorage();
    renderDiagram();
    updateInspector();
    hideFloatingPlus();
    
    resizeCanvasIfNeeded();
}

/**
 * Handle image file upload for a new image node
 */
export function handleImageUploadNode(e) {
    const file = e.target.files[0];
    const clientX = e.target.dataset.clientX ? parseFloat(e.target.dataset.clientX) : null;
    const clientY = e.target.dataset.clientY ? parseFloat(e.target.dataset.clientY) : null;
    
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            if (clientX !== null && clientY !== null) {
                const coords = getSvgCoords(clientX, clientY);
                addNode('image', event.target.result, coords.x, coords.y);
            } else {
                addNode('image', event.target.result);
            }
        };
        reader.readAsDataURL(file);
    }
    e.target.value = ''; // reset uploader value
    delete e.target.dataset.clientX;
    delete e.target.dataset.clientY;
}

/**
 * Delete all selected nodes and cascade-delete connected wires
 */
export function deleteSelectedNodes() {
    if (state.selectedNodeIds.length === 0) return;
    
    // Filter out these nodes
    state.nodes = state.nodes.filter(n => !state.selectedNodeIds.includes(n.id));
    
    // Cascade delete any connections attached to them
    state.connections = state.connections.filter(c => 
        !state.selectedNodeIds.includes(c.fromId) && !state.selectedNodeIds.includes(c.toId)
    );
    
    state.selectedNodeIds = [];
    state.shiftSelectedNodeIds = [];
    hideFloatingPlus();
    
    saveStateToLocalStorage();
    renderDiagram();
    updateInspector();
}

/**
 * Delete selected connection
 */
export function deleteSelectedConnection() {
    if (!state.selectedConnectionId) return;
    
    state.connections = state.connections.filter(c => c.id !== state.selectedConnectionId);
    state.selectedConnectionId = null;
    
    saveStateToLocalStorage();
    renderDiagram();
    updateInspector();
}

/**
 * Toggle node selection for Shift+Click gesture
 */
export function toggleNodeShiftSelection(nodeId) {
    const idx = state.shiftSelectedNodeIds.indexOf(nodeId);
    if (idx !== -1) {
        state.shiftSelectedNodeIds.splice(idx, 1);
    } else {
        if (state.shiftSelectedNodeIds.length >= 2) {
            state.shiftSelectedNodeIds.shift();
        }
        state.shiftSelectedNodeIds.push(nodeId);
    }
    
    renderDiagram();
    
    if (state.shiftSelectedNodeIds.length === 2) {
        showFloatingPlusBetween(state.shiftSelectedNodeIds[0], state.shiftSelectedNodeIds[1]);
    } else {
        hideFloatingPlus();
    }
}

/**
 * Show the floating "+" midpoint button between two nodes
 */
export function showFloatingPlusBetween(nodeId1, nodeId2) {
    const node1 = state.nodes.find(n => n.id === nodeId1);
    const node2 = state.nodes.find(n => n.id === nodeId2);
    if (!node1 || !node2) return;
    
    // Midpoint between their centers in SVG coordinate system
    const midX = ((node1.x + node1.w / 2) + (node2.x + node2.w / 2)) / 2;
    const midY = ((node1.y + node1.h / 2) + (node2.y + node2.h / 2)) / 2;
    
    // Position floating overlay element
    const containerX = midX * state.zoom + state.panX;
    const containerY = midY * state.zoom + state.panY;
    
    dom.floatingConnectBtn.style.left = `${containerX}px`;
    dom.floatingConnectBtn.style.top = `${containerY}px`;
    dom.floatingConnectBtn.style.display = 'flex';
}

/**
 * Hide the floating "+" midpoint button
 */
export function hideFloatingPlus() {
    if (dom.floatingConnectBtn) {
        dom.floatingConnectBtn.style.display = 'none';
    }
}

/**
 * Create connection between the shift-selected nodes
 */
export function createConnectionFromGesture() {
    if (state.shiftSelectedNodeIds.length !== 2) return;
    
    const [fromId, toId] = state.shiftSelectedNodeIds;
    
    const newConnId = generateId();
    const newConn = {
        id: newConnId,
        fromId: fromId,
        toId: toId,
        label: "",
        color: "#6366f1",
        thickness: 2,
        arrowStart: "none",
        arrowEnd: "arrow",
        routing: "orthogonal",
        radius: 12
    };
    
    state.connections.push(newConn);
    state.selectedNodeIds = [];
    state.selectedConnectionId = newConnId;
    state.shiftSelectedNodeIds = []; // clear selection
    
    hideFloatingPlus();
    saveStateToLocalStorage();
    renderDiagram();
    updateInspector();
}

/**
 * Open inline double-click textarea to directly edit node or wire labels
 */
export function openInlineTextEditor(elementId, type, clientX, clientY, currentText) {
    const prevEditor = document.querySelector('.text-editor-input');
    if (prevEditor) prevEditor.remove();
    
    const editor = document.createElement('textarea');
    editor.className = 'text-editor-input';
    editor.value = currentText;
    editor.rows = 2;
    
    const rect = dom.canvasContainer.getBoundingClientRect();
    const top = clientY - rect.top - 20;
    const left = clientX - rect.left - 70;
    
    editor.style.top = `${top}px`;
    editor.style.left = `${left}px`;
    editor.style.width = '140px';
    
    dom.canvasContainer.appendChild(editor);
    editor.focus();
    editor.select();
    
    let isSaving = false;
    const saveChanges = () => {
        if (isSaving) return;
        isSaving = true;
        
        const text = editor.value.trim();
        if (type === 'node') {
            const node = state.nodes.find(n => n.id === elementId);
            if (node) node.label = text;
        } else if (type === 'connection') {
            const conn = state.connections.find(c => c.id === elementId);
            if (conn) conn.label = text;
        }
        
        saveStateToLocalStorage();
        renderDiagram();
        updateInspector();
        editor.remove();
    };
    
    editor.addEventListener('blur', saveChanges);
    editor.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            saveChanges();
        }
        if (e.key === 'Escape') {
            isSaving = true; // prevent blur from saving
            editor.remove();
        }
    });
}

/**
 * Copy currently selected nodes to the state clipboard
 */
export function copySelectedNodes() {
    if (state.selectedNodeIds.length === 0) return;
    
    // Deep clone the selected nodes (exclude connections)
    const cloned = state.selectedNodeIds.map(id => {
        const node = state.nodes.find(n => n.id === id);
        if (node) {
            return JSON.parse(JSON.stringify(node));
        }
        return null;
    }).filter(Boolean);
    
    if (cloned.length > 0) {
        state.clipboard = cloned;
    }
}

/**
 * Paste copied nodes from the state clipboard
 */
export function pasteNodes(clientX = null, clientY = null) {
    if (!state.clipboard || state.clipboard.length === 0) return;
    
    const newIds = [];
    
    // Determine positioning offset
    let offsetX = 40;
    let offsetY = 40;
    
    if (clientX !== null && clientY !== null) {
        // Paste centered at mouse cursor coordinates
        const coords = getSvgCoords(clientX, clientY);
        
        // Find top-left bound of clipboard nodes to calculate relative offset
        let minCX = Infinity;
        let minCY = Infinity;
        state.clipboard.forEach(n => {
            if (n.x < minCX) minCX = n.x;
            if (n.y < minCY) minCY = n.y;
        });
        
        // Offset each pasted node relative to mouse coordinates
        state.clipboard.forEach(n => {
            const newId = generateId();
            newIds.push(newId);
            
            const dx = n.x - minCX;
            const dy = n.y - minCY;
            
            let targetX = coords.x + dx - n.w / 2;
            let targetY = coords.y + dy - n.h / 2;
            
            if (state.isSnapEnabled) {
                targetX = Math.round(targetX / state.gridSize) * state.gridSize;
                targetY = Math.round(targetY / state.gridSize) * state.gridSize;
            }
            
            const pastedNode = {
                ...JSON.parse(JSON.stringify(n)),
                id: newId,
                x: targetX,
                y: targetY
            };
            
            state.nodes.push(pastedNode);
        });
    } else {
        // Standard keyboard paste with simple diagonal shift
        state.clipboard.forEach(n => {
            const newId = generateId();
            newIds.push(newId);
            
            let targetX = n.x + offsetX;
            let targetY = n.y + offsetY;
            
            if (state.isSnapEnabled) {
                targetX = Math.round(targetX / state.gridSize) * state.gridSize;
                targetY = Math.round(targetY / state.gridSize) * state.gridSize;
            }
            
            const pastedNode = {
                ...JSON.parse(JSON.stringify(n)),
                id: newId,
                x: targetX,
                y: targetY
            };
            
            state.nodes.push(pastedNode);
        });
    }
    
    // Select the newly pasted elements
    state.selectedNodeIds = newIds;
    state.selectedConnectionId = null;
    state.shiftSelectedNodeIds = [];
    hideFloatingPlus();
    
    saveStateToLocalStorage();
    renderDiagram();
    updateInspector();
    resizeCanvasIfNeeded();
}

