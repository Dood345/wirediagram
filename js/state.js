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
    lastClickTime: 0
};

/**
 * Save current state to local storage
 */
export function saveStateToLocalStorage() {
    localStorage.setItem('aperture_diagrammer_state', JSON.stringify({
        nodes: state.nodes,
        connections: state.connections
    }));
}

/**
 * Generate a unique ID string
 */
export function generateId() {
    return 'id_' + Math.random().toString(36).substr(2, 9);
}
