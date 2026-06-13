import { state, saveStateToLocalStorage } from './state.js';
import { COLOR_PRESETS } from './config.js';
import { renderDiagram } from './renderer.js';
import { syncBoundaryPorts } from './subdiagram.js';
import { deleteSelectedNodes, deleteSelectedConnection } from './editor.js';

/**
 * Setup color preset buttons in the inspector sidebars
 */
export function setupColorPresets() {
    const fillPresets = document.getElementById('node-fill-presets');
    const connPresets = document.getElementById('conn-color-presets');
    
    if (fillPresets && connPresets) {
        fillPresets.innerHTML = '';
        connPresets.innerHTML = '';
        
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
}

/**
 * Apply Node Fill Preset
 */
export function applyNodeFillPreset(colorHex) {
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

/**
 * Apply Connection Color Preset
 */
export function applyConnColorPreset(colorHex) {
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

/**
 * Sync active item properties with inspector form elements
 */
export function updateInspector() {
    const emptyPanel = document.getElementById('inspector-empty');
    const nodePanel = document.getElementById('inspector-node');
    const connPanel = document.getElementById('inspector-connection');
    
    if (!emptyPanel || !nodePanel || !connPanel) return;
    
    emptyPanel.style.display = 'none';
    nodePanel.style.display = 'none';
    connPanel.style.display = 'none';
    
    if (state.selectedNodeIds.length === 1) {
        nodePanel.style.display = 'block';
        const node = state.nodes.find(n => n.id === state.selectedNodeIds[0]);
        if (!node) return;
        
        const isPort = node.type === 'port';
        
        if (isPort) {
            const connId = node.id.replace('port_', '');
            const parentLevel = state.navigationStack[state.navigationStack.length - 1];
            const conn = parentLevel ? parentLevel.connections.find(c => c.id === connId) : null;
            document.getElementById('node-label').value = conn ? (conn.label || "") : "";
        } else {
            document.getElementById('node-label').value = node.label || "";
        }

        document.getElementById('node-type-display').textContent = 
            isPort ? 'Boundary Port' : (node.type === 'image' ? 'Image Block' : 'Custom Box');

        const btnChangeImage = document.getElementById('btn-node-change-image');
        const fillControls = document.querySelector('.fill-controls');
        const borderControls = document.querySelector('.border-controls');
        const textControls = document.querySelector('.text-controls');
        const dimControls = document.querySelector('.dimension-controls');
        const btnDeleteNode = document.getElementById('btn-delete-node');
        
        if (btnChangeImage) btnChangeImage.style.display = isPort ? 'none' : 'block';
        if (fillControls) fillControls.style.display = isPort ? 'none' : 'block';
        if (borderControls) borderControls.style.display = isPort ? 'none' : 'block';
        if (textControls) textControls.style.display = isPort ? 'none' : 'block';
        if (dimControls) dimControls.style.display = isPort ? 'none' : 'block';
        if (btnDeleteNode) btnDeleteNode.style.display = isPort ? 'none' : 'block';

        if (!isPort) {
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

/**
 * Register all event listeners for inspector form fields
 */
export function setupInspectorEventListeners() {
    // Inspector events (Node)
    document.getElementById('node-label').addEventListener('input', (e) => {
        state.selectedNodeIds.forEach(id => {
            const node = state.nodes.find(n => n.id === id);
            if (node) {
                if (node.type === 'port') {
                    const connId = node.id.replace('port_', '');
                    if (state.navigationStack.length > 0) {
                        const parentLevel = state.navigationStack[state.navigationStack.length - 1];
                        const conn = parentLevel.connections.find(c => c.id === connId);
                        if (conn) conn.label = e.target.value;
                    }
                    syncBoundaryPorts();
                } else {
                    node.label = e.target.value;
                }
            }
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
}
