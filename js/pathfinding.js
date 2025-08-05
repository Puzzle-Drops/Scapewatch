class Pathfinding {
    constructor(collisionSystem) {
        this.collision = collisionSystem;
    }

    // A* pathfinding algorithm
    findPath(startX, startY, endX, endY) {
        if (!this.collision.initialized) {
            console.error('Collision system not initialized');
            return null;
        }

        // Round positions to pixels
        const start = { x: Math.round(startX), y: Math.round(startY) };
        const end = { x: Math.round(endX), y: Math.round(endY) };

        // Check if start and end are walkable
        if (!this.collision.isWalkable(start.x, start.y)) {
            console.error('Start position is not walkable');
            return null;
        }
        if (!this.collision.isWalkable(end.x, end.y)) {
            console.error('End position is not walkable');
            return null;
        }

        // Check if we have line of sight - if so, just go straight
        if (this.collision.isLineOfSight(start.x, start.y, end.x, end.y)) {
            return this.createStraightPath(start, end);
        }

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

        while (!openSet.isEmpty()) {
            const current = openSet.dequeue();
            const currentKey = `${current.x},${current.y}`;

            // Check if we reached the goal
            if (current.x === end.x && current.y === end.y) {
                return this.reconstructPath(cameFrom, current);
            }

            closedSet.add(currentKey);

            // Check all neighbors
            const neighbors = this.collision.getWalkableNeighbors(current.x, current.y);
            
            for (const neighbor of neighbors) {
                const neighborKey = `${neighbor.x},${neighbor.y}`;
                
                if (closedSet.has(neighborKey)) {
                    continue;
                }

                // Calculate tentative g score
                const isDiagonal = Math.abs(neighbor.x - current.x) === 1 && Math.abs(neighbor.y - current.y) === 1;
                const moveCost = isDiagonal ? Math.sqrt(2) : 1;
                const tentativeGScore = gScore.get(currentKey) + moveCost;

                if (!gScore.has(neighborKey) || tentativeGScore < gScore.get(neighborKey)) {
                    // This path is better
                    cameFrom.set(neighborKey, current);
                    gScore.set(neighborKey, tentativeGScore);
                    
                    // Add a small tie-breaker to prefer paths that go more directly toward the goal
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
        console.log('No path found');
        return null;
    }

    heuristic(a, b) {
        // Use Chebyshev distance for tile-based movement
        return Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y));
    }

    createStraightPath(start, end) {
        const path = [];
        let x = start.x;
        let y = start.y;
        
        const dx = Math.sign(end.x - start.x);
        const dy = Math.sign(end.y - start.y);
        
        while (x !== end.x || y !== end.y) {
            path.push({ x, y });
            
            // Move diagonally when possible
            if (x !== end.x && y !== end.y) {
                x += dx;
                y += dy;
            } else if (x !== end.x) {
                x += dx;
            } else {
                y += dy;
            }
        }
        
        path.push(end);
        return path;
    }

    reconstructPath(cameFrom, current) {
        const path = [current];
        let currentKey = `${current.x},${current.y}`;

        while (cameFrom.has(currentKey)) {
            current = cameFrom.get(currentKey);
            path.unshift(current);
            currentKey = `${current.x},${current.y}`;
        }

        // Smooth the path more aggressively
        return this.smoothPath(path);
    }

    smoothPath(path) {
        if (path.length < 3) return path;

        const smoothed = [path[0]];
        let current = 0;

        while (current < path.length - 1) {
            let farthest = current + 1;
            
            // Find the farthest point we can see
            for (let i = current + 2; i < path.length; i++) {
                if (this.canWalkStraight(path[current], path[i])) {
                    farthest = i;
                } else {
                    break;
                }
            }

            smoothed.push(path[farthest]);
            current = farthest;
        }

        return smoothed;
    }

    canWalkStraight(from, to) {
        // Check if we can walk in a straight line (allowing diagonal movement)
        let x = from.x;
        let y = from.y;
        
        const dx = Math.sign(to.x - from.x);
        const dy = Math.sign(to.y - from.y);
        
        while (x !== to.x || y !== to.y) {
            // Move diagonally when possible
            let nextX = x;
            let nextY = y;
            
            if (x !== to.x && y !== to.y) {
                nextX += dx;
                nextY += dy;
            } else if (x !== to.x) {
                nextX += dx;
            } else {
                nextY += dy;
            }
            
            // Check if the next position is walkable
            if (!this.collision.isWalkable(nextX, nextY)) {
                return false;
            }
            
            // For diagonal movement, also check that we can move through the corners
            if (nextX !== x && nextY !== y) {
                if (!this.collision.isWalkable(x, nextY) || !this.collision.isWalkable(nextX, y)) {
                    return false;
                }
            }
            
            x = nextX;
            y = nextY;
        }
        
        return true;
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
            item.element.x === element.x && item.element.y === element.y
        );
    }
}
