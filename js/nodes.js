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

    getNodeAt(x, y, radius = 3) {  // Reduced from 15 to 3 (1/5 of original)
        for (const [id, node] of Object.entries(this.nodes)) {
            const dist = distance(x, y, node.position.x, node.position.y);
            if (dist <= radius) {
                return node;
            }
        }
        return null;
    }
}
        // All goals complete - add new ones
        this.generateNewGoals();
    }

    isGoalComplete(goal) {
        switch (goal.type) {
            case 'skill_level':
                return skills.getLevel(goal.skill) >= goal.targetLevel;
            
            case 'bank_items':
                return bank.getItemCount(goal.itemId) >= goal.targetCount;
            
            case 'complete_quest':
                // TODO: Implement quest completion check
                return false;
            
            default:
                return false;
        }
    }

    executeGoal(goal) {
        switch (goal.type) {
            case 'skill_level':
                this.trainSkill(goal.skill);
                break;
            
            case 'bank_items':
                this.gatherItems(goal.itemId);
                break;
            
            case 'complete_quest':
                this.doQuest(goal.questId);
                break;
        }
    }

    trainSkill(skillId) {
        // Find best activity for training this skill
        const activities = loadingManager.getData('activities');
        const skillActivities = Object.entries(activities)
            .filter(([id, data]) => data.skill === skillId && skills.canPerformActivity(id))
            .sort((a, b) => b[1].xpPerAction - a[1].xpPerAction);

        if (skillActivities.length === 0) {
            console.log(`No available activities for ${skillId}`);
            return;
        }

        const [bestActivityId] = skillActivities[0];
        this.doActivity(bestActivityId);
    }

    gatherItems(itemId) {
        // Find activities that give this item
        const activities = loadingManager.getData('activities');
        const itemActivities = Object.entries(activities)
            .filter(([id, data]) => {
                if (!skills.canPerformActivity(id)) return false;
                return data.rewards?.some(r => r.itemId === itemId);
            });

        if (itemActivities.length === 0) {
            console.log(`No activities found for item ${itemId}`);
            return;
        }

        const [activityId] = itemActivities[0];
        this.doActivity(activityId);
    }

    doActivity(activityId) {
        // Check if we're at a node with this activity
        const currentNode = nodes.getNode(player.currentNode);
        if (currentNode && currentNode.activities?.includes(activityId)) {
            player.startActivity(activityId);
            return;
        }

        // Find nearest node with this activity
        const targetNode = nodes.getNearestNodeWithActivity(player.position, activityId);
        if (!targetNode) {
            console.log(`No node found for activity ${activityId}`);
            return;
        }

        // Move to the node
        player.moveTo(targetNode.id);
    }

    goToBank() {
        // If already at bank, deposit all
        const currentNode = nodes.getNode(player.currentNode);
        if (currentNode && currentNode.type === 'bank') {
            const deposited = bank.depositAll();
            console.log(`Deposited ${deposited} items`);
            ui.updateSkillsList(); // Update UI after banking
            
            // Check if current goal is complete
            if (this.currentGoal && this.isGoalComplete(this.currentGoal)) {
                console.log('Goal complete:', this.currentGoal);
                this.currentGoal = null;
            }
            
            // Make a new decision (will continue current goal if not complete)
            this.makeDecision();
            return;
        }

        // Find nearest bank
        const nearestBank = nodes.getNearestBank(player.position);
        if (!nearestBank) {
            console.log('No bank found!');
            return;
        }

        // Move to bank
        player.moveTo(nearestBank.id);
    }

    doQuest(questId) {
        // TODO: Implement quest system
        console.log(`Quest system not yet implemented: ${questId}`);
    }

    generateNewGoals() {
        // Generate new goals based on current progress
        const totalLevel = skills.getTotalLevel();

        // Add some higher level goals
        this.addGoal({
            type: 'skill_level',
            skill: 'woodcutting',
            targetLevel: 30,
            priority: this.goals.length + 1
        });

        this.addGoal({
            type: 'bank_items',
            itemId: 'willow_logs',
            targetCount: 500,
            priority: this.goals.length + 2
        });

        console.log('Generated new goals');
    }

    getStatus() {
        if (!this.currentGoal) return 'No active goal';

        switch (this.currentGoal.type) {
            case 'skill_level':
                const currentLevel = skills.getLevel(this.currentGoal.skill);
                return `Training ${this.currentGoal.skill} to level ${this.currentGoal.targetLevel} (current: ${currentLevel})`;
            
            case 'bank_items':
                const currentCount = bank.getItemCount(this.currentGoal.itemId);
                const itemData = loadingManager.getData('items')[this.currentGoal.itemId];
                return `Banking ${itemData.name}: ${currentCount}/${this.currentGoal.targetCount}`;
            
            default:
                return 'Working on goal...';
        }
    }
}
