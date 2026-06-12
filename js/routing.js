import { state } from './state.js';

/**
 * Calculates a global assignment of connection ends to specific node faces ('T', 'B', 'L', 'R')
 * based on distance preferences and face capacities to prevent wire overlaps.
 */
export function getGlobalPortAssignments() {
    const assignments = {};
    const sideCounts = {}; // Key: `${nodeId}_${side}`, Value: count of assigned wire terminals
    
    // Spacing is 20px. We enforce a 20px padding at each end of the side.
    const getCapacity = (node, side) => {
        const L = (side === 'T' || side === 'B') ? node.w : node.h;
        return Math.max(1, Math.floor((L - 40) / 20) + 1);
    };
    
    // Sort connections by ID to ensure stable and deterministic assignments
    const sortedConns = [...state.connections].sort((a, b) => a.id.localeCompare(b.id));
    
    sortedConns.forEach(c => {
        const nA = state.nodes.find(n => n.id === c.fromId);
        const nB = state.nodes.find(n => n.id === c.toId);
        if (!nA || !nB) return;
        
        const opp = { L: 'R', R: 'L', T: 'B', B: 'T' };
        
        let sA_fixed = null;
        if (nA.type === 'port') {
            sA_fixed = opp[nA.side] || 'T';
        }
        
        let sB_fixed = null;
        if (nB.type === 'port') {
            sB_fixed = opp[nB.side] || 'T';
        }
        
        // List and sort all possible combinations by side center distance
        const combos = [];
        const sides = ['T', 'B', 'L', 'R'];
        
        const getSideCenter = (node, side) => {
            if (node.type === 'port') {
                return { x: node.x, y: node.y };
            }
            if (side === 'T') return { x: node.x + node.w / 2, y: node.y };
            if (side === 'B') return { x: node.x + node.w / 2, y: node.y + node.h };
            if (side === 'L') return { x: node.x, y: node.y + node.h / 2 };
            if (side === 'R') return { x: node.x + node.w, y: node.y + node.h / 2 };
        };
        
        const sidesA = sA_fixed ? [sA_fixed] : sides;
        const sidesB = sB_fixed ? [sB_fixed] : sides;
        
        sidesA.forEach(sA => {
            sidesB.forEach(sB => {
                const ptA = getSideCenter(nA, sA);
                const ptB = getSideCenter(nB, sB);
                const dist = Math.hypot(ptB.x - ptA.x, ptB.y - ptA.y);
                combos.push({ sA, sB, dist });
            });
        });
        
        combos.sort((a, b) => a.dist - b.dist);
        
        // Find first side combination where both target sides have remaining capacity
        let chosen = combos[0];
        for (let combo of combos) {
            const countA = sideCounts[`${nA.id}_${combo.sA}`] || 0;
            const countB = sideCounts[`${nB.id}_${combo.sB}`] || 0;
            const capA = nA.type === 'port' ? Infinity : getCapacity(nA, combo.sA);
            const capB = nB.type === 'port' ? Infinity : getCapacity(nB, combo.sB);
            
            if (countA < capA && countB < capB) {
                chosen = combo;
                break;
            }
        }
        
        assignments[c.id] = { sideA: chosen.sA, sideB: chosen.sB };
        
        // Track the count
        sideCounts[`${nA.id}_${chosen.sA}`] = (sideCounts[`${nA.id}_${chosen.sA}`] || 0) + 1;
        sideCounts[`${nB.id}_${chosen.sB}`] = (sideCounts[`${nB.id}_${chosen.sB}`] || 0) + 1;
    });
    
    return assignments;
}

/**
 * Standard closest-ports helper (fallback or reference)
 */
