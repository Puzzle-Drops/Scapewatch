class MapRenderer {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.camera = {
            x: 0,
            y: 0,
            zoom: 6.25 // increased by 1/4 from 5
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

        // Node circle (reduced to 1/5 of original size)
        this.ctx.beginPath();
        this.ctx.arc(x, y, 1, 0, Math.PI * 2); // was 5, now 1

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
        this.ctx.lineWidth = 0.5; // reduced from 2
        this.ctx.stroke();

        // Draw icons based on node type
        if (node.type === 'bank') {
            const bankIcon = loadingManager.getImage('skill_bank');
            if (bankIcon) {
                this.ctx.drawImage(bankIcon, x - 4, y - 4, 8, 8);
            }
        } else if (node.type === 'quest') {
            const questIcon = loadingManager.getImage('skill_quests');
            if (questIcon) {
                this.ctx.drawImage(questIcon, x - 4, y - 4, 8, 8);
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
            const iconSize = 8;
            const spacing = 1;
            const totalWidth = uniqueSkills.length * iconSize + (uniqueSkills.length - 1) * spacing;
            const startX = x - totalWidth / 2;
            
            // Draw skill icons
            uniqueSkills.forEach((skill, index) => {
                const skillIcon = loadingManager.getImage(`skill_${skill}`);
                if (skillIcon) {
                    const iconX = startX + index * (iconSize + spacing);
                    this.ctx.drawImage(skillIcon, iconX, y - 4, iconSize, iconSize);
                }
            });
        }

        // Node name (smaller font)
        this.ctx.font = '2px Arial'; // reduced from 8px
        this.ctx.fillStyle = '#fff';
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 0.25; // reduced from 1
        this.ctx.strokeText(node.name, x, y + 4); // reduced offset from 15
        this.ctx.fillText(node.name, x, y + 4);
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
        if (!player.targetPosition) return;

        this.ctx.beginPath();
        this.ctx.moveTo(player.position.x, player.position.y);
        this.ctx.lineTo(player.targetPosition.x, player.targetPosition.y);
        this.ctx.strokeStyle = 'rgba(46, 204, 113, 0.5)';
        this.ctx.lineWidth = 0.4; // reduced from 2
        this.ctx.setLineDash([1, 1]); // reduced from [5, 5]
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
