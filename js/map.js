class MapRenderer {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.camera = {
            x: 0,
            y: 0,
            zoom: 10 // higher number is zoom in
        };
        this.worldMap = loadingManager.getImage('worldMap');
    }

    render() {
        // Clear canvas
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Update camera to follow player
        this.updateCamera();

        // Save context state
        this.ctx.save();

        // Apply camera transform
        this.ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
        this.ctx.scale(this.camera.zoom, this.camera.zoom);
        this.ctx.translate(-this.camera.x, -this.camera.y);

        // Draw world map
        if (this.worldMap) {
            this.ctx.drawImage(this.worldMap, 0, 0);
        }

        // Draw nodes
        this.drawNodes();

        // Draw player
        this.drawPlayer();

        // Draw player path
        this.drawPlayerPath();

        // Restore context state
        this.ctx.restore();

        // Draw UI elements (not affected by camera)
        this.drawMinimap();
    }

    updateCamera() {
        // Smooth camera follow
        const targetX = player.position.x;
        const targetY = player.position.y;

        this.camera.x = lerp(this.camera.x, targetX, 0.1);
        this.camera.y = lerp(this.camera.y, targetY, 0.1);
    }

    drawNodes() {
        const allNodes = nodes.getAllNodes();

        for (const [id, node] of Object.entries(allNodes)) {
            // Only draw nodes within view
            const screenDist = distance(
                node.position.x,
                node.position.y,
                this.camera.x,
                this.camera.y
            );

            if (screenDist < 500 / this.camera.zoom) {
                this.drawNode(node);
            }
        }
    }

    drawNode(node) {
        const { x, y } = node.position;

        // Node circle
        this.ctx.beginPath();
        this.ctx.arc(x, y, 3, 0, Math.PI * 2);

        // Color based on type
        switch (node.type) {
            case 'bank':
                this.ctx.fillStyle = '#f1c40f';
                break;
            case 'skill':
                this.ctx.fillStyle = '#3498db';
                break;
            case 'quest':
                this.ctx.fillStyle = '#e74c3c';
                break;
            default:
                this.ctx.fillStyle = '#95a5a6';
        }

        this.ctx.fill();
        this.ctx.strokeStyle = '#fff';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();

        // Node icon or text
        this.ctx.fillStyle = '#fff';
        this.ctx.font = 'bold 10px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        // Simple icon based on type
        if (node.type === 'bank') {
            this.ctx.fillText('$', x, y);
        } else if (node.type === 'skill' && node.activities) {
            // Show first activity icon
            const firstActivity = node.activities[0];
            if (firstActivity.includes('chop')) {
                this.ctx.fillText('🌳', x, y);
            } else if (firstActivity.includes('mine')) {
                this.ctx.fillText('⛏', x, y);
            } else if (firstActivity.includes('fish')) {
                this.ctx.fillText('🎣', x, y);
            } else if (firstActivity.includes('fight')) {
                this.ctx.fillText('⚔', x, y);
            }
        } else if (node.type === 'quest') {
            this.ctx.fillText('!', x, y);
        }

        // Node name
        this.ctx.font = '8px Arial';
        this.ctx.fillStyle = '#fff';
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 1;
        this.ctx.strokeText(node.name, x, y + 15);
        this.ctx.fillText(node.name, x, y + 15);
    }

    drawPlayer() {
    const { x, y } = player.position;

    // Player circle (smaller)
    this.ctx.beginPath();
    this.ctx.arc(x, y, 6, 0, Math.PI * 2);  // Reduced from 8 to 6
    this.ctx.fillStyle = '#2ecc71';
    this.ctx.fill();
    this.ctx.strokeStyle = '#27ae60';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();

    // Activity indicator
    if (player.currentActivity) {
        this.ctx.beginPath();
        this.ctx.arc(x, y, 10, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * player.activityProgress));  // Reduced from 12 to 10
        this.ctx.strokeStyle = '#f39c12';
        this.ctx.lineWidth = 2;  // Reduced from 3 to 2
        this.ctx.stroke();
    }
}
    drawPlayerPath() {
        if (!player.targetPosition) return;

        this.ctx.beginPath();
        this.ctx.moveTo(player.position.x, player.position.y);
        this.ctx.lineTo(player.targetPosition.x, player.targetPosition.y);
        this.ctx.strokeStyle = 'rgba(46, 204, 113, 0.5)';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
    }

    drawMinimap() {
        const minimapSize = 150;
        const minimapX = this.canvas.width - minimapSize - 10;
        const minimapY = 10;

        // Minimap background
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(minimapX, minimapY, minimapSize, minimapSize);
        this.ctx.strokeStyle = '#fff';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(minimapX, minimapY, minimapSize, minimapSize);

        // Scale factor for minimap
        const scale = minimapSize / 1000; // Assuming world is roughly 1000x1000

        // Draw nodes on minimap
        const allNodes = nodes.getAllNodes();
        for (const node of Object.values(allNodes)) {
            const mx = minimapX + node.position.x * scale;
            const my = minimapY + node.position.y * scale;

            this.ctx.beginPath();
            this.ctx.arc(mx, my, 2, 0, Math.PI * 2);

            switch (node.type) {
                case 'bank':
                    this.ctx.fillStyle = '#f1c40f';
                    break;
                case 'skill':
                    this.ctx.fillStyle = '#3498db';
                    break;
                case 'quest':
                    this.ctx.fillStyle = '#e74c3c';
                    break;
                default:
                    this.ctx.fillStyle = '#95a5a6';
            }

            this.ctx.fill();
        }

        // Draw player on minimap
        const px = minimapX + player.position.x * scale;
        const py = minimapY + player.position.y * scale;

        this.ctx.beginPath();
        this.ctx.arc(px, py, 3, 0, Math.PI * 2);
        this.ctx.fillStyle = '#2ecc71';
        this.ctx.fill();
    }

    handleClick(x, y) {
        // Convert screen coordinates to world coordinates
        const worldX = (x - this.canvas.width / 2) / this.camera.zoom + this.camera.x;
        const worldY = (y - this.canvas.height / 2) / this.camera.zoom + this.camera.y;

        // Check if clicked on a node
        const clickedNode = nodes.getNodeAt(worldX, worldY);
        if (clickedNode) {
            console.log('Clicked node:', clickedNode.name);
            // Could add manual node interaction here
        }
    }
}
