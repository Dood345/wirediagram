import { dom } from '../dom.js';
import { state, saveStateToLocalStorage } from '../state.js';
import { renderDiagram, updateNodeSvgElement, updateNodeConnections } from '../renderer.js';
import { updateInspector } from '../inspector.js';
import { getSvgCoords, resizeCanvasIfNeeded } from '../viewport.js';
import { calculatePathPoints, getPathCenter } from '../routing.js';
import { toggleNodeShiftSelection, hideFloatingPlus, openInlineTextEditor } from '../editor.js';
import { enterNodeDiagram, syncBoundaryPorts, getSubDiagramBounds } from '../subdiagram.js';

export function startNodeDrag(nodeId, e) {
    e.stopPropagation();
    
    const node = state.nodes.find(n => n.id === nodeId);
    if (!node) return;
    
    if (e.shiftKey) {
        toggleNodeShiftSelection(nodeId);
        return;
    }
    
    if (node.type === 'port') {
        const now = Date.now();
        if (state.lastClickedNodeId === nodeId && (now - (state.lastClickTime || 0)) < 300) {
            state.lastClickTime = 0;
            state.lastClickedNodeId = null;
            
            state.selectedNodeIds = [nodeId];
            state.selectedConnectionId = null;
            state.shiftSelectedNodeIds = [];
            hideFloatingPlus();
            updateInspector();
            renderDiagram();
            
            const connId = nodeId.replace('port_', '');
            const parentLevel = state.navigationStack[state.navigationStack.length - 1];
            const conn = parentLevel ? parentLevel.connections.find(c => c.id === connId) : null;
            const currentText = conn ? (conn.label || "") : "";
            openInlineTextEditor(nodeId, 'port', e.clientX, e.clientY, currentText);
            e.preventDefault();
            return;
        }
        state.lastClickTime = now;
        state.lastClickedNodeId = nodeId;
        state.lastClickedConnId = null;
        
        state.selectedNodeIds = [nodeId];
        state.selectedConnectionId = null;
        state.shiftSelectedNodeIds = [];
        hideFloatingPlus();
        
        updateInspector();
        renderDiagram();
        return;
    }
    
    const now = Date.now();
    if (state.lastClickedNodeId === nodeId && (now - (state.lastClickTime || 0)) < 300) {
        state.lastClickTime = 0;
        state.lastClickedNodeId = null;
        
        enterNodeDiagram(nodeId);
        e.preventDefault();
        return;
    }
    state.lastClickTime = now;
    state.lastClickedNodeId = nodeId;
    state.lastClickedConnId = null;
    
    state.selectedNodeIds = [nodeId];
    state.selectedConnectionId = null;
    state.shiftSelectedNodeIds = [];
    hideFloatingPlus();
    
    updateInspector();
    renderDiagram();
    
    state.draggedNodeId = nodeId;
    state.dragMode = 'drag';
    
    const coords = getSvgCoords(e.clientX, e.clientY);
    state.dragOffset = {
        x: coords.x - node.x,
        y: coords.y - node.y
    };
    state.dragStartCoords = { x: coords.x, y: coords.y };
    state.hasDragged = false;
    
    window.addEventListener('mousemove', handleNodeDragMove);
    window.addEventListener('mouseup', handleNodeDragUp);
}

