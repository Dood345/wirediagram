import { state } from './state.js';

/**
 * Finds a path from startPt to endPt that avoids all node bounding boxes (except start/end connections offset)
 * using a small-grid Dijkstra/A* routing search.
 * 
 * @param {Object} startPt - The starting coordinates {x, y}
 * @param {Object} endPt - The ending coordinates {x, y}
 * @param {Array} [nodes=state.nodes] - The list of active nodes to avoid
 * @returns {Array|null} Array of path coordinates {x, y} or null if no path found
 */
export function findAvoidancePath(startPt, endPt, nodes = state.nodes) {
    const xsSet = new Set([startPt.x, endPt.x]);
    const ysSet = new Set([startPt.y, endPt.y]);
    
    const margin = 15;
    
    for (const node of nodes) {
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
        for (const node of nodes) {
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
