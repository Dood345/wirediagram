/**
 * Centralized DOM elements mapping
 */
export const dom = {
    svg: null,
    canvasContainer: null,
    nodesGroup: null,
    connectionsGroup: null,
    overlaysGroup: null,
    canvasGrid: null,
    floatingConnectBtn: null,
    viewportG: null // Dynamically set in viewport.js
};

export function initDomReferences() {
    dom.svg = document.getElementById('canvas-svg');
    dom.canvasContainer = document.getElementById('canvas-container');
    dom.nodesGroup = document.getElementById('nodes-group');
    dom.connectionsGroup = document.getElementById('connections-group');
    dom.overlaysGroup = document.getElementById('overlays-group');
    dom.canvasGrid = document.getElementById('canvas-grid');
    dom.floatingConnectBtn = document.getElementById('floating-connect-btn');
}
