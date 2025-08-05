class AIManager {
    constructor() {
        this.currentGoal = null;
        this.goals = [];
        this.decisionCooldown = 0;
        this.failedNodes = new Set(); // Track nodes we couldn't reach
        this.plannedActivity = null; // Track what activity we plan to do
        this.initializeGoals();
    }

    initializeGoals() {
        // Set up initial goals

        this.addGoal({
            type: 'skill_level',
            skill: 'woodcutting',
            targetLevel: 5,
            priority: 1
        });
        this.addGoal({
            type: 'skill_level',
            skill: 'fishing',
            targetLevel: 5,
            priority: 2
        });
        this.addGoal({
            type: 'skill_level',
            skill: 'mining',
            targetLevel: 5,
            priority: 3
        });


        
        /*

        this.addGoal({
            type: 'bank_items',
            itemId: 'raw_shrimps',
            targetCount: 28,
            priority: 1
        });

        this.addGoal({
            type: 'bank_items',
            itemId: 'logs',
            targetCount: 10,
            priority: 2
        });
        
        this.addGoal({
            type: 'bank_items',
            itemId: 'tin_ore',
            targetCount: 20,
            priority: 3
        });

        this.addGoal({
            type: 'bank_items',
            itemId: 'copper_ore',
            targetCount: 20,
            priority: 4
        });

        this.addGoal({
            type: 'skill_level',
            skill: 'woodcutting',
            targetLevel: 15,
            priority: 5
        });

        this.addGoal({
            type: 'bank_items',
            itemId: 'oak_logs',
            targetCount: 50,
            priority: 6
        });

        this.addGoal({
            type: 'skill_level',
            skill: 'mining',
            targetLevel: 15,
            priority: 7
        });
        */
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

    update(deltaTime) {
        // Cooldown to prevent too frequent decisions
        this.decisionCooldown -= deltaTime;
        
        // Always check if current goal is complete
        if (this.currentGoal && this.isGoalComplete(this.currentGoal)) {
            console.log('Goal complete during update:', this.currentGoal);
            this.currentGoal = null;
            this.plannedActivity = null; // Clear planned activity when goal completes
            this.selectNewGoal();
            this.decisionCooldown = 0; // Reset cooldown to make immediate decision
        }

        // Only make decisions if cooldown has expired
        if (this.decisionCooldown > 0) return;

        // Check if we need to make a decision
        if (!player.isBusy() || inventory.isFull()) {
            this.makeDecision();
            this.decisionCooldown = 1000; // 1 second cooldown
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
        // This ensures we don't get stuck after banking or reaching a location
        console.log('Executing goal:', this.currentGoal);
        this.executeGoal(this.currentGoal);
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

    // Check if we have access to required items (in inventory or bank)
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

    trainSkill(skillId) {
        // Find best activity for training this skill
        const activities = loadingManager.getData('activities');
        const skillActivities = Object.entries(activities)
            .filter(([id, data]) => data.skill === skillId && skills.canPerformActivity(id));

        if (skillActivities.length === 0) {
            console.log(`No available activities for ${skillId}`);
            return;
        }

        // Filter to only reachable activities that we have items for (or no items needed)
        const viableActivities = [];
        const activitiesNeedingItems = [];
        
        for (const [activityId, activityData] of skillActivities) {
            const reachableNode = this.findReachableNodeWithActivity(activityId);
            if (!reachableNode) continue;
            
            // Check if we have access to required items
            if (this.hasAccessToRequiredItems(activityId)) {
                viableActivities.push([activityId, activityData]);
            } else {
                activitiesNeedingItems.push([activityId, activityData]);
            }
        }
        
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
            // Bank what we have first
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

        // Filter to activities we have items for (or no items needed)
        const viableActivities = [];
        const activitiesNeedingItems = [];
        
        for (const [activityId, activityData] of itemActivities) {
            const reachableNode = this.findReachableNodeWithActivity(activityId);
            if (!reachableNode) continue;
            
            // Check if we have access to required items
            if (this.hasAccessToRequiredItems(activityId)) {
                viableActivities.push(activityId);
            } else {
                activitiesNeedingItems.push(activityId);
            }
        }
        
        console.log(`Found ${viableActivities.length} viable activities and ${activitiesNeedingItems.length} requiring unavailable items for ${itemId}`);
        
        if (viableActivities.length === 0) {
            if (activitiesNeedingItems.length > 0) {
                console.log(`All activities for ${itemId} require items we don't have. Cannot gather this item.`);
            } else {
                console.log(`No reachable activities found for item ${itemId}`);
            }
            
            // Mark this goal as unachievable for now and move to next goal
            console.log(`Skipping goal to gather ${itemId} as it's currently unachievable`);
            this.currentGoal = null;
            this.plannedActivity = null;
            this.selectNewGoal();
            return;
        }

        // Choose the first viable activity
        const selectedActivity = viableActivities[0];
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
                this.plannedActivity = null;
                
                // Try to find alternative activity for the same skill
                const activityData = loadingManager.getData('activities')[activityId];
                if (activityData && activityData.skill) {
                    console.log(`Looking for alternative ${activityData.skill} activities...`);
                    this.trainSkill(activityData.skill);
                }
                return;
            }
        }
        
        // Check if we're at a node with this activity
        const currentNode = nodes.getNode(player.currentNode);
        console.log(`Trying to do activity ${activityId} at node ${player.currentNode}`);
        console.log(`Current node activities:`, currentNode?.activities);
        
        if (currentNode && currentNode.activities?.includes(activityId)) {
            console.log(`Starting activity ${activityId}`);
            player.startActivity(activityId);
            return;
        }

        // Find nearest reachable node with this activity
        const targetNode = this.findReachableNodeWithActivity(activityId);
        if (!targetNode) {
            console.log(`No reachable node found for activity ${activityId}`);
            this.plannedActivity = null;
            return;
        }

        console.log(`Moving to node ${targetNode.id} for activity ${activityId}`);
        // Move to the node
        player.moveTo(targetNode.id);
    }

    goToBankForItems(activityId) {
        // Find the node where we'll do the activity
        const targetNode = this.findReachableNodeWithActivity(activityId);
        if (!targetNode) {
            console.log(`No node found for activity ${activityId}`);
            this.plannedActivity = null;
            return;
        }

        // Find nearest bank to the activity location
        const nearestBank = nodes.getNearestBank(targetNode.position);
        if (!nearestBank) {
            console.log('No reachable bank found!');
            this.plannedActivity = null;
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

    handleBankingForActivity(activityId) {
        // Deposit all first
        const deposited = bank.depositAll();
        console.log(`Deposited ${deposited} items`);
        
        // Get required items for the activity
        const requiredItems = player.getRequiredItems(activityId);
        
        if (requiredItems.length > 0) {
            console.log(`Withdrawing required items for ${activityId}:`, requiredItems);
            
            let missingItems = false;
            
            for (const required of requiredItems) {
                const itemData = loadingManager.getData('items')[required.itemId];
                const bankCount = bank.getItemCount(required.itemId);
                
                if (bankCount === 0) {
                    console.log(`No ${required.itemId} in bank, cannot perform activity`);
                    missingItems = true;
                    break;
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
            
            if (missingItems) {
                // Cannot do this activity, try alternatives
                this.plannedActivity = null;
                const activityData = loadingManager.getData('activities')[activityId];
                if (activityData && activityData.skill) {
                    console.log(`Cannot get required items for ${activityId}, looking for alternatives...`);
                    this.trainSkill(activityData.skill);
                }
                return;
            }
        }
        
        // Update UI
        ui.updateSkillsList();
        
        // Reset decision cooldown and continue with activity
        this.decisionCooldown = 0;
        
        // Now try to do the activity again
        if (this.plannedActivity) {
            console.log(`Continuing with planned activity: ${this.plannedActivity}`);
            this.executeGoal(this.currentGoal);
        }
    }

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

    goToBank() {
        // If already at bank, deposit all
        const currentNode = nodes.getNode(player.currentNode);
        if (currentNode && currentNode.type === 'bank') {
            const deposited = bank.depositAll();
            console.log(`Deposited ${deposited} items`);
            ui.updateSkillsList(); // Update UI after banking
            
            // If we have a planned activity, withdraw required items for it
            if (this.plannedActivity && this.hasAccessToRequiredItems(this.plannedActivity)) {
                const requiredItems = player.getRequiredItems(this.plannedActivity);
                
                if (requiredItems.length > 0) {
                    console.log(`Re-withdrawing required items for ${this.plannedActivity}:`, requiredItems);
                    
                    for (const required of requiredItems) {
                        const itemData = loadingManager.getData('items')[required.itemId];
                        const bankCount = bank.getItemCount(required.itemId);
                        
                        if (bankCount > 0) {
                            let withdrawAmount;
                            if (itemData.stackable) {
                                // Withdraw all for stackable items
                                withdrawAmount = bankCount;
                            } else {
                                // Withdraw 14 for non-stackable
                                withdrawAmount = Math.min(14, bankCount);
                            }
                            
                            const withdrawn = bank.withdrawUpTo(required.itemId, withdrawAmount);
                            if (withdrawn > 0) {
                                inventory.addItem(required.itemId, withdrawn);
                                console.log(`Re-withdrew ${withdrawn} ${itemData.name}`);
                            }
                        }
                    }
                }
            }
            
            // Check if current goal is complete after banking
            if (this.currentGoal && this.isGoalComplete(this.currentGoal)) {
                console.log('Goal complete after banking:', this.currentGoal);
                this.currentGoal = null;
                this.plannedActivity = null;
                // Select new goal immediately
                this.selectNewGoal();
            }
            
            // Reset decision cooldown and make a new decision immediately
            this.decisionCooldown = 0;
            
            // Execute current goal (whether it's new or continuing)
            if (this.currentGoal) {
                console.log('Continuing/starting goal after banking:', this.currentGoal);
                this.executeGoal(this.currentGoal);
            }
            
            return;
        }

        // Find nearest reachable bank
        const nearestBank = nodes.getNearestBank(player.position);
        if (!nearestBank) {
            console.log('No reachable bank found!');
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
