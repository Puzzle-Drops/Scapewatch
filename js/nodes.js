class NodeManager {
    constructor() {
        this.nodes = {};
        this.loadNodes();
    }

    loadNodes() {
        this.nodes = loadingManager.getData('nodes');
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
            const dist = distance(position.x, position.y, bank.position.x, bank.position.y);
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

    getNodeAt(x, y, radius = 15) {  // Reduced from 20 to 15
    for (const [id, node] of Object.entries(this.nodes)) {
        const dist = distance(x, y, node.position.x, node.position.y);
        if (dist <= radius) {
            return node;
        }
    }
    return null;
}
}
