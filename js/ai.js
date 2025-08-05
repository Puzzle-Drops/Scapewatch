class AIManager {
    constructor() {
        this.currentGoal = null;
        this.goals = [];
        this.decisionCooldown = 0;
        this.failedNodes = new Set(); // Track nodes we couldn't reach
        this.initializeGoals();
    }

    initializeGoals() {
        // Set up initial goals

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
            currentNode: player.currentNode
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

    trainSkill(skillId) {
        // Find best activity for training this skill
        const activities = loadingManager.getData('activities');
        const skillActivities = Object.entries(activities)
            .filter(([id, data]) => data.skill === skillId && skills.canPerformActivity(id));

        if (skillActivities.length === 0) {
            console.log(`No available activities for ${skillId}`);
            return;
        }

        // Calculate effective XP/action based on skill-specific mechanics
        let bestActivity = null;
        let bestEffectiveXp = 0;

        for (const [activityId, activityData] of skillActivities) {
            // Check if we can reach a node with this activity
            const reachableNode = this.findReachableNodeWithActivity(activityId);
            if (!reachableNode) continue;

            let effectiveXp;
            
            // Get skill-specific behavior
            const behavior = skillBehaviors.getBehavior(skillId);
            
            // For skills that only grant XP on success (woodcutting, mining)
            if (skillId === 'woodcutting' || skillId === 'mining') {
                // Estimate success rate based on rewards
                let successChance = 1.0;
                
                if (activityData.rewards && activityData.rewards.length > 0) {
                    const mainReward = activityData.rewards[0];
                    successChance = mainReward.chanceScaling ? 
                        skillBehaviors.getScaledChance(mainReward, skills.getLevel(skillId)) :
                        (mainReward.chance || 1.0);
                }
                
                effectiveXp = activityData.xpPerAction * successChance;
            } else {
                // For other activities, use base XP
                effectiveXp = activityData.xpPerAction;
            }

            if (effectiveXp > bestEffectiveXp) {
                bestEffectiveXp = effectiveXp;
                bestActivity = activityId;
            }
        }

        if (bestActivity) {
            this.doActivity(bestActivity);
        } else {
            console.log(`No reachable activities found for ${skillId}`);
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

        // Find an activity we can reach
        let selectedActivity = null;
        for (const [activityId] of itemActivities) {
            if (this.findReachableNodeWithActivity(activityId)) {
                selectedActivity = activityId;
                break;
            }
        }

        if (selectedActivity) {
            console.log(`Selected activity: ${selectedActivity}`);
            this.doActivity(selectedActivity);
        } else {
            console.log(`No reachable activities found for item ${itemId}`);
        }
    }

    doActivity(activityId) {
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
            return;
        }

        console.log(`Moving to node ${targetNode.id} for activity ${activityId}`);
        // Move to the node
        player.moveTo(targetNode.id);
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
            
            // Check if current goal is complete after banking
            if (this.currentGoal && this.isGoalComplete(this.currentGoal)) {
                console.log('Goal complete after banking:', this.currentGoal);
                this.currentGoal = null;
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
        const totalLevel = skills.getTotalLevel();
        const baseGoalCount = this.goals.length;

        // Generate skill goals for each skill, progressively
        const skillIds = ['woodcutting', 'mining', 'fishing', 'attack'];
        
        for (const skillId of skillIds) {
            const currentLevel = skills.getLevel(skillId);
            
            // Add a goal 10 levels higher than current
            if (currentLevel < 90) {
                this.addGoal({
                    type: 'skill_level',
                    skill: skillId,
                    targetLevel: Math.min(currentLevel + 10, 99),
                    priority: baseGoalCount + this.goals.length + 1
                });
            }
        }

        // Add some item banking goals based on what we can gather
        const itemGoals = [
            { itemId: 'oak_logs', count: 250, minLevel: 15, skill: 'woodcutting' },
            { itemId: 'willow_logs', count: 500, minLevel: 30, skill: 'woodcutting' },
            { itemId: 'iron_ore', count: 300, minLevel: 15, skill: 'mining' },
            { itemId: 'raw_shrimps', count: 200, minLevel: 1, skill: 'fishing' }
        ];

        for (const itemGoal of itemGoals) {
            if (skills.getLevel(itemGoal.skill) >= itemGoal.minLevel) {
                this.addGoal({
                    type: 'bank_items',
                    itemId: itemGoal.itemId,
                    targetCount: itemGoal.count,
                    priority: baseGoalCount + this.goals.length + 1
                });
            }
        }

        console.log(`Generated ${this.goals.length - baseGoalCount} new goals`);
        
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
