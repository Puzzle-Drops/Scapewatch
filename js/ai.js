class AIManager {
    constructor() {
        this.currentTask = null;
        this.decisionCooldown = 0;
        this.failedNodes = new Set();
        this.hasBankedForCurrentTask = false; // Track if we've already banked for current task
    }

    // ==================== TASK MANAGEMENT ====================

    selectNextTask() {
        if (!window.taskManager) {
            console.log('Task manager not initialized');
            return;
        }

        // Always work on the current task from task manager
        this.currentTask = taskManager.currentTask;
        
        if (!this.currentTask) {
            console.log('No current task available');
            return;
        }

        // Reset banking flag when selecting a new task
        this.hasBankedForCurrentTask = false;
        console.log('Working on task:', this.currentTask.description);
    }

    // Check if current task is still valid
    isCurrentTaskValid() {
        if (!this.currentTask) return false;
        if (!window.taskManager) return false;
        
        // Check if our task is still the current task in task manager
        return this.currentTask === taskManager.currentTask;
    }

    // ==================== DECISION MAKING & EXECUTION ====================

    update(deltaTime) {
        this.decisionCooldown -= deltaTime;
        
        // Only make decisions if cooldown has expired
        if (this.decisionCooldown > 0) return;

        // Update task progress periodically for sync
        if (window.taskManager) {
            taskManager.updateAllProgress();
        }

        // CRITICAL: If we have no current task but player is moving, stop and re-evaluate
        if (this.currentTask === null && player.isMoving()) {
            console.log('Task lost while moving, stopping to re-evaluate');
            // Stop movement immediately
            player.path = [];
            player.pathIndex = 0;
            player.targetPosition = null;
            player.targetNode = null;
            player.segmentProgress = 0;
            // Make a decision immediately
            this.makeDecision();
            this.resetDecisionCooldown();
            return;
        }

        // Check if current task changed while we were busy
        if (!this.isCurrentTaskValid() && this.currentTask !== null) {
            // Task was invalidated (completed, changed, etc)
            if (player.isMoving()) {
                console.log('Task changed while moving, stopping to re-evaluate');
                // Stop movement
                player.path = [];
                player.pathIndex = 0;
                player.targetPosition = null;
                player.targetNode = null;
                player.segmentProgress = 0;
            }
            if (player.isPerformingActivity()) {
                console.log('Task changed while performing activity, stopping to re-evaluate');
                player.stopActivity();
            }
            this.currentTask = null;
            this.hasBankedForCurrentTask = false; // Reset banking flag
            this.decisionCooldown = 0;
            // Don't return - let it make a new decision immediately
        }

        // Additional check: if we have no task but player is still doing an activity, stop it
        if (this.currentTask === null && player.isPerformingActivity()) {
            console.log('No current task but still performing activity, stopping');
            player.stopActivity();
            this.decisionCooldown = 0;
        }

        // Make decisions when appropriate
        if (!player.isBusy()) {
            this.makeDecision();
            this.resetDecisionCooldown();
        } else if (this.shouldCheckBanking() && !player.isMoving()) {
            this.makeDecision();
            this.resetDecisionCooldown();
        }
    }

    shouldCheckBanking() {
        // Check if inventory is full
        return inventory.isFull();
    }

    makeDecision() {
        console.log('AI making decision...', {
            isBusy: player.isBusy(),
            inventoryFull: inventory.isFull(),
            currentTask: this.currentTask?.description,
            currentNode: player.currentNode,
            hasBankedForTask: this.hasBankedForCurrentTask
        });
        
        // Check if we need banking
        if (this.needsBanking()) {
            if (this.isMovingToBank()) {
                console.log('Already moving to bank');
                return;
            }
            this.goToBank();
            return;
        }

        // IMPORTANT: Always verify we're working on the right task
        if (!this.isCurrentTaskValid()) {
            console.log('Current task is no longer valid, selecting new task');
            this.selectNextTask();
        }

        // Check if we need a new task
        if (!this.currentTask || this.currentTask.progress >= 1) {
            this.selectNextTask();
        }

        if (!this.currentTask) {
            console.log('No tasks available');
            return;
        }

        console.log('Executing task:', this.currentTask.description);
        this.executeTask(this.currentTask);
    }

    needsBanking() {
        // First, let the skill decide if it needs banking for the current task
        if (this.currentTask) {
            const skill = skillRegistry.getSkill(this.currentTask.skill);
            if (skill && skill.needsBankingForTask) {
                // Skill has specific banking logic - use it
                const needsBank = skill.needsBankingForTask(this.currentTask);
                if (needsBank) {
                    console.log(`Skill ${this.currentTask.skill} says banking needed for task`);
                    return true;
                }
                
                // IMPORTANT: If this is a processing skill and it says no banking needed,
                // trust it! Don't fall through to the inventory.isFull() check
                if (skill.isProcessingSkill) {
                    return false;
                }
            }
        }
        
        // Fallback ONLY for gathering skills (or skills without specific banking logic)
        if (inventory.isFull()) {
            return true;
        }
        
        return false;
    }

    // Check if any processing skill has materials to work with
    hasProcessingMaterials() {
        if (!this.currentTask) return false;
        
        const skill = skillRegistry.getSkill(this.currentTask.skill);
        if (!skill) return false;
        
        // Use the generic interface
        if (skill.isProcessingSkill) {
            return skill.hasMaterials ? skill.hasMaterials() : false;
        }
        
        return false;
    }

    executeTask(task) {
        // Double-check this is still the right task
        if (!this.isCurrentTaskValid()) {
            console.log('Task changed during execution, re-selecting');
            this.selectNextTask();
            return;
        }

        // Check if task is valid
        if (!taskManager.isTaskPossible(task)) {
            console.log('Task is impossible, skipping it');
            // Skip the impossible task
            if (window.taskManager) {
                taskManager.skipCurrentTask();
            }
            this.currentTask = null;
            this.hasBankedForCurrentTask = false;
            return;
        }
        
        // Check if skill can continue with this task
        const skill = skillRegistry.getSkill(task.skill);
        if (skill && !skill.canContinueTask(task)) {
            console.log(`Skill ${task.skill} cannot continue task, skipping it`);
            // Skip the impossible task
            if (window.taskManager) {
                taskManager.skipCurrentTask();
            }
            this.currentTask = null;
            this.hasBankedForCurrentTask = false;
            return;
        }

        // NEW: Check if skill requires banking before starting the task
        if (skill && skill.requiresBankingBeforeTask && !this.hasBankedForCurrentTask) {
            console.log(`${task.skill} requires banking before starting task`);
            this.goToBank();
            return;
        }

        // Check if we're at the right node
        if (player.currentNode !== task.nodeId) {
            // Double-check we're not already moving to this node
            if (player.targetNode === task.nodeId && player.isMoving()) {
                console.log(`Already moving to ${task.nodeId}`);
                return;
            }
            
            console.log(`Moving to ${task.nodeId} for task`);
            player.moveTo(task.nodeId);
            return;
        }

        // Verify we're actually at the node (not just have it set incorrectly)
        const node = nodes.getNode(task.nodeId);
        if (node) {
            const dist = window.distance(player.position.x, player.position.y, node.position.x, node.position.y);
            if (dist > 2) { // More than 2 tiles away
                console.log(`currentNode says ${task.nodeId} but player is ${dist} tiles away, clearing and moving`);
                player.currentNode = null;
                player.moveTo(task.nodeId);
                return;
            }
        }
        
        // Check for processing skills - do we have the right materials?
        if (skill && skill.isProcessingSkill) {
            if (!skill.hasMaterialsForCurrentTask || !skill.hasMaterialsForCurrentTask()) {
                const materials = skill.getMaterialsNeededForTask ? skill.getMaterialsNeededForTask(task) : null;
                if (materials) {
                    console.log(`No ${materials.itemId} in inventory for ${task.skill} task, need to bank`);
                } else {
                    console.log(`No materials in inventory for ${task.skill} task, need to bank`);
                }
                
                // Check if we actually have materials in the bank
                if (materials && bank.getItemCount(materials.itemId) === 0) {
                    console.log(`No ${materials.itemId} in bank either, task impossible, skipping`);
                    if (window.taskManager) {
                        taskManager.skipCurrentTask();
                    }
                    this.currentTask = null;
                    this.hasBankedForCurrentTask = false;
                    return;
                }
                
                this.goToBank();
                return;
            }
        }
        
        // Check if we have required items (for fishing bait, etc)
        if (!player.hasRequiredItems(task.activityId)) {
            if (this.hasAccessToRequiredItems(task.activityId)) {
                console.log(`Missing required items for ${task.activityId}, going to bank`);
                this.goToBankForItems(task.activityId);
                return;
            } else {
                // Check if we can buy the items
                if (this.canBuyRequiredItems(task.activityId)) {
                    console.log(`Need to buy items for ${task.activityId}`);
                    // For now, just skip the task since shopping isn't implemented
                    console.log('Shopping not yet implemented by AI, skipping task');
                    if (window.taskManager) {
                        taskManager.skipCurrentTask();
                    }
                    this.currentTask = null;
                    this.hasBankedForCurrentTask = false;
                    return;
                }
                
                console.log(`Cannot perform ${task.activityId} - required items not available, skipping task`);
                // Skip the impossible task
                if (window.taskManager) {
                    taskManager.skipCurrentTask();
                }
                this.currentTask = null;
                this.hasBankedForCurrentTask = false;
                return;
            }
        }
        
        // Start the activity
        console.log(`Starting activity ${task.activityId} for task`);
        player.startActivity(task.activityId);
    }

    canBuyRequiredItems(activityId) {
        const requiredItems = player.getRequiredItems(activityId);
        
        for (const required of requiredItems) {
            // Check if shop sells it
            if (window.shop && shop.sellsItem(required.itemId)) {
                // Check if we have coins
                const price = shop.getPrice(required.itemId);
                const coins = inventory.getItemCount('coins');
                if (coins >= price * required.quantity) {
                    return true;
                }
            }
        }
        
        return false;
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
        const nearestBank = nodes.getNearestBank(player.position);
        if (!nearestBank) {
            console.log('No reachable bank found!');
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
        // Let the skill handle its own banking if it has a current task
        if (this.currentTask) {
            const skill = skillRegistry.getSkill(this.currentTask.skill);
            if (skill && skill.handleBanking) {
                const success = skill.handleBanking(this.currentTask);
                
                // Mark that we've banked for this task if successful
                if (success) {
                    this.hasBankedForCurrentTask = true;
                } else {
                    console.log('Banking failed for skill task');
                    
                    // IMPORTANT: Skip the impossible task in task manager
                    if (window.taskManager) {
                        taskManager.skipCurrentTask();
                    }
                    
                    // Clear our reference
                    this.currentTask = null;
                    this.hasBankedForCurrentTask = false;
                    return;
                }
                
                // Update task progress after banking
                if (window.taskManager) {
                    taskManager.updateAllProgress();
                    if (window.ui) {
                        window.ui.updateTasks();
                    }
                }
                
                // Re-validate current task after banking
                if (!this.isCurrentTaskValid()) {
                    this.selectNextTask();
                }
                
                this.clearCooldown();
                
                if (this.currentTask && this.currentTask.progress < 1) {
                    console.log('Continuing task after banking');
                    this.executeTask(this.currentTask);
                }
                
                return;
            }
        }
        
        // Default banking - deposit all
        const deposited = bank.depositAll();
        console.log(`Deposited ${deposited} items`);
        
        // Update task progress after banking
        if (window.taskManager) {
            taskManager.updateAllProgress();
            if (window.ui) {
                window.ui.updateTasks();
            }
        }
        
        // Re-validate current task after banking
        if (!this.isCurrentTaskValid()) {
            this.selectNextTask();
        }
        
        this.clearCooldown();
        
        if (this.currentTask && this.currentTask.progress < 1) {
            console.log('Continuing task after banking');
            this.executeTask(this.currentTask);
        }
    }

    handleBankingForActivity(activityId) {
        const deposited = bank.depositAll();
        console.log(`Deposited ${deposited} items`);
        
        if (!this.withdrawItemsForActivity(activityId)) {
            // Failed to get required items - skip the current task if it exists
            if (this.currentTask && window.taskManager) {
                console.log('Cannot get required items for task, skipping it');
                taskManager.skipCurrentTask();
                this.currentTask = null;
                this.hasBankedForCurrentTask = false;
            }
            return;
        }
        
        // Update task progress
        if (window.taskManager) {
            taskManager.updateAllProgress();
            if (window.ui) {
                window.ui.updateTasks();
            }
        }
        
        // Re-validate current task
        if (!this.isCurrentTaskValid()) {
            this.selectNextTask();
        }
        
        this.clearCooldown();
        
        if (this.currentTask) {
            console.log(`Continuing task after banking`);
            this.executeTask(this.currentTask);
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

    // ==================== HELPER METHODS ====================

    resetDecisionCooldown() {
        this.decisionCooldown = 1000;
    }

    clearCooldown() {
        this.decisionCooldown = 0;
    }

    getStatus() {
        if (!this.currentTask) return 'No active task';
        
        const current = Math.floor(this.currentTask.progress * this.currentTask.targetCount);
        return `${this.currentTask.description} (${current}/${this.currentTask.targetCount})`;
    }
}
