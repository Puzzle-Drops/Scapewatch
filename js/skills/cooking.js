class CookingSkill extends BaseSkill {
    constructor() {
        super('cooking', 'Cooking');
        this.requiresBankingBeforeTask = true; // Cooking ALWAYS banks before starting a task
        this.isProcessingSkill = true;
        this.lastCookingXp = 0;
        this.currentRawItem = null;
        this.hasBankedForTask = false; // Track if we've banked for current cooking task
        this.currentTaskId = null; // Track which task we've banked for
        
        // State tracking to prevent duplicate cooking starts
        this.isCooking = false;
        this.cookingTaskId = null;
        this.cookingItemId = null;
        this.cookingStartTime = 0;
    }
    
    // ==================== TASK GENERATION OVERRIDES ====================
    
    generateTask() {
        // Get available raw food from bank + inventory
        const availableRawFood = this.getAvailableRawFood();
        
        if (availableRawFood.length === 0) {
            console.log('No raw food available for cooking tasks');
            return null;
        }
        
        // Filter out items that already have cooking tasks (unless we have lots)
        const filteredFood = this.filterOutExistingTasks(availableRawFood);
        
        if (filteredFood.length === 0) {
            console.log('All available raw food already has tasks');
            return null;
        }
        
        // Select a raw food item using weighted distribution
        const selectedFood = this.selectWeightedRawFood(filteredFood);
        if (!selectedFood) {
            console.log('Failed to select raw food for cooking');
            return null;
        }
        
        // Find cooking nodes
        const cookingNodes = this.findCookingNodes();
        if (cookingNodes.length === 0) {
            console.log('No cooking locations available');
            return null;
        }
        
        // Select a random cooking location
        const selectedNode = cookingNodes[Math.floor(Math.random() * cookingNodes.length)];
        
        // Determine target count (capped by available raw food)
        const desiredCount = this.determineTargetCount(selectedFood.cookedItemId);
        const targetCount = Math.min(desiredCount, selectedFood.available);
        
        // Don't create tasks for very small amounts
        if (targetCount < 5) {
            console.log(`Not enough ${selectedFood.rawItemId} for a task (only ${selectedFood.available} available)`);
            return null;
        }
        
        // Get item names
        const rawItemData = loadingManager.getData('items')[selectedFood.rawItemId];
        const nodeData = nodes.getNode(selectedNode.nodeId);
        
        // Create the cooking task - note we track RAW item consumption
        return {
            skill: this.id,
            itemId: selectedFood.rawItemId, // Track RAW item consumption
            targetCount: targetCount,
            nodeId: selectedNode.nodeId,
            activityId: selectedNode.activityId,
            description: `Cook ${targetCount} ${rawItemData.name} at ${nodeData.name}`,
            startingCount: this.getRawFoodConsumedCount(selectedFood.rawItemId), // Track how many we've already used
            progress: 0,
            isCookingTask: true, // Flag to identify cooking tasks
            cookedItemId: selectedFood.cookedItemId, // Store what we're making for reference
            rawFoodConsumed: 0 // Initialize consumption counter
        };
    }
    
    // Update cooking task progress when we consume raw food
    updateCookingTaskProgress(rawItemId) {
        // Only update if we have task manager and the current task is for this raw item
        if (!window.taskManager) return;
        
        const currentTask = taskManager.getFirstIncompleteTask();
        
        // Only update if the current task is a cooking task for this raw item
        if (currentTask && currentTask.isCookingTask && currentTask.itemId === rawItemId) {
            // Increment the consumption counter
            currentTask.rawFoodConsumed = (currentTask.rawFoodConsumed || 0) + 1;
            
            // Calculate and set progress
            const progress = currentTask.rawFoodConsumed / currentTask.targetCount;
            
            console.log(`Cooking progress: ${currentTask.rawFoodConsumed}/${currentTask.targetCount}`);
            
            // Use the generic setTaskProgress method
            taskManager.setTaskProgress(currentTask, progress);
        }
    }
    
    // Get count of raw food we've consumed (inverse of what's available)
    getRawFoodConsumedCount(rawItemId) {
        // This is a bit tricky - we need to track based on some baseline
        // For now, we'll use 0 as the starting count and track depletion
        // In a real implementation, we might want to store the initial count
        return 0;
    }
    
    // Filter out raw food that already has tasks (unless we have plenty)
    filterOutExistingTasks(availableRawFood) {
        if (!window.taskManager) return availableRawFood;
        
        const filtered = [];
        const existingTasks = taskManager.getAllTasks();
        
        for (const food of availableRawFood) {
            // Check if there's already a cooking task for this raw item
            const existingTask = existingTasks.find(task => 
                task.isCookingTask && 
                task.itemId === food.rawItemId &&
                task.progress < 1
            );
            
            if (existingTask) {
                // Only allow if we have 10x the amount needed for a typical task
                const typicalTaskSize = this.determineTargetCount(food.cookedItemId);
                const safeAmount = typicalTaskSize * 10;
                
                if (food.available >= safeAmount) {
                    console.log(`Allowing duplicate task for ${food.rawItemId} - have ${food.available}, safe threshold is ${safeAmount}`);
                    filtered.push(food);
                } else {
                    console.log(`Filtering out ${food.rawItemId} - already has task and only ${food.available} available`);
                }
            } else {
                // No existing task for this item, safe to use
                filtered.push(food);
            }
        }
        
        return filtered;
    }
    
    // Get all available raw food items
    getAvailableRawFood() {
        const availableFood = [];
        const activityData = loadingManager.getData('activities')['cook_food'];
        if (!activityData || !activityData.cookingTable) return availableFood;
        
        const cookingLevel = skills.getLevel('cooking');
        
        for (const recipe of activityData.cookingTable) {
            if (cookingLevel < recipe.requiredLevel) continue;
            
            // Check how much of this raw food we have
            const inInventory = inventory.getItemCount(recipe.rawItemId);
            const inBank = bank.getItemCount(recipe.rawItemId);
            const total = inInventory + inBank;
            
            if (total > 0) {
                availableFood.push({
                    rawItemId: recipe.rawItemId,
                    cookedItemId: recipe.cookedItemId,
                    available: total,
                    requiredLevel: recipe.requiredLevel
                });
            }
        }
        
        return availableFood;
    }
    
    // Select raw food using weighted distribution (prefer higher level foods)
    selectWeightedRawFood(availableFood) {
        if (availableFood.length === 0) return null;
        
        // Sort by required level (highest first)
        availableFood.sort((a, b) => b.requiredLevel - a.requiredLevel);
        
        // Apply weights based on level and availability
        const weights = [];
        let totalWeight = 0;
        
        for (let i = 0; i < availableFood.length; i++) {
            // Base weight: higher level foods get more weight
            let weight = 0;
            if (i === 0) weight = 0.4; // Highest level
            else if (i === 1) weight = 0.3; // Second highest
            else weight = 0.3 / (availableFood.length - 2); // Split remaining
            
            // Adjust weight based on quantity available (more available = more likely)
            const quantityMultiplier = Math.min(2.0, 1.0 + (availableFood[i].available / 100));
            weight *= quantityMultiplier;
            
            weights.push(weight);
            totalWeight += weight;
        }
        
        // Normalize weights
        for (let i = 0; i < weights.length; i++) {
            weights[i] /= totalWeight;
        }
        
        // Random selection based on weights
        const random = Math.random();
        let cumulative = 0;
        
        for (let i = 0; i < availableFood.length; i++) {
            cumulative += weights[i];
            if (random < cumulative) {
                return availableFood[i];
            }
        }
        
        return availableFood[availableFood.length - 1]; // Fallback
    }
    
    // Find nodes where we can cook
    findCookingNodes() {
        const cookingNodes = [];
        const allNodes = nodes.getAllNodes();
        
        for (const [nodeId, node] of Object.entries(allNodes)) {
            if (!node.activities) continue;
            
            // Check if this node has cooking activity
            if (node.activities.includes('cook_food')) {
                // Check if node is walkable
                if (window.collision && window.collision.initialized) {
                    if (!collision.isWalkable(Math.floor(node.position.x), Math.floor(node.position.y))) {
                        continue;
                    }
                }
                
                cookingNodes.push({
                    nodeId: nodeId,
                    activityId: 'cook_food'
                });
            }
        }
        
        return cookingNodes;
    }
    
    getTaskVerb() {
        return 'Cook';
    }
    
    isIgnoredItem(itemId) {
        // Ignore burnt food
        return itemId === 'burnt_food';
    }
    
    determineTargetCount(itemId) {
        const foodCounts = {
            'meat': { min: 25, max: 75 },
            'shrimps': { min: 25, max: 75 },
            'sardine': { min: 25, max: 70 },
            'anchovies': { min: 25, max: 70 },
            'herring': { min: 25, max: 60 },
            'mackerel': { min: 20, max: 50 },
            'trout': { min: 20, max: 45 },
            'cod': { min: 20, max: 45 },
            'pike': { min: 15, max: 40 },
            'salmon': { min: 15, max: 35 },
            'tuna': { min: 15, max: 30 },
            'lobster': { min: 10, max: 25 },
            'bass': { min: 10, max: 20 },
            'swordfish': { min: 10, max: 20 },
            'shark': { min: 5, max: 15 }
        };
        
        const counts = foodCounts[itemId] || { min: 15, max: 40 };
        const baseCount = counts.min + Math.random() * (counts.max - counts.min);
        return Math.round(baseCount / 5) * 5;
    }
    
    // Check if we still have access to raw food for cooking
    hasAccessToRawFood() {
        const activityData = loadingManager.getData('activities')['cook_food'];
        if (!activityData || !activityData.cookingTable) return false;
        
        const cookingLevel = skills.getLevel('cooking');
        
        for (const recipe of activityData.cookingTable) {
            if (cookingLevel >= recipe.requiredLevel) {
                // Check if raw item exists in bank or inventory
                const inInventory = inventory.getItemCount(recipe.rawItemId);
                const inBank = bank.getItemCount(recipe.rawItemId);
                if (inInventory + inBank > 0) {
                    return true;
                }
            }
        }
        
        return false;
    }
    
    // NEW METHOD: Check if we have raw food for the CURRENT TASK specifically
    hasRawFoodForCurrentTask() {
        // Only check if we have an active cooking task
        if (!window.ai || !window.ai.currentTask || !window.ai.currentTask.isCookingTask) {
            return false;
        }
        
        const task = window.ai.currentTask;
        const hasRawFood = inventory.hasItem(task.itemId, 1);
        
        if (!hasRawFood) {
            console.log(`No ${task.itemId} in inventory for cooking task`);
        }
        
        return hasRawFood;
    }
    
    // ==================== PROCESSING SKILL INTERFACE ====================
    // Implement the generic processing skill interface
    
    isProcessingSkill() {
        return true; // Cooking is a processing skill
    }
    
    hasMaterialsForCurrentTask() {
        // Delegate to our specific implementation
        return this.hasRawFoodForCurrentTask();
    }
    
    getMaterialsNeededForTask(task) {
        if (!task || !task.isCookingTask) return null;
        
        return {
            itemId: task.itemId, // The raw food needed
            quantity: task.targetCount - (task.rawFoodConsumed || 0)
        };
    }
    
    // ==================== CORE BEHAVIOR ====================
    
    getDuration(baseDuration, level, activityData) {
        return 2400; // Cooking is always 2400ms
    }
    
    beforeActivityStart(activityData) {
        // Check if we're already cooking
        if (this.isCooking) {
            const currentTime = Date.now();
            const timeCooking = currentTime - this.cookingStartTime;
            
            // If we're in the middle of cooking (within the 2400ms window), reject the new start
            if (timeCooking < 2400) {
                // Check if it's the same task and item
                if (window.ai && window.ai.currentTask && window.ai.currentTask.isCookingTask) {
                    const taskId = `${window.ai.currentTask.itemId}_${window.ai.currentTask.targetCount}`;
                    if (this.cookingTaskId === taskId && this.cookingItemId === window.ai.currentTask.itemId) {
                        console.log(`Already cooking ${this.cookingItemId} for this task, rejecting duplicate start`);
                        return false; // Reject the duplicate start
                    }
                }
            } else {
                // Been cooking too long, something went wrong, reset
                console.log('Cooking took too long, resetting state');
                this.clearCookingState();
            }
        }
        
        // If we have a cooking task, we MUST cook that specific item
        let rawItem = null;
        
        if (window.ai && window.ai.currentTask && window.ai.currentTask.isCookingTask) {
            // Check if we have the task's raw item in inventory
            const taskRawItemId = window.ai.currentTask.itemId;
            const level = skills.getLevel('cooking');
            
            // Find the recipe for this raw item
            const recipe = activityData.cookingTable.find(r => 
                r.rawItemId === taskRawItemId && 
                level >= r.requiredLevel
            );
            
            if (recipe && inventory.hasItem(taskRawItemId, 1)) {
                rawItem = recipe;
                console.log(`Selected ${taskRawItemId} for current cooking task`);
            } else {
                // We have a cooking task but don't have the required raw food
                console.log(`Cannot cook - need ${taskRawItemId} for task but don't have it`);
                this.clearCookingState(); // Clear state when we can't cook
                
                // Tell the AI it needs to re-evaluate (probably need to bank)
                if (window.ai) {
                    window.ai.decisionCooldown = 0;
                }
                
                return false; // IMPORTANT: Don't fall back to other items
            }
        } else {
            // No cooking task, cook any available raw food
            rawItem = this.findRawItemToCook(activityData.cookingTable, skills.getLevel('cooking'));
        }
        
        if (!rawItem) {
            console.log('No raw items to cook');
            this.clearCookingState(); // Clear state when we can't cook
            return false;
        }
        
        // Store what we're going to cook
        this.currentRawItem = rawItem;
        
        // Set cooking state
        this.isCooking = true;
        this.cookingStartTime = Date.now();
        this.cookingItemId = rawItem.rawItemId;
        if (window.ai && window.ai.currentTask && window.ai.currentTask.isCookingTask) {
            this.cookingTaskId = `${window.ai.currentTask.itemId}_${window.ai.currentTask.targetCount}`;
        } else {
            this.cookingTaskId = null;
        }
        
        console.log(`Starting to cook ${this.cookingItemId}`);
        
        return true;
    }
    
    processRewards(activityData, level) {
        // Clear cooking state when processing rewards (cooking is complete)
        this.clearCookingState();
        
        if (!this.currentRawItem) {
            this.lastCookingXp = 0;
            return [];
        }
        
        // Double-check we still have the raw item
        if (!inventory.hasItem(this.currentRawItem.rawItemId, 1)) {
            // This shouldn't happen if beforeActivityStart() is working correctly
            console.log('ERROR: Raw item disappeared during cooking - this should not happen!');
            this.lastCookingXp = 0;
            this.clearCookingState();
            
            // Trigger AI re-evaluation to go bank
            if (window.ai) {
                window.ai.decisionCooldown = 0;
            }
            
            return [];
        }
        
        // NOW consume the raw item
        inventory.removeItem(this.currentRawItem.rawItemId, 1);
        
        // Update cooking task progress if applicable
        this.updateCookingTaskProgress(this.currentRawItem.rawItemId);
        
        // Check success
        const successChance = this.getChance(this.currentRawItem, level);
        const success = Math.random() <= successChance;
        
        if (success) {
            this.lastCookingXp = this.currentRawItem.xpPerAction;
            return [{ itemId: this.currentRawItem.cookedItemId, quantity: 1 }];
        } else {
            this.lastCookingXp = 0;
            return [{ itemId: this.currentRawItem.burntItemId, quantity: 1 }];
        }
    }
    
    shouldGrantXP(rewards, activityData) {
        return this.lastCookingXp > 0;
    }
    
    getXpToGrant(rewards, activityData) {
        return this.lastCookingXp || 0;
    }
    
    findRawItemToCook(cookingTable, level) {
        // Sort by required level (lowest first)
        const availableRecipes = cookingTable
            .filter(recipe => level >= recipe.requiredLevel)
            .sort((a, b) => a.requiredLevel - b.requiredLevel);
        
        // Find first recipe where we have the raw item
        for (const recipe of availableRecipes) {
            if (inventory.hasItem(recipe.rawItemId, 1)) {
                return recipe;
            }
        }
        
        return null;
    }
    
    canPerformActivity(activityId) {
        const activityData = loadingManager.getData('activities')[activityId];
        if (!activityData || activityData.skill !== this.id) return false;
        
        // For cooking, we need raw food in inventory
        const level = skills.getLevel('cooking');
        const rawItem = this.findRawItemToCook(activityData.cookingTable, level);
        
        return rawItem !== null;
    }
    
    shouldBankItem(itemId) {
        // Don't bank burnt food
        return itemId !== 'burnt_food';
    }
    
    // Check if task has changed
    isNewTask(task) {
        // Check if this is a different task than what we banked for
        const taskId = task ? `${task.itemId}_${task.targetCount}_${task.nodeId}` : null;
        return taskId !== this.currentTaskId;
    }
    
    // Clear cooking state
    clearCookingState() {
        this.isCooking = false;
        this.cookingTaskId = null;
        this.cookingItemId = null;
        this.cookingStartTime = 0;
    }
    
    // ==================== BANKING LOGIC ====================
    
    // Check if we have any raw food to cook (in inventory)
    hasRawFoodInInventory() {
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
    
    // Check if we need banking for a cooking task (called after arriving at cooking location)
    needsBankingForTask(task) {
        if (!task || task.skill !== 'cooking') return false;
        if (!task.isCookingTask) return false;
        
        // Check if we have the specific raw food for our task
        if (!inventory.hasItem(task.itemId, 1)) {
            // We don't have the raw food for our task - need to bank
            console.log(`Need banking: no ${task.itemId} in inventory for cooking task`);
            return true;
        }
        
        return false;
    }
    
    // Handle banking for cooking tasks
    handleBanking(task) {
        // Deposit all first
        bank.depositAll();
        console.log('Deposited all items for cooking');
        
        // Mark that we've banked for this task
        const taskId = task ? `${task.itemId}_${task.targetCount}_${task.nodeId}` : null;
        this.currentTaskId = taskId;
        this.hasBankedForTask = true;
        
        let withdrawnAny = false;
        let totalWithdrawn = 0;
        
        // If we have a specific cooking task, ONLY withdraw that raw food
        if (task && task.isCookingTask) {
            const taskRawItemId = task.itemId;
            const bankCount = bank.getItemCount(taskRawItemId);
            const needed = task.targetCount - (task.rawFoodConsumed || 0);
            
            if (bankCount > 0 && needed > 0) {
                const toWithdraw = Math.min(28, Math.min(bankCount, needed));
                const withdrawn = bank.withdrawUpTo(taskRawItemId, toWithdraw);
                
                if (withdrawn > 0) {
                    inventory.addItem(taskRawItemId, withdrawn);
                    console.log(`Withdrew ${withdrawn} ${taskRawItemId} for cooking task`);
                    withdrawnAny = true;
                    totalWithdrawn += withdrawn;
                }
            } else {
                console.log(`No ${taskRawItemId} in bank for cooking task`);
            }
        }
        
        // DON'T fill with other raw food - only cook what the task requires
        // This keeps things clean and predictable
        
        return withdrawnAny;
    }
    
    // Check if we can continue with this task
    canContinueTask(task) {
        if (!task || !task.isCookingTask) return true;
        
        // Check if we have enough raw food remaining
        const currentRawFood = (inventory.getItemCount(task.itemId) + bank.getItemCount(task.itemId));
        const remaining = task.targetCount - (task.rawFoodConsumed || 0);
        
        if (currentRawFood < remaining) {
            console.log(`Cannot continue cooking task - need ${remaining} more ${task.itemId}, have ${currentRawFood}`);
            // Reset banking flag when task becomes impossible
            this.hasBankedForTask = false;
            this.currentTaskId = null;
            this.clearCookingState();
            return false;
        }
        
        return true;
    }
    
    // Called when activity completes to potentially reset state
    onActivityComplete(activityData) {
        // Clear cooking state when activity completes
        this.clearCookingState();
        
        // Check if task is complete
        if (window.ai && window.ai.currentTask && window.ai.currentTask.isCookingTask) {
            if (window.ai.currentTask.progress >= 1) {
                // Task complete, reset banking state
                console.log('Cooking task complete, resetting banking state');
                this.hasBankedForTask = false;
                this.currentTaskId = null;
            } else {
                // Task not complete, check if we need to bank for more raw food
                if (!inventory.hasItem(window.ai.currentTask.itemId, 1)) {
                    console.log('Cooking task needs more raw food, triggering AI re-evaluation');
                    // Clear banking flag so AI will go bank again
                    this.hasBankedForTask = false;
                    // Tell AI to re-evaluate immediately
                    if (window.ai) {
                        window.ai.decisionCooldown = 0;
                    }
                }
            }
        }
    }
    
    // Check if we have materials to work with (for production skills)
    hasMaterials() {
        return this.hasRawFoodInInventory();
    }
    
    // Called when activity is stopped (interrupted)
    onActivityStopped() {
        console.log('Cooking activity was stopped, clearing state');
        this.clearCookingState();
    }
}
