import { dom } from './dom.js';
import { state, saveStateToLocalStorage } from './state.js';
import { renderDiagram, updateNodeSvgElement, updateNodeConnections } from './renderer.js';
import { updateInspector, applyNodeFillPreset, applyConnColorPreset } from './inspector.js';
import { zoomCanvas, centerViewport, getSvgCoords, resizeCanvasIfNeeded } from './viewport.js';
import { calculatePathPoints, getPathCenter } from './routing.js';
import { 
    addNode, 
    handleImageUploadNode, 
    deleteSelectedNodes, 
    deleteSelectedConnection, 
    toggleNodeShiftSelection, 
    hideFloatingPlus, 
    createConnectionFromGesture, 
    openInlineTextEditor,
    copySelectedNodes,
    pasteNodes
} from './editor.js';
import { exportPng, saveJson, loadJson } from './exporter.js';

let isSpacePressed = false;

/**
 * Main Setup function called by the bootstrapper
 */
export function setupEventListeners() {
    // Toolbar Actions
    document.getElementById('btn-export-png').addEventListener('click', exportPng);
    document.getElementById('btn-save-json').addEventListener('click', saveJson);
    document.getElementById('btn-load-json-trigger').addEventListener('click', () => {
        document.getElementById('file-load-json').click();
    });
    document.getElementById('file-load-json').addEventListener('change', loadJson);
    
    const btnToggleGrid = document.getElementById('btn-toggle-grid');
    btnToggleGrid.addEventListener('click', () => {
        state.isGridVisible = !state.isGridVisible;
        btnToggleGrid.classList.toggle('active', state.isGridVisible);
        dom.canvasGrid.style.display = state.isGridVisible ? 'block' : 'none';
    });
    
    const btnToggleSnap = document.getElementById('btn-toggle-snap');
    btnToggleSnap.addEventListener('click', () => {
        state.isSnapEnabled = !state.isSnapEnabled;
        btnToggleSnap.classList.toggle('active', state.isSnapEnabled);
    });
    
    document.getElementById('btn-clear').addEventListener('click', () => {
        if (confirm("Are you sure you want to clear the entire diagram? This cannot be undone.")) {
            state.nodes = [];
            state.connections = [];
            state.selectedNodeIds = [];
            state.selectedConnectionId = null;
            state.shiftSelectedNodeIds = [];
            saveStateToLocalStorage();
            renderDiagram();
            updateInspector();
            hideFloatingPlus();
        }
    });
    
    // Zoom Commands
    document.getElementById('btn-zoom-in').addEventListener('click', () => zoomCanvas(0.1));
    document.getElementById('btn-zoom-out').addEventListener('click', () => zoomCanvas(-0.1));
    document.getElementById('btn-zoom-reset').addEventListener('click', () => {
        state.zoom = 1.0;
        centerViewport();
    });
    
    // Add Node Button
    document.getElementById('palette-add-box').addEventListener('click', () => addNode('box'));
    document.getElementById('palette-add-image').addEventListener('click', () => {
        document.getElementById('image-node-uploader').click();
    });
    document.getElementById('image-node-uploader').addEventListener('change', handleImageUploadNode);
    
    // Canvas Container interaction
    dom.canvasContainer.addEventListener('mousedown', handleCanvasMouseDown);
    dom.canvasContainer.addEventListener('wheel', handleCanvasWheel, { passive: false });
    
    // Global keyboard listener
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    // Inspector events (Node)
    document.getElementById('node-label').addEventListener('input', (e) => {
        state.selectedNodeIds.forEach(id => {
            const node = state.nodes.find(n => n.id === id);
            if (node) node.label = e.target.value;
        });
        saveStateToLocalStorage();
        renderDiagram();
    });
    
    document.getElementById('btn-node-change-image').addEventListener('click', () => {
        if (state.selectedNodeIds.length === 1) {
            const uploader = document.createElement('input');
            uploader.type = 'file';
            uploader.accept = 'image/*';
            uploader.onchange = (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        const node = state.nodes.find(n => n.id === state.selectedNodeIds[0]);
                        if (node) {
                            node.type = 'image';
                            node.imageSrc = event.target.result;
                            if (node.w === 140 && node.h === 80) {
                                node.w = 100;
                                node.h = 100;
                            }
                            saveStateToLocalStorage();
                            renderDiagram();
                            updateInspector();
                        }
                    };
                    reader.readAsDataURL(file);
                }
            };
            uploader.click();
        }
    });
    
    document.getElementById('node-fill-custom').addEventListener('input', (e) => {
        state.selectedNodeIds.forEach(id => {
            const node = state.nodes.find(n => n.id === id);
            if (node) {
                node.fill = e.target.value + '25'; // light background
                node.border = e.target.value;
            }
        });
        saveStateToLocalStorage();
        renderDiagram();
    });
    
    document.getElementById('node-border-custom').addEventListener('input', (e) => {
        state.selectedNodeIds.forEach(id => {
            const node = state.nodes.find(n => n.id === id);
            if (node) node.border = e.target.value;
        });
        saveStateToLocalStorage();
        renderDiagram();
    });
    
    const nodeThicknessSlider = document.getElementById('node-border-thickness');
    nodeThicknessSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        document.getElementById('node-border-thickness-val').textContent = `${val}px`;
        state.selectedNodeIds.forEach(id => {
            const node = state.nodes.find(n => n.id === id);
            if (node) node.borderThickness = val;
        });
        saveStateToLocalStorage();
        renderDiagram();
    });
    
    const nodeFontSizeSlider = document.getElementById('node-font-size');
    nodeFontSizeSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        document.getElementById('node-font-size-val').textContent = `${val}px`;
        state.selectedNodeIds.forEach(id => {
            const node = state.nodes.find(n => n.id === id);
            if (node) node.fontSize = val;
        });
        saveStateToLocalStorage();
        renderDiagram();
    });
    
    document.getElementById('node-text-color').addEventListener('input', (e) => {
        state.selectedNodeIds.forEach(id => {
            const node = state.nodes.find(n => n.id === id);
            if (node) node.textColor = e.target.value;
        });
        saveStateToLocalStorage();
        renderDiagram();
    });
    
    document.getElementById('node-width').addEventListener('change', (e) => {
        const val = Math.max(40, parseInt(e.target.value));
        state.selectedNodeIds.forEach(id => {
            const node = state.nodes.find(n => n.id === id);
            if (node) node.w = val;
        });
        saveStateToLocalStorage();
        renderDiagram();
    });
    
    document.getElementById('node-height').addEventListener('change', (e) => {
        const val = Math.max(40, parseInt(e.target.value));
        state.selectedNodeIds.forEach(id => {
            const node = state.nodes.find(n => n.id === id);
            if (node) node.h = val;
        });
        saveStateToLocalStorage();
        renderDiagram();
    });
    
    document.getElementById('btn-delete-node').addEventListener('click', deleteSelectedNodes);
    
    // Inspector events (Connection)
    document.getElementById('conn-label').addEventListener('input', (e) => {
        if (state.selectedConnectionId) {
            const conn = state.connections.find(c => c.id === state.selectedConnectionId);
            if (conn) conn.label = e.target.value;
            saveStateToLocalStorage();
            renderDiagram();
        }
    });
    
    document.getElementById('conn-color-custom').addEventListener('input', (e) => {
        if (state.selectedConnectionId) {
            const conn = state.connections.find(c => c.id === state.selectedConnectionId);
            if (conn) conn.color = e.target.value;
            saveStateToLocalStorage();
            renderDiagram();
        }
    });
    
    const connThicknessSlider = document.getElementById('conn-thickness');
    connThicknessSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        document.getElementById('conn-thickness-val').textContent = `${val}px`;
        if (state.selectedConnectionId) {
            const conn = state.connections.find(c => c.id === state.selectedConnectionId);
            if (conn) conn.thickness = val;
            saveStateToLocalStorage();
            renderDiagram();
        }
    });
    
    document.getElementById('conn-arrow-start').addEventListener('change', (e) => {
        if (state.selectedConnectionId) {
            const conn = state.connections.find(c => c.id === state.selectedConnectionId);
            if (conn) conn.arrowStart = e.target.value;
            saveStateToLocalStorage();
            renderDiagram();
        }
    });
    
    document.getElementById('conn-arrow-end').addEventListener('change', (e) => {
        if (state.selectedConnectionId) {
            const conn = state.connections.find(c => c.id === state.selectedConnectionId);
            if (conn) conn.arrowEnd = e.target.value;
            saveStateToLocalStorage();
            renderDiagram();
        }
    });
    
    document.getElementsByName('conn-routing').forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (state.selectedConnectionId) {
                const conn = state.connections.find(c => c.id === state.selectedConnectionId);
                if (conn) conn.routing = e.target.value;
                document.getElementById('conn-radius-group').style.display = 
                    e.target.value === 'smooth' ? 'flex' : 'none';
                saveStateToLocalStorage();
                renderDiagram();
            }
        });
    });
    
    const connRadiusSlider = document.getElementById('conn-radius');
    connRadiusSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        document.getElementById('conn-radius-val').textContent = `${val}px`;
        if (state.selectedConnectionId) {
            const conn = state.connections.find(c => c.id === state.selectedConnectionId);
            if (conn) conn.radius = val;
            saveStateToLocalStorage();
            renderDiagram();
        }
    });
    
    document.getElementById('btn-delete-connection').addEventListener('click', deleteSelectedConnection);
    
    // Floating connector Plus button click
    dom.floatingConnectBtn.addEventListener('click', createConnectionFromGesture);
    
    // Create Context Menu dynamically
    let contextMenu = document.getElementById('context-menu');
    if (!contextMenu) {
        contextMenu = document.createElement('div');
        contextMenu.id = 'context-menu';
        contextMenu.className = 'context-menu';
        
        contextMenu.innerHTML = `
            <div class="context-menu-item" id="ctx-copy">Copy <span class="shortcut">Ctrl+C</span></div>
            <div class="context-menu-item" id="ctx-paste">Paste <span class="shortcut">Ctrl+V</span></div>
            <div class="context-menu-item" id="ctx-delete">Delete <span class="shortcut">Del</span></div>
            <div class="context-menu-separator"></div>
            <div class="context-menu-item" id="ctx-add-box">Add Default Box</div>
            <div class="context-menu-item" id="ctx-add-image">Add Image Box</div>
        `;
        document.body.appendChild(contextMenu);
    }
    
    const hideContextMenu = () => {
        contextMenu.style.display = 'none';
    };
    
    // Show context menu
    dom.canvasContainer.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        
        const clientX = e.clientX;
        const clientY = e.clientY;
        
        let clickedNodeId = null;
        let clickedConnId = null;
        
        let target = e.target;
        while (target && target !== dom.svg) {
            if (target.classList && target.classList.contains('svg-node')) {
                clickedNodeId = target.id;
                break;
            }
            if (target.classList && target.classList.contains('svg-connection')) {
                clickedConnId = target.id;
                break;
            }
            target = target.parentNode;
        }
        
        if (clickedNodeId) {
            if (!state.selectedNodeIds.includes(clickedNodeId)) {
                state.selectedNodeIds = [clickedNodeId];
                state.selectedConnectionId = null;
                state.shiftSelectedNodeIds = [];
                hideFloatingPlus();
                renderDiagram();
                updateInspector();
            }
        } else if (clickedConnId) {
            if (state.selectedConnectionId !== clickedConnId) {
                state.selectedNodeIds = [];
                state.selectedConnectionId = clickedConnId;
                state.shiftSelectedNodeIds = [];
                hideFloatingPlus();
                renderDiagram();
                updateInspector();
            }
        }
        
        const hasNodeSelected = state.selectedNodeIds.length > 0;
        const hasConnSelected = state.selectedConnectionId !== null;
        const hasClipboard = state.clipboard !== null && state.clipboard.length > 0;
        
        const btnCopy = document.getElementById('ctx-copy');
        const btnPaste = document.getElementById('ctx-paste');
        const btnDelete = document.getElementById('ctx-delete');
        
        btnCopy.classList.toggle('disabled', !hasNodeSelected);
        btnPaste.classList.toggle('disabled', !hasClipboard);
        btnDelete.classList.toggle('disabled', !hasNodeSelected && !hasConnSelected);
        
        contextMenu.style.left = `${e.pageX}px`;
        contextMenu.style.top = `${e.pageY}px`;
        contextMenu.style.display = 'flex';
        
        contextMenu.dataset.clientX = clientX;
        contextMenu.dataset.clientY = clientY;
    });
    
    // Hide context menu on click elsewhere
    document.addEventListener('click', (e) => {
        if (!contextMenu.contains(e.target)) {
            hideContextMenu();
        }
    });
    
    // Hide context menu on canvas container drag start
    dom.canvasContainer.addEventListener('mousedown', (e) => {
        if (e.button !== 2) {
            hideContextMenu();
        }
    });
    
    // Context menu item actions
    document.getElementById('ctx-copy').addEventListener('click', () => {
        copySelectedNodes();
        hideContextMenu();
    });
    document.getElementById('ctx-paste').addEventListener('click', () => {
        const cx = parseFloat(contextMenu.dataset.clientX);
        const cy = parseFloat(contextMenu.dataset.clientY);
        pasteNodes(cx, cy);
        hideContextMenu();
    });
    document.getElementById('ctx-delete').addEventListener('click', () => {
        if (state.selectedNodeIds.length > 0) {
            deleteSelectedNodes();
        } else if (state.selectedConnectionId) {
            deleteSelectedConnection();
        }
        hideContextMenu();
    });
    document.getElementById('ctx-add-box').addEventListener('click', () => {
        const cx = parseFloat(contextMenu.dataset.clientX);
        const cy = parseFloat(contextMenu.dataset.clientY);
        const coords = getSvgCoords(cx, cy);
        addNode('box', null, coords.x, coords.y);
        hideContextMenu();
    });
    document.getElementById('ctx-add-image').addEventListener('click', () => {
        const uploader = document.getElementById('image-node-uploader');
        uploader.dataset.clientX = contextMenu.dataset.clientX;
        uploader.dataset.clientY = contextMenu.dataset.clientY;
        uploader.click();
        hideContextMenu();
    });
}

