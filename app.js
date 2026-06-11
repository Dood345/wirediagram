/**
 * Aperture Back-Alley Diagrammer
 * Core Application Logic
 */

// Global state
let state = {
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
    dragMode: null, // 'drag', 'resize', 'pan'
    draggedNodeId: null,
    dragOffset: { x: 0, y: 0 },
    resizeStartDims: { w: 0, h: 0 },
    resizeStartPos: { x: 0, y: 0 },
    isSnapEnabled: true,
    isGridVisible: true,
    gridSize: 20
};

// Preset colors for beautiful diagrams
const COLOR_PRESETS = [
    { name: 'Indigo', value: '#6366f1' },
    { name: 'Teal', value: '#0d9488' },
    { name: 'Emerald', value: '#10b981' },
    { name: 'Amber', value: '#d97706' },
    { name: 'Rose', value: '#f43f5e' },
    { name: 'Slate', value: '#475569' }
];

// DOM References
const svg = document.getElementById('canvas-svg');
const canvasContainer = document.getElementById('canvas-container');
const nodesGroup = document.getElementById('nodes-group');
const connectionsGroup = document.getElementById('connections-group');
const overlaysGroup = document.getElementById('overlays-group');
const canvasGrid = document.getElementById('canvas-grid');
const floatingConnectBtn = document.getElementById('floating-connect-btn');

// Viewport container group (dynamically created for zoom/pan)
let viewportG;

// Initialize app when DOM loaded
document.addEventListener('DOMContentLoaded', () => {
    setupViewport();
    setupEventListeners();
    setupColorPresets();
    loadDemoDiagram();
    centerViewport();
});

// Wrap canvas layers in a viewport group to allow unified zoom/pan
function setupViewport() {
    viewportG = document.createElementNS("http://www.w3.org/2000/svg", "g");
    viewportG.id = "viewport-g";
    
    // Move layout elements into the viewport group
    viewportG.appendChild(canvasGrid);
    viewportG.appendChild(connectionsGroup);
    viewportG.appendChild(nodesGroup);
    viewportG.appendChild(overlaysGroup);
    
    svg.appendChild(viewportG);
    updateViewportTransform();
}

// Center viewport on the middle of the 3000x3000px base canvas
function centerViewport() {
    const rect = canvasContainer.getBoundingClientRect();
    state.panX = Math.round(rect.width / 2 - 1500 * state.zoom);
    state.panY = Math.round(rect.height / 2 - 1500 * state.zoom);
    updateViewportTransform();
}

// Render zoom/pan transformations
function updateViewportTransform() {
    viewportG.setAttribute('transform', `translate(${state.panX}, ${state.panY}) scale(${state.zoom})`);
    document.getElementById('zoom-level').textContent = `${Math.round(state.zoom * 100)}%`;
}

// Generate unique IDs
function generateId() {
    return 'id_' + Math.random().toString(36).substr(2, 9);
}

// Helper to convert screen coordinates to SVG coordinates
function getSvgCoords(clientX, clientY) {
    const rect = svg.getBoundingClientRect();
    const x = (clientX - rect.left - state.panX) / state.zoom;
    const y = (clientY - rect.top - state.panY) / state.zoom;
    return { x, y };
}

// Generate color preset buttons
function setupColorPresets() {
    const fillPresets = document.getElementById('node-fill-presets');
    const connPresets = document.getElementById('conn-color-presets');
    
    COLOR_PRESETS.forEach(color => {
        // Node Fill preset
        const fillBtn = document.createElement('div');
        fillBtn.className = 'color-preset';
        fillBtn.style.backgroundColor = color.value + '25'; // 15% opacity for transparent backgrounds
        fillBtn.style.borderColor = color.value;
        fillBtn.dataset.value = color.value;
        fillBtn.title = color.name;
        fillBtn.addEventListener('click', () => applyNodeFillPreset(color.value));
        fillPresets.appendChild(fillBtn);
        
        // Connection Color preset
        const connBtn = document.createElement('div');
        connBtn.className = 'color-preset';
        connBtn.style.backgroundColor = color.value;
        connBtn.dataset.value = color.value;
        connBtn.title = color.name;
        connBtn.addEventListener('click', () => applyConnColorPreset(color.value));
        connPresets.appendChild(connBtn);
    });
}

// Apply Node Fill Preset
function applyNodeFillPreset(colorHex) {
    state.selectedNodeIds.forEach(id => {
        const node = state.nodes.find(n => n.id === id);
        if (node) {
            node.fill = colorHex + '25'; // light background
            node.border = colorHex;      // colored border
        }
    });
    saveStateToLocalStorage();
    renderDiagram();
    updateInspector();
}

// Apply Connection Color Preset
function applyConnColorPreset(colorHex) {
    if (state.selectedConnectionId) {
        const conn = state.connections.find(c => c.id === state.selectedConnectionId);
        if (conn) {
            conn.color = colorHex;
        }
        saveStateToLocalStorage();
        renderDiagram();
        updateInspector();
    }
}

// Save/Load in local storage for session safety
function saveStateToLocalStorage() {
    localStorage.setItem('aperture_diagrammer_state', JSON.stringify({
        nodes: state.nodes,
        connections: state.connections
    }));
}