export function getBestPorts(nodeA, nodeB) {
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

/**
 * Calculate path points between two nodes for a connection, distributing them evenly along the sides
 */
export function calculatePathPoints(nodeA, nodeB, conn) {
    const routingType = conn.routing;
    
    // Resolve global port assignments
    const assignments = getGlobalPortAssignments();
    const assignment = assignments[conn.id] || { sideA: 'T', sideB: 'T' };
    const sideA = assignment.sideA;
    const sideB = assignment.sideB;
    
    // Filter connections that are sharing sideA of nodeA
    const connsA = state.connections.filter(c => {
        const ass = assignments[c.id];
        return ass && ((c.fromId === nodeA.id && ass.sideA === sideA) || (c.toId === nodeA.id && ass.sideB === sideA));
    }).sort((a, b) => a.id.localeCompare(b.id));
    
    // Filter connections that are sharing sideB of nodeB
    const connsB = state.connections.filter(c => {
        const ass = assignments[c.id];
        return ass && ((c.fromId === nodeB.id && ass.sideA === sideB) || (c.toId === nodeB.id && ass.sideB === sideB));
    }).sort((a, b) => a.id.localeCompare(b.id));
    
    const countA = connsA.length;
    const countB = connsB.length;
    
    const idxA = connsA.findIndex(c => c.id === conn.id);
    const idxB = connsB.findIndex(c => c.id === conn.id);
    
    const spacing = 20;
    
    // Helper to calculate coordinates dynamically shifted from center of node side
    const getDistributedCoords = (node, side, idx, count) => {
        if (node.type === 'port') {
            const opp = { L: 'R', R: 'L', T: 'B', B: 'T' };
            return { x: node.x, y: node.y, dir: opp[node.side] || 'T' };
        }
        const offset = (idx === -1 || count <= 1) ? 0 : (idx - (count - 1) / 2) * spacing;
        
        if (side === 'T') return { x: node.x + node.w / 2 + offset, y: node.y, dir: 'T' };
        if (side === 'B') return { x: node.x + node.w / 2 + offset, y: node.y + node.h, dir: 'B' };
        if (side === 'L') return { x: node.x, y: node.y + node.h / 2 + offset, dir: 'L' };
        if (side === 'R') return { x: node.x + node.w, y: node.y + node.h / 2 + offset, dir: 'R' };
    };
    
    const portA = getDistributedCoords(nodeA, sideA, idxA, countA);
    const portB = getDistributedCoords(nodeB, sideB, idxB, countB);
    
    // Offset the start and end of the line to prevent markers from extending past node borders
    let startOffset = 0;
    if (nodeA.type !== 'port') {
        startOffset = (nodeA.borderThickness || 0) / 2;
        if (conn.arrowStart === 'arrow') {
            startOffset += 2 * conn.thickness;
        } else if (conn.arrowStart === 'circle') {
            startOffset += 3.5 * conn.thickness;
        }
    }
    
    let endOffset = 0;
    if (nodeB.type !== 'port') {
        endOffset = (nodeB.borderThickness || 0) / 2;
        if (conn.arrowEnd === 'arrow') {
            endOffset += 2 * conn.thickness;
        } else if (conn.arrowEnd === 'circle') {
            endOffset += 3.5 * conn.thickness;
        }
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
    if (routingType === "orthogonal" || routingType === "smooth") {
        const avoidPath = findAvoidancePath({ x: ex1, y: ey1 }, { x: ex2, y: ey2 });
        if (avoidPath && avoidPath.length >= 2) {
            for (let i = 1; i < avoidPath.length; i++) {
                points.push(avoidPath[i]);
            }
        } else {
            const isHoriz1 = (portA.dir === "L" || portA.dir === "R");
            const isHoriz2 = (portB.dir === "L" || portB.dir === "R");
            
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
            points.push({ x: ex2, y: ey2 });
        }
    } else {
        points.push({ x: ex2, y: ey2 });
    }
    
    points.push({ x: tx, y: ty });
    
    return cleanPathPoints(points);
}

/**
 * Remove duplicate adjacent points and collinear bends
 */
export function cleanPathPoints(points) {
    if (points.length < 2) return points;
    
    let unique = [points[0]];
    for (let i = 1; i < points.length; i++) {
        const last = unique[unique.length - 1];
        const curr = points[i];
        if (Math.abs(last.x - curr.x) > 0.05 || Math.abs(last.y - curr.y) > 0.05) {
            unique.push(curr);
        }
    }
    
    if (unique.length < 3) return unique;
    
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

/**
 * Finds the middle point along a path segment sequence
 */
export function getPathCenter(points) {
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

/**
 * Convert point arrays into SVG Path strings (with rounded Bezier corner adjustments)
 */
export function getSvgPathString(points, isSmooth, radius) {
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

/**
 * Finds a path from startPt to endPt that avoids all node bounding boxes (except start/end connections offset)
 * using a small-grid Dijkstra/A* routing search.
 */
function findAvoidancePath(startPt, endPt) {
    const xsSet = new Set([startPt.x, endPt.x]);
    const ysSet = new Set([startPt.y, endPt.y]);
    
    const margin = 15;
    
    for (const node of state.nodes) {
        if (node.type === 'port') continue;
        xsSet.add(node.x - margin);
        xsSet.add(node.x + node.w + margin);
        ysSet.add(node.y - margin);
        ysSet.add(node.y + node.h + margin);
    }
    
    const xs = [...xsSet].sort((a, b) => a - b);
    const ys = [...ysSet].sort((a, b) => a - b);
    
    const startXIdx = xs.indexOf(startPt.x);
    const startYIdx = ys.indexOf(startPt.y);
    const endXIdx = xs.indexOf(endPt.x);
    const endYIdx = ys.indexOf(endPt.y);
    
    if (startXIdx === -1 || startYIdx === -1 || endXIdx === -1 || endYIdx === -1) {
        return null;
    }
    
    const segmentIntersectsNode = (p1, p2) => {
        for (const node of state.nodes) {
            if (node.type === 'port') continue;
            // Blocked rectangle is shrunken slightly (2px) to allow start/end connections at the boundary
            const xMin = node.x + 2;
            const xMax = node.x + node.w - 2;
            const yMin = node.y + 2;
            const yMax = node.y + node.h - 2;
            
            if (p1.y === p2.y) {
                const y = p1.y;
                if (y > yMin && y < yMax) {
                    const minX = Math.min(p1.x, p2.x);
                    const maxX = Math.max(p1.x, p2.x);
                    if (maxX > xMin && minX < xMax) {
                        return true;
                    }
                }
            } else if (p1.x === p2.x) {
                const x = p1.x;
                if (x > xMin && x < xMax) {
                    const minY = Math.min(p1.y, p2.y);
                    const maxY = Math.max(p1.y, p2.y);
                    if (maxY > yMin && minY < yMax) {
                        return true;
                    }
                }
            }
        }
        return false;
    };
    
    const startState = {
        xIdx: startXIdx,
        yIdx: startYIdx,
        dir: null,
        cost: 0,
        path: [startPt]
    };
    
    const queue = [startState];
    const visited = new Map();
    let iterations = 0;
    const maxIterations = 2000;
    
    while (queue.length > 0) {
        iterations++;
        if (iterations > maxIterations) {
            return null;
        }
        
        let minIdx = 0;
        for (let i = 1; i < queue.length; i++) {
            if (queue[i].cost < queue[minIdx].cost) {
                minIdx = i;
            }
        }
        
        const curr = queue.splice(minIdx, 1)[0];
        
        if (curr.xIdx === endXIdx && curr.yIdx === endYIdx) {
            return curr.path;
        }
        
        const visitKey = `${curr.xIdx}_${curr.yIdx}_${curr.dir}`;
        if (visited.has(visitKey) && visited.get(visitKey) <= curr.cost) {
            continue;
        }
        visited.set(visitKey, curr.cost);
        
        // 1. Move horizontally
        const xOffsets = [-1, 1];
        for (const dx of xOffsets) {
            const nextXIdx = curr.xIdx + dx;
            if (nextXIdx >= 0 && nextXIdx < xs.length) {
                const nextPt = { x: xs[nextXIdx], y: ys[curr.yIdx] };
                const prevPt = { x: xs[curr.xIdx], y: ys[curr.yIdx] };
                
                if (!segmentIntersectsNode(prevPt, nextPt)) {
                    const dist = Math.abs(nextPt.x - prevPt.x);
                    const turnPenalty = (curr.dir !== null && curr.dir !== "H") ? 50 : 0;
                    const nextCost = curr.cost + dist + turnPenalty;
                    
                    queue.push({
                        xIdx: nextXIdx,
                        yIdx: curr.yIdx,
                        dir: "H",
                        cost: nextCost,
                        path: [...curr.path, nextPt]
                    });
                }
            }
        }
        
        // 2. Move vertically
        const yOffsets = [-1, 1];
        for (const dy of yOffsets) {
            const nextYIdx = curr.yIdx + dy;
            if (nextYIdx >= 0 && nextYIdx < ys.length) {
                const nextPt = { x: xs[curr.xIdx], y: ys[nextYIdx] };
                const prevPt = { x: xs[curr.xIdx], y: ys[curr.yIdx] };
                
                if (!segmentIntersectsNode(prevPt, nextPt)) {
                    const dist = Math.abs(nextPt.y - prevPt.y);
                    const turnPenalty = (curr.dir !== null && curr.dir !== "V") ? 50 : 0;
                    const nextCost = curr.cost + dist + turnPenalty;
                    
                    queue.push({
                        xIdx: curr.xIdx,
                        yIdx: nextYIdx,
                        dir: "V",
                        cost: nextCost,
                        path: [...curr.path, nextPt]
                    });
                }
            }
        }
    }
    
    return null;
}