export function handleNodeDragMove(e) {
    if (!state.draggedNodeId) return;
    const node = state.nodes.find(n => n.id === state.draggedNodeId);
    if (!node) return;
    
    const coords = getSvgCoords(e.clientX, e.clientY);
    
    if (!state.hasDragged) {
        const dist = Math.hypot(coords.x - state.dragStartCoords.x, coords.y - state.dragStartCoords.y);
        if (dist < 4) return;
        state.hasDragged = true;
    }
    
    let newX = coords.x - state.dragOffset.x;
    let newY = coords.y - state.dragOffset.y;
    
    if (state.isSnapEnabled) {
        newX = Math.round(newX / state.gridSize) * state.gridSize;
        newY = Math.round(newY / state.gridSize) * state.gridSize;
    }
    
    node.x = newX;
    node.y = newY;
    
    updateNodeSvgElement(node);
    updateNodeConnections(node.id);
    
    if (state.currentParentNodeId !== null) {
        syncBoundaryPorts();
        const bounds = getSubDiagramBounds();
        const frame = document.querySelector('.subdiagram-frame');
        if (frame) {
            frame.setAttribute('x', bounds.x);
            frame.setAttribute('y', bounds.y);
            frame.setAttribute('width', bounds.w);
            frame.setAttribute('height', bounds.h);
        }
        const title = document.querySelector('.subdiagram-frame-title');
        if (title) {
            title.setAttribute('x', bounds.x + 10);
            title.setAttribute('y', bounds.y - 12);
        }
        state.nodes.forEach(n => {
            if (n.type === 'port') {
                updateNodeSvgElement(n);
                updateNodeConnections(n.id);
            }
        });
    }
    
    if (state.selectedNodeIds.includes(node.id)) {
        document.getElementById('node-width').value = node.w;
        document.getElementById('node-height').value = node.h;
    }
}

export function handleNodeDragUp() {
    state.draggedNodeId = null;
    state.dragMode = null;
    window.removeEventListener('mousemove', handleNodeDragMove);
    window.removeEventListener('mouseup', handleNodeDragUp);
    
    saveStateToLocalStorage();
    resizeCanvasIfNeeded();
}

export function startNodeResize(nodeId, e) {
    e.stopPropagation();
    e.preventDefault();
    
    const node = state.nodes.find(n => n.id === nodeId);
    if (!node || node.type === 'port') return;
    
    state.selectedNodeIds = [nodeId];
    state.selectedConnectionId = null;
    state.shiftSelectedNodeIds = [];
    hideFloatingPlus();
    updateInspector();
    renderDiagram();
    
    state.draggedNodeId = nodeId;
    state.dragMode = 'resize';
    
    state.resizeStartDims = { w: node.w, h: node.h };
    
    const coords = getSvgCoords(e.clientX, e.clientY);
    state.resizeStartPos = { x: coords.x, y: coords.y };
    
    window.addEventListener('mousemove', handleNodeResizeMove);
    window.addEventListener('mouseup', handleNodeResizeUp);
}

export function handleNodeResizeMove(e) {
    if (state.dragMode !== 'resize' || !state.draggedNodeId) return;
    const node = state.nodes.find(n => n.id === state.draggedNodeId);
    if (!node) return;
    
    const coords = getSvgCoords(e.clientX, e.clientY);
    const dx = coords.x - state.resizeStartPos.x;
    const dy = coords.y - state.resizeStartPos.y;
    
    let newW = state.resizeStartDims.w + dx;
    let newH = state.resizeStartDims.h + dy;
    
    if (state.isSnapEnabled) {
        newW = Math.round(newW / state.gridSize) * state.gridSize;
        newH = Math.round(newH / state.gridSize) * state.gridSize;
    }
    
    node.w = Math.max(40, newW);
    node.h = Math.max(40, newH);
    
    updateNodeSvgElement(node);
    updateNodeConnections(node.id);
    
    if (state.currentParentNodeId !== null) {
        syncBoundaryPorts();
        const bounds = getSubDiagramBounds();
        const frame = document.querySelector('.subdiagram-frame');
        if (frame) {
            frame.setAttribute('x', bounds.x);
            frame.setAttribute('y', bounds.y);
            frame.setAttribute('width', bounds.w);
            frame.setAttribute('height', bounds.h);
        }
        const title = document.querySelector('.subdiagram-frame-title');
        if (title) {
            title.setAttribute('x', bounds.x + 10);
            title.setAttribute('y', bounds.y - 12);
        }
        state.nodes.forEach(n => {
            if (n.type === 'port') {
                updateNodeSvgElement(n);
                updateNodeConnections(n.id);
            }
        });
    }
    
    document.getElementById('node-width').value = node.w;
    document.getElementById('node-height').value = node.h;
}

