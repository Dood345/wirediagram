/**
 * Events Facade / Orchestrator
 * Restructured to import events from specific modules under events/
 */
import { setupCanvasEventListeners } from './events/canvas.js';
import { setupKeyboardEventListeners } from './events/keyboard.js';
import { setupContextMenu } from './events/contextmenu.js';
import { setupToolbarEventListeners } from './events/toolbar.js';
import { setupInspectorEventListeners } from './inspector.js';
import { updateBreadcrumbs } from './subdiagram.js';

export function setupEventListeners() {
    setupCanvasEventListeners();
    setupKeyboardEventListeners();
    setupContextMenu();
    setupToolbarEventListeners();
    setupInspectorEventListeners();
    updateBreadcrumbs();
}

// Re-export handlers to maintain public API compatibility
export {
    handleKeyDown,
    handleKeyUp
} from './events/keyboard.js';

export {
    handleCanvasMouseDown,
    handleCanvasPanMove,
    handleCanvasPanUp,
    handleCanvasWheel
} from './events/canvas.js';

export {
    startNodeDrag,
    handleNodeDragMove,
    handleNodeDragUp,
    startNodeResize,
    handleNodeResizeMove,
    handleNodeResizeUp,
    startLabelDrag,
    handleLabelDragMove,
    handleLabelDragUp,
    startConnLabelDrag,
    handleConnLabelDragMove,
    handleConnLabelDragUp,
    handleConnectionMouseDown
} from './events/drag.js';
