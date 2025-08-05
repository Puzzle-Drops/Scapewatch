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

        // Filter to only reachable activities
        const reachableActivities = [];
        for (const [activityId, activityData] of skillActivities) {
            const reachableNode = this.findReachableNodeWithActivity(activityId);
            if (reachableNode) {
                reachableActivities.push([activityId, activityData]);
            }
        }
        
        if (reachableActivities.length === 0) {
            console.log(`No reachable activities found for ${skillId}`);
            return;
        }
        
        // Let skillBehaviors choose the best activity (with randomness)
        const chosenActivity = skillBehaviors.chooseBestActivity(
            skillId, 
            reachableActivities, 
            skills.getLevel(skillId)
        );
        
        if (chosenActivity) {
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
            // Woodcutting items
            { itemId: 'logs', count: 50, minLevel: 1, skill: 'woodcutting' },
            { itemId: 'oak_logs', count: 100, minLevel: 15, skill: 'woodcutting' },
            { itemId: 'willow_logs', count: 200, minLevel: 30, skill: 'woodcutting' },
            { itemId: 'teak_logs', count: 300, minLevel: 35, skill: 'woodcutting' },
            { itemId: 'maple_logs', count: 300, minLevel: 45, skill: 'woodcutting' },
            { itemId: 'mahogany_logs', count: 300, minLevel: 50, skill: 'woodcutting' },
            { itemId: 'yew_logs', count: 300, minLevel: 60, skill: 'woodcutting' },
            { itemId: 'magic_logs', count: 300, minLevel: 75, skill: 'woodcutting' },
            { itemId: 'redwood_logs', count: 300, minLevel: 90, skill: 'woodcutting' },
            
            // Mining items
            { itemId: 'copper_ore', count: 50, minLevel: 1, skill: 'mining' },
            { itemId: 'tin_ore', count: 50, minLevel: 1, skill: 'mining' },
            { itemId: 'iron_ore', count: 100, minLevel: 15, skill: 'mining' },
            { itemId: 'silver_ore', count: 200, minLevel: 20, skill: 'mining' },
            { itemId: 'coal', count: 300, minLevel: 30, skill: 'mining' },
            { itemId: 'gold_ore', count: 300, minLevel: 40, skill: 'mining' },
            { itemId: 'mithril_ore', count: 300, minLevel: 55, skill: 'mining' },
            { itemId: 'adamantite_ore', count: 300, minLevel: 70, skill: 'mining' },
            { itemId: 'runite_ore', count: 300, minLevel: 85, skill: 'mining' },
            { itemId: 'amethyst', count: 300, minLevel: 92, skill: 'mining' },
            
            // Fishing items
            { itemId: 'raw_shrimps', count: 50, minLevel: 1, skill: 'fishing' },
            { itemId: 'raw_sardine', count: 100, minLevel: 5, skill: 'fishing' },
            { itemId: 'raw_herring', count: 100, minLevel: 10, skill: 'fishing' },
            { itemId: 'raw_anchovies', count: 100, minLevel: 15, skill: 'fishing' },
            { itemId: 'raw_mackerel', count: 100, minLevel: 16, skill: 'fishing' },
            { itemId: 'raw_trout', count: 200, minLevel: 20, skill: 'fishing' },
            { itemId: 'raw_cod', count: 200, minLevel: 23, skill: 'fishing' },
            { itemId: 'raw_pike', count: 200, minLevel: 25, skill: 'fishing' },
            { itemId: 'raw_salmon', count: 250, minLevel: 30, skill: 'fishing' },
            { itemId: 'raw_tuna', count: 250, minLevel: 35, skill: 'fishing' },
            { itemId: 'raw_lobster', count: 300, minLevel: 40, skill: 'fishing' },
            { itemId: 'raw_bass', count: 300, minLevel: 46, skill: 'fishing' },
            { itemId: 'raw_swordfish', count: 300, minLevel: 50, skill: 'fishing' },
            { itemId: 'raw_shark', count: 300, minLevel: 76, skill: 'fishing' }
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
