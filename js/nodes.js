class NodeManager {
    constructor() {
        this.nodes = {};
        this.loadNodes();
    }

    loadNodes() {
        this.nodes = loadingManager.getData('nodes');
        
        // Validate nodes are in walkable positions after collision system loads
        setTimeout(() => {
            if (window.collision && window.collision.initialized) {
                this.validateNodePositions();
            }
        }, 100);
    }

    validateNodePositions() {
        let invalidNodes = [];
        
        for (const [id, node] of Object.entries(this.nodes)) {
            // Check if a player can fit at this node position
            if (!collision.canCircleFit(node.position.x, node.position.y, 0.5)) {
                invalidNodes.push(id);
                console.warn(`Node ${id} (${node.name}) is in a non-walkable position for player!`);
            }
        }
        
        if (invalidNodes.length > 0) {
            console.warn(`Found ${invalidNodes.length} nodes in non-walkable positions. These nodes may be inaccessible.`);
        } else {
            console.log('All nodes are in walkable positions.');
        }
    }

    getNode(nodeId) {
        return this.nodes[nodeId];
    }

    getNodesOfType(type) {
        return Object.values(this.nodes).filter(node => node.type === type);
    }

    getNearestBank(position) {
        const banks = this.getNodesOfType('bank');
        let nearest = null;
        let minDistance = Infinity;

        for (const bank of banks) {
            // Check if we can actually path to this bank
            if (window.pathfinding) {
                const path = pathfinding.findPath(
                    position.x, 
                    position.y, 
                    bank.position.x, 
                    bank.position.y,
                    0.5 // Player radius
                );
                if (!path) continue; // Skip inaccessible banks
            }
            
            const dist = Math.sqrt(
                Math.pow(position.x - bank.position.x, 2) + 
                Math.pow(position.y - bank.position.y, 2)
            );
            if (dist < minDistance) {
                minDistance = dist;
                nearest = bank;
            }
        }

        return nearest;
    }

    getNearestNodeWithActivity(position, activityId) {
        const nodesWithActivity = Object.values(this.nodes).filter(
            node => node.activities && node.activities.includes(activityId)
        );

        let nearest = null;
        let minDistance = Infinity;

        for (const node of nodesWithActivity) {
            // Check if we can actually path to this node
            if (window.pathfinding) {
                const path = pathfinding.findPath(
                    position.x, 
                    position.y, 
                    node.position.x, 
                    node.position.y,
                    0.5 // Player radius
                );
                if (!path) continue; // Skip inaccessible nodes
            }
            
            const dist = Math.sqrt(
                Math.pow(position.x - node.position.x, 2) + 
                Math.pow(position.y - node.position.y, 2)
            );
            if (dist < minDistance) {
                minDistance = dist;
                nearest = node;
            }
        }

        return nearest;
    }

    getAvailableActivities(nodeId) {
        const node = this.nodes[nodeId];
        if (!node || !node.activities) return [];

        const activities = loadingManager.getData('activities');
        return node.activities.filter(activityId => {
            const activity = activities[activityId];
            return activity && skills.canPerformActivity(activityId);
        });
    }

    getAllNodes() {
        return this.nodes;
    }

    getNodeAt(x, y, radius = 2) {  // Adjusted to match icon size (half of 4x4 icon)
        for (const [id, node] of Object.entries(this.nodes)) {
            const dist = Math.sqrt(
                Math.pow(x - node.position.x, 2) + 
                Math.pow(y - node.position.y, 2)
            );
            if (dist <= radius) {
                return node;
            }
        }
        return null;
    }

    // Find nearest walkable position to a node (for nodes that might be slightly in walls)
    findNearestWalkablePosition(x, y, maxRadius = 5) {
        if (!window.collision || !window.collision.initialized) {
            return { x, y }; // Return original position if collision not ready
        }

        // Check if current position is already walkable for a player
        if (collision.canCircleFit(x, y, 0.5)) {
            return { x, y };
        }

        // Search in expanding circles
        for (let radius = 1; radius <= maxRadius; radius++) {
            // Check positions in a circle
            const steps = radius * 8; // More steps for larger radius
            for (let i = 0; i < steps; i++) {
                const angle = (i / steps) * Math.PI * 2;
                const checkX = x + Math.cos(angle) * radius;
                const checkY = y + Math.sin(angle) * radius;
                
                if (collision.canCircleFit(checkX, checkY, 0.5)) {
                    return { x: checkX, y: checkY };
                }
            }
        }

        console.warn(`Could not find walkable position near ${x}, ${y}`);
        return { x, y }; // Return original if nothing found
    }
}
