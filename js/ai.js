class AIManager {
    constructor() {
        this.currentGoal = null;
        this.goals = [];
        this.decisionCooldown = 0;
        this.failedNodes = new Set(); // Track nodes we couldn't reach
        this.plannedActivity = null; // Track what activity we plan to do
        this.initializeGoals();
    }

    // ==================== INITIALIZATION & GOAL MANAGEMENT ====================

    initializeGoals() {
        // Set up initial goals
        this.addGoal({
            type: 'skill_level',
            skill: 'mining',
            targetLevel: 5,
            priority: 1
        });
        this.addGoal({
            type: 'skill_level',
            skill: 'woodcutting',
            targetLevel: 5,
            priority: 2
        });
        this.addGoal({
            type: 'skill_level',
            skill: 'fishing',
            targetLevel: 5,
            priority: 3
        });
        this.addGoal({
            type: 'skill_level',
            skill: 'attack',
            targetLevel: 5,
            priority: 4
        });
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
        // Find first incomplete goal
        for (const goal of this.goals) {
            if (!this.isGoalComplete(goal)) {
                this.currentGoal = goal;
                
                // Update starting values when goal is selected
                if (goal.type === 'skill_level') {
                    goal.startingLevel = skills.getLevel(goal.skill);
                    goal.startingXp = skills.getXp(goal.skill);
                } else if (goal.type === 'bank_items') {
                    goal.startingCount = bank.getItemCount(goal.itemId);
                }
                
                console.log('New goal selected:', goal);
                // Update UI immediately when new goal is selected
                if (window.ui) {
                    window.ui.forceGoalUpdate();
                }
                return;
            }
        }

        // All goals complete - add new ones
        console.log('All goals complete, generating new goals');
        this.generateNewGoals();
        this.selectNewGoal(); // Try selecting again after generating new goals
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

    generateNewGoals() {
        // Generate new goals based on current progress
        const baseGoalCount = this.goals.length;
        
        // Get current skill levels
        const currentSkillLevels = {};
        const allSkills = skills.getAllSkills();
        for (const [skillId, skillData] of Object.entries(allSkills)) {
            currentSkillLevels[skillId] = skillData.level;
        }
        
        // Generate skill training goals
        const skillGoals = skillBehaviors.generateSkillGoals(currentSkillLevels, baseGoalCount);
        for (const goal of skillGoals) {
            this.addGoal(goal);
        }
        
        // Generate item banking goals based on activities and current levels
        const itemGoals = skillBehaviors.generateItemGoals(currentSkillLevels, this.goals.length);
        for (const goal of itemGoals) {
            this.addGoal(goal);
        }
        
        console.log(`Generated ${this.goals.length - baseGoalCount} new goals (${skillGoals.length} skill, ${itemGoals.length} item)`);
        
        // Notify UI
        if (window.ui) {
            window.ui.forceGoalUpdate();
        }
    }

    // ==================== DECISION MAKING & EXECUTION ====================

    update(deltaTime) {
        // Cooldown to prevent too frequent decisions
        this.decisionCooldown -= deltaTime;
        
        // Always check if current goal is complete
        if (this.currentGoal && this.isGoalComplete(this.currentGoal)) {
            this.completeCurrentGoal();
        }

        // Only make decisions if cooldown has expired
        if (this.decisionCooldown > 0) return;

        // Check if we need to make a decision
        // Only make decisions if not busy, OR if inventory is full and we're not already handling it
        if (!player.isBusy()) {
            this.makeDecision();
            this.resetDecisionCooldown();
        } else if (inventory.isFull() && !player.isMoving()) {
            // Only make decision about full inventory if we're not already moving
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
        
        // If inventory is full, go to bank (but check if we're already going there)
        if (inventory.isFull()) {
            if (this.isMovingToBank()) {
                console.log('Already moving to bank, no need to re-path');
                return;
            }
            this.goToBank();
            return;
        }

        // Check current goal - if none or complete, select new one
        if (!this.currentGoal || this.isGoalComplete(this.currentGoal)) {
            this.selectNewGoal();
        }

        if (!this.currentGoal) {
            console.log('No goals available');
            return;
        }

        // Always try to execute the current goal when making a decision
        console.log('Executing goal:', this.currentGoal);
        this.executeGoal(this.currentGoal);
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

    // ==================== ACTIVITY MANAGEMENT ====================

    trainSkill(skillId) {
        // Find best activity for training this skill
        const activities = loadingManager.getData('activities');
        const skillActivities = Object.entries(activities)
            .filter(([id, data]) => data.skill === skillId && skills.canPerformActivity(id));

        if (skillActivities.length === 0) {
            console.log(`No available activities for ${skillId}`);
            this.skipCurrentGoal(`${skillId} goal as impossible`);
            return;
        }

        // Filter to only reachable activities that we have items for
        const { viableActivities, activitiesNeedingItems } = this.categorizeActivities(skillActivities);
        
        console.log(`Found ${viableActivities.length} viable activities and ${activitiesNeedingItems.length} requiring unavailable items for ${skillId}`);
        
        if (viableActivities.length === 0) {
            if (activitiesNeedingItems.length > 0) {
                console.log(`All ${skillId} activities require items we don't have. Skipping skill training.`);
            } else {
                console.log(`No reachable activities found for ${skillId}`);
            }
            return;
        }
        
        // Let skillBehaviors choose the best activity from viable ones
        const chosenActivity = skillBehaviors.chooseBestActivity(
            skillId, 
            viableActivities, 
            skills.getLevel(skillId)
        );
        
        if (chosenActivity) {
            console.log(`Chosen activity for ${skillId}: ${chosenActivity}`);
            this.doActivity(chosenActivity);
        }
    }

    gatherItems(itemId) {
        console.log(`Gathering items: ${itemId}`);
        
        // Check if we already have enough in bank
        if (bank.getItemCount(itemId) >= this.currentGoal.targetCount) {
            console.log(`Already have enough ${itemId} in bank`);
            return;
        }

        // If we have items in inventory but not enough total, bank first
        const inventoryCount = inventory.getItemCount(itemId);
        const bankCount = bank.getItemCount(itemId);
        const totalCount = inventoryCount + bankCount;
        
        if (inventoryCount > 0 && totalCount < this.currentGoal.targetCount) {
            console.log(`Banking ${inventoryCount} ${itemId} first`);
            this.goToBank();
            return;
        }

        // Find activities that give this item
        const activities = loadingManager.getData('activities');
        const itemActivities = Object.entries(activities)
            .filter(([id, data]) => {
                if (!skills.canPerformActivity(id)) return false;
                return data.rewards?.some(r => r.itemId === itemId);
            });

        console.log(`Found ${itemActivities.length} activities for ${itemId}`);
        
        if (itemActivities.length === 0) {
            console.log(`No activities found for item ${itemId}`);
            return;
        }

        // Filter to activities we have items for
        const { viableActivities, activitiesNeedingItems } = this.categorizeActivities(itemActivities);
        
        console.log(`Found ${viableActivities.length} viable activities and ${activitiesNeedingItems.length} requiring unavailable items for ${itemId}`);
        
        if (viableActivities.length === 0) {
            if (activitiesNeedingItems.length > 0) {
                console.log(`All activities for ${itemId} require items we don't have. Cannot gather this item.`);
            } else {
                console.log(`No reachable activities found for item ${itemId}`);
            }
            
            this.skipCurrentGoal(`goal to gather ${itemId} as it's currently unachievable`);
            return;
        }

        // Choose the first viable activity
        const selectedActivity = viableActivities[0][0];
        console.log(`Selected activity: ${selectedActivity}`);
        this.doActivity(selectedActivity);
    }

    doActivity(activityId) {
        // Store the planned activity
        this.plannedActivity = activityId;
        
        // Check if we have required items in inventory
        if (!player.hasRequiredItems(activityId)) {
            // Check if we have them in bank
            if (this.hasAccessToRequiredItems(activityId)) {
                console.log(`Missing required items for ${activityId} in inventory, going to bank`);
                this.goToBankForItems(activityId);
                return;
            } else {
                console.log(`Cannot perform ${activityId} - required items not available`);
                this.resetPlannedActivity();
                this.findAlternativeActivity(activityId);
                return;
            }
        }
        
        // Check if we're at a node with this activity
const currentNode = nodes.getNode(player.currentNode);
console.log(`Trying to do activity ${activityId} at node ${player.currentNode}`);
console.log(`Current node activities:`, currentNode?.activities);

if (currentNode && currentNode.activities?.includes(activityId)) {
    // Double-check we're actually at this node position (prevents stale currentNode issues)
    const nodePos = currentNode.position;
    const dist = distance(player.position.x, player.position.y, nodePos.x, nodePos.y);
    
    if (dist <= 1.5) {  // Within reasonable distance
        console.log(`Starting activity ${activityId}`);
        player.startActivity(activityId);
        return;
    } else {
        console.log(`CurrentNode says ${player.currentNode} but we're ${dist} pixels away, need to move there`);
        player.currentNode = null;  // Clear stale node
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
        // TODO: Implement quest system
        console.log(`Quest system not yet implemented: ${questId}`);
    }

    // ==================== BANKING OPERATIONS ====================

    goToBank() {
        // If already at bank, deposit all
        const currentNode = nodes.getNode(player.currentNode);
        if (currentNode && currentNode.type === 'bank') {
            this.performBanking();
            return;
        }

        // Find nearest reachable bank
        const nearestBank = nodes.getNearestBank(player.position);
        if (!nearestBank) {
            console.log('No reachable bank found!');
            return;
        }

        // Check if we're already moving to this bank
        if (player.targetNode === nearestBank.id && player.isMoving()) {
            console.log(`Already moving to ${nearestBank.name}, not re-pathing`);
            return;
        }

        // Move to bank
        console.log(`Moving to ${nearestBank.name}`);
        player.moveTo(nearestBank.id);
    }

    goToBankForItems(activityId) {
        // Find the node where we'll do the activity
        const targetNode = this.findReachableNodeWithActivity(activityId);
        if (!targetNode) {
            console.log(`No node found for activity ${activityId}`);
            this.resetPlannedActivity();
            return;
        }

        // Find nearest bank to the activity location
        const nearestBank = nodes.getNearestBank(targetNode.position);
        if (!nearestBank) {
            console.log('No reachable bank found!');
            this.resetPlannedActivity();
            return;
        }

        // If already at bank, handle items
        const currentNode = nodes.getNode(player.currentNode);
        if (currentNode && currentNode.type === 'bank') {
            this.handleBankingForActivity(activityId);
            return;
        }

        // Move to bank
        console.log(`Moving to ${nearestBank.name} to get items for ${activityId}`);
        player.moveTo(nearestBank.id);
    }

    performBanking() {
        const deposited = bank.depositAll();
        console.log(`Deposited ${deposited} items`);
        ui.updateSkillsList(); // Update UI after banking
        
        // If we have a planned activity, withdraw required items for it
        if (this.plannedActivity && this.hasAccessToRequiredItems(this.plannedActivity)) {
            this.withdrawItemsForActivity(this.plannedActivity);
        }
        
        // Check if current goal is complete after banking
        if (this.currentGoal && this.isGoalComplete(this.currentGoal)) {
            this.completeCurrentGoal();
        } else {
            // Reset decision cooldown and continue with current goal
            this.clearCooldown();
            
            if (this.currentGoal) {
                console.log('Continuing/starting goal after banking:', this.currentGoal);
                this.executeGoal(this.currentGoal);
            }
        }
    }

    handleBankingForActivity(activityId) {
        // Deposit all first
        const deposited = bank.depositAll();
        console.log(`Deposited ${deposited} items`);
        
        // Try to withdraw items for the activity
        if (!this.withdrawItemsForActivity(activityId)) {
            // Cannot do this activity, try alternatives
            this.resetPlannedActivity();
            this.findAlternativeActivity(activityId);
            return;
        }
        
        // Update UI
        ui.updateSkillsList();
        
        // Reset decision cooldown and continue with activity
        this.clearCooldown();
        
        // Now try to do the activity again
        if (this.plannedActivity) {
            console.log(`Continuing with planned activity: ${this.plannedActivity}`);
            this.executeGoal(this.currentGoal);
        }
    }

    withdrawItemsForActivity(activityId) {
        const requiredItems = player.getRequiredItems(activityId);
        
        if (requiredItems.length === 0) {
            return true; // No items needed
        }
        
        console.log(`Withdrawing required items for ${activityId}:`, requiredItems);
        
        for (const required of requiredItems) {
            const itemData = loadingManager.getData('items')[required.itemId];
            const bankCount = bank.getItemCount(required.itemId);
            
            if (bankCount === 0) {
                console.log(`No ${required.itemId} in bank, cannot perform activity`);
                return false; // Missing required items
            }
            
            let withdrawAmount;
            if (itemData.stackable) {
                // Withdraw all for stackable items
                withdrawAmount = bankCount;
            } else {
                // Withdraw 14 for non-stackable (half inventory)
                withdrawAmount = Math.min(14, bankCount);
            }
            
            const withdrawn = bank.withdrawUpTo(required.itemId, withdrawAmount);
            if (withdrawn > 0) {
                inventory.addItem(required.itemId, withdrawn);
                console.log(`Withdrew ${withdrawn} ${itemData.name}`);
            }
        }
        
        return true; // Successfully withdrew all items
    }

    // ==================== NAVIGATION & MOVEMENT ====================

    findReachableNodeWithActivity(activityId) {
        // Get all nodes with this activity
        const nodesWithActivity = Object.values(nodes.getAllNodes()).filter(
            node => node.activities && node.activities.includes(activityId) && !this.failedNodes.has(node.id)
        );

        // Sort by distance
        nodesWithActivity.sort((a, b) => {
            const distA = distance(player.position.x, player.position.y, a.position.x, a.position.y);
            const distB = distance(player.position.x, player.position.y, b.position.x, b.position.y);
            return distA - distB;
        });

        // Find first reachable node
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
                    console.warn(`Node ${node.id} is not reachable, marking as failed`);
                    this.failedNodes.add(node.id);
                }
            } else {
                // If pathfinding not available, assume all nodes are reachable
                return node;
            }
        }

        return null;
    }

    // ==================== HELPER METHODS ====================

    // Check if player has access to required items (in inventory or bank)
    hasAccessToRequiredItems(activityId) {
        const requiredItems = player.getRequiredItems(activityId);
        
        for (const required of requiredItems) {
            const inInventory = inventory.getItemCount(required.itemId);
            const inBank = bank.getItemCount(required.itemId);
            
            if (inInventory + inBank === 0) {
                console.log(`No access to required item ${required.itemId} for activity ${activityId}`);
                return false;
            }
        }
        
        return true;
    }

    // Check if activity can be performed (has level and items)
    canPerformActivity(activityId) {
        return skills.canPerformActivity(activityId) && this.hasAccessToRequiredItems(activityId);
    }

    // Categorize activities into viable and those needing items
    categorizeActivities(activities) {
        const viableActivities = [];
        const activitiesNeedingItems = [];
        
        for (const [activityId, activityData] of activities) {
            const reachableNode = this.findReachableNodeWithActivity(activityId);
            if (!reachableNode) continue;
            
            if (this.hasAccessToRequiredItems(activityId)) {
                viableActivities.push([activityId, activityData]);
            } else {
                activitiesNeedingItems.push([activityId, activityData]);
            }
        }
        
        return { viableActivities, activitiesNeedingItems };
    }

    // Check if currently moving to a bank
    isMovingToBank() {
        if (!player.isMoving() || !player.targetNode) return false;
        
        const targetNode = nodes.getNode(player.targetNode);
        return targetNode && targetNode.type === 'bank';
    }

    // Find alternative activity for the same skill
    findAlternativeActivity(activityId) {
        const activityData = loadingManager.getData('activities')[activityId];
        if (activityData && activityData.skill) {
            console.log(`Looking for alternative ${activityData.skill} activities...`);
            this.trainSkill(activityData.skill);
        }
    }

    // Complete the current goal and select a new one
    completeCurrentGoal() {
        console.log('Goal complete:', this.currentGoal);
        this.currentGoal = null;
        this.resetPlannedActivity();
        this.selectNewGoal();
        this.clearCooldown();
    }

    // Skip current goal and move to next
    skipCurrentGoal(reason) {
        console.log(`Marking ${reason} and skipping`);
        this.currentGoal = null;
        this.resetPlannedActivity();
        this.selectNewGoal();
    }

    // Clear planned activity with logging
    resetPlannedActivity() {
        if (this.plannedActivity) {
            console.log(`Clearing planned activity: ${this.plannedActivity}`);
        }
        this.plannedActivity = null;
    }

    // Reset decision cooldown
    resetDecisionCooldown() {
        this.decisionCooldown = 1000; // 1 second cooldown
    }

    // Clear cooldown for immediate decision
    clearCooldown() {
        this.decisionCooldown = 0;
    }

    // Get status text for UI
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
