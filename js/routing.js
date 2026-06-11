/**
 * Connection path routing calculation and geometry helpers
 */

/**
 * Choose port pair (Top, Bottom, Left, Right) with absolute shortest distance
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
 * Calculate path points between two nodes for a connection
 */
export function calculatePathPoints(nodeA, nodeB, conn) {
    const routingType = conn.routing;
    const { portA, portB } = getBestPorts(nodeA, nodeB);
    
    // Offset the start and end of the line to prevent markers from extending past node borders
    let startOffset = nodeA.borderThickness / 2;
    if (conn.arrowStart === 'arrow') {
        startOffset += 2 * conn.thickness;
    } else if (conn.arrowStart === 'circle') {
        startOffset += 3.5 * conn.thickness;
    }
    
    let endOffset = nodeB.borderThickness / 2;
    if (conn.arrowEnd === 'arrow') {
        endOffset += 2 * conn.thickness;
    } else if (conn.arrowEnd === 'circle') {
        endOffset += 3.5 * conn.thickness;
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
    
    // Distance to back out of the port to prevent lines clipping node edges
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
    if (routingType === 'orthogonal' || routingType === 'smooth') {
        const isHoriz1 = (portA.dir === 'L' || portA.dir === 'R');
        const isHoriz2 = (portB.dir === 'L' || portB.dir === 'R');
        
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
    }
    
    points.push({ x: ex2, y: ey2 });
    points.push({ x: tx, y: ty });
    
    return cleanPathPoints(points);
}

/**
 * Remove duplicate adjacent points and collinear bends
 */
export function cleanPathPoints(points) {
    if (points.length < 2) return points;
    
    // 1. Remove duplicate adjacent points
    let unique = [points[0]];
    for (let i = 1; i < points.length; i++) {
        const last = unique[unique.length - 1];
        const curr = points[i];
        if (Math.abs(last.x - curr.x) > 0.05 || Math.abs(last.y - curr.y) > 0.05) {
            unique.push(curr);
        }
    }
    
    if (unique.length < 3) return unique;
    
    // 2. Remove collinear bends
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
        
        // Avoid overlapping beziers on short wire segments
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
