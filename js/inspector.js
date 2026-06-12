import { state, saveStateToLocalStorage } from './state.js';
import { COLOR_PRESETS } from './config.js';
import { renderDiagram } from './renderer.js';

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
        if (node && node.type !== 'port') {
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
        
        document.getElementById('node-label').value = node.label || "";
        document.getElementById('node-label').disabled = isPort;
        
        document.getElementById('node-type-display').textContent = 
            node.type === 'image' ? 'Image Block' : (node.type === 'port' ? 'Boundary Port' : 'Custom Box');
        
        const customFill = document.getElementById('node-fill-custom');
        customFill.value = (node.fill || '#10b981').substr(0, 7);
        customFill.disabled = isPort;
        
        const customBorder = document.getElementById('node-border-custom');
        customBorder.value = node.border || '#10b981';
        customBorder.disabled = isPort;
        
        const borderThickness = document.getElementById('node-border-thickness');
        borderThickness.value = node.borderThickness || 0;
        borderThickness.disabled = isPort;
        document.getElementById('node-border-thickness-val').textContent = `${node.borderThickness || 0}px`;
        
        const fontSize = document.getElementById('node-font-size');
        fontSize.value = node.fontSize || 10;
        fontSize.disabled = isPort;
        document.getElementById('node-font-size-val').textContent = `${node.fontSize || 10}px`;
        
        const textColor = document.getElementById('node-text-color');
        textColor.value = node.textColor || '#f8fafc';
        textColor.disabled = isPort;
        
        const nodeWidth = document.getElementById('node-width');
        nodeWidth.value = node.w;
        nodeWidth.disabled = isPort;
        
        const nodeHeight = document.getElementById('node-height');
        nodeHeight.value = node.h;
        nodeHeight.disabled = isPort;
        
        const presetContainer = document.getElementById('node-fill-presets');
        if (presetContainer) {
            presetContainer.style.opacity = isPort ? '0.5' : '1.0';
            presetContainer.style.pointerEvents = isPort ? 'none' : 'auto';
        }
        
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