export function handleNodeResizeUp() {
    state.draggedNodeId = null;
    state.dragMode = null;
    window.removeEventListener('mousemove', handleNodeResizeMove);
    window.removeEventListener('mouseup', handleNodeResizeUp);
    
    saveStateToLocalStorage();
    resizeCanvasIfNeeded();
}

export function startLabelDrag(nodeId, e) {
    e.stopPropagation();
    
    if (e.shiftKey) {
        toggleNodeShiftSelection(nodeId);
        return;
    }
    
    e.preventDefault();
    
    const now = Date.now();
    if (state.lastClickedNodeId === nodeId && (now - (state.lastClickTime || 0)) < 300) {
        state.lastClickTime = 0;
        state.lastClickedNodeId = null;
        
        state.selectedNodeIds = [nodeId];
        state.selectedConnectionId = null;
        state.shiftSelectedNodeIds = [];
        hideFloatingPlus();
        updateInspector();
        renderDiagram();
        
        const node = state.nodes.find(n => n.id === nodeId);
        openInlineTextEditor(nodeId, 'node', e.clientX, e.clientY, node.label || "");
        return;
    }
    state.lastClickTime = now;
    state.lastClickedNodeId = nodeId;
    state.lastClickedConnId = null;
    
    state.draggedNodeId = nodeId;
    state.dragMode = 'drag-label';
    
    const node = state.nodes.find(n => n.id === nodeId);
    const coords = getSvgCoords(e.clientX, e.clientY);
    
    state.labelDragStartOffset = {
        x: node.labelOffsetX || 0,
        y: node.labelOffsetY || 0
    };
    state.dragStartCoords = { x: coords.x, y: coords.y };
    
    window.addEventListener('mousemove', handleLabelDragMove);
    window.addEventListener('mouseup', handleLabelDragUp);
}

export function handleLabelDragMove(e) {
    if (state.dragMode !== 'drag-label' || !state.draggedNodeId) return;
    const node = state.nodes.find(n => n.id === state.draggedNodeId);
    if (!node) return;
    
    const coords = getSvgCoords(e.clientX, e.clientY);
    const dx = coords.x - state.dragStartCoords.x;
    const dy = coords.y - state.dragStartCoords.y;
    
    let nextOffsetX = state.labelDragStartOffset.x + dx;
    let nextOffsetY = state.labelDragStartOffset.y + dy;
    
    if (state.isSnapEnabled) {
        nextOffsetX = Math.round(nextOffsetX / state.gridSize) * state.gridSize;
        nextOffsetY = Math.round(nextOffsetY / state.gridSize) * state.gridSize;
    }
    
    node.labelOffsetX = nextOffsetX;
    node.labelOffsetY = nextOffsetY;
    
    const nodeEl = document.getElementById(node.id);
    if (nodeEl) {
        const foreign = nodeEl.querySelector('.node-label-foreign');
        if (foreign) {
            const textH = Math.max(30, node.h);
            const defaultY = node.type === 'image' ? (node.h + 6) : ((node.h - textH) / 2);
            foreign.setAttribute('x', nextOffsetX);
            foreign.setAttribute('y', defaultY + nextOffsetY);
        }
    }
}

export function handleLabelDragUp() {
    state.draggedNodeId = null;
    state.dragMode = null;
    window.removeEventListener('mousemove', handleLabelDragMove);
    window.removeEventListener('mouseup', handleLabelDragUp);
    
    saveStateToLocalStorage();
}

