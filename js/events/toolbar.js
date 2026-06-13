import { dom } from '../dom.js';
import { state, saveStateToLocalStorage } from '../state.js';
import { renderDiagram } from '../renderer.js';
import { updateInspector } from '../inspector.js';
import { zoomCanvas, centerViewport } from '../viewport.js';
import { 
    addNode, 
    handleImageUploadNode, 
    hideFloatingPlus, 
    createConnectionFromGesture 
} from '../editor.js';
import { exportPng, saveJson, loadJson } from '../exporter.js';

export function setupToolbarEventListeners() {
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
    
    // Floating connector Plus button click
    dom.floatingConnectBtn.addEventListener('click', createConnectionFromGesture);
}
