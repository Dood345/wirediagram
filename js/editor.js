import { dom } from './dom.js';
import { state, generateId, saveStateToLocalStorage } from './state.js';
import { renderDiagram } from './renderer.js';
import { updateInspector } from './inspector.js';
import { resizeCanvasIfNeeded } from './viewport.js';

/**
 * Add a new node to the diagram
 */
export function addNode(type = 'box', imageSrc = null) {
    // Determine spawn coordinate based on current pan center
    const rect = dom.canvasContainer.getBoundingClientRect();
    const spawnX = Math.round(((rect.width / 2) - state.panX) / state.zoom / 20) * 20;
    const spawnY = Math.round(((rect.height / 2) - state.panY) / state.zoom / 20) * 20;
    
    const id = generateId();
    const newNode = {
        id: id,
        x: spawnX - 70,
        y: spawnY - 40,
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
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            addNode('image', event.target.result);
        };
        reader.readAsDataURL(file);
    }
    e.target.value = ''; // reset uploader value
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
    
    // Check if duplicate connection exists
    const exists = state.connections.some(c => 
        (c.fromId === fromId && c.toId === toId) || (c.fromId === toId && c.toId === fromId)
    );
    
    if (exists) {
        alert("A wire connection already exists between these two components!");
        state.shiftSelectedNodeIds = [];
        hideFloatingPlus();
        renderDiagram();
        return;
    }
    
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
