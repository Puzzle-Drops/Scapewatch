class AIManager {
    constructor() {
        this.currentGoal = null;
        this.goals = [];
        this.decisionCooldown = 0;
        this.failedNodes = new Set();
        this.plannedActivity = null;
        this.unachievableGoals = new Map();
        this.initializeGoals();
    }

    // ==================== INITIALIZATION & GOAL MANAGEMENT ====================

    initializeGoals() {
        // Let skills generate initial goals
        this.generateNewGoals();
    }

    addGoal(goal) {
        // Store starting values when goal is created
        if (goal.type === 'skill_level') {
            goal.startingLevel = skills.getLevel(goal.skill);
            goal.startingXp = skills.getXp(goal.skill);
        } else if (goal.type === 'bank_items') {
            goal.startingCount = bank.getItemCount(goal.itemId);
        }
        
        this.goals.push(goal);
        this.goals.sort((a, b) => a.priority - b.priority);
    }

    selectNewGoal() {
        // Clean up expired unachievable goals
        const now = Date.now();
        for (const [goalKey, timestamp] of this.unachievableGoals.entries()) {
            if (now - timestamp > 30000) {
                this.unachievableGoals.delete(goalKey);
                console.log(`Retrying previously unachievable goal: ${goalKey}`);
            }
        }
        
        // Find first incomplete and achievable goal
        for (const goal of this.goals) {
            const goalKey = this.getGoalKey(goal);
            
            if (this.unachievableGoals.has(goalKey)) {
                continue;
            }
            
            if (!this.isGoalComplete(goal)) {
                this.currentGoal = goal;
                
                // Update starting values
                if (goal.type === 'skill_level') {
                    goal.startingLevel = skills.getLevel(goal.skill);
                    goal.startingXp = skills.getXp(goal.skill);
                } else if (goal.type === 'bank_items') {
                    goal.startingCount = bank.getItemCount(goal.itemId);
                }
                
                console.log('New goal selected:', goal);
                if (window.ui) {
                    window.ui.forceGoalUpdate();
                }
                return;
            }
        }

        // All goals complete or unachievable
        console.log('All goals complete or unachievable, generating new goals');
        this.generateNewGoals();
        this.selectNewGoal();
    }

    getGoalKey(goal) {
        switch (goal.type) {
            case 'skill_level':
                return `skill_${goal.skill}_${goal.targetLevel}`;
            case 'bank_items':
                return `bank_${goal.itemId}_${goal.targetCount}`;
            case 'complete_quest':
                return `quest_${goal.questId}`;
            default:
                return `unknown_${JSON.stringify(goal)}`;
        }
    }

    isGoalComplete(goal) {
        switch (goal.type) {
            case 'skill_level':
                return skills.getLevel(goal.skill) >= goal.targetLevel;
            
            case 'bank_items':
                return bank.getItemCount(goal.itemId) >= goal.targetCount;
            
            case 'complete_quest':
                return false; // TODO: Implement
            
            default:
                return false;
        }
    }

    generateNewGoals() {
        const baseGoalCount = this.goals.length;
        
        // Let skill registry generate all goals
        const newGoals = skillRegistry.generateAllGoals(baseGoalCount);
        
        for (const goal of newGoals) {
            this.addGoal(goal);
        }
        
        console.log(`Generated ${newGoals.length} new goals`);
        
        if (window.ui) {
            window.ui.forceGoalUpdate();
        }
    }

    // ==================== DECISION MAKING & EXECUTION ====================

    update(deltaTime) {
        this.decisionCooldown -= deltaTime;
        
        // Always check if current goal is complete
        if (this.currentGoal && this.isGoalComplete(this.currentGoal)) {
            this.completeCurrentGoal();
        }

        // Only make decisions if cooldown has expired
        if (this.decisionCooldown > 0) return;

        // Make decisions when not busy or inventory full
        if (!player.isBusy()) {
            this.makeDecision();
            this.resetDecisionCooldown();
        } else if (inventory.isFull() && !player.isMoving()) {
            this.makeDecision();
            this.resetDecisionCooldown();
        }
    }

    makeDecision() {
        console.log('AI making decision...', {
            isBusy: player.isBusy(),
            inventoryFull: inventory.isFull(),
            currentGoal: this.currentGoal?.type,
            currentNode: player.currentNode,
            plannedActivity: this.plannedActivity
        });
        
        // If inventory is full, go to bank
        if (inventory.isFull()) {
            if (this.isMovingToBank()) {
                console.log('Already moving to bank');
                return;
            }
            this.goToBank();
            return;
        }

        // Check current goal
        if (!this.currentGoal || this.isGoalComplete(this.currentGoal)) {
            this.selectNewGoal();
        }

        if (!this.currentGoal) {
            console.log('No goals available');
            return;
        }

        console.log('Executing goal:', this.currentGoal);
        this.executeGoal(this.currentGoal);
    }

    executeGoal(goal) {
        // Delegate to skill-specific logic
        if (goal.skill) {
            const skill = skillRegistry.getSkill(goal.skill);
            if (skill) {
                skill.executeGoal(goal, this);
                return;
            }
        }
        
        // Handle item goals that might be from a skill
        if (goal.type === 'bank_items') {
            // Check if any skill handles this item
            for (const skill of skillRegistry.getAllSkills()) {
                if (skill.executeGoal) {
                    // Let skill check if it handles this item
                    const handled = skill.executeGoal(goal, this);
                    if (handled !== undefined) return;
                }
            }
        }
        
        // Fallback for non-skill goals
        switch (goal.type) {
            case 'complete_quest':
                this.doQuest(goal.questId);
                break;
            default:
                console.log('Unknown goal type:', goal.type);
        }
    }

    // ==================== ACTIVITY MANAGEMENT ====================

    doActivity(activityId) {
        this.plannedActivity = activityId;
        
        // Check if we have required items
        if (!player.hasRequiredItems(activityId)) {
            if (this.hasAccessToRequiredItems(activityId)) {
                console.log(`Missing required items for ${activityId}, going to bank`);
                this.goToBankForItems(activityId);
                return;
            } else {
                console.log(`Cannot perform ${activityId} - required items not available`);
                this.resetPlannedActivity();
                return;
            }
        }
        
        // Check if we're at a node with this activity
        const currentNode = nodes.getNode(player.currentNode);
        if (currentNode && currentNode.activities?.includes(activityId)) {
            const nodePos = currentNode.position;
            const dist = distance(player.position.x, player.position.y, nodePos.x, nodePos.y);
            
            if (dist <= 1.5) {
                console.log(`Starting activity ${activityId}`);
                player.startActivity(activityId);
                return;
            } else {
                console.log(`Need to move to node position`);
                player.currentNode = null;
            }
        }

        // Find nearest reachable node with this activity
        const targetNode = this.findReachableNodeWithActivity(activityId);
        if (!targetNode) {
            console.log(`No reachable node found for activity ${activityId}`);
            this.resetPlannedActivity();
            return;
        }

        console.log(`Moving to node ${targetNode.id} for activity ${activityId}`);
        player.moveTo(targetNode.id);
    }

    doQuest(questId) {
        console.log(`Quest system not yet implemented: ${questId}`);
    }

    // ==================== BANKING OPERATIONS ====================

    goToBank() {
        const currentNode = nodes.getNode(player.currentNode);
        if (currentNode && currentNode.type === 'bank') {
            this.performBanking();
            return;
        }

        const nearestBank = nodes.getNearestBank(player.position);
        if (!nearestBank) {
            console.log('No reachable bank found!');
            return;
        }

        if (player.targetNode === nearestBank.id && player.isMoving()) {
            console.log(`Already moving to ${nearestBank.name}`);
            return;
        }

        console.log(`Moving to ${nearestBank.name}`);
        player.moveTo(nearestBank.id);
    }

    goToBankForItems(activityId) {
        const targetNode = this.findReachableNodeWithActivity(activityId);
        if (!targetNode) {
            console.log(`No node found for activity ${activityId}`);
            this.resetPlannedActivity();
            return;
        }

        const nearestBank = nodes.getNearestBank(targetNode.position);
        if (!nearestBank) {
            console.log('No reachable bank found!');
            this.resetPlannedActivity();
            return;
        }

        const currentNode = nodes.getNode(player.currentNode);
        if (currentNode && currentNode.type === 'bank') {
            this.handleBankingForActivity(activityId);
            return;
        }

        console.log(`Moving to ${nearestBank.name} to get items for ${activityId}`);
        player.moveTo(nearestBank.id);
    }

    performBanking() {
        // Check if current goal has skill-specific banking
        if (this.currentGoal && this.currentGoal.skill) {
            const skill = skillRegistry.getSkill(this.currentGoal.skill);
            if (skill && skill.handleBanking) {
                skill.handleBanking(this, this.currentGoal);
                return;
            }
        }
        
        // Default banking behavior
        const deposited = bank.depositAll();
        console.log(`Deposited ${deposited} items`);
        ui.updateSkillsList();
        
        // Check if goal is complete after banking
        if (this.currentGoal && this.isGoalComplete(this.currentGoal)) {
            this.completeCurrentGoal();
        } else {
            this.clearCooldown();
            if (this.currentGoal) {
                console.log('Continuing goal after banking:', this.currentGoal);
                this.executeGoal(this.currentGoal);
            }
        }
    }

    handleBankingForActivity(activityId) {
        const deposited = bank.depositAll();
        console.log(`Deposited ${deposited} items`);
        
        if (!this.withdrawItemsForActivity(activityId)) {
            this.resetPlannedActivity();
            return;
        }
        
        ui.updateSkillsList();
        this.clearCooldown();
        
        if (this.plannedActivity) {
            console.log(`Continuing with planned activity: ${this.plannedActivity}`);
            this.executeGoal(this.currentGoal);
        }
    }

    withdrawItemsForActivity(activityId) {
        const requiredItems = player.getRequiredItems(activityId);
        
        if (requiredItems.length === 0) {
            return true;
        }
        
        console.log(`Withdrawing required items for ${activityId}:`, requiredItems);
        
        for (const required of requiredItems) {
            const itemData = loadingManager.getData('items')[required.itemId];
            const bankCount = bank.getItemCount(required.itemId);
            
            if (bankCount === 0) {
                console.log(`No ${required.itemId} in bank`);
                return false;
            }
            
            let withdrawAmount = itemData.stackable ? bankCount : Math.min(14, bankCount);
            
            const withdrawn = bank.withdrawUpTo(required.itemId, withdrawAmount);
            if (withdrawn > 0) {
                inventory.addItem(required.itemId, withdrawn);
                console.log(`Withdrew ${withdrawn} ${itemData.name}`);
            }
        }
        
        return true;
    }

    // ==================== NAVIGATION & MOVEMENT ====================

    findReachableNodeWithActivity(activityId) {
        const nodesWithActivity = Object.values(nodes.getAllNodes()).filter(
            node => node.activities && node.activities.includes(activityId) && !this.failedNodes.has(node.id)
        );

        nodesWithActivity.sort((a, b) => {
            const distA = distance(player.position.x, player.position.y, a.position.x, a.position.y);
            const distB = distance(player.position.x, player.position.y, b.position.x, b.position.y);
            return distA - distB;
        });

        for (const node of nodesWithActivity) {
            if (window.pathfinding) {
                const path = pathfinding.findPath(
                    player.position.x,
                    player.position.y,
                    node.position.x,
                    node.position.y
                );
                if (path) {
                    return node;
                } else {
                    console.warn(`Node ${node.id} is not reachable`);
                    this.failedNodes.add(node.id);
                }
            } else {
                return node;
            }
        }

        return null;
    }

    // ==================== HELPER METHODS ====================

    hasAccessToRequiredItems(activityId) {
        const requiredItems = player.getRequiredItems(activityId);
        
        for (const required of requiredItems) {
            const inInventory = inventory.getItemCount(required.itemId);
            const inBank = bank.getItemCount(required.itemId);
            
            if (inInventory + inBank === 0) {
                console.log(`No access to required item ${required.itemId}`);
                return false;
            }
        }
        
        return true;
    }

    isMovingToBank() {
        if (!player.isMoving() || !player.targetNode) return false;
        
        const targetNode = nodes.getNode(player.targetNode);
        return targetNode && targetNode.type === 'bank';
    }

    completeCurrentGoal() {
        console.log('Goal complete:', this.currentGoal);
        this.currentGoal = null;
        this.resetPlannedActivity();
        this.selectNewGoal();
        this.clearCooldown();
    }

    skipCurrentGoal(reason) {
        console.log(`Skipping ${reason}`);
        this.currentGoal = null;
        this.resetPlannedActivity();
        this.decisionCooldown = 100;
        this.selectNewGoal();
    }

    markGoalUnachievable(goal) {
        if (!goal) return;
        
        const goalKey = this.getGoalKey(goal);
        this.unachievableGoals.set(goalKey, Date.now());
        console.log(`Marked goal as temporarily unachievable: ${goalKey}`);
    }

    resetPlannedActivity() {
        if (this.plannedActivity) {
            console.log(`Clearing planned activity: ${this.plannedActivity}`);
        }
        this.plannedActivity = null;
    }

    resetDecisionCooldown() {
        this.decisionCooldown = 1000;
    }

    clearCooldown() {
        this.decisionCooldown = 0;
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
