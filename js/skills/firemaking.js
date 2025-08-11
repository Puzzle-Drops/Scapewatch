class FiremakingSkill extends BaseSkill {
    constructor() {
        super('firemaking', 'Firemaking');
        this.requiresBankingBeforeTask = true; // Firemaking ALWAYS banks before starting a task
        this.isProcessingSkill = true;
        this.lastFiremakingXp = 0;
        this.currentLog = null;
        this.hasBankedForTask = false; // Track if we've banked for current firemaking task
        this.currentTaskId = null; // Track which task we've banked for
        
        // State tracking to prevent duplicate firemaking starts
        this.isBurning = false;
        this.burningTaskId = null;
        this.burningLogId = null;
        this.burningStartTime = 0;
    }
    
    // ==================== TASK GENERATION OVERRIDES ====================
    
    generateTask() {
        // Get available logs from bank + inventory
        const availableLogs = this.getAvailableLogs();
        
        if (availableLogs.length === 0) {
            console.log('No logs available for firemaking tasks');
            return null;
        }
        
        // Filter out items that already have firemaking tasks
        const filteredLogs = this.filterOutExistingTasks(availableLogs);
        
        if (filteredLogs.length === 0) {
            console.log('All available logs already have tasks');
            return null;
        }
        
        // Select a log item using weighted distribution
        const selectedLog = this.selectWeightedLog(filteredLogs);
        if (!selectedLog) {
            console.log('Failed to select log for firemaking');
            return null;
        }
        
        // Find firemaking nodes
        const firemakingNodes = this.findFiremakingNodes();
        if (firemakingNodes.length === 0) {
            console.log('No firemaking locations available');
            return null;
        }
        
        // Select a random firemaking location
        const selectedNode = firemakingNodes[Math.floor(Math.random() * firemakingNodes.length)];
        
        // Determine target count (capped by available logs)
        const desiredCount = this.determineTargetCount(selectedLog.logId);
        const targetCount = Math.min(desiredCount, selectedLog.available);
        
        // Don't create tasks for very small amounts
        if (targetCount < 5) {
            console.log(`Not enough ${selectedLog.logId} for a task (only ${selectedLog.available} available)`);
            return null;
        }
        
        // Get item names
        const logItemData = loadingManager.getData('items')[selectedLog.logId];
        const nodeData = nodes.getNode(selectedNode.nodeId);
        
        // Create the firemaking task - note we track log consumption
        return {
            skill: this.id,
            itemId: selectedLog.logId, // Track log consumption
            targetCount: targetCount,
            nodeId: selectedNode.nodeId,
            activityId: selectedNode.activityId,
            description: `Burn ${targetCount} ${logItemData.name} at ${nodeData.name}`,
            startingCount: 0, // Track how many we've already burned
            progress: 0,
            isFiremakingTask: true, // Flag to identify firemaking tasks
            logsConsumed: 0 // Initialize consumption counter
        };
    }
    
    // Update firemaking task progress when we consume a log
    updateFiremakingTaskProgress(logId) {
        // Only update if we have task manager and the current task is for this log
        if (!window.taskManager) return;
        
        const currentTask = taskManager.getFirstIncompleteTask();
        
        // Only update if the current task is a firemaking task for this log
        if (currentTask && currentTask.isFiremakingTask && currentTask.itemId === logId) {
            // Increment the consumption counter
            currentTask.logsConsumed = (currentTask.logsConsumed || 0) + 1;
            
            // Calculate and set progress
            const progress = currentTask.logsConsumed / currentTask.targetCount;
            
            console.log(`Firemaking progress: ${currentTask.logsConsumed}/${currentTask.targetCount}`);
            
            // Use the generic setTaskProgress method
            taskManager.setTaskProgress(currentTask, progress);
        }
    }
    
    // Filter out logs that already have tasks (ANY skill, not just firemaking)
filterOutExistingTasks(availableLogs) {
    if (!window.taskManager) return availableLogs;
    
    const filtered = [];
    const existingTasks = taskManager.getAllTasks();
    
    for (const log of availableLogs) {
        // Check if there's already ANY task (from any skill) for this log
        const existingTask = existingTasks.find(task => 
            task.itemId === log.logId &&
            task.progress < 1
        );
        
        if (existingTask) {
            // Only allow if we have 10x the amount needed for a typical task
            const typicalTaskSize = this.determineTargetCount(log.logId);
            const safeAmount = typicalTaskSize * 10;
            
            if (log.available >= safeAmount) {
                console.log(`Allowing duplicate task for ${log.logId} (used by ${existingTask.skill}) - have ${log.available}, safe threshold is ${safeAmount}`);
                filtered.push(log);
            } else {
                console.log(`Filtering out ${log.logId} - already has task in ${existingTask.skill} and only ${log.available} available`);
            }
        } else {
            // No existing task for this item, safe to use
            filtered.push(log);
        }
    }
    
    return filtered;
}
    
    // Get all available logs
    getAvailableLogs() {
        const availableLogs = [];
        const activityData = loadingManager.getData('activities')['firemaking'];
        if (!activityData || !activityData.firemakingTable) return availableLogs;
        
        const firemakingLevel = skills.getLevel('firemaking');
        
        for (const logData of activityData.firemakingTable) {
            if (firemakingLevel < logData.requiredLevel) continue;
            
            // Check how much of this log we have
            const inInventory = inventory.getItemCount(logData.logId);
            const inBank = bank.getItemCount(logData.logId);
            const total = inInventory + inBank;
            
            if (total > 0) {
                availableLogs.push({
                    logId: logData.logId,
                    available: total,
                    requiredLevel: logData.requiredLevel
                });
            }
        }
        
        return availableLogs;
    }
    
    // Select log using weighted distribution (prefer higher level logs)
    selectWeightedLog(availableLogs) {
        if (availableLogs.length === 0) return null;
        
        // Sort by required level (highest first)
        availableLogs.sort((a, b) => b.requiredLevel - a.requiredLevel);
        
        // Apply weights based on level and availability
        const weights = [];
        let totalWeight = 0;
        
        for (let i = 0; i < availableLogs.length; i++) {
            // Base weight: higher level logs get more weight
            let weight = 0;
            if (i === 0) weight = 0.4; // Highest level
            else if (i === 1) weight = 0.3; // Second highest
            else weight = 0.3 / (availableLogs.length - 2); // Split remaining
            
            // Adjust weight based on quantity available (more available = more likely)
            const quantityMultiplier = Math.min(2.0, 1.0 + (availableLogs[i].available / 100));
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
        
        for (let i = 0; i < availableLogs.length; i++) {
            cumulative += weights[i];
            if (random < cumulative) {
                return availableLogs[i];
            }
        }
        
        return availableLogs[availableLogs.length - 1]; // Fallback
    }
    
    // Find nodes where we can do firemaking
    findFiremakingNodes() {
        const firemakingNodes = [];
        const allNodes = nodes.getAllNodes();
        
        for (const [nodeId, node] of Object.entries(allNodes)) {
            if (!node.activities) continue;
            
            // Check if this node has firemaking activity
            if (node.activities.includes('firemaking')) {
                // Check if node is walkable
                if (window.collision && window.collision.initialized) {
                    if (!collision.isWalkable(Math.floor(node.position.x), Math.floor(node.position.y))) {
                        continue;
                    }
                }
                
                firemakingNodes.push({
                    nodeId: nodeId,
                    activityId: 'firemaking'
                });
            }
        }
        
        return firemakingNodes;
    }
    
    getTaskVerb() {
        return 'Burn';
    }
    
    determineTargetCount(logId) {
        const logCounts = {
            'logs': { min: 30, max: 80 },
            'oak_logs': { min: 25, max: 70 },
            'willow_logs': { min: 25, max: 60 },
            'maple_logs': { min: 20, max: 50 },
            'yew_logs': { min: 15, max: 40 },
            'magic_logs': { min: 10, max: 30 },
            'redwood_logs': { min: 10, max: 25 }
        };
        
        const counts = logCounts[logId] || { min: 20, max: 50 };
        const baseCount = counts.min + Math.random() * (counts.max - counts.min);
        return Math.round(baseCount / 5) * 5;
    }
    
    // Check if we have logs for the CURRENT TASK specifically
    hasLogsForCurrentTask() {
        // Only check if we have an active firemaking task
        if (!window.ai || !window.ai.currentTask || !window.ai.currentTask.isFiremakingTask) {
            return false;
        }
        
        const task = window.ai.currentTask;
        const hasLogs = inventory.hasItem(task.itemId, 1);
        
        if (!hasLogs) {
            console.log(`No ${task.itemId} in inventory for firemaking task`);
        }
        
        return hasLogs;
    }
    
    // ==================== PROCESSING SKILL INTERFACE ====================
    
    hasMaterialsForCurrentTask() {
        return this.hasLogsForCurrentTask();
    }
    
    getMaterialsNeededForTask(task) {
        if (!task || !task.isFiremakingTask) return null;
        
        return {
            itemId: task.itemId, // The logs needed
            quantity: task.targetCount - (task.logsConsumed || 0)
        };
    }
    
    // ==================== CORE BEHAVIOR ====================
    
    getDuration(baseDuration, level, activityData) {
        return 2400; // Firemaking is always 2400ms per attempt
    }
    
    beforeActivityStart(activityData) {
        // Check if we're already burning
        if (this.isBurning) {
            const currentTime = Date.now();
            const timeBurning = currentTime - this.burningStartTime;
            
            // If we're in the middle of burning (within the 2400ms window), reject the new start
            if (timeBurning < 2400) {
                // Check if it's the same task and item
                if (window.ai && window.ai.currentTask && window.ai.currentTask.isFiremakingTask) {
                    const taskId = `${window.ai.currentTask.itemId}_${window.ai.currentTask.targetCount}`;
                    if (this.burningTaskId === taskId && this.burningLogId === window.ai.currentTask.itemId) {
                        console.log(`Already burning ${this.burningLogId} for this task, rejecting duplicate start`);
                        return false; // Reject the duplicate start
                    }
                }
            } else {
                // Been burning too long, something went wrong, reset
                console.log('Burning took too long, resetting state');
                this.clearBurningState();
            }
        }
        
        // If we have a firemaking task, we MUST burn that specific log
        let logItem = null;
        
        if (window.ai && window.ai.currentTask && window.ai.currentTask.isFiremakingTask) {
            // Check if we have the task's log in inventory
            const taskLogId = window.ai.currentTask.itemId;
            const level = skills.getLevel('firemaking');
            
            // Find the recipe for this log
            const recipe = activityData.firemakingTable.find(r => 
                r.logId === taskLogId && 
                level >= r.requiredLevel
            );
            
            if (recipe && inventory.hasItem(taskLogId, 1)) {
                logItem = recipe;
                console.log(`Selected ${taskLogId} for current firemaking task`);
            } else {
                // We have a firemaking task but don't have the required log
                console.log(`Cannot burn - need ${taskLogId} for task but don't have it`);
                this.clearBurningState(); // Clear state when we can't burn
                
                // Tell the AI it needs to re-evaluate (probably need to bank)
                if (window.ai) {
                    window.ai.decisionCooldown = 0;
                }
                
                return false; // IMPORTANT: Don't fall back to other logs
            }
        } else {
            // No firemaking task, burn any available log
            logItem = this.findLogToBurn(activityData.firemakingTable, skills.getLevel('firemaking'));
        }
        
        if (!logItem) {
            console.log('No logs to burn');
            this.clearBurningState(); // Clear state when we can't burn
            return false;
        }
        
        // Store what we're going to burn
        this.currentLog = logItem;
        
        // Set burning state
        this.isBurning = true;
        this.burningStartTime = Date.now();
        this.burningLogId = logItem.logId;
        if (window.ai && window.ai.currentTask && window.ai.currentTask.isFiremakingTask) {
            this.burningTaskId = `${window.ai.currentTask.itemId}_${window.ai.currentTask.targetCount}`;
        } else {
            this.burningTaskId = null;
        }
        
        console.log(`Starting to burn ${this.burningLogId}`);
        
        return true;
    }
    
    processRewards(activityData, level) {
        if (!this.currentLog) {
            this.lastFiremakingXp = 0;
            return [];
        }
        
        // Double-check we still have the log
        if (!inventory.hasItem(this.currentLog.logId, 1)) {
            console.log('ERROR: Log disappeared during burning - this should not happen!');
            this.lastFiremakingXp = 0;
            this.clearBurningState();
            
            // Trigger AI re-evaluation to go bank
            if (window.ai) {
                window.ai.decisionCooldown = 0;
            }
            
            return [];
        }
        
        // Calculate success chance (linear interpolation from 65/256 at level 1 to 513/256 at level 99)
        const successChance = this.calculateSuccessChance(level);
        const success = Math.random() <= successChance;
        
        if (success) {
            // Clear burning state on success
            this.clearBurningState();
            
            // NOW consume the log
            inventory.removeItem(this.currentLog.logId, 1);
            
            // Update firemaking task progress if applicable
            this.updateFiremakingTaskProgress(this.currentLog.logId);
            
            // Move player 1 tile to the left
            if (window.player) {
                player.position.x -= 1;
                console.log('Moved 1 tile left after successful fire');
            }
            
            this.lastFiremakingXp = this.currentLog.xpPerAction;
            return [{ itemId: 'ashes', quantity: 1 }];
        } else {
            // Failed - don't consume log, don't grant XP, retry same log
            console.log('Failed to light fire, retrying...');
            this.lastFiremakingXp = 0;
            
            // Keep the same log selected for retry
            // Don't clear currentLog here
            
            return [];
        }
    }
    
    calculateSuccessChance(level) {
        // Linear interpolation from 65/256 at level 1 to 513/256 at level 99
        // 256/256 (100%) is achieved at level 43
        
        if (level >= 43) {
            return 1.0; // Guaranteed success at level 43+
        }
        
        // Linear interpolation for levels 1-42
        const minLevel = 1;
        const maxLevel = 42;
        const minChance = 65 / 256;  // ~25.4%
        const maxChance = 256 / 256; // 100%
        
        const progress = (level - minLevel) / (maxLevel - minLevel);
        const chance = minChance + (maxChance - minChance) * progress;
        
        return chance;
    }
    
    shouldGrantXP(rewards, activityData) {
        return this.lastFiremakingXp > 0;
    }
    
    getXpToGrant(rewards, activityData) {
        return this.lastFiremakingXp || 0;
    }
    
    findLogToBurn(firemakingTable, level) {
        // Sort by required level (lowest first)
        const availableRecipes = firemakingTable
            .filter(recipe => level >= recipe.requiredLevel)
            .sort((a, b) => a.requiredLevel - b.requiredLevel);
        
        // Find first recipe where we have the log
        for (const recipe of availableRecipes) {
            if (inventory.hasItem(recipe.logId, 1)) {
                return recipe;
            }
        }
        
        return null;
    }
    
    canPerformActivity(activityId) {
        const activityData = loadingManager.getData('activities')[activityId];
        if (!activityData || activityData.skill !== this.id) return false;
        
        // For firemaking, we need logs in inventory
        const level = skills.getLevel('firemaking');
        const logItem = this.findLogToBurn(activityData.firemakingTable, level);
        
        return logItem !== null;
    }
    
    shouldBankItem(itemId) {
        // Don't bank logs (we need them for firemaking)
        const logs = ['logs', 'oak_logs', 'willow_logs', 'maple_logs', 'yew_logs', 'magic_logs', 'redwood_logs'];
        if (logs.includes(itemId)) {
            return false;
        }
        return true;
    }
    
    // Clear burning state
    clearBurningState() {
        this.isBurning = false;
        this.burningTaskId = null;
        this.burningLogId = null;
        this.burningStartTime = 0;
    }
    
    // ==================== BANKING LOGIC ====================
    
    // Check if we have any logs to burn (in inventory)
    hasLogsInInventory() {
        const activityData = loadingManager.getData('activities')['firemaking'];
        if (!activityData || !activityData.firemakingTable) return false;
        
        const firemakingLevel = skills.getLevel('firemaking');
        
        for (const recipe of activityData.firemakingTable) {
            if (firemakingLevel >= recipe.requiredLevel && inventory.hasItem(recipe.logId, 1)) {
                return true;
            }
        }
        
        return false;
    }
    
    // Check if we need banking for a firemaking task
    needsBankingForTask(task) {
        if (!task || task.skill !== 'firemaking') return false;
        if (!task.isFiremakingTask) return false;
        
        // Check if we have the specific log for our task
        if (!inventory.hasItem(task.itemId, 1)) {
            console.log(`Need banking: no ${task.itemId} in inventory for firemaking task`);
            return true;
        }
        
        return false;
    }
    
    // Handle banking for firemaking tasks
    handleBanking(task) {
        // Deposit all first
        bank.depositAll();
        console.log('Deposited all items for firemaking');
        
        // Mark that we've banked for this task
        const taskId = task ? `${task.itemId}_${task.targetCount}_${task.nodeId}` : null;
        this.currentTaskId = taskId;
        this.hasBankedForTask = true;
        
        let withdrawnAny = false;
        
        // If we have a specific firemaking task, ONLY withdraw that log
        if (task && task.isFiremakingTask) {
            const taskLogId = task.itemId;
            const bankCount = bank.getItemCount(taskLogId);
            const needed = task.targetCount - (task.logsConsumed || 0);
            
            if (bankCount > 0 && needed > 0) {
                const toWithdraw = Math.min(28, Math.min(bankCount, needed));
                const withdrawn = bank.withdrawUpTo(taskLogId, toWithdraw);
                
                if (withdrawn > 0) {
                    inventory.addItem(taskLogId, withdrawn);
                    console.log(`Withdrew ${withdrawn} ${taskLogId} for firemaking task`);
                    withdrawnAny = true;
                }
            } else {
                console.log(`No ${taskLogId} in bank for firemaking task`);
            }
        }
        
        return withdrawnAny;
    }
    
    // Check if we can continue with this task
    canContinueTask(task) {
        if (!task || !task.isFiremakingTask) return true;
        
        // Check if we have enough logs remaining
        const currentLogs = (inventory.getItemCount(task.itemId) + bank.getItemCount(task.itemId));
        const remaining = task.targetCount - (task.logsConsumed || 0);
        
        if (currentLogs < remaining) {
            console.log(`Cannot continue firemaking task - need ${remaining} more ${task.itemId}, have ${currentLogs}`);
            // Reset banking flag when task becomes impossible
            this.hasBankedForTask = false;
            this.currentTaskId = null;
            this.clearBurningState();
            return false;
        }
        
        return true;
    }
    
    // Called when activity completes to potentially reset state
    onActivityComplete(activityData) {
        // Clear burning state when activity completes
        this.clearBurningState();
        
        // Check if task is complete
        if (window.ai && window.ai.currentTask && window.ai.currentTask.isFiremakingTask) {
            if (window.ai.currentTask.progress >= 1) {
                // Task complete, reset banking state
                console.log('Firemaking task complete, resetting banking state');
                this.hasBankedForTask = false;
                this.currentTaskId = null;
            } else {
                // Task not complete, check if we need to bank for more logs
                if (!inventory.hasItem(window.ai.currentTask.itemId, 1)) {
                    console.log('Firemaking task needs more logs, triggering AI re-evaluation');
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
    
    // Check if we have materials to work with
    hasMaterials() {
        return this.hasLogsInInventory();
    }
    
    // Called when activity is stopped (interrupted)
    onActivityStopped() {
        console.log('Firemaking activity was stopped, clearing state');
        this.clearBurningState();
    }
}
