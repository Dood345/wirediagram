import { dom } from '../dom.js';
import { state, saveStateToLocalStorage } from '../state.js';
import { renderDiagram } from '../renderer.js';
import { updateInspector } from '../inspector.js';
import { getSvgCoords } from '../viewport.js';
import { 
    addNode, 
    deleteSelectedNodes, 
    deleteSelectedConnection, 
    hideFloatingPlus, 
    copySelectedNodes, 
    pasteNodes 
} from '../editor.js';
import { enterNodeDiagram, exitToParentDiagram } from '../subdiagram.js';

export function setupContextMenu() {
    let contextMenu = document.getElementById('context-menu');
    if (!contextMenu) {
        contextMenu = document.createElement('div');
        contextMenu.id = 'context-menu';
        contextMenu.className = 'context-menu';
        
        contextMenu.innerHTML = `
            <div class="context-menu-item" id="ctx-go-inside">Go Inside</div>
            <div class="context-menu-item" id="ctx-go-up">Go Back Up</div>
            <div class="context-menu-separator" id="ctx-nested-separator"></div>
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
        
        const selectedNode = state.selectedNodeIds.length === 1 ? state.nodes.find(n => n.id === state.selectedNodeIds[0]) : null;
        const canGoInside = selectedNode && selectedNode.type !== 'port';
        const canGoUp = state.currentParentNodeId !== null;
        
        const btnGoInside = document.getElementById('ctx-go-inside');
        const btnGoUp = document.getElementById('ctx-go-up');
        const nestedSeparator = document.getElementById('ctx-nested-separator');
        
        btnGoInside.style.display = canGoInside ? 'flex' : 'none';
        btnGoUp.style.display = canGoUp ? 'flex' : 'none';
        nestedSeparator.style.display = (canGoInside || canGoUp) ? 'block' : 'none';
        
        const btnCopy = document.getElementById('ctx-copy');
        const btnPaste = document.getElementById('ctx-paste');
        const btnDelete = document.getElementById('ctx-delete');
        
        btnCopy.classList.toggle('disabled', !hasNodeSelected || (selectedNode && selectedNode.type === 'port'));
        btnPaste.classList.toggle('disabled', !hasClipboard);
        btnDelete.classList.toggle('disabled', (!hasNodeSelected && !hasConnSelected) || (selectedNode && selectedNode.type === 'port'));
        
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
        const selectedNode = state.selectedNodeIds.length === 1 ? state.nodes.find(n => n.id === state.selectedNodeIds[0]) : null;
        if (selectedNode && selectedNode.type === 'port') return;
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
        const selectedNode = state.selectedNodeIds.length === 1 ? state.nodes.find(n => n.id === state.selectedNodeIds[0]) : null;
        if (selectedNode && selectedNode.type === 'port') return;
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
    
    document.getElementById('ctx-go-inside').addEventListener('click', () => {
        if (state.selectedNodeIds.length === 1) {
            enterNodeDiagram(state.selectedNodeIds[0]);
        }
        hideContextMenu();
    });
    
    document.getElementById('ctx-go-up').addEventListener('click', () => {
        exitToParentDiagram();
        hideContextMenu();
    });
}
