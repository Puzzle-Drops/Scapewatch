class MapRenderer {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Apply crisp rendering settings
        this.applyNoSmoothing();
        
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

    // Add this new method right after the constructor
    applyNoSmoothing() {
        this.ctx.imageSmoothingEnabled = false;
        this.ctx.webkitImageSmoothingEnabled = false;
        this.ctx.mozImageSmoothingEnabled = false;
        this.ctx.msImageSmoothingEnabled = false;
        this.ctx.imageSmoothingQuality = 'low';
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
        // Ensure no smoothing is applied (in case context was reset)
        this.applyNoSmoothing();
        
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
        // Camera instantly follows the player position (no lerp, no rounding)
        this.camera.x = player.position.x;
        this.camera.y = player.position.y;
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
        // Center the node on its pixel position
        const x = Math.floor(node.position.x) + 0.5;
        const y = Math.floor(node.position.y) + 0.5;

        // Draw icons based on node type
        if (node.type === 'bank') {
            const bankIcon = loadingManager.getImage('skill_bank');
            if (bankIcon) {
                // Draw icon centered on the pixel center
                this.ctx.drawImage(bankIcon, x - 2, y - 2, 4, 4);
            }
        } else if (node.type === 'quest') {
            const questIcon = loadingManager.getImage('skill_quests');
            if (questIcon) {
                // Draw icon centered on the pixel center
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

    // Get the color for a skill
    getSkillColor(skillId) {
        const skillColors = {
            'mining': '#808080',      // Grey rock color
            'fishing': '#5DADE2',     // Light blue
            'woodcutting': '#27AE60', // Green
            'cooking': '#8E44AD',     // Purple
            // Add more skills as needed
            'attack': '#C0392B',
            'strength': '#E74C3C',
            'defence': '#3498DB',
            'magic': '#2E86AB',
            'ranged': '#16A085',
            'prayer': '#F4D03F',
            'runecraft': '#5B2C6F',
            'construction': '#A04000',
            'agility': '#2E4053',
            'herblore': '#239B56',
            'thieving': '#884EA0',
            'crafting': '#935116',
            'fletching': '#0E6655',
            'slayer': '#641E16',
            'hunter': '#5D4E37',
            'smithing': '#515A5A',
            'firemaking': '#DC7633',
            'farming': '#1E8449'
        };
        
        return skillColors[skillId] || '#f39c12'; // Default orange
    }

    drawPlayer() {
        // Use the actual player position for smooth movement
        const { x, y } = player.position;

        // Player circle (reduced to 1/5 of original size)
        this.ctx.beginPath();
        this.ctx.arc(x, y, 1.2, 0, Math.PI * 2);  // was 6, now 1.2
        this.ctx.fillStyle = player.isStunned ? '#e74c3c' : '#2ecc71'; // Red when stunned
        this.ctx.fill();
        this.ctx.strokeStyle = player.isStunned ? '#c0392b' : '#27ae60';
        this.ctx.lineWidth = 0.4; // reduced from 2
        this.ctx.stroke();

        // Activity indicator OR stun indicator OR banking indicator OR path prep indicator
        if (player.isBanking) {
            // Show banking progress (golden circle that depletes counter-clockwise)
            const bankingProgress = player.getBankingProgress();
            if (bankingProgress > 0) {
                this.ctx.beginPath();
                // Start from top, go counter-clockwise based on remaining progress
                this.ctx.arc(x, y, 2, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * bankingProgress));
                this.ctx.strokeStyle = '#f39c12'; // Golden color for banking
                this.ctx.lineWidth = 0.4;
                this.ctx.stroke();
            }
        } else if (player.isPreparingPath) {
            // Show path preparation progress (white circle that depletes counter-clockwise)
            const pathPrepProgress = player.getPathPreparationProgress();
            if (pathPrepProgress > 0) {
                this.ctx.beginPath();
                // Start from top, go counter-clockwise based on remaining progress
                this.ctx.arc(x, y, 2, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * pathPrepProgress));
                this.ctx.strokeStyle = '#ffffff'; // White color for path preparation
                this.ctx.lineWidth = 0.4;
                this.ctx.stroke();
            }
        } else if (player.isStunned) {
            // Show stun progress (counter-clockwise from full)
            const stunProgress = player.getStunProgress();
            this.ctx.beginPath();
            this.ctx.arc(x, y, 2, -Math.PI / 2, -Math.PI / 2 - (Math.PI * 2 * stunProgress));
            this.ctx.strokeStyle = '#e74c3c';
            this.ctx.lineWidth = 0.4;
            this.ctx.stroke();
        } else if (player.currentActivity) {
            // Get the skill for the current activity
            let activityColor = '#f39c12'; // Default orange
            
            const activityData = loadingManager.getData('activities')[player.currentActivity];
            if (activityData && activityData.skill) {
                activityColor = this.getSkillColor(activityData.skill);
            }
            
            this.ctx.beginPath();
            this.ctx.arc(x, y, 2, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * player.activityProgress));  // was 10, now 2
            this.ctx.strokeStyle = activityColor;
            this.ctx.lineWidth = 0.4;  // reduced from 2
            this.ctx.stroke();
        }
    }

    drawPlayerPath() {
        if (!player.path || player.path.length === 0) return;

        // Draw the path from destination back to player (reversed)
        this.ctx.beginPath();
        
        // Start from the final destination
        const destination = player.path[player.path.length - 1];
        this.ctx.moveTo(destination.x, destination.y);
        
        // Draw backwards through the path
        for (let i = player.path.length - 2; i >= player.pathIndex; i--) {
            this.ctx.lineTo(player.path[i].x, player.path[i].y);
        }
        
        // End at player position
        this.ctx.lineTo(player.position.x, player.position.y);
        
        this.ctx.strokeStyle = 'rgba(46, 204, 113, 0.5)';
        this.ctx.lineWidth = 0.4;
        this.ctx.setLineDash([1, 1]);
        this.ctx.stroke();
        this.ctx.setLineDash([]);

        // Draw waypoint markers (only for remaining waypoints)
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
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 3;
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'top';
        
        // Color code based on FPS
        if (gameState.fps >= 60) {
            this.ctx.fillStyle = '#0f0'; // Green for 60+ FPS
        } else if (gameState.fps >= 30) {
            this.ctx.fillStyle = '#ff0'; // Yellow for 30-59 FPS
        } else {
            this.ctx.fillStyle = '#f00'; // Red for under 30 FPS
        }
        
        const fpsText = `${gameState.fps} FPS`;
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

        // Check if clicked on a node (adjusted for pixel-centered positions)
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
