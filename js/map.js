class MapRenderer {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.camera = {
            x: 0,
            y: 0,
            zoom: 10  // High zoom for close-up view
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

        // Draw player path
        this.drawPlayerPath();
        
        // Draw player (before nodes so it appears under them)
        this.drawPlayer();

        // Draw nodes (last so they appear on top)
        this.drawNodes();

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

            if (screenDist < 800 / this.camera.zoom) {
                this.drawNode(node);
            }
        }
    }

    drawNode(node) {
        const { x, y } = node.position;
        
        // Get unique skills from activities
        const skills = this.getNodeSkills(node);
        
        if (skills.length === 0) return;
        
        // Calculate icon positions based on count
        const iconSize = 3;  // Very small for high zoom
        const positions = this.getIconPositions(skills.length, iconSize);
        
        // Draw each skill icon
        skills.forEach((skill, index) => {
            const pos = positions[index];
            const iconX = x + pos.x - iconSize / 2;
            const iconY = y + pos.y - iconSize / 2;
            
            // Get icon from loading manager
            const icon = loadingManager.getImage(`skill_${skill}`);
            
            if (icon) {
                this.ctx.drawImage(icon, iconX, iconY, iconSize, iconSize);
            } else {
                // Fallback: colored square with initial
                this.ctx.fillStyle = this.getSkillColor(skill);
                this.ctx.fillRect(iconX, iconY, iconSize, iconSize);
                
                this.ctx.fillStyle = '#fff';
                this.ctx.font = 'bold 3px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText(skill.charAt(0).toUpperCase(), iconX + iconSize / 2, iconY + iconSize / 2);
            }
        });
        
        // Node name
        this.ctx.font = '3px Arial';  // Very small for high zoom
        this.ctx.fillStyle = '#fff';
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 0.5;
        this.ctx.textAlign = 'center';
        this.ctx.strokeText(node.name, x, y + 5);
        this.ctx.fillText(node.name, x, y + 5);
    }

    getNodeSkills(node) {
        const skills = new Set();
        
        if (node.type === 'bank') {
            skills.add('bank');
        } else if (node.type === 'quest') {
            skills.add('quests');
        } else if (node.type === 'skill' && node.activities) {
            // Get all unique skills from activities
            const activities = loadingManager.getData('activities');
            for (const activityId of node.activities) {
                const activity = activities[activityId];
                if (activity && activity.skill) {
                    skills.add(activity.skill);
                }
            }
        }
        
        return Array.from(skills);
    }

    getIconPositions(count, iconSize) {
        const spacing = 1;  // Very small spacing for tiny icons
        
        switch (count) {
            case 1:
                // Single icon centered
                return [{ x: 0, y: 0 }];
                
            case 2:
                // Two icons side by side
                const offset2 = (iconSize + spacing) / 2;
                return [
                    { x: -offset2, y: 0 },
                    { x: offset2, y: 0 }
                ];
                
            case 3:
                // Triangle formation
                const offset3 = (iconSize + spacing) / 2;
                return [
                    { x: 0, y: -offset3 },
                    { x: -offset3, y: offset3 / 2 },
                    { x: offset3, y: offset3 / 2 }
                ];
                
            case 4:
                // 2x2 grid
                const offset4 = (iconSize + spacing) / 2;
                return [
                    { x: -offset4, y: -offset4 },
                    { x: offset4, y: -offset4 },
                    { x: -offset4, y: offset4 },
                    { x: offset4, y: offset4 }
                ];
                
            default:
                // For more than 4, just use first 4 positions
                return this.getIconPositions(4, iconSize).slice(0, count);
        }
    }

    getSkillColor(skill) {
        // Fallback colors for each skill type
        const colors = {
            bank: '#f1c40f',
            quests: '#e74c3c',
            combat: '#c0392b',
            skills: '#f39c12',
            attack: '#9b2c2c',
            strength: '#2c9b2c',
            defence: '#2c2c9b',
            hitpoints: '#e74c3c',
            ranged: '#4a7c59',
            prayer: '#ecf0f1',
            magic: '#9b59b6',
            woodcutting: '#8b4513',
            mining: '#696969',
            fishing: '#4682b4',
            cooking: '#ff6347',
            crafting: '#8b7355',
            smithing: '#708090',
            agility: '#34495e',
            thieving: '#2c3e50',
            runecraft: '#8e44ad',
            construction: '#795548',
            herblore: '#27ae60',
            fletching: '#16a085',
            slayer: '#c0392b',
            hunter: '#d35400',
            farming: '#229954',
            firemaking: '#e67e22'
        };
        
        return colors[skill] || '#3498db';
    }

    drawPlayer() {
        const { x, y } = player.position;

        // Player circle
        this.ctx.beginPath();
        this.ctx.arc(x, y, 2, 0, Math.PI * 2);  // Small for high zoom
        this.ctx.fillStyle = '#2ecc71';
        this.ctx.fill();
        this.ctx.strokeStyle = '#27ae60';
        this.ctx.lineWidth = 0.5;
        this.ctx.stroke();

        // Activity indicator
        if (player.currentActivity) {
            this.ctx.beginPath();
            this.ctx.arc(x, y, 3, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * player.activityProgress));
            this.ctx.strokeStyle = '#f39c12';
            this.ctx.lineWidth = 0.5;
            this.ctx.stroke();
        }
    }

    drawPlayerPath() {
        if (!player.targetPosition) return;

        this.ctx.beginPath();
        this.ctx.moveTo(player.position.x, player.position.y);
        this.ctx.lineTo(player.targetPosition.x, player.targetPosition.y);
        this.ctx.strokeStyle = 'rgba(46, 204, 113, 0.5)';
        this.ctx.lineWidth = 0.5;
        this.ctx.setLineDash([2, 2]);
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
