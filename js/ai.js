class AIManager {
    constructor() {
        this.currentTask = null;
        this.decisionCooldown = 0;
        this.failedNodes = new Set();
    }

    // ==================== TASK MANAGEMENT ====================

    selectNextTask() {
        if (!window.taskManager) {
            console.log('Task manager not initialized');
            return;
        }

        // Always get the first incomplete task
        this.currentTask = taskManager.getFirstIncompleteTask();
        
        if (!this.currentTask) {
            console.log('No incomplete tasks available');
            // All tasks complete, new batch should be generated automatically
            return;
        }

        console.log('Selected task:', this.currentTask.description);
    }

    // Check if current task is still valid (first incomplete task)
    isCurrentTaskValid() {
        if (!this.currentTask) return false;
        if (!window.taskManager) return false;
        
        const firstIncomplete = taskManager.getFirstIncompleteTask();
        return this.currentTask === firstIncomplete;
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
    // This happens when task is rerolled or becomes invalid while we're moving
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

    // Check if current task changed while we were busy (moving OR performing activity)
    if (!this.isCurrentTaskValid() && this.currentTask !== null) {
        // Task was invalidated (rerolled, completed, etc)
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
        this.decisionCooldown = 0;
        // Don't return - let it make a new decision immediately
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
            currentNode: player.currentNode
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
            return skill.needsBankingForTask(this.currentTask);
        }
    }
    
    // Fallback for skills without specific banking logic (gathering skills)
    if (inventory.isFull()) {
        return true;
    }
    
    return false;
}

    hasRawFood() {
        // Delegate to cooking skill
        const cookingSkill = skillRegistry.getSkill('cooking');
        return cookingSkill ? cookingSkill.hasRawFoodInInventory() : false;
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
            console.log('Task is impossible, rerolling...');
            const index = taskManager.tasks.indexOf(task);
            if (index >= 0) {
                taskManager.rerollTask(index);
            }
            this.currentTask = null;
            return;
        }
        
        // Check if skill can continue with this task
        const skill = skillRegistry.getSkill(task.skill);
        if (skill && !skill.canContinueTask(task)) {
            console.log(`Skill ${task.skill} cannot continue task, rerolling...`);
            const index = taskManager.tasks.indexOf(task);
            if (index >= 0) {
                taskManager.rerollTask(index);
            }
            this.currentTask = null;
            return;
        }

        // Check if we're at the right node
        if (player.currentNode !== task.nodeId) {
            console.log(`Moving to ${task.nodeId} for task`);
            player.moveTo(task.nodeId);
            return;
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
                    // For now, just skip the task
                    console.log('Shopping not yet implemented by AI');
                    return;
                }
                
                console.log(`Cannot perform ${task.activityId} - required items not available`);
                // Reroll the task
                const index = taskManager.tasks.indexOf(task);
                if (index >= 0) {
                    taskManager.rerollTask(index);
                }
                this.currentTask = null;
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
                
                if (!success) {
                    console.log('Banking failed for skill task');
                    // Can't complete task, should reroll
                    const index = taskManager.tasks.indexOf(this.currentTask);
                    if (index >= 0) {
                        taskManager.rerollTask(index);
                    }
                    this.currentTask = null;
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