function loadDemoDiagram() {
    const saved = localStorage.getItem('aperture_diagrammer_state');
    if (saved) {
        try {
            const data = JSON.parse(saved);
            state.nodes = data.nodes || [];
            state.connections = data.connections || [];
            renderDiagram();
            return;
        } catch(e) {
            console.error("Failed to parse local storage diagram", e);
        }
    }
    
    // Default demo diagram
    const id1 = generateId();
    const id2 = generateId();
    const id3 = generateId();
    
    state.nodes = [
        {
            id: id1,
            x: 1300, y: 1450, w: 140, h: 80,
            label: "Control Module",
            fill: "#6366f125",
            border: "#6366f1",
            borderThickness: 2,
            fontSize: 14,
            textColor: "#f8fafc",
            type: "box"
        },
        {
            id: id2,
            x: 1600, y: 1450, w: 140, h: 80,
            label: "Logic Gate A",
            fill: "#0d948825",
            border: "#0d9488",
            borderThickness: 2,
            fontSize: 14,
            textColor: "#f8fafc",
            type: "box"
        },
        {
            id: id3,
            x: 1600, y: 1650, w: 140, h: 80,
            label: "Glow Indicator",
            fill: "#d9770625",
            border: "#d97706",
            borderThickness: 2,
            fontSize: 14,
            textColor: "#f8fafc",
            type: "box"
        }
    ];
    
    state.connections = [
        {
            id: generateId(),
            fromId: id1,
            toId: id2,
            label: "Control Bus",
            color: "#6366f1",
            thickness: 2,
            arrowStart: "none",
            arrowEnd: "arrow",
            routing: "orthogonal",
            radius: 12
        },
        {
            id: generateId(),
            fromId: id2,
            toId: id3,
            label: "Trigger Sign",
            color: "#0d9488",
            thickness: 2,
            arrowStart: "circle",
            arrowEnd: "arrow",
            routing: "smooth",
            radius: 12
        }
    ];
    
    renderDiagram();
}

// SETUP EVENT LISTENERS
function setupEventListeners() {
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
        canvasGrid.style.display = state.isGridVisible ? 'block' : 'none';
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
    
    // Canvas Container interaction (Panning / Deselecting / Space-drag)
    canvasContainer.addEventListener('mousedown', handleCanvasMouseDown);
    canvasContainer.addEventListener('wheel', handleCanvasWheel, { passive: false });
    
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
        // Trigger uploader to replace selected box with image
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
                            // Make it square if rectangular since it's an image
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
    floatingConnectBtn.addEventListener('click', createConnectionFromGesture);
}

// Global Space Bar state tracking
let isSpacePressed = false;

function handleKeyDown(e) {
    if (e.code === 'Space') {
        isSpacePressed = true;
        if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
            canvasContainer.style.cursor = 'grab';
        }
    }
    // Delete keys
    if (e.code === 'Delete' || e.code === 'Backspace') {
        // Prevent deleting items while typing in text inputs
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

function handleKeyUp(e) {
    if (e.code === 'Space') {
        isSpacePressed = false;
        canvasContainer.style.cursor = 'default';
    }
}

// ADD NEW NODES
function addNode(type = 'box', imageSrc = null) {
    // Determine spawn coordinate based on current pan center
    const rect = canvasContainer.getBoundingClientRect();
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

function handleImageUploadNode(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            addNode('image', event.target.result);
        };
        reader.readAsDataURL(file);
    }
    // reset uploader value
    e.target.value = '';
}

// CANVAS EVENT HANDLERS
function handleCanvasMouseDown(e) {
    const clickedElement = e.target;
    const isBackgroundClick = (clickedElement === svg || clickedElement === canvasGrid);
    
    // Middle click, Space+click, or Left click on empty background triggers Panning
    if (e.button === 1 || isSpacePressed || (e.button === 0 && isBackgroundClick)) {
        // If left clicking the background, deselect active selections first
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
        canvasContainer.style.cursor = 'grabbing';
        state.panStart = { x: e.clientX, y: e.clientY };
        
        window.addEventListener('mousemove', handleCanvasPanMove);
        window.addEventListener('mouseup', handleCanvasPanUp);
        return;
    }
}

function handleCanvasPanMove(e) {
    if (!state.isPanning) return;
    const dx = e.clientX - state.panStart.x;
    const dy = e.clientY - state.panStart.y;
    state.panX += dx;
    state.panY += dy;
    state.panStart = { x: e.clientX, y: e.clientY };
    updateViewportTransform();
}

function handleCanvasPanUp(e) {
    state.isPanning = false;
    canvasContainer.style.cursor = isSpacePressed ? 'grab' : 'default';
    window.removeEventListener('mousemove', handleCanvasPanMove);
    window.removeEventListener('mouseup', handleCanvasPanUp);
}

function handleCanvasWheel(e) {
    if (e.ctrlKey) {
        e.preventDefault();
        const zoomFactor = 0.08;
        const delta = -Math.sign(e.deltaY) * zoomFactor;
        zoomCanvas(delta, e.clientX, e.clientY);
    }
}

