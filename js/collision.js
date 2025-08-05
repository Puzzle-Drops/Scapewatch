class CollisionSystem {
    constructor() {
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.imageData = null;
        this.width = 0;
        this.height = 0;
        this.initialized = false;
    }

    async initialize() {
        const collisionMap = loadingManager.getImage('collisionMap');
        if (!collisionMap) {
            console.error('Collision map not loaded!');
            return;
        }

        this.width = collisionMap.width;
        this.height = collisionMap.height;
        this.canvas.width = this.width;
        this.canvas.height = this.height;

        // Draw collision map to canvas
        this.ctx.drawImage(collisionMap, 0, 0);
        
        // Get image data for pixel-perfect collision detection
        this.imageData = this.ctx.getImageData(0, 0, this.width, this.height);
        
        this.initialized = true;
        console.log(`Collision system initialized: ${this.width}x${this.height}`);
    }

    isWalkable(x, y) {
        if (!this.initialized) return false;
        
        // Round to nearest pixel
        x = Math.round(x);
        y = Math.round(y);
        
        // Check bounds
        if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
            return false;
        }
        
        // Get pixel data (RGBA)
        const index = (y * this.width + x) * 4;
        const alpha = this.imageData.data[index + 3];
        
        // If alpha is 0 (transparent), it's walkable
        return alpha === 0;
    }

    // Check if a line from start to end is clear
    isLineOfSight(x1, y1, x2, y2) {
        const dx = Math.abs(x2 - x1);
        const dy = Math.abs(y2 - y1);
        const sx = x1 < x2 ? 1 : -1;
        const sy = y1 < y2 ? 1 : -1;
        let err = dx - dy;
        
        let x = Math.round(x1);
        let y = Math.round(y1);
        
        while (x !== Math.round(x2) || y !== Math.round(y2)) {
            if (!this.isWalkable(x, y)) {
                return false;
            }
            
            const e2 = 2 * err;
            if (e2 > -dy) {
                err -= dy;
                x += sx;
            }
            if (e2 < dx) {
                err += dx;
                y += sy;
            }
        }
        
        return this.isWalkable(Math.round(x2), Math.round(y2));
    }

    // Get all walkable neighbors of a position
    getWalkableNeighbors(x, y) {
        const neighbors = [];
        
        // 8-directional movement
        const directions = [
            { x: 0, y: -1 },  // North
            { x: 1, y: -1 },  // Northeast
            { x: 1, y: 0 },   // East
            { x: 1, y: 1 },   // Southeast
            { x: 0, y: 1 },   // South
            { x: -1, y: 1 },  // Southwest
            { x: -1, y: 0 },  // West
            { x: -1, y: -1 }  // Northwest
        ];
        
        for (const dir of directions) {
            const nx = x + dir.x;
            const ny = y + dir.y;
            
            if (this.isWalkable(nx, ny)) {
                // For diagonal movement, check that we can actually move diagonally
                // (not blocked by walls on either side)
                if (dir.x !== 0 && dir.y !== 0) {
                    if (this.isWalkable(x + dir.x, y) && this.isWalkable(x, y + dir.y)) {
                        neighbors.push({ x: nx, y: ny });
                    }
                } else {
                    neighbors.push({ x: nx, y: ny });
                }
            }
        }
        
        return neighbors;
    }

    // Debug visualization
    drawDebug(ctx, camera) {
        if (!this.initialized) return;
        
        ctx.save();
        ctx.globalAlpha = 0.3;
        
        // Only draw visible portion
        const viewLeft = Math.max(0, Math.floor(camera.x - ctx.canvas.width / (2 * camera.zoom)));
        const viewRight = Math.min(this.width, Math.ceil(camera.x + ctx.canvas.width / (2 * camera.zoom)));
        const viewTop = Math.max(0, Math.floor(camera.y - ctx.canvas.height / (2 * camera.zoom)));
        const viewBottom = Math.min(this.height, Math.ceil(camera.y + ctx.canvas.height / (2 * camera.zoom)));
        
        // Draw collision areas
        for (let y = viewTop; y < viewBottom; y++) {
            for (let x = viewLeft; x < viewRight; x++) {
                if (!this.isWalkable(x, y)) {
                    ctx.fillStyle = '#ff0000';
                    ctx.fillRect(x, y, 1, 1);
                }
            }
        }
        
        ctx.restore();
    }
}