/**
 * Keyboard down shortcuts
 */
export function handleKeyDown(e) {
    if (e.code === 'Space') {
        isSpacePressed = true;
        if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
            dom.canvasContainer.style.cursor = 'grab';
        }
    }
    
    // Copy shortcut (Ctrl + C)
    if (e.ctrlKey && e.code === 'KeyC') {
        if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
            e.preventDefault();
            copySelectedNodes();
        }
    }
    
    // Paste shortcut (Ctrl + V)
    if (e.ctrlKey && e.code === 'KeyV') {
        if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
            e.preventDefault();
            pasteNodes();
        }
    }
    
    if (e.code === 'Delete' || e.code === 'Backspace') {
        if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
            e.preventDefault();
            if (state.selectedNodeIds.length > 0) {
                deleteSelectedNodes();
            } else if (state.selectedConnectionId) {
                deleteSelectedConnection();
            }
        }
    }
}

/**
 * Keyboard up shortcuts
 */
export function handleKeyUp(e) {
    if (e.code === 'Space') {
        isSpacePressed = false;
        dom.canvasContainer.style.cursor = 'default';
    }
}

/**
 * Canvas mousedown (for panning and empty space deselects)
 */
export function handleCanvasMouseDown(e) {
    const clickedElement = e.target;
    const isBackgroundClick = (clickedElement === dom.svg || clickedElement === dom.canvasGrid);
    
    if (e.button === 1 || isSpacePressed || (e.button === 0 && isBackgroundClick)) {
        if (e.button === 0 && isBackgroundClick) {
            state.selectedNodeIds = [];
            state.selectedConnectionId = null;
            if (!e.shiftKey) {
                state.shiftSelectedNodeIds = [];
                hideFloatingPlus();
            }
            renderDiagram();
            updateInspector();
        }
        
        e.preventDefault();
        state.isPanning = true;
        dom.canvasContainer.style.cursor = 'grabbing';
        state.panStart = { x: e.clientX, y: e.clientY };
        
        window.addEventListener('mousemove', handleCanvasPanMove);
        window.addEventListener('mouseup', handleCanvasPanUp);
    }
}