function zoomCanvas(delta, clientX = null, clientY = null) {
    const oldZoom = state.zoom;
    let newZoom = oldZoom + delta;
    newZoom = Math.max(0.2, Math.min(3.0, newZoom)); // limits between 20% and 300%
    
    if (clientX !== null && clientY !== null) {
        // Zoom centered on mouse cursor
        const rect = svg.getBoundingClientRect();
        const mouseX = clientX - rect.left;
        const mouseY = clientY - rect.top;
        
        const svgX = (mouseX - state.panX) / oldZoom;
        const svgY = (mouseY - state.panY) / oldZoom;
        
        state.zoom = newZoom;
        state.panX = mouseX - svgX * newZoom;
        state.panY = mouseY - svgY * newZoom;
    } else {
        // Zoom centered on canvas viewport midpoint
        const rect = canvasContainer.getBoundingClientRect();
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

// NODE MOUSE DRAG / RESIZE ACTIONS
function startNodeDrag(nodeId, e) {
    e.stopPropagation();
    
    // Shift selection connection gesture logic
    if (e.shiftKey) {
        toggleNodeShiftSelection(nodeId);
        return;
    }
    
    // Manual double-click detection for nodes
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
        
        // Focus and highlight inspector textarea
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
    state.lastClickedConnId = null; // clear other clicks
    
    // Select this node
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

function handleNodeDragMove(e) {
    if (!state.draggedNodeId) return;
    const node = state.nodes.find(n => n.id === state.draggedNodeId);
    if (!node) return;
    
    const coords = getSvgCoords(e.clientX, e.clientY);
    
    // Check drag threshold to prevent micro-drags from canceling double click events
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
    
    // Update live SVG attributes of nodes and lines rather than full redraw for speed
    updateNodeSvgElement(node);
    updateNodeConnections(node.id);
    
    // Live update inspector values
    if (state.selectedNodeIds.includes(node.id)) {
        document.getElementById('node-width').value = node.w;
        document.getElementById('node-height').value = node.h;
    }
}

function handleNodeDragUp() {
    state.draggedNodeId = null;
    state.dragMode = null;
    window.removeEventListener('mousemove', handleNodeDragMove);
    window.removeEventListener('mouseup', handleNodeDragUp);
    
    saveStateToLocalStorage();
    resizeCanvasIfNeeded();
}

// Start Node Resize action
function startNodeResize(nodeId, e) {
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

function handleNodeResizeMove(e) {
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
    
    // Update inspector values
    document.getElementById('node-width').value = node.w;
    document.getElementById('node-height').value = node.h;
}

function handleNodeResizeUp() {
    state.draggedNodeId = null;
    state.dragMode = null;
    window.removeEventListener('mousemove', handleNodeResizeMove);
    window.removeEventListener('mouseup', handleNodeResizeUp);
    
    saveStateToLocalStorage();
    resizeCanvasIfNeeded();
}

// Start Shape Text Label Drag action
function startLabelDrag(nodeId, e) {
    e.stopPropagation();
    e.preventDefault(); // prevents text selection while dragging
    
    // Manual double-click detection for text labels
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

function handleLabelDragMove(e) {
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
    
    // Live update the label positioning attributes in DOM
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

function handleLabelDragUp() {
    state.draggedNodeId = null;
    state.dragMode = null;
    window.removeEventListener('mousemove', handleLabelDragMove);
    window.removeEventListener('mouseup', handleLabelDragUp);
    
    saveStateToLocalStorage();
}

// Start Connection Text Label Drag action
function startConnLabelDrag(connId, e) {
    e.stopPropagation();
    e.preventDefault(); // prevents text selection while dragging
    
    // Manual double-click detection for connection label to edit text
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
        
        const input = document.getElementById('conn-label');
        if (input) {
            input.focus();
            input.select();
        }
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

function handleConnLabelDragMove(e) {
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
    
    // Live update the label positioning attributes in DOM
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

function handleConnLabelDragUp() {
    state.draggedConnId = null;
    state.dragMode = null;
    window.removeEventListener('mousemove', handleConnLabelDragMove);
    window.removeEventListener('mouseup', handleConnLabelDragUp);
    
    saveStateToLocalStorage();
}


// AUTO EXPAND CANVAS IF BEYOND BOUNDS
function resizeCanvasIfNeeded() {
    let currentW = parseInt(svg.getAttribute('width'));
    let currentH = parseInt(svg.getAttribute('height'));
    let maxNodeX = 3000;
    let maxNodeY = 3000;
    
    state.nodes.forEach(n => {
        if (n.x + n.w + 300 > maxNodeX) maxNodeX = n.x + n.w + 300;
        if (n.y + n.h + 300 > maxNodeY) maxNodeY = n.y + n.h + 300;
    });
    
    if (maxNodeX > currentW || maxNodeY > currentH) {
        const nextW = Math.max(currentW, maxNodeX);
        const nextH = Math.max(currentH, maxNodeY);
        svg.setAttribute('width', nextW);
        svg.setAttribute('height', nextH);
    }
}

// SHIFT+CLICK CONNECTOR GESTURE LOGIC
function toggleNodeShiftSelection(nodeId) {
    const idx = state.shiftSelectedNodeIds.indexOf(nodeId);
    if (idx !== -1) {
        state.shiftSelectedNodeIds.splice(idx, 1);
    } else {
        if (state.shiftSelectedNodeIds.length >= 2) {
            // Shift out first, append new
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

function showFloatingPlusBetween(nodeId1, nodeId2) {
    const node1 = state.nodes.find(n => n.id === nodeId1);
    const node2 = state.nodes.find(n => n.id === nodeId2);
    if (!node1 || !node2) return;
    
    // Midpoint between their centers in SVG coordinate system
    const midX = ((node1.x + node1.w / 2) + (node2.x + node2.w / 2)) / 2;
    const midY = ((node1.y + node1.h / 2) + (node2.y + node2.h / 2)) / 2;
    
    // Position floating overlay element (HTML positioned relative to SVG canvas container)
    // Convert SVG coords to CSS container coords
    const containerX = midX * state.zoom + state.panX;
    const containerY = midY * state.zoom + state.panY;
    
    floatingConnectBtn.style.left = `${containerX}px`;
    floatingConnectBtn.style.top = `${containerY}px`;
    floatingConnectBtn.style.display = 'flex';
}

function hideFloatingPlus() {
    floatingConnectBtn.style.display = 'none';
}

function createConnectionFromGesture() {
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

// IN-PLACE DOUBLE-CLICK LABEL EDITOR
function openInlineTextEditor(elementId, type, clientX, clientY, currentText) {
    // Remove existing editor if open
    const prevEditor = document.querySelector('.text-editor-input');
    if (prevEditor) prevEditor.remove();
    
    const editor = document.createElement('textarea');
    editor.className = 'text-editor-input';
    editor.value = currentText;
    editor.rows = 2;
    
    // Absolute position at double click client coordinates
    const rect = canvasContainer.getBoundingClientRect();
    const top = clientY - rect.top - 20;
    const left = clientX - rect.left - 70;
    
    editor.style.top = `${top}px`;
    editor.style.left = `${left}px`;
    editor.style.width = '140px';
    
    canvasContainer.appendChild(editor);
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

// CONNECTION ROUTING PATH COMPUTATION
function getBestPorts(nodeA, nodeB) {
    // Define ports (Top, Bottom, Left, Right)
    const portsA = [
        { x: nodeA.x + nodeA.w / 2, y: nodeA.y, dir: 'T' },
        { x: nodeA.x + nodeA.w / 2, y: nodeA.y + nodeA.h, dir: 'B' },
        { x: nodeA.x, y: nodeA.y + nodeA.h / 2, dir: 'L' },
        { x: nodeA.x + nodeA.w, y: nodeA.y + nodeA.h / 2, dir: 'R' }
    ];
    const portsB = [
        { x: nodeB.x + nodeB.w / 2, y: nodeB.y, dir: 'T' },
        { x: nodeB.x + nodeB.w / 2, y: nodeB.y + nodeB.h, dir: 'B' },
        { x: nodeB.x, y: nodeB.y + nodeB.h / 2, dir: 'L' },
        { x: nodeB.x + nodeB.w, y: nodeB.y + nodeB.h / 2, dir: 'R' }
    ];
    
    let bestA = portsA[0];
    let bestB = portsB[0];
    let minDist = Infinity;
    
    // Choose port pair with absolute shortest distance
    for (let pA of portsA) {
        for (let pB of portsB) {
            const dist = Math.hypot(pB.x - pA.x, pB.y - pA.y);
            if (dist < minDist) {
                minDist = dist;
                bestA = pA;
                bestB = pB;
            }
        }
    }
    
    return { portA: bestA, portB: bestB };
}

function calculatePathPoints(nodeA, nodeB, conn) {
    const routingType = conn.routing;
    const { portA, portB } = getBestPorts(nodeA, nodeB);
    
    // Offset the start and end of the line to prevent markers from extending past node borders
    let startOffset = nodeA.borderThickness / 2;
    if (conn.arrowStart === 'arrow') {
        startOffset += 2 * conn.thickness;
    } else if (conn.arrowStart === 'circle') {
        startOffset += 3.5 * conn.thickness;
    }
    
    let endOffset = nodeB.borderThickness / 2;
    if (conn.arrowEnd === 'arrow') {
        endOffset += 2 * conn.thickness;
    } else if (conn.arrowEnd === 'circle') {
        endOffset += 3.5 * conn.thickness;
    }
    
    // Shift start and end coordinates in the direction of the exit vector
    let sx = portA.x, sy = portA.y;
    if (portA.dir === 'L') sx -= startOffset;
    else if (portA.dir === 'R') sx += startOffset;
    else if (portA.dir === 'T') sy -= startOffset;
    else if (portA.dir === 'B') sy += startOffset;
    
    let tx = portB.x, ty = portB.y;
    if (portB.dir === 'L') tx -= endOffset;
    else if (portB.dir === 'R') tx += endOffset;
    else if (portB.dir === 'T') ty -= endOffset;
    else if (portB.dir === 'B') ty += endOffset;

    const points = [{ x: sx, y: sy }];
    
    // Distance to back out of the port to prevent lines clipping node edges
    const margin = 24;
    
    let ex1 = sx, ey1 = sy;
    if (portA.dir === 'L') ex1 -= margin;
    else if (portA.dir === 'R') ex1 += margin;
    else if (portA.dir === 'T') ey1 -= margin;
    else if (portA.dir === 'B') ey1 += margin;
    points.push({ x: ex1, y: ey1 });

    let ex2 = tx, ey2 = ty;
    if (portB.dir === 'L') ex2 -= margin;
    else if (portB.dir === 'R') ex2 += margin;
    else if (portB.dir === 'T') ey2 -= margin;
    else if (portB.dir === 'B') ey2 += margin;
    
    // Route from (ex1, ey1) to (ex2, ey2)
    if (routingType === 'orthogonal' || routingType === 'smooth') {
        const isHoriz1 = (portA.dir === 'L' || portA.dir === 'R');
        const isHoriz2 = (portB.dir === 'L' || portB.dir === 'R');
        
        if (isHoriz1 && isHoriz2) {
            const mx = (ex1 + ex2) / 2;
            points.push({ x: mx, y: ey1 });
            points.push({ x: mx, y: ey2 });
        } else if (!isHoriz1 && !isHoriz2) {
            const my = (ey1 + ey2) / 2;
            points.push({ x: ex1, y: my });
            points.push({ x: ex2, y: my });
        } else {
            if (isHoriz1) {
                points.push({ x: ex2, y: ey1 });
            } else {
                points.push({ x: ex1, y: ey1 });
            }
        }
    }
    
    points.push({ x: ex2, y: ey2 });
    points.push({ x: tx, y: ty });
    
    return cleanPathPoints(points);
}

function cleanPathPoints(points) {
    if (points.length < 2) return points;
    
    // 1. Remove duplicate adjacent points
    let unique = [points[0]];
    for (let i = 1; i < points.length; i++) {
        const last = unique[unique.length - 1];
        const curr = points[i];
        if (Math.abs(last.x - curr.x) > 0.05 || Math.abs(last.y - curr.y) > 0.05) {
            unique.push(curr);
        }
    }
    
    if (unique.length < 3) return unique;
    
    // 2. Remove collinear bends
    let result = [unique[0]];
    for (let i = 1; i < unique.length - 1; i++) {
        const prev = result[result.length - 1];
        const curr = unique[i];
        const next = unique[i + 1];
        
        const isCollinearX = Math.abs(prev.x - curr.x) < 0.05 && Math.abs(curr.x - next.x) < 0.05;
        const isCollinearY = Math.abs(prev.y - curr.y) < 0.05 && Math.abs(curr.y - next.y) < 0.05;
        
        if (!isCollinearX && !isCollinearY) {
            result.push(curr);
        }
    }
    result.push(unique[unique.length - 1]);
    return result;
}

function getPathCenter(points) {
    if (!points || points.length === 0) return { x: 0, y: 0 };
    if (points.length === 1) return { x: points[0].x, y: points[0].y };
    
    let totalLength = 0;
    const segments = [];
    
    for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];
        const len = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        totalLength += len;
        segments.push({ p1, p2, len });
    }
    
    if (totalLength === 0) {
        return { x: points[0].x, y: points[0].y };
    }
    
    const target = totalLength / 2;
    let accumulated = 0;
    
    for (let seg of segments) {
        if (accumulated + seg.len >= target) {
            const remaining = target - accumulated;
            const ratio = seg.len > 0 ? remaining / seg.len : 0;
            return {
                x: seg.p1.x + (seg.p2.x - seg.p1.x) * ratio,
                y: seg.p1.y + (seg.p2.y - seg.p1.y) * ratio
            };
        }
        accumulated += seg.len;
    }
    
    const last = points[points.length - 1];
    return { x: last.x, y: last.y };
}

// Convert point arrays into SVG Path strings (with rounded Bezier corner adjustments)
function getSvgPathString(points, isSmooth, radius) {
    if (points.length === 0) return '';
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
    
    if (!isSmooth || radius <= 0 || points.length < 3) {
        let d = `M ${points[0].x} ${points[0].y}`;
        for (let i = 1; i < points.length; i++) {
            d += ` L ${points[i].x} ${points[i].y}`;
        }
        return d;
    }
    
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length - 1; i++) {
        const prev = points[i - 1];
        const curr = points[i];
        const next = points[i + 1];
        
        const dist1 = Math.hypot(curr.x - prev.x, curr.y - prev.y);
        const dist2 = Math.hypot(next.x - curr.x, next.y - curr.y);
        
        // Avoid overlapping beziers on short wire segments
        const safeRadius = Math.min(radius, dist1 / 2, dist2 / 2);
        
        const arcStart = {
            x: curr.x + (safeRadius * (prev.x - curr.x)) / dist1,
            y: curr.y + (safeRadius * (prev.y - curr.y)) / dist1
        };
        const arcEnd = {
            x: curr.x + (safeRadius * (next.x - curr.x)) / dist2,
            y: curr.y + (safeRadius * (next.y - curr.y)) / dist2
        };
        
        d += ` L ${arcStart.x} ${arcStart.y} Q ${curr.x} ${curr.y} ${arcEnd.x} ${arcEnd.y}`;
    }
    
    const last = points[points.length - 1];
    d += ` L ${last.x} ${last.y}`;
    return d;
}

// DYNAMICALLY GENERATED MARKERS TO PREVENT COLOR MISMATCHES IN PNG EXPORTS
function getOrCreateMarker(type, colorHex) {
    const colorId = colorHex.replace('#', '');
    const markerId = `${type}-${colorId}`;
    
    let marker = document.getElementById(markerId);
    if (!marker) {
        const defs = svg.querySelector('defs');
        
        // Clone default marker template
        if (type === 'arrow-end') {
            marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
            marker.id = markerId;
            marker.setAttribute('markerWidth', '10');
            marker.setAttribute('markerHeight', '7');
            marker.setAttribute('refX', '8');
            marker.setAttribute('refY', '3.5');
            marker.setAttribute('orient', 'auto');
            marker.setAttribute('markerUnits', 'strokeWidth');
            
            const poly = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
            poly.setAttribute('points', '0 0, 10 3.5, 0 7');
            poly.setAttribute('fill', colorHex);
            marker.appendChild(poly);
        } 
        else if (type === 'arrow-start') {
            marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
            marker.id = markerId;
            marker.setAttribute('markerWidth', '10');
            marker.setAttribute('markerHeight', '7');
            marker.setAttribute('refX', '2');
            marker.setAttribute('refY', '3.5');
            marker.setAttribute('orient', 'auto');
            marker.setAttribute('markerUnits', 'strokeWidth');
            
            const poly = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
            poly.setAttribute('points', '10 0, 0 3.5, 10 7');
            poly.setAttribute('fill', colorHex);
            marker.appendChild(poly);
        }
        else if (type === 'circle-end' || type === 'circle-start') {
            marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
            marker.id = markerId;
            marker.setAttribute('markerWidth', '8');
            marker.setAttribute('markerHeight', '8');
            marker.setAttribute('refX', '4');
            marker.setAttribute('refY', '4');
            marker.setAttribute('orient', 'auto');
            marker.setAttribute('markerUnits', 'strokeWidth');
            
            const circ = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            circ.setAttribute('cx', '4');
            circ.setAttribute('cy', '4');
            circ.setAttribute('r', '3.5');
            circ.setAttribute('fill', colorHex);
            marker.appendChild(circ);
        }
        
        if (marker) defs.appendChild(marker);
    }
    
    return `url(#${markerId})`;
}

// RENDERING DIAGRAM GRAPHICS
function renderDiagram() {
    // 1. Render Connections
    connectionsGroup.innerHTML = '';
    state.connections.forEach(conn => {
        const nodeA = state.nodes.find(n => n.id === conn.fromId);
        const nodeB = state.nodes.find(n => n.id === conn.toId);
        if (!nodeA || !nodeB) return;
        
        const points = calculatePathPoints(nodeA, nodeB, conn);
        const pathStr = getSvgPathString(points, conn.routing === 'smooth', conn.radius);
        
        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        g.id = conn.id;
        g.setAttribute('class', `svg-connection ${state.selectedConnectionId === conn.id ? 'selected' : ''}`);
        g.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            
            // Manual double-click detection for connections
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
            state.lastClickedNodeId = null; // clear other clicks
            
            state.selectedConnectionId = conn.id;
            state.selectedNodeIds = [];
            state.shiftSelectedNodeIds = [];
            hideFloatingPlus();
            updateInspector();
            renderDiagram();
        });
        
        // Background thick line for easy clicking/hovering
        const bgPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
        bgPath.setAttribute('d', pathStr);
        bgPath.setAttribute('class', 'conn-path-bg');
        g.appendChild(bgPath);
        
        // Front wire line
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute('d', pathStr);
        path.setAttribute('class', 'conn-path');
        path.setAttribute('stroke', conn.color);
        path.setAttribute('stroke-width', conn.thickness);
        path.style.setProperty('--base-stroke-width', `${conn.thickness}px`);
        
        // Apply arrow marker ends
        if (conn.arrowStart !== 'none') {
            const markerType = conn.arrowStart === 'circle' ? 'circle-start' : 'arrow-start';
            path.setAttribute('marker-start', getOrCreateMarker(markerType, conn.color));
        }
        if (conn.arrowEnd !== 'none') {
            const markerType = conn.arrowEnd === 'circle' ? 'circle-end' : 'arrow-end';
            path.setAttribute('marker-end', getOrCreateMarker(markerType, conn.color));
        }
        
        g.appendChild(path);
        
        // Text label
        if (conn.label) {
            const mid = getPathCenter(points);
            const ox = conn.labelOffsetX || 0;
            const oy = conn.labelOffsetY || 0;
            const lx = mid.x + ox;
            const ly = mid.y + oy;
            
            const labelGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
            labelGroup.setAttribute('class', 'conn-label-group');
            
            const textBg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            textBg.setAttribute('class', 'conn-label-bg');
            
            const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
            text.setAttribute('x', lx);
            text.setAttribute('y', ly + 4);
            text.setAttribute('class', 'conn-label-text');
            text.textContent = conn.label;
            
            labelGroup.appendChild(textBg);
            labelGroup.appendChild(text);
            
            labelGroup.addEventListener('mousedown', (e) => startConnLabelDrag(conn.id, e));
            g.appendChild(labelGroup);
            
            // Adjust label backdrop dimensions to cover wire text boundary perfectly
            setTimeout(() => {
                try {
                    const bbox = text.getBBox();
                    textBg.setAttribute('x', bbox.x - 6);
                    textBg.setAttribute('y', bbox.y - 2);
                    textBg.setAttribute('width', bbox.width + 12);
                    textBg.setAttribute('height', bbox.height + 4);
                } catch(e){}
            }, 0);
        }
        
        connectionsGroup.appendChild(g);
    });
    
    // 2. Render Nodes
    nodesGroup.innerHTML = '';
    state.nodes.forEach(node => {
        const isSelected = state.selectedNodeIds.includes(node.id);
        const isShiftSelected = state.shiftSelectedNodeIds.includes(node.id);
        
        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        g.id = node.id;
        g.setAttribute('class', `svg-node ${isSelected ? 'selected' : ''} ${isShiftSelected ? 'shift-selected' : ''}`);
        g.setAttribute('transform', `translate(${node.x}, ${node.y})`);
        
        // Mousedown selects/drags node (includes manual double-click detection)
        g.addEventListener('mousedown', (e) => startNodeDrag(node.id, e));
        
        // Render base shape (rect or image)
        if (node.type === 'image' && node.imageSrc) {
            // Custom Image node
            const image = document.createElementNS("http://www.w3.org/2000/svg", "image");
            image.setAttribute('href', node.imageSrc);
            image.setAttribute('width', node.w);
            image.setAttribute('height', node.h);
            image.setAttribute('preserveAspectRatio', 'xMidYMid meet');
            g.appendChild(image);
            
            // Border outline around image
            const outline = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            outline.setAttribute('width', node.w);
            outline.setAttribute('height', node.h);
            outline.setAttribute('class', 'node-shape-image-border');
            outline.setAttribute('fill', 'none');
            outline.setAttribute('stroke', node.borderThickness > 0 ? node.border : 'none');
            outline.setAttribute('stroke-width', node.borderThickness);
            outline.setAttribute('rx', 4);
            g.appendChild(outline);
        } else {
            // Box shape node
            const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            rect.setAttribute('width', node.w);
            rect.setAttribute('height', node.h);
            rect.setAttribute('class', 'node-shape-rect');
            rect.setAttribute('fill', node.fill);
            rect.setAttribute('stroke', node.border);
            rect.setAttribute('stroke-width', node.borderThickness);
            rect.setAttribute('rx', 8);
            g.appendChild(rect);
        }
        
        // Text label rendering (using foreignObject for automatic browser wrapping)
        const textH = Math.max(30, node.h);
        const foreign = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
        foreign.setAttribute('width', node.w);
        
        const defaultY = node.type === 'image' ? (node.h + 6) : ((node.h - textH) / 2);
        const ox = node.labelOffsetX || 0;
        const oy = node.labelOffsetY || 0;
        
        foreign.setAttribute('x', ox);
        foreign.setAttribute('y', defaultY + oy);
        foreign.setAttribute('height', node.type === 'image' ? 50 : textH);
        
        foreign.setAttribute('class', 'node-label-foreign');
        
        const editorDiv = document.createElement('div');
        editorDiv.setAttribute('class', 'node-label-editor');
        editorDiv.style.fontSize = `${node.fontSize}px`;
        editorDiv.style.color = node.textColor;
        
        const textSpan = document.createElement('span');
        textSpan.className = 'label-text-span';
        textSpan.textContent = node.label || "";
        editorDiv.appendChild(textSpan);
        
        foreign.appendChild(editorDiv);
        
        // Add mousedown listener to enable label dragging when selected
        foreign.addEventListener('mousedown', (e) => startLabelDrag(node.id, e));
        
        g.appendChild(foreign);
        
        // Render resize handle (bottom-right corner)
        const handleSize = 12;
        const handle = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        handle.setAttribute('x', node.w - handleSize / 2);
        handle.setAttribute('y', node.h - handleSize / 2);
        handle.setAttribute('width', handleSize);
        handle.setAttribute('height', handleSize);
        handle.setAttribute('class', 'resize-handle');
        handle.setAttribute('rx', 2);
        handle.addEventListener('mousedown', (e) => startNodeResize(node.id, e));
        g.appendChild(handle);
        
        nodesGroup.appendChild(g);
    });
}

// Live node-dragging DOM update (keeps UI fast & buttery)
function updateNodeSvgElement(node) {
    const nodeEl = document.getElementById(node.id);
    if (!nodeEl) return;
    
    nodeEl.setAttribute('transform', `translate(${node.x}, ${node.y})`);
    
    // Update rect or image width/height attributes
    const rect = nodeEl.querySelector('.node-shape-rect');
    if (rect) {
        rect.setAttribute('width', node.w);
        rect.setAttribute('height', node.h);
    }
    const outline = nodeEl.querySelector('.node-shape-image-border');
    if (outline) {
        outline.setAttribute('width', node.w);
        outline.setAttribute('height', node.h);
    }
    const image = nodeEl.querySelector('image');
    if (image) {
        image.setAttribute('width', node.w);
        image.setAttribute('height', node.h);
    }
    
    // Update text container boundary (including custom drag offset)
    const foreign = nodeEl.querySelector('.node-label-foreign');
    if (foreign) {
        foreign.setAttribute('width', node.w);
        const textH = Math.max(30, node.h);
        const defaultY = node.type === 'image' ? (node.h + 6) : ((node.h - textH) / 2);
        foreign.setAttribute('x', node.labelOffsetX || 0);
        foreign.setAttribute('y', defaultY + (node.labelOffsetY || 0));
        if (node.type !== 'image') {
            foreign.setAttribute('height', textH);
        }
    }
    
    // Update resize handle coordinate
    const handle = nodeEl.querySelector('.resize-handle');
    if (handle) {
        handle.setAttribute('x', node.w - 6);
        handle.setAttribute('y', node.h - 6);
    }
}

// Re-route connection lines attached to specific Node ID
function updateNodeConnections(nodeId) {
    state.connections.forEach(conn => {
        if (conn.fromId === nodeId || conn.toId === nodeId) {
            const connEl = document.getElementById(conn.id);
            if (!connEl) return;
            
            const nodeA = state.nodes.find(n => n.id === conn.fromId);
            const nodeB = state.nodes.find(n => n.id === conn.toId);
            if (!nodeA || !nodeB) return;
            
            const points = calculatePathPoints(nodeA, nodeB, conn);
            const pathStr = getSvgPathString(points, conn.routing === 'smooth', conn.radius);
            
            const paths = connEl.querySelectorAll('path');
            paths.forEach(path => path.setAttribute('d', pathStr));
            
            // Relocate wire label if exists
            const text = connEl.querySelector('.conn-label-text');
            const textBg = connEl.querySelector('.conn-label-bg');
            if (text && textBg) {
                const points = calculatePathPoints(nodeA, nodeB, conn);
                const mid = getPathCenter(points);
                const ox = conn.labelOffsetX || 0;
                const oy = conn.labelOffsetY || 0;
                const lx = mid.x + ox;
                const ly = mid.y + oy;
                
                text.setAttribute('x', lx);
                text.setAttribute('y', ly + 4);
                
                // Readjust backdrop
                try {
                    const bbox = text.getBBox();
                    textBg.setAttribute('x', bbox.x - 6);
                    textBg.setAttribute('y', bbox.y - 2);
                    textBg.setAttribute('width', bbox.width + 12);
                    textBg.setAttribute('height', bbox.height + 4);
                } catch(e){}
            }
        }
    });
}

// DYNAMIC INSPECTOR SYNC
function updateInspector() {
    const emptyPanel = document.getElementById('inspector-empty');
    const nodePanel = document.getElementById('inspector-node');
    const connPanel = document.getElementById('inspector-connection');
    
    // Default hiding
    emptyPanel.style.display = 'none';
    nodePanel.style.display = 'none';
    connPanel.style.display = 'none';
    
    if (state.selectedNodeIds.length === 1) {
        nodePanel.style.display = 'block';
        const node = state.nodes.find(n => n.id === state.selectedNodeIds[0]);
        if (!node) return;
        
        document.getElementById('node-label').value = node.label || "";
        document.getElementById('node-type-display').textContent = 
            node.type === 'image' ? 'Image Block' : 'Custom Box';
        document.getElementById('node-fill-custom').value = node.fill.substr(0, 7);
        document.getElementById('node-border-custom').value = node.border;
        
        document.getElementById('node-border-thickness').value = node.borderThickness;
        document.getElementById('node-border-thickness-val').textContent = `${node.borderThickness}px`;
        
        document.getElementById('node-font-size').value = node.fontSize;
        document.getElementById('node-font-size-val').textContent = `${node.fontSize}px`;
        document.getElementById('node-text-color').value = node.textColor;
        
        document.getElementById('node-width').value = node.w;
        document.getElementById('node-height').value = node.h;
        
        // highlight active preset fill color if matching
        document.querySelectorAll('#node-fill-presets .color-preset').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.value === node.border);
        });
    } 
    else if (state.selectedConnectionId) {
        connPanel.style.display = 'block';
        const conn = state.connections.find(c => c.id === state.selectedConnectionId);
        if (!conn) return;
        
        document.getElementById('conn-label').value = conn.label || "";
        document.getElementById('conn-color-custom').value = conn.color;
        
        document.getElementById('conn-thickness').value = conn.thickness;
        document.getElementById('conn-thickness-val').textContent = `${conn.thickness}px`;
        
        document.getElementById('conn-arrow-start').value = conn.arrowStart;
        document.getElementById('conn-arrow-end').value = conn.arrowEnd;
        
        // Radio button routing sync
        document.getElementsByName('conn-routing').forEach(radio => {
            radio.checked = radio.value === conn.routing;
        });
        document.getElementById('conn-radius-group').style.display = 
            conn.routing === 'smooth' ? 'flex' : 'none';
        
        document.getElementById('conn-radius').value = conn.radius;
        document.getElementById('conn-radius-val').textContent = `${conn.radius}px`;
        
        // highlight active color preset
        document.querySelectorAll('#conn-color-presets .color-preset').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.value === conn.color);
        });
    } 
    else {
        emptyPanel.style.display = 'flex';
    }
}

// DELETE SHORTCUT FUNCTIONS
function deleteSelectedNodes() {
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

function deleteSelectedConnection() {
    if (!state.selectedConnectionId) return;
    
    state.connections = state.connections.filter(c => c.id !== state.selectedConnectionId);
    state.selectedConnectionId = null;
    
    saveStateToLocalStorage();
    renderDiagram();
    updateInspector();
}

// DIAGRAM SERIALIZATION (SAVE / LOAD JSON)
function saveJson() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
        nodes: state.nodes,
        connections: state.connections
    }, null, 2));
    
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", "aperture_wiring_diagram.json");
    dlAnchorElem.click();
}

