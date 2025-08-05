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

    // Check if a circle can fit at a position
    canCircleFit(centerX, centerY, radius) {
        if (!this.initialized) return false;
        
        // Check center point first
        if (!this.isWalkable(centerX, centerY)) {
            return false;
        }
        
        // If radius is very small, just check center
        if (radius < 0.1) {
            return true;
        }
        
        // Check points around the circle
        const steps = Math.max(8, Math.ceil(radius * 8)); // More steps for larger radius
        for (let i = 0; i < steps; i++) {
            const angle = (i / steps) * Math.PI * 2;
            const checkX = Math.round(centerX + Math.cos(angle) * radius);
            const checkY = Math.round(centerY + Math.sin(angle) * radius);
            
            if (!this.isWalkable(checkX, checkY)) {
                return false;
            }
        }
        
        // Also check a few intermediate points for better accuracy
        for (let r = radius / 2; r < radius; r += radius / 2) {
            for (let i = 0; i < 4; i++) {
                const angle = (i / 4) * Math.PI * 2;
                const checkX = Math.round(centerX + Math.cos(angle) * r);
                const checkY = Math.round(centerY + Math.sin(angle) * r);
                
                if (!this.isWalkable(checkX, checkY)) {
                    return false;
                }
            }
        }
        
        return true;
    }

    // Check if a line from start to end is clear for a circle
    isLineOfSightForCircle(x1, y1, x2, y2, radius) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < 0.01) {
            return this.canCircleFit(x1, y1, radius);
        }
        
        // Check at regular intervals along the line
        const steps = Math.max(2, Math.ceil(distance));
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const checkX = x1 + dx * t;
            const checkY = y1 + dy * t;
            
            if (!this.canCircleFit(checkX, checkY, radius)) {
                return false;
            }
        }
        
        return true;
    }

    // Get all walkable neighbors of a position for a circle
    getWalkableNeighbors(x, y, radius) {
        const neighbors = [];
        
        // 8-directional movement with variable step size
        const stepSize = Math.max(0.5, radius); // Step at least by radius
        const directions = [
            { x: 0, y: -stepSize },    // North
            { x: stepSize, y: -stepSize },   // Northeast
            { x: stepSize, y: 0 },     // East
            { x: stepSize, y: stepSize },    // Southeast
            { x: 0, y: stepSize },     // South
            { x: -stepSize, y: stepSize },   // Southwest
            { x: -stepSize, y: 0 },    // West
            { x: -stepSize, y: -stepSize }   // Northwest
        ];
        
        for (const dir of directions) {
            const nx = x + dir.x;
            const ny = y + dir.y;
            
            if (this.canCircleFit(nx, ny, radius)) {
                // For diagonal movement, check that we can actually move diagonally
                if (dir.x !== 0 && dir.y !== 0) {
                    // Check intermediate positions to ensure smooth diagonal movement
                    if (this.canCircleFit(x + dir.x, y, radius) && 
                        this.canCircleFit(x, y + dir.y, radius)) {
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