export function startConnLabelDrag(connId, e) {
    e.stopPropagation();
    e.preventDefault();
    
    const now = Date.now();
    if (state.lastClickedConnId === connId && (now - (state.lastClickTime || 0)) < 300) {
        state.lastClickTime = 0;
        state.lastClickedConnId = null;
        
        state.selectedConnectionId = connId;
        state.selectedNodeIds = [];
        state.shiftSelectedNodeIds = [];
        hideFloatingPlus();
        updateInspector();
        renderDiagram();
        
        const conn = state.connections.find(c => c.id === connId);
        openInlineTextEditor(connId, 'connection', e.clientX, e.clientY, conn.label || "");
        return;
    }
    state.lastClickTime = now;
    state.lastClickedConnId = connId;
    state.lastClickedNodeId = null;
    
    state.draggedConnId = connId;
    state.dragMode = 'drag-conn-label';
    
    const conn = state.connections.find(c => c.id === connId);
    const coords = getSvgCoords(e.clientX, e.clientY);
    
    state.labelDragStartOffset = {
        x: conn.labelOffsetX || 0,
        y: conn.labelOffsetY || 0
    };
    state.dragStartCoords = { x: coords.x, y: coords.y };
    
    window.addEventListener('mousemove', handleConnLabelDragMove);
    window.addEventListener('mouseup', handleConnLabelDragUp);
}

export function handleConnLabelDragMove(e) {
    if (state.dragMode !== 'drag-conn-label' || !state.draggedConnId) return;
    const conn = state.connections.find(c => c.id === state.draggedConnId);
    if (!conn) return;
    
    const coords = getSvgCoords(e.clientX, e.clientY);
    const dx = coords.x - state.dragStartCoords.x;
    const dy = coords.y - state.dragStartCoords.y;
    
    let nextOffsetX = state.labelDragStartOffset.x + dx;
    let nextOffsetY = state.labelDragStartOffset.y + dy;
    
    if (state.isSnapEnabled) {
        nextOffsetX = Math.round(nextOffsetX / state.gridSize) * state.gridSize;
        nextOffsetY = Math.round(nextOffsetY / state.gridSize) * state.gridSize;
    }
    
    conn.labelOffsetX = nextOffsetX;
    conn.labelOffsetY = nextOffsetY;
    
    const connEl = document.getElementById(conn.id);
    if (connEl) {
        const text = connEl.querySelector('.conn-label-text');
        const textBg = connEl.querySelector('.conn-label-bg');
        if (text && textBg) {
            const nodeA = state.nodes.find(n => n.id === conn.fromId);
            const nodeB = state.nodes.find(n => n.id === conn.toId);
            if (nodeA && nodeB) {
                const points = calculatePathPoints(nodeA, nodeB, conn);
                const mid = getPathCenter(points);
                
                const lx = mid.x + nextOffsetX;
                const ly = mid.y + nextOffsetY;
                
                text.setAttribute('x', lx);
                text.setAttribute('y', ly + 4);
                
                try {
                    const bbox = text.getBBox();
                    textBg.setAttribute('x', bbox.x - 6);
                    textBg.setAttribute('y', bbox.y - 2);
                    textBg.setAttribute('width', bbox.width + 12);
                    textBg.setAttribute('height', bbox.height + 4);
                } catch(err){}
            }
        }
    }
}

export function handleConnLabelDragUp() {
    state.draggedConnId = null;
    state.dragMode = null;
    window.removeEventListener('mousemove', handleConnLabelDragMove);
    window.removeEventListener('mouseup', handleConnLabelDragUp);
    
    saveStateToLocalStorage();
}

export function handleConnectionMouseDown(conn, e) {
    e.stopPropagation();
    
    const now = Date.now();
    if (state.lastClickedConnId === conn.id && (now - (state.lastClickTime || 0)) < 300) {
        state.lastClickTime = 0;
        state.lastClickedConnId = null;
        
        state.selectedConnectionId = conn.id;
        state.selectedNodeIds = [];
        state.shiftSelectedNodeIds = [];
        hideFloatingPlus();
        updateInspector();
        renderDiagram();
        
        openInlineTextEditor(conn.id, 'connection', e.clientX, e.clientY, conn.label || "");
        return;
    }
    state.lastClickTime = now;
    state.lastClickedConnId = conn.id;
    state.lastClickedNodeId = null;
    
    state.selectedConnectionId = conn.id;
    state.selectedNodeIds = [];
    state.shiftSelectedNodeIds = [];
    hideFloatingPlus();
    updateInspector();
    renderDiagram();
}
