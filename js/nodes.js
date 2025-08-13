class NodeManager {
    constructor() {
        this.nodes = {};
        this.accessibleBanks = []; // Track accessible banks
        this.loadNodes();
    }

    loadNodes() {
        this.nodes = loadingManager.getData('nodes');
        
        // Validate nodes are in walkable positions after collision system loads
        // Increased timeout to ensure collision is fully ready
        setTimeout(() => {
            if (window.collision && window.collision.initialized) {
                this.validateNodePositions();
            } else {
                // If collision isn't ready, keep trying
                const retryInterval = setInterval(() => {
                    if (window.collision && window.collision.initialized) {
                        this.validateNodePositions();
                        clearInterval(retryInterval);
                    }
                }, 100);
            }
        }, 250);
    }

    validateNodePositions() {
        let invalidNodes = [];
        this.accessibleBanks = []; // Reset accessible banks list
        
        for (const [id, node] of Object.entries(this.nodes)) {
            // Check if the exact position is walkable
            const isWalkable = collision.isWalkable(
                Math.floor(node.position.x), 
                Math.floor(node.position.y)
            );
            
            if (!isWalkable) {
                invalidNodes.push(id);
                console.warn(`Node ${id} (${node.name}) is in a non-walkable position at (${node.position.x}, ${node.position.y})!`);
            } else {
                // If it's a walkable bank, add to accessible banks list
                if (node.type === 'bank') {
                    this.accessibleBanks.push(node);
                    console.log(`Bank ${node.name} is accessible at (${node.position.x}, ${node.position.y})`);
                }
            }
        }
        
        if (invalidNodes.length > 0) {
            console.warn(`Found ${invalidNodes.length} nodes in non-walkable positions. These nodes will be excluded from pathfinding.`);
        } else {
            console.log('All nodes are in walkable positions.');
        }
        
        console.log(`Found ${this.accessibleBanks.length} accessible banks`);
    }

    getNode(nodeId) {
        return this.nodes[nodeId];
    }

    getNodesOfType(type) {
        return Object.values(this.nodes).filter(node => node.type === type);
    }

    getNearestBank(position) {
        // Use only pre-validated accessible banks
        if (this.accessibleBanks.length === 0) {
            console.error('No accessible banks found! Falling back to all banks.');
            // Fallback in case accessibleBanks hasn't been populated yet
            const allBanks = this.getNodesOfType('bank');
            
            for (const bank of allBanks) {
                // Double-check walkability
                if (window.collision && window.collision.initialized) {
                    const isWalkable = collision.isWalkable(
                        Math.floor(bank.position.x),
                        Math.floor(bank.position.y)
                    );
                    if (!isWalkable) {
                        console.log(`Skipping inaccessible bank: ${bank.name}`);
                        continue;
                    }
                }
                
                // Try to path to it
                if (window.pathfinding) {
                    const path = pathfinding.findPath(
                        position.x, position.y, 
                        bank.position.x, bank.position.y
                    );
                    if (!path) {
                        console.log(`Cannot path to bank: ${bank.name}`);
                        continue;
                    }
                }
                
                // If we get here, use this bank
                return bank;
            }
            return null;
        }
        
        let nearest = null;
        let minDistance = Infinity;

        for (const bank of this.accessibleBanks) {
            // Since these are pre-validated, we can just check distance
            const dist = distance(position.x, position.y, bank.position.x, bank.position.y);
            
            if (dist < minDistance) {
                // Double-check we can actually path there right now
                if (window.pathfinding) {
                    const path = pathfinding.findPath(
                        position.x, position.y,
                        bank.position.x, bank.position.y
                    );
                    if (!path) {
                        console.log(`Cannot currently path to ${bank.name}, skipping`);
                        continue;
                    }
                }
                
                minDistance = dist;
                nearest = bank;
            }
        }

        if (!nearest) {
            console.error('Could not find any reachable bank!');
        } else {
            console.log(`Nearest bank: ${nearest.name} at distance ${Math.round(minDistance)}`);
        }

        return nearest;
    }

    // Get nearest bank to a specific position (not just player position)
    getNearestBankToPosition(targetPosition) {
        // Use only pre-validated accessible banks
        if (this.accessibleBanks.length === 0) {
            console.error('No accessible banks found!');
            return null;
        }
        
        let nearest = null;
        let minDistance = Infinity;

        for (const bank of this.accessibleBanks) {
            // Check if we can actually path to this bank from target position
            if (window.pathfinding) {
                const path = pathfinding.findPath(
                    targetPosition.x, targetPosition.y, 
                    bank.position.x, bank.position.y
                );
                if (!path) {
                    console.log(`Cannot path from target to ${bank.name}, skipping`);
                    continue;
                }
            }
            
            const dist = distance(targetPosition.x, targetPosition.y, bank.position.x, bank.position.y);
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
                const path = pathfinding.findPath(position.x, position.y, node.position.x, node.position.y);
                if (!path) continue; // Skip inaccessible nodes
            }
            
            const dist = distance(position.x, position.y, node.position.x, node.position.y);
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
            const dist = distance(x, y, node.position.x, node.position.y);
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

        // Check if current position is already walkable
        if (collision.isWalkable(x, y)) {
            return { x, y };
        }

        // Search in expanding circles
        for (let radius = 1; radius <= maxRadius; radius++) {
            // Check positions in a circle
            const steps = radius * 8; // More steps for larger radius
            for (let i = 0; i < steps; i++) {
                const angle = (i / steps) * Math.PI * 2;
                const checkX = Math.round(x + Math.cos(angle) * radius);
                const checkY = Math.round(y + Math.sin(angle) * radius);
                
                if (collision.isWalkable(checkX, checkY)) {
                    return { x: checkX, y: checkY };
                }
            }
        }

        console.warn(`Could not find walkable position near ${x}, ${y}`);
        return { x, y }; // Return original if nothing found
    }
}
