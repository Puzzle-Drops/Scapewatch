class Pathfinding {
    constructor(collisionSystem) {
        this.collision = collisionSystem;
    }

    // A* pathfinding algorithm with circular hitbox support
    findPath(startX, startY, endX, endY, radius = 0.5) {
        if (!this.collision.initialized) {
            console.error('Collision system not initialized');
            return null;
        }

        // Check if start and end are walkable for the circle
        if (!this.collision.canCircleFit(startX, startY, radius)) {
            console.error('Start position is not walkable for radius', radius);
            return null;
        }
        if (!this.collision.canCircleFit(endX, endY, radius)) {
            console.error('End position is not walkable for radius', radius);
            return null;
        }

        // Check if we have line of sight - if so, just go straight
        if (this.collision.isLineOfSightForCircle(startX, startY, endX, endY, radius)) {
            return [{ x: endX, y: endY }];
        }

        // Use finer grid for smoother paths
        const gridSize = Math.max(0.5, radius);
        
        // Snap positions to grid
        const start = {
            x: Math.round(startX / gridSize) * gridSize,
            y: Math.round(startY / gridSize) * gridSize
        };
        const end = {
            x: Math.round(endX / gridSize) * gridSize,
            y: Math.round(endY / gridSize) * gridSize
        };

        // A* implementation
        const openSet = new PriorityQueue();
        const closedSet = new Set();
        const cameFrom = new Map();
        const gScore = new Map();
        const fScore = new Map();

        const startKey = `${start.x},${start.y}`;
        gScore.set(startKey, 0);
        fScore.set(startKey, this.heuristic(start, end));
        openSet.enqueue(start, fScore.get(startKey));

        let nodesExplored = 0;
        const maxNodes = 10000; // Prevent infinite loops

        while (!openSet.isEmpty() && nodesExplored < maxNodes) {
            nodesExplored++;
            const current = openSet.dequeue();
            const currentKey = `${current.x},${current.y}`;

            // Check if we're close enough to the goal
            const distToEnd = Math.sqrt(
                Math.pow(current.x - end.x, 2) + 
                Math.pow(current.y - end.y, 2)
            );
            
            if (distToEnd < gridSize) {
                // Close enough, construct path to exact end position
                const path = this.reconstructPath(cameFrom, current);
                path[path.length - 1] = { x: endX, y: endY }; // Use exact end position
                return this.smoothPath(path, radius);
            }

            closedSet.add(currentKey);

            // Check all neighbors
            const neighbors = this.getNeighbors(current.x, current.y, gridSize, radius);
            
            for (const neighbor of neighbors) {
                const neighborKey = `${neighbor.x},${neighbor.y}`;
                
                if (closedSet.has(neighborKey)) {
                    continue;
                }

                // Calculate tentative g score
                const dx = neighbor.x - current.x;
                const dy = neighbor.y - current.y;
                const moveCost = Math.sqrt(dx * dx + dy * dy);
                const tentativeGScore = gScore.get(currentKey) + moveCost;

                if (!gScore.has(neighborKey) || tentativeGScore < gScore.get(neighborKey)) {
                    // This path is better
                    cameFrom.set(neighborKey, current);
                    gScore.set(neighborKey, tentativeGScore);
                    
                    // Add tie-breaker for straighter paths
                    const h = this.heuristic(neighbor, end);
                    const dx1 = neighbor.x - end.x;
                    const dy1 = neighbor.y - end.y;
                    const dx2 = start.x - end.x;
                    const dy2 = start.y - end.y;
                    const cross = Math.abs(dx1 * dy2 - dx2 * dy1);
                    const tieBreaker = cross * 0.001;
                    
                    fScore.set(neighborKey, tentativeGScore + h + tieBreaker);

                    if (!openSet.contains(neighbor)) {
                        openSet.enqueue(neighbor, fScore.get(neighborKey));
                    }
                }
            }
        }

        // No path found
        console.log('No path found after exploring', nodesExplored, 'nodes');
        return null;
    }

    getNeighbors(x, y, gridSize, radius) {
        const neighbors = [];
        
        // 8-directional movement
        const directions = [
            { dx: 0, dy: -gridSize },         // North
            { dx: gridSize, dy: -gridSize },  // Northeast
            { dx: gridSize, dy: 0 },          // East
            { dx: gridSize, dy: gridSize },   // Southeast
            { dx: 0, dy: gridSize },          // South
            { dx: -gridSize, dy: gridSize },  // Southwest
            { dx: -gridSize, dy: 0 },         // West
            { dx: -gridSize, dy: -gridSize }  // Northwest
        ];
        
        for (const dir of directions) {
            const nx = x + dir.dx;
            const ny = y + dir.dy;
            
            if (this.collision.canCircleFit(nx, ny, radius)) {
                // For diagonal movement, ensure the path is clear
                if (dir.dx !== 0 && dir.dy !== 0) {
                    if (this.collision.canCircleFit(x + dir.dx, y, radius) && 
                        this.collision.canCircleFit(x, y + dir.dy, radius)) {
                        neighbors.push({ x: nx, y: ny });
                    }
                } else {
                    neighbors.push({ x: nx, y: ny });
                }
            }
        }
        
        return neighbors;
    }

    heuristic(a, b) {
        // Euclidean distance for smooth movement
        return Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2));
    }

    reconstructPath(cameFrom, current) {
        const path = [current];
        let currentKey = `${current.x},${current.y}`;

        while (cameFrom.has(currentKey)) {
            current = cameFrom.get(currentKey);
            path.unshift(current);
            currentKey = `${current.x},${current.y}`;
        }

        return path;
    }

    smoothPath(path, radius) {
        if (path.length < 3) return path;

        const smoothed = [path[0]];
        let current = 0;

        // Aggressive smoothing - try to connect distant points
        while (current < path.length - 1) {
            let farthest = current + 1;
            
            // Try to connect to the farthest visible point
            for (let i = path.length - 1; i > current + 1; i--) {
                if (this.collision.isLineOfSightForCircle(
                    path[current].x, path[current].y,
                    path[i].x, path[i].y, radius
                )) {
                    farthest = i;
                    break;
                }
            }

            smoothed.push(path[farthest]);
            current = farthest;
        }

        // Final smoothing pass to remove redundant waypoints
        const finalSmoothed = [smoothed[0]];
        for (let i = 1; i < smoothed.length - 1; i++) {
            const prev = finalSmoothed[finalSmoothed.length - 1];
            const next = smoothed[i + 1];
            
            // Skip this waypoint if we can go directly from prev to next
            if (!this.collision.isLineOfSightForCircle(
                prev.x, prev.y, next.x, next.y, radius
            )) {
                finalSmoothed.push(smoothed[i]);
            }
        }
        
        // Always add the last point
        if (smoothed.length > 1) {
            finalSmoothed.push(smoothed[smoothed.length - 1]);
        }

        return finalSmoothed;
    }
}

// Priority queue implementation for A*
class PriorityQueue {
    constructor() {
        this.elements = [];
    }

    enqueue(element, priority) {
        this.elements.push({ element, priority });
        this.elements.sort((a, b) => a.priority - b.priority);
    }

    dequeue() {
        return this.elements.shift().element;
    }

    isEmpty() {
        return this.elements.length === 0;
    }

    contains(element) {
        return this.elements.some(item => 
            Math.abs(item.element.x - element.x) < 0.01 && 
            Math.abs(item.element.y - element.y) < 0.01
        );
    }
}