function loadJson(e) {
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

// CROP EXPORT TO HIGH RESOLUTION PNG
function exportPng() {
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
        // Check for node text underneath image node boundary
        const actualH = n.type === 'image' ? n.h + 50 : n.h;
        if (n.y + actualH > maxY) maxY = n.y + actualH;
    });
    
    // Include connection path bounds just in case wires curve outwards
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
    const clone = svg.cloneNode(true);
    
    // Set viewport crop on clone (excluding coordinates offset by viewport pans)
    clone.setAttribute('width', cropW);
    clone.setAttribute('height', cropH);
    clone.setAttribute('viewBox', `${minX} ${minY} ${cropW} ${cropH}`);
    
    // 3. Remove non-export items (Grid patterns, selection outline classes)
    const clonedGrid = clone.querySelector('#canvas-grid');
    if (clonedGrid) clonedGrid.remove();
    
    const clonedViewport = clone.querySelector('#viewport-g');
    if (clonedViewport) {
        // Remove panning/zooming scales from the clone
        clonedViewport.removeAttribute('transform');
    }
    
    // Remove selection glows and resize handle elements inside clone
    clone.querySelectorAll('.svg-node').forEach(node => {
        node.setAttribute('class', 'svg-node'); // clear selected/shift-selected classes
        const handle = node.querySelector('.resize-handle');
        if (handle) handle.remove();
    });
    clone.querySelectorAll('.svg-connection').forEach(conn => {
        conn.setAttribute('class', 'svg-connection'); // clear selection styles
    });
    
    // 4. Load cloned SVG XML into off-screen canvas to convert to PNG
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(clone);
    
    // Handle inline CSS styles in SVG. Let's append current stylesheet contents into clone defs to guarantee text fonts/colors render identical
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
        
        // Draw transparent backdrop or solid dark backdrop (let's export it as transparent for maximum versatility!)
        ctx.clearRect(0, 0, cropW, cropH);
        
        ctx.drawImage(image, 0, 0);
        
        // Download PNG
        const pngUrl = canvas.toDataURL('image/png');
        const dlLink = document.createElement('a');
        dlLink.download = 'aperture_wiring_diagram.png';
        dlLink.href = pngUrl;
        dlLink.click();
        
        URL.revokeObjectURL(blobURL);
    };
    image.src = blobURL;
}
