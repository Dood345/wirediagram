import { GRID_SIZE } from './config.js';

export const state = {
    nodes: [],
    connections: [],
    selectedNodeIds: [],
    selectedConnectionId: null,
    shiftSelectedNodeIds: [], // Used for connections gesture
    zoom: 1.0,
    panX: 0,
    panY: 0,
    isPanning: false,
    panStart: { x: 0, y: 0 },
    dragMode: null, // 'drag', 'resize', 'pan', 'drag-label', 'drag-conn-label'
    draggedNodeId: null,
    draggedConnId: null,
    dragOffset: { x: 0, y: 0 },
    dragStartCoords: { x: 0, y: 0 },
    hasDragged: false,
    resizeStartDims: { w: 0, h: 0 },
    resizeStartPos: { x: 0, y: 0 },
    labelDragStartOffset: { x: 0, y: 0 },
    isSnapEnabled: true,
    isGridVisible: true,
    gridSize: GRID_SIZE,
    
    // Manual double-click detection helpers
    lastClickedNodeId: null,
    lastClickedConnId: null,
    lastClickTime: 0,
    
    // Clipboard for copy/paste actions
    clipboard: null,
    
    // Tesseract / nested diagram tracking
    currentParentNodeId: null,
    navigationStack: []
};

/**
 * Traverses back up the navigation stack, merging the active nested state
 * recursively into the full root diagram tree structure.
 */
export function getRootNodesAndConnections() {
    let currentNodes = [...state.nodes];
    let currentConns = [...state.connections];
    let currentParentId = state.currentParentNodeId;
    
    for (let i = state.navigationStack.length - 1; i >= 0; i--) {
        const level = state.navigationStack[i];
        
        // Find the parent node in the outer level's nodes list
        const parentNode = level.nodes.find(n => n.id === currentParentId);
        if (parentNode) {
            parentNode.childDiagram = {
                nodes: currentNodes,
                connections: currentConns
            };
        }
        
        currentNodes = [...level.nodes];
        currentConns = [...level.connections];
        currentParentId = level.parentId;
    }
    
    return { nodes: currentNodes, connections: currentConns };
}

/**
 * Save current state to local storage
 */
export function saveStateToLocalStorage() {
    const root = getRootNodesAndConnections();
    localStorage.setItem('aperture_diagrammer_state', JSON.stringify({
        nodes: root.nodes,
        connections: root.connections
    }));
}

/**
 * Generate a unique ID string
 */
export function generateId() {
    return 'id_' + Math.random().toString(36).substr(2, 9);
}
