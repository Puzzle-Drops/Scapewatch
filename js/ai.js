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
        // Bank if inventory is full and we're gathering
        if (inventory.isFull()) {
            // Check if we're doing a production skill that needs raw materials
            if (this.currentTask && this.currentTask.skill === 'cooking') {
                // Cooking needs raw food, so banking makes sense
                return !this.hasRawFood();
            }
            return true;
        }
        
        // Check if we need supplies for the current task
        if (this.currentTask && this.currentTask.skill === 'cooking') {
            return !this.hasRawFood();
        }
        
        return false;
    }

    hasRawFood() {
        const activityData = loadingManager.getData('activities')['cook_food'];
        if (!activityData || !activityData.cookingTable) return false;
        
        const cookingLevel = skills.getLevel('cooking');
        
        for (const recipe of activityData.cookingTable) {
            if (cookingLevel >= recipe.requiredLevel && inventory.hasItem(recipe.rawItemId, 1)) {
                return true;
            }
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
            console.log('Task is impossible, rerolling...');
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
        // Special handling for cooking
        if (this.currentTask && this.currentTask.skill === 'cooking') {
            this.handleCookingBanking();
            return;
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

    handleCookingBanking() {
        // Deposit all first
        bank.depositAll();
        console.log('Deposited all items for cooking');
        
        // Withdraw raw food items
        const activityData = loadingManager.getData('activities')['cook_food'];
        const cookingLevel = skills.getLevel('cooking');
        
        // Sort recipes by required level (lowest first)
        const availableRecipes = activityData.cookingTable
            .filter(recipe => cookingLevel >= recipe.requiredLevel)
            .sort((a, b) => a.requiredLevel - b.requiredLevel);
        
        let withdrawnAny = false;
        let totalWithdrawn = 0;
        
        for (const recipe of availableRecipes) {
            const bankCount = bank.getItemCount(recipe.rawItemId);
            if (bankCount > 0) {
                const toWithdraw = Math.min(28 - totalWithdrawn, bankCount);
                const withdrawn = bank.withdrawUpTo(recipe.rawItemId, toWithdraw);
                
                if (withdrawn > 0) {
                    inventory.addItem(recipe.rawItemId, withdrawn);
                    console.log(`Withdrew ${withdrawn} ${recipe.rawItemId}`);
                    withdrawnAny = true;
                    totalWithdrawn += withdrawn;
                    
                    if (totalWithdrawn >= 28) break;
                }
            }
        }
        
        if (!withdrawnAny) {
            console.log('No raw food to withdraw for cooking');
            // Can't complete cooking task, should reroll
            if (this.currentTask) {
                const index = taskManager.tasks.indexOf(this.currentTask);
                if (index >= 0) {
                    taskManager.rerollTask(index);
                }
                this.currentTask = null;
            }
            return;
        }
        
        // Update task progress and continue
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
