import { dom } from './dom.js';
import { state } from './state.js';
import { calculatePathPoints, getPathCenter, getSvgPathString } from './routing.js';
import { updateInspector } from './inspector.js';
import { hideFloatingPlus } from './editor.js';
import { getSubDiagramBounds } from './subdiagram.js';
import { 
    startNodeDrag, 
    startNodeResize, 
    startLabelDrag, 
    startConnLabelDrag, 
    handleConnectionMouseDown 
} from './events.js';

/**
 * Dynamically generated markers to prevent color mismatches in exports
 */
export function getOrCreateMarker(type, colorHex) {
    const colorId = colorHex.replace('#', '');
    const markerId = `${type}-${colorId}`;
    
    let marker = document.getElementById(markerId);
    if (!marker) {
        const defs = dom.svg.querySelector('defs');
        
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

/**
 * Render all diagram elements (connections and nodes)
 */
export function renderDiagram() {
    // Render enclosing frame for sub-diagrams
    let bgGroup = document.getElementById('subdiagram-bg-group');
    if (!bgGroup) {
        bgGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
        bgGroup.id = 'subdiagram-bg-group';
        const parentElement = dom.viewportG || dom.svg;
        parentElement.insertBefore(bgGroup, dom.connectionsGroup);
    }
    bgGroup.innerHTML = '';
    
    if (state.currentParentNodeId !== null) {
        const bounds = getSubDiagramBounds();
        
        const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        rect.setAttribute('x', bounds.x);
        rect.setAttribute('y', bounds.y);
        rect.setAttribute('width', bounds.w);
        rect.setAttribute('height', bounds.h);
        rect.setAttribute('class', 'subdiagram-frame');
        bgGroup.appendChild(rect);
        
        const parentLevel = state.navigationStack[state.navigationStack.length - 1];
        const parentNode = parentLevel ? parentLevel.nodes.find(n => n.id === state.currentParentNodeId) : null;
        const titleText = parentNode ? parentNode.label : "Sub-Diagram";
        
        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute('x', bounds.x + 10);
        text.setAttribute('y', bounds.y - 12);
        text.setAttribute('class', 'subdiagram-frame-title');
        text.textContent = `${titleText} Workspace`;
        bgGroup.appendChild(text);
    }
    
    // 1. Render Connections
    dom.connectionsGroup.innerHTML = '';
    state.connections.forEach(conn => {
        const nodeA = state.nodes.find(n => n.id === conn.fromId);
        const nodeB = state.nodes.find(n => n.id === conn.toId);
        if (!nodeA || !nodeB) return;
        
        const points = calculatePathPoints(nodeA, nodeB, conn);
        const pathStr = getSvgPathString(points, conn.routing === 'smooth', conn.radius);
        
        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        g.id = conn.id;
        g.setAttribute('class', `svg-connection ${state.selectedConnectionId === conn.id ? 'selected' : ''}`);
        g.addEventListener('mousedown', (e) => handleConnectionMouseDown(conn, e));
        
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
        
        dom.connectionsGroup.appendChild(g);
    });
    
    // 2. Render Nodes
    dom.nodesGroup.innerHTML = '';
    state.nodes.forEach(node => {
        const isSelected = state.selectedNodeIds.includes(node.id);
        const isShiftSelected = state.shiftSelectedNodeIds.includes(node.id);
        
        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        g.id = node.id;
        g.setAttribute('class', `svg-node ${node.type === 'port' ? 'port' : ''} ${isSelected ? 'selected' : ''} ${isShiftSelected ? 'shift-selected' : ''}`);
        g.setAttribute('transform', `translate(${node.x}, ${node.y})`);
        
        if (node.type === 'port') {
            const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            rect.setAttribute('x', -6);
            rect.setAttribute('y', -6);
            rect.setAttribute('width', 12);
            rect.setAttribute('height', 12);
            rect.setAttribute('rx', 3);
            rect.setAttribute('class', 'port-base');
            rect.setAttribute('fill', node.direction === 'in' ? '#10b981' : '#6366f1');
            g.appendChild(rect);
            
            const labelText = document.createElementNS("http://www.w3.org/2000/svg", "text");
            labelText.setAttribute('class', 'port-label');
            labelText.setAttribute('fill', '#f8fafc');
            labelText.setAttribute('font-size', '10px');
            labelText.setAttribute('font-family', 'var(--font-sans)');
            labelText.setAttribute('font-weight', '500');
            
            let tx = 0, ty = 0, anchor = 'middle';
            if (node.side === 'L') {
                tx = -12; ty = 3; anchor = 'end';
            } else if (node.side === 'R') {
                tx = 12; ty = 3; anchor = 'start';
            } else if (node.side === 'T') {
                tx = 0; ty = -12; anchor = 'middle';
            } else if (node.side === 'B') {
                tx = 0; ty = 20; anchor = 'middle';
            }
            labelText.setAttribute('x', tx);
            labelText.setAttribute('y', ty);
            labelText.setAttribute('text-anchor', anchor);
            labelText.textContent = node.label;
            g.appendChild(labelText);
            
            g.addEventListener('mousedown', (e) => startNodeDrag(node.id, e));
            dom.nodesGroup.appendChild(g);
            return;
        }
        
        g.addEventListener('mousedown', (e) => startNodeDrag(node.id, e));
        
        // Render base shape (rect or image)
        if (node.type === 'image' && node.imageSrc) {
            const image = document.createElementNS("http://www.w3.org/2000/svg", "image");
            image.setAttribute('href', node.imageSrc);
            image.setAttribute('width', node.w);
            image.setAttribute('height', node.h);
            image.setAttribute('preserveAspectRatio', 'xMidYMid meet');
            g.appendChild(image);
            
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
        
        // Render blurred sub-diagram snapshot inside the box shape if child diagram exists
        if (node.childDiagram && Array.isArray(node.childDiagram.nodes) && node.childDiagram.nodes.length > 0) {
            const childNodes = node.childDiagram.nodes;
            const childConns = node.childDiagram.connections;
            
            let minCx = Infinity, minCy = Infinity;
            let maxCx = -Infinity, maxCy = -Infinity;
            
            const previewNodes = childNodes.filter(cn => cn.type !== 'port');
            const targetNodes = previewNodes.length > 0 ? previewNodes : childNodes;
            
            targetNodes.forEach(cn => {
                if (cn.x < minCx) minCx = cn.x;
                if (cn.y < minCy) minCy = cn.y;
                if (cn.x + cn.w > maxCx) maxCx = cn.x + cn.w;
                if (cn.y + cn.h > maxCy) maxCy = cn.y + cn.h;
            });
            
            const cw = maxCx - minCx;
            const ch = maxCy - minCy;
            
            if (cw > 0 && ch > 0) {
                const padding = 16;
                const scaleX = (node.w - padding * 2) / cw;
                const scaleY = (node.h - padding * 2) / ch;
                const scale = Math.min(scaleX, scaleY, 0.45);
                
                const dx = (node.w - cw * scale) / 2 - minCx * scale;
                const dy = (node.h - ch * scale) / 2 - minCy * scale;
                
                const previewG = document.createElementNS("http://www.w3.org/2000/svg", "g");
                previewG.setAttribute('transform', `translate(${dx}, ${dy}) scale(${scale})`);
                previewG.setAttribute('filter', 'url(#mini-blur)');
                previewG.setAttribute('opacity', '0.45');
                previewG.setAttribute('pointer-events', 'none');
                
                childConns.forEach(cc => {
                    const cNodeA = childNodes.find(n => n.id === cc.fromId);
                    const cNodeB = childNodes.find(n => n.id === cc.toId);
                    if (!cNodeA || !cNodeB) return;
                    
                    const points = calculatePathPoints(cNodeA, cNodeB, cc, childNodes, childConns);
                    
                    // Extend points to match parent connection coordinates if they connect to ports
                    if (cNodeA.type === 'port') {
                        const parentConnId = cNodeA.id.replace('port_', '');
                        const parentConn = state.connections.find(c => c.id === parentConnId);
                        if (parentConn) {
                            const pA = state.nodes.find(n => n.id === parentConn.fromId);
                            const pB = state.nodes.find(n => n.id === parentConn.toId);
                            if (pA && pB) {
                                const parentPoints = calculatePathPoints(pA, pB, parentConn);
                                if (parentPoints && parentPoints.length > 0) {
                                    const ptGlobal = parentConn.fromId === node.id ? parentPoints[0] : parentPoints[parentPoints.length - 1];
                                    const ptLocalX = ptGlobal.x - node.x;
                                    const ptLocalY = ptGlobal.y - node.y;
                                    const ptChildX = (ptLocalX - dx) / scale;
                                    const ptChildY = (ptLocalY - dy) / scale;
                                    points[0] = { x: ptChildX, y: ptChildY };
                                }
                            }
                        }
                    }
                    if (cNodeB.type === 'port') {
                        const parentConnId = cNodeB.id.replace('port_', '');
                        const parentConn = state.connections.find(c => c.id === parentConnId);
                        if (parentConn) {
                            const pA = state.nodes.find(n => n.id === parentConn.fromId);
                            const pB = state.nodes.find(n => n.id === parentConn.toId);
                            if (pA && pB) {
                                const parentPoints = calculatePathPoints(pA, pB, parentConn);
                                if (parentPoints && parentPoints.length > 0) {
                                    const ptGlobal = parentConn.fromId === node.id ? parentPoints[0] : parentPoints[parentPoints.length - 1];
                                    const ptLocalX = ptGlobal.x - node.x;
                                    const ptLocalY = ptGlobal.y - node.y;
                                    const ptChildX = (ptLocalX - dx) / scale;
                                    const ptChildY = (ptLocalY - dy) / scale;
                                    points[points.length - 1] = { x: ptChildX, y: ptChildY };
                                }
                            }
                        }
                    }
                    
                    const pathStr = getSvgPathString(points, cc.routing === 'smooth', cc.radius);
                    
                    const line = document.createElementNS("http://www.w3.org/2000/svg", "path");
                    line.setAttribute('d', pathStr);
                    line.setAttribute('stroke', cc.color || '#6366f1');
                    line.setAttribute('stroke-width', (cc.thickness || 2) * 2);
                    line.setAttribute('fill', 'none');
                    previewG.appendChild(line);
                });
                
                targetNodes.forEach(cn => {
                    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                    rect.setAttribute('x', cn.x);
                    rect.setAttribute('y', cn.y);
                    rect.setAttribute('width', cn.w);
                    rect.setAttribute('height', cn.h);
                    rect.setAttribute('rx', 6);
                    rect.setAttribute('fill', cn.fill || 'rgba(99, 102, 241, 0.2)');
                    rect.setAttribute('stroke', cn.border || '#6366f1');
                    rect.setAttribute('stroke-width', (cn.borderThickness || 2) * 1.5);
                    previewG.appendChild(rect);
                });
                
                g.appendChild(previewG);
            }
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
        
        dom.nodesGroup.appendChild(g);
    });
}

/**
 * Live node-dragging DOM update (keeps UI fast & buttery)
 */
export function updateNodeSvgElement(node) {
    const nodeEl = document.getElementById(node.id);
    if (!nodeEl) return;
    
    nodeEl.setAttribute('transform', `translate(${node.x}, ${node.y})`);
    
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
    
    const handle = nodeEl.querySelector('.resize-handle');
    if (handle) {
        handle.setAttribute('x', node.w - 6);
        handle.setAttribute('y', node.h - 6);
    }
}

/**
 * Re-route connection lines attached to specific Node ID
 */
export function updateNodeConnections(nodeId) {
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
