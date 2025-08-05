class MapRenderer {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Disable image smoothing for pixel-perfect rendering
        this.ctx.imageSmoothingEnabled = false;
        this.ctx.webkitImageSmoothingEnabled = false;
        this.ctx.mozImageSmoothingEnabled = false;
        this.ctx.msImageSmoothingEnabled = false;
        
        this.camera = {
            x: 4395, // Start at player position
            y: 1882, // Start at player position
            zoom: 10 // increased by 1/4 from 5
        };
        this.worldMap = loadingManager.getImage('worldMap');
        this.showNodeText = false; // Flag for showing node text
        this.showCollisionDebug = false; // Flag for showing collision areas
        this.mapCache = null; // Cached map canvas
        this.initMapCache();
    }

    initMapCache() {
        if (!this.worldMap) return;
        
        // Create offscreen canvas for map cache
        this.mapCache = document.createElement('canvas');
        this.mapCache.width = this.worldMap.width;
        this.mapCache.height = this.worldMap.height;
        
        const cacheCtx = this.mapCache.getContext('2d');
        // Render map once to cache
        cacheCtx.drawImage(this.worldMap, 0, 0);
        
        console.log('Map cached to offscreen canvas');
    }

    render() {
        // Initialize map cache if not done yet (in case image loaded after constructor)
        if (!this.mapCache && this.worldMap) {
            this.initMapCache();
        }
        
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

        // Draw world map (only visible portion from cache)
        if (this.mapCache) {
            // Calculate visible bounds in world coordinates
            const viewWidth = this.canvas.width / this.camera.zoom;
            const viewHeight = this.canvas.height / this.camera.zoom;
            
            const viewLeft = this.camera.x - viewWidth / 2;
            const viewRight = this.camera.x + viewWidth / 2;
            const viewTop = this.camera.y - viewHeight / 2;
            const viewBottom = this.camera.y + viewHeight / 2;
            
            // Clamp to map boundaries
            const mapWidth = this.mapCache.width;
            const mapHeight = this.mapCache.height;
            
            const sourceX = Math.max(0, viewLeft);
            const sourceY = Math.max(0, viewTop);
            const sourceWidth = Math.min(viewRight, mapWidth) - sourceX;
            const sourceHeight = Math.min(viewBottom, mapHeight) - sourceY;
            
            // Only draw if there's something visible
            if (sourceWidth > 0 && sourceHeight > 0) {
                this.ctx.drawImage(
                    this.mapCache,
                    sourceX, sourceY, sourceWidth, sourceHeight,  // Source rectangle
                    sourceX, sourceY, sourceWidth, sourceHeight   // Destination rectangle
                );
            }
        }

        // Draw collision debug overlay if enabled
        if (this.showCollisionDebug && window.collision) {
            collision.drawDebug(this.ctx, this.camera);
        }

        // Draw nodes
        this.drawNodes();

        // Draw player path
        this.drawPlayerPath();

        // Draw player
        this.drawPlayer();

        // Restore context state
        this.ctx.restore();

        // Draw UI elements (not affected by camera)
        this.drawFPS();
        this.drawDebugInfo();
    }

    updateCamera() {
        // Smooth camera follow
        const targetX = player.position.x;
        const targetY = player.position.y;

        this.camera.x = lerp(this.camera.x, targetX, 0.3);
        this.camera.y = lerp(this.camera.y, targetY, 0.3);
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

            if (screenDist < 1500 / this.camera.zoom) {
                this.drawNode(node);
            }
        }
    }

    drawNode(node) {
        const { x, y } = node.position;

        // Draw icons based on node type
        if (node.type === 'bank') {
            const bankIcon = loadingManager.getImage('skill_bank');
            if (bankIcon) {
                this.ctx.drawImage(bankIcon, x - 2, y - 2, 4, 4);
            }
        } else if (node.type === 'quest') {
            const questIcon = loadingManager.getImage('skill_quests');
            if (questIcon) {
                this.ctx.drawImage(questIcon, x - 2, y - 2, 4, 4);
            }
        } else if (node.type === 'skill' && node.activities) {
            // Get unique skills from activities
            const skillSet = new Set();
            const activities = loadingManager.getData('activities');
            
            for (const activityId of node.activities) {
                const activity = activities[activityId];
                if (activity && activity.skill) {
                    skillSet.add(activity.skill);
                }
            }
            
            const uniqueSkills = Array.from(skillSet);
            const iconSize = 4;
            const spacing = 0.5;
            const totalWidth = uniqueSkills.length * iconSize + (uniqueSkills.length - 1) * spacing;
            const startX = x - totalWidth / 2;
            
            // Draw skill icons
            uniqueSkills.forEach((skill, index) => {
                const skillIcon = loadingManager.getImage(`skill_${skill}`);
                if (skillIcon) {
                    const iconX = startX + index * (iconSize + spacing);
                    this.ctx.drawImage(skillIcon, iconX, y - 2, iconSize, iconSize);
                }
            });
        }

        // Node name (only if flag is set)
        if (this.showNodeText) {
            this.ctx.font = '2px Arial'; // reduced from 8px
            this.ctx.fillStyle = '#fff';
            this.ctx.strokeStyle = '#000';
            this.ctx.lineWidth = 0.25; // reduced from 1
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'bottom';
            this.ctx.strokeText(node.name, x, y - 5); // adjusted for smaller icons
            this.ctx.fillText(node.name, x, y - 5);
        }
    }

    drawPlayer() {
        const { x, y } = player.position;

        // Player circle (reduced to 1/5 of original size)
        this.ctx.beginPath();
        this.ctx.arc(x, y, 1.2, 0, Math.PI * 2);  // was 6, now 1.2
        this.ctx.fillStyle = '#2ecc71';
        this.ctx.fill();
        this.ctx.strokeStyle = '#27ae60';
        this.ctx.lineWidth = 0.4; // reduced from 2
        this.ctx.stroke();

        // Activity indicator
        if (player.currentActivity) {
            this.ctx.beginPath();
            this.ctx.arc(x, y, 2, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * player.activityProgress));  // was 10, now 2
            this.ctx.strokeStyle = '#f39c12';
            this.ctx.lineWidth = 0.4;  // reduced from 2
            this.ctx.stroke();
        }
    }

    drawPlayerPath() {
        if (!player.path || player.path.length < 2) return;

        // Draw the full path
        this.ctx.beginPath();
        this.ctx.moveTo(player.position.x, player.position.y);
        
        // Draw from current position to next waypoint
        if (player.pathIndex < player.path.length) {
            this.ctx.lineTo(player.path[player.pathIndex].x, player.path[player.pathIndex].y);
            
            // Draw remaining waypoints
            for (let i = player.pathIndex; i < player.path.length - 1; i++) {
                this.ctx.lineTo(player.path[i + 1].x, player.path[i + 1].y);
            }
        }
        
        this.ctx.strokeStyle = 'rgba(46, 204, 113, 0.5)';
        this.ctx.lineWidth = 0.4;
        this.ctx.setLineDash([1, 1]);
        this.ctx.stroke();
        this.ctx.setLineDash([]);

        // Draw waypoint markers
        this.ctx.fillStyle = 'rgba(46, 204, 113, 0.8)';
        for (let i = player.pathIndex; i < player.path.length; i++) {
            const point = player.path[i];
            this.ctx.beginPath();
            this.ctx.arc(point.x, point.y, 0.3, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }

    drawFPS() {
        // Draw FPS counter in top-left corner
        this.ctx.font = '16px Arial';
        this.ctx.fillStyle = '#0f0';
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 3;
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'top';
        
        const fpsText = `FPS: ${gameState.fps}`;
        this.ctx.strokeText(fpsText, 10, 10);
        this.ctx.fillText(fpsText, 10, 10);
    }

    drawDebugInfo() {
        // Draw debug info in top-right corner
        this.ctx.font = '14px Arial';
        this.ctx.fillStyle = '#ff0';
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 2;
        this.ctx.textAlign = 'right';
        this.ctx.textBaseline = 'top';
        
        const debugInfo = [
            `Pos: ${Math.round(player.position.x)}, ${Math.round(player.position.y)}`,
            `Collision: ${this.showCollisionDebug ? 'ON' : 'OFF'} (Press C)`,
            `Node Text: ${this.showNodeText ? 'ON' : 'OFF'} (Press N)`
        ];
        
        debugInfo.forEach((text, index) => {
            const y = 10 + index * 20;
            this.ctx.strokeText(text, this.canvas.width - 10, y);
            this.ctx.fillText(text, this.canvas.width - 10, y);
        });
    }

    handleClick(screenX, screenY) {
        // Convert screen coordinates to game coordinates using scaling system
        const gameCoords = scalingSystem.screenToGame(screenX, screenY);
        
        // Then convert to world coordinates
        const worldX = (gameCoords.x - this.canvas.width / 2) / this.camera.zoom + this.camera.x;
        const worldY = (gameCoords.y - this.canvas.height / 2) / this.camera.zoom + this.camera.y;

        // Check if clicked on a node
        const clickedNode = nodes.getNodeAt(worldX, worldY);
        if (clickedNode) {
            console.log('Clicked node:', clickedNode.name);
            // Could add manual node interaction here
        }
    }

    toggleCollisionDebug() {
        this.showCollisionDebug = !this.showCollisionDebug;
    }

    toggleNodeText() {
        this.showNodeText = !this.showNodeText;
    }
}

// Add keyboard shortcuts for debug features
window.addEventListener('keydown', (e) => {
    if (window.map) {
        if (e.key === 'c' || e.key === 'C') {
            map.toggleCollisionDebug();
        } else if (e.key === 'n' || e.key === 'N') {
            map.toggleNodeText();
        }
    }
});
