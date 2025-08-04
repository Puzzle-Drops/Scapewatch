class MapRenderer {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d', { alpha: false }); // Optimization: disable alpha
        this.camera = {
            x: 4395, // Start at player position
            y: 1882,
            zoom: 6.25
        };
        this.worldMap = loadingManager.getImage('worldMap');
        this.showNodeText = false;
        
        // Cache for performance
        this.visibleNodes = [];
        this.lastCameraX = 0;
        this.lastCameraY = 0;
        this.viewportPadding = 100; // Extra padding for smooth scrolling
    }

    render() {
        // Clear canvas with black (no alpha)
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Update camera to follow player
        this.updateCamera();

        // Save context state
        this.ctx.save();

        // Apply camera transform with integer values to avoid sub-pixel rendering
        const centerX = Math.floor(this.canvas.width / 2);
        const centerY = Math.floor(this.canvas.height / 2);
        const cameraX = Math.floor(this.camera.x);
        const cameraY = Math.floor(this.camera.y);
        
        this.ctx.translate(centerX, centerY);
        this.ctx.scale(this.camera.zoom, this.camera.zoom);
        this.ctx.translate(-cameraX, -cameraY);

        // Calculate visible bounds for culling
        const viewLeft = cameraX - (centerX + this.viewportPadding) / this.camera.zoom;
        const viewRight = cameraX + (centerX + this.viewportPadding) / this.camera.zoom;
        const viewTop = cameraY - (centerY + this.viewportPadding) / this.camera.zoom;
        const viewBottom = cameraY + (centerY + this.viewportPadding) / this.camera.zoom;

        // Draw only visible portion of world map
        if (this.worldMap) {
            // Calculate which part of the image is visible
            const imgLeft = Math.max(0, viewLeft);
            const imgTop = Math.max(0, viewTop);
            const imgRight = Math.min(this.worldMap.width, viewRight);
            const imgBottom = Math.min(this.worldMap.height, viewBottom);
            
            if (imgRight > imgLeft && imgBottom > imgTop) {
                // Draw only the visible portion
                this.ctx.drawImage(
                    this.worldMap,
                    imgLeft, imgTop, // Source position
                    imgRight - imgLeft, imgBottom - imgTop, // Source dimensions
                    imgLeft, imgTop, // Destination position
                    imgRight - imgLeft, imgBottom - imgTop // Destination dimensions
                );
            }
        }

        // Update visible nodes cache only if camera moved significantly
        if (Math.abs(this.camera.x - this.lastCameraX) > 10 || 
            Math.abs(this.camera.y - this.lastCameraY) > 10) {
            this.updateVisibleNodes(viewLeft, viewRight, viewTop, viewBottom);
            this.lastCameraX = this.camera.x;
            this.lastCameraY = this.camera.y;
        }

        // Draw only visible nodes
        for (const node of this.visibleNodes) {
            this.drawNode(node);
        }

        // Draw player
        this.drawPlayer();

        // Draw player path
        if (player.targetPosition) {
            this.drawPlayerPath();
        }

        // Restore context state
        this.ctx.restore();

        // Draw UI elements (not affected by camera)
        this.drawMinimap();
    }

    updateCamera() {
        // Smooth camera follow with integer positions
        const targetX = player.position.x;
        const targetY = player.position.y;

        this.camera.x = lerp(this.camera.x, targetX, 0.1);
        this.camera.y = lerp(this.camera.y, targetY, 0.1);
    }

    updateVisibleNodes(left, right, top, bottom) {
        this.visibleNodes = [];
        const allNodes = nodes.getAllNodes();

        for (const node of Object.values(allNodes)) {
            // Check if node is within visible bounds
            if (node.position.x >= left && node.position.x <= right &&
                node.position.y >= top && node.position.y <= bottom) {
                this.visibleNodes.push(node);
            }
        }
    }

    drawNode(node) {
        // Use integer coordinates
        const x = Math.floor(node.position.x);
        const y = Math.floor(node.position.y);

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
                    const iconX = Math.floor(startX + index * (iconSize + spacing));
                    this.ctx.drawImage(skillIcon, iconX, y - 2, iconSize, iconSize);
                }
            });
        }

        // Node name (only if flag is set)
        if (this.showNodeText) {
            this.ctx.font = '2px Arial';
            this.ctx.fillStyle = '#fff';
            this.ctx.strokeStyle = '#000';
            this.ctx.lineWidth = 0.25;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'bottom';
            this.ctx.strokeText(node.name, x, y - 5);
            this.ctx.fillText(node.name, x, y - 5);
        }
    }

    drawPlayer() {
        // Use integer coordinates
        const x = Math.floor(player.position.x);
        const y = Math.floor(player.position.y);

        // Player circle
        this.ctx.beginPath();
        this.ctx.arc(x, y, 1.2, 0, Math.PI * 2);
        this.ctx.fillStyle = '#2ecc71';
        this.ctx.fill();
        this.ctx.strokeStyle = '#27ae60';
        this.ctx.lineWidth = 0.4;
        this.ctx.stroke();

        // Activity indicator
        if (player.currentActivity) {
            this.ctx.beginPath();
            this.ctx.arc(x, y, 2, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * player.activityProgress));
            this.ctx.strokeStyle = '#f39c12';
            this.ctx.lineWidth = 0.4;
            this.ctx.stroke();
        }
    }

    drawPlayerPath() {
        const px = Math.floor(player.position.x);
        const py = Math.floor(player.position.y);
        const tx = Math.floor(player.targetPosition.x);
        const ty = Math.floor(player.targetPosition.y);
        
        this.ctx.beginPath();
        this.ctx.moveTo(tx, ty);
        this.ctx.lineTo(px, py);
        this.ctx.strokeStyle = 'rgba(46, 204, 113, 0.5)';
        this.ctx.lineWidth = 0.4;
        this.ctx.setLineDash([1, 1]);
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
        const scale = minimapSize / 1000;

        // Draw only visible nodes on minimap for performance
        for (const node of this.visibleNodes) {
            const mx = Math.floor(minimapX + node.position.x * scale);
            const my = Math.floor(minimapY + node.position.y * scale);

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
        const px = Math.floor(minimapX + player.position.x * scale);
        const py = Math.floor(minimapY + player.position.y * scale);

        this.ctx.beginPath();
        this.ctx.arc(px, py, 3, 0, Math.PI * 2);
        this.ctx.fillStyle = '#2ecc71';
        this.ctx.fill();
    }

    handleClick(x, y) {
        // Convert screen coordinates to world coordinates
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const worldX = (x - centerX) / this.camera.zoom + this.camera.x;
        const worldY = (y - centerY) / this.camera.zoom + this.camera.y;

        // Check if clicked on a node
        const clickedNode = nodes.getNodeAt(worldX, worldY);
        if (clickedNode) {
            console.log('Clicked node:', clickedNode.name);
        }
    }
}