export function handleCanvasPanMove(e) {
    if (!state.isPanning) return;
    const dx = e.clientX - state.panStart.x;
    const dy = e.clientY - state.panStart.y;
    state.panX += dx;
    state.panY += dy;
    state.panStart = { x: e.clientX, y: e.clientY };
    
    if (dom.viewportG) {
        dom.viewportG.setAttribute('transform', `translate(${state.panX}, ${state.panY}) scale(${state.zoom})`);
    }
}

export function handleCanvasPanUp(e) {
    state.isPanning = false;
    dom.canvasContainer.style.cursor = isSpacePressed ? 'grab' : 'default';
    window.removeEventListener('mousemove', handleCanvasPanMove);
    window.removeEventListener('mouseup', handleCanvasPanUp);
}

/**
 * Wheel scroll zoom
 */
export function handleCanvasWheel(e) {
    if (e.ctrlKey) {
        e.preventDefault();
        const zoomFactor = 0.08;
        const delta = -Math.sign(e.deltaY) * zoomFactor;
        zoomCanvas(delta, e.clientX, e.clientY);
    }
}

/**
 * Node mousedown for drag start
 */
export function startNodeDrag(nodeId, e) {
    e.stopPropagation();
    
    if (e.shiftKey) {
        toggleNodeShiftSelection(nodeId);
        return;
    }
    
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
        
        const input = document.getElementById('node-label');
        if (input) {
            input.focus();
            input.select();
        }
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
    
    const node = state.nodes.find(n => n.id === nodeId);
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

/**
 * Node bottom-right resize handle click/drag
 */
export function startNodeResize(nodeId, e) {
    e.stopPropagation();
    e.preventDefault();
    
    state.selectedNodeIds = [nodeId];
    state.selectedConnectionId = null;
    state.shiftSelectedNodeIds = [];
    hideFloatingPlus();
    updateInspector();
    renderDiagram();
    
    state.draggedNodeId = nodeId;
    state.dragMode = 'resize';
    
    const node = state.nodes.find(n => n.id === nodeId);
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

/**
 * Text label reposition dragging
 */
export function startLabelDrag(nodeId, e) {
    e.stopPropagation();
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

/**
 * Connection label reposition dragging
 */
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

/**
 * Click on connection (mousedown helper)
 */
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
        
        const input = document.getElementById('conn-label');
        if (input) {
            input.focus();
            input.select();
        }
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
