import { dom } from '../dom.js';
import { state } from '../state.js';
import { zoomCanvas } from '../viewport.js';
import { renderDiagram } from '../renderer.js';
import { updateInspector } from '../inspector.js';
import { hideFloatingPlus } from '../editor.js';
import { getIsSpacePressed } from './keyboard.js';

export function handleCanvasMouseDown(e) {
    // Force blur any active inline text editor if clicking outside it
    const activeEditor = document.querySelector('.text-editor-input');
    if (activeEditor && e.target !== activeEditor) {
        activeEditor.blur();
    }
    
    const clickedElement = e.target;
    const isBackgroundClick = (clickedElement === dom.svg || clickedElement === dom.canvasGrid);
    
    if (e.button === 1 || getIsSpacePressed() || (e.button === 0 && isBackgroundClick)) {
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
    dom.canvasContainer.style.cursor = getIsSpacePressed() ? 'grab' : 'default';
    window.removeEventListener('mousemove', handleCanvasPanMove);
    window.removeEventListener('mouseup', handleCanvasPanUp);
}

export function handleCanvasWheel(e) {
    e.preventDefault();
    const zoomFactor = 0.08;
    const delta = -Math.sign(e.deltaY) * zoomFactor;
    zoomCanvas(delta, e.clientX, e.clientY);
}

export function setupCanvasEventListeners() {
    dom.canvasContainer.addEventListener('mousedown', handleCanvasMouseDown);
    dom.canvasContainer.addEventListener('wheel', handleCanvasWheel, { passive: false });
}
