import { dom } from '../dom.js';
import { state } from '../state.js';
import { 
    copySelectedNodes, 
    pasteNodes, 
    deleteSelectedNodes, 
    deleteSelectedConnection 
} from '../editor.js';

let isSpacePressed = false;

export function getIsSpacePressed() {
    return isSpacePressed;
}

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

export function handleKeyUp(e) {
    if (e.code === 'Space') {
        isSpacePressed = false;
        dom.canvasContainer.style.cursor = 'default';
    }
}

export function setupKeyboardEventListeners() {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
}
