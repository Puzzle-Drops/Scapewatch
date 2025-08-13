class TaskManager {
    constructor() {
        this.currentTask = null;
        this.nextTask = null;
        this.tasks = []; // The 5 rerollable tasks
        this.maxTasks = 5;
        this.completedTasks = []; // Track completed tasks
        this.skillWeights = null; // For future weighted distribution
    }

    // Initialize with first set of tasks
    initialize() {
        if (!this.currentTask && !this.nextTask && this.tasks.length === 0) {
            this.generateInitialTasks();
        }
    }

    // Generate initial set of tasks (current, next, and 5 regular)
    generateInitialTasks() {
        const allTasks = this.generateMultipleTasks(7); // Generate 7 tasks total
        
        if (allTasks.length > 0) {
            this.currentTask = allTasks[0];
            // Initialize startingCount for current task if it's a gathering task
            if (this.currentTask && !this.currentTask.isCookingTask) {
                this.currentTask.startingCount = this.getCurrentItemCount(this.currentTask.itemId);
            }
        }
        
        if (allTasks.length > 1) {
            this.nextTask = allTasks[1];
        }
        
        // Rest go to regular tasks
        this.tasks = allTasks.slice(2, 7); // Take up to 5 remaining tasks
        
        // Notify UI to update
        if (window.ui) {
            window.ui.updateTasks();
        }
        
        // Notify AI about the new current task
        if (window.ai) {
            window.ai.currentTask = null;
            window.ai.decisionCooldown = 0;
        }
    }

    // Generate multiple tasks at once
    generateMultipleTasks(count) {
        const generatedTasks = [];
        const availableSkills = this.getAvailableSkills();
        
        if (availableSkills.length === 0) {
            console.error('No skills available to generate tasks');
            return generatedTasks;
        }

        let attempts = 0;
        const maxAttempts = count * 10; // Prevent infinite loops

        while (generatedTasks.length < count && attempts < maxAttempts) {
            attempts++;
            
            // Pick a random skill
            const skill = availableSkills[Math.floor(Math.random() * availableSkills.length)];
            
            // Try to generate a task for this skill
            const task = skill.generateTask();
            
            if (task) {
                // Set initial progress tracking based on task type
                if (task.isCookingTask) {
                    task.rawFoodConsumed = 0;
                    task.startingCount = 0;
                } else {
                    task.startingCount = null; // Will be set when task becomes current
                }
                task.progress = 0;
                generatedTasks.push(task);
                console.log(`Generated task: ${task.description}`);
            }
        }

        if (generatedTasks.length < count) {
            console.warn(`Only generated ${generatedTasks.length} tasks after ${attempts} attempts`);
        }

        return generatedTasks;
    }

    // Get all registered skills that can generate tasks
    getAvailableSkills() {
        if (!window.skillRegistry || !window.skillRegistry.initialized) {
            return [];
        }
        
        return window.skillRegistry.getAllSkills().filter(skill => 
            typeof skill.generateTask === 'function'
        );
    }

    // Get current count of an item (inventory + bank)
    getCurrentItemCount(itemId) {
        let count = 0;
        
        if (window.inventory) {
            count += inventory.getItemCount(itemId);
        }
        
        if (window.bank) {
            count += bank.getItemCount(itemId);
        }
        
        return count;
    }

    // Generic method to set task progress directly
    setTaskProgress(task, progress) {
        task.progress = Math.min(Math.max(0, progress), 1);
        
        // Check if complete
        if (task.progress >= 1) {
            this.completeTask(task);
        }
        
        // Update UI
        if (window.ui) {
            window.ui.updateTasks();
        }
    }

    // Update task progress for a specific task (for gathering tasks)
    updateTaskProgress(task) {
        // Cooking tasks should not use this method - they update via setTaskProgress
        if (task.isCookingTask) {
            return;
        }
        
        // Normal gathering task - track items gained
        const currentCount = this.getCurrentItemCount(task.itemId);
        const itemsGained = currentCount - task.startingCount;
        const progress = itemsGained / task.targetCount;
        
        this.setTaskProgress(task, progress);
    }

    // Update progress for the current task if it matches the given item
    updateProgressForItem(itemId) {
        // Only update gathering tasks - processing tasks manage their own progress
        if (this.currentTask && 
            !this.currentTask.isCookingTask && 
            !this.currentTask.isFiremakingTask && 
            !this.currentTask.isAgilityTask && 
            this.currentTask.itemId === itemId) {
            this.updateTaskProgress(this.currentTask);
        }
    }

    // Update all task progress (called periodically to sync)
    updateAllProgress() {
        // Only update the current task
        if (this.currentTask && this.currentTask.progress < 1) {
            // Check if this task manages its own progress (processing skills)
            if (this.currentTask.isCookingTask || 
                this.currentTask.isFiremakingTask || 
                this.currentTask.isAgilityTask ||
                this.currentTask.isThievingTask ||
                this.currentTask.isRunecraftingTask) {
                // These tasks manage their own progress through their skills
                // Just check if complete
                if (this.currentTask.progress >= 1) {
                    this.completeTask(this.currentTask);
                }
            } else {
                // Gathering tasks - calculate progress based on inventory/bank
                // Initialize startingCount if this is the first time
                if (this.currentTask.startingCount === null) {
                    this.currentTask.startingCount = this.getCurrentItemCount(this.currentTask.itemId);
                    console.log(`Task "${this.currentTask.description}" now active, starting count: ${this.currentTask.startingCount}`);
                }
                
                // Update gathering task based on current counts
                const currentCount = this.getCurrentItemCount(this.currentTask.itemId);
                const itemsGained = currentCount - this.currentTask.startingCount;
                this.currentTask.progress = Math.min(itemsGained / this.currentTask.targetCount, 1);
                
                if (this.currentTask.progress >= 1) {
                    this.completeTask(this.currentTask);
                }
            }
        }
    }

    // Mark a task as complete and move to completed list
    completeTask(task) {
        console.log(`Task complete: ${task.description}`);
        task.progress = 1;
        task.completedAt = Date.now();
        
        // Add to completed tasks
        this.completedTasks.push(task);
        
        // If this was the current task, promote next task
        if (task === this.currentTask) {
            this.promoteNextTask();
        }
    }

    // Skip the current task when it's impossible
    skipCurrentTask() {
        if (!this.currentTask) return;
        
        console.log(`Skipping impossible task: ${this.currentTask.description}`);
        
        // Mark as skipped (not completed)
        this.currentTask.progress = -1; // -1 indicates skipped
        this.currentTask.skippedAt = Date.now();
        
        // Could track skipped tasks if desired
        // this.skippedTasks.push(this.currentTask);
        
        // Promote the next task (same as when completing a task)
        this.promoteNextTask();
    }

    // Move next task to current, and first regular task to next
    promoteNextTask() {
        this.currentTask = this.nextTask;
        
        // Initialize starting count for new current task if it's a gathering task
        if (this.currentTask && !this.currentTask.isCookingTask && this.currentTask.startingCount === null) {
            this.currentTask.startingCount = this.getCurrentItemCount(this.currentTask.itemId);
            console.log(`New current task "${this.currentTask.description}" starting count: ${this.currentTask.startingCount}`);
        }
        
        // Move first regular task to next
        if (this.tasks.length > 0) {
            this.nextTask = this.tasks.shift();
        } else {
            this.nextTask = null;
        }
        
        // Generate a new regular task to fill the gap
        const newTasks = this.generateMultipleTasks(1);
        if (newTasks.length > 0) {
            this.tasks.push(newTasks[0]);
        }
        
        // Update UI
        if (window.ui) {
            window.ui.updateTasks();
        }
        
        // Notify AI to re-evaluate
        if (window.ai) {
            console.log('Current task changed, notifying AI to re-evaluate');
            window.ai.currentTask = null;
            window.ai.decisionCooldown = 0;
        }
    }

    // Reroll a specific regular task (index 0-4)
    rerollTask(index) {
        if (index < 0 || index >= this.tasks.length) {
            console.error('Invalid task index');
            return;
        }

        const oldTask = this.tasks[index];
        console.log(`Rerolling task: ${oldTask.description}`);

        const availableSkills = this.getAvailableSkills();
        if (availableSkills.length === 0) {
            console.error('No skills available for reroll');
            return;
        }

        // Try to generate a new task from a random skill
        let attempts = 0;
        let newTask = null;
        
        while (attempts < 20 && !newTask) {
            attempts++;
            
            // Pick a random skill (could be same or different)
            const skill = availableSkills[Math.floor(Math.random() * availableSkills.length)];
            newTask = skill.generateTask();
            
            // Make sure it's different from the old task
            if (newTask && newTask.itemId === oldTask.itemId && 
                newTask.nodeId === oldTask.nodeId && 
                newTask.targetCount === oldTask.targetCount) {
                newTask = null; // Try again
            }
        }

        if (newTask) {
            // Initialize based on task type
            if (newTask.isCookingTask) {
                newTask.rawFoodConsumed = 0;
                newTask.startingCount = 0;
            } else {
                newTask.startingCount = null; // Will be set when task becomes current
            }
            newTask.progress = 0;
            this.tasks[index] = newTask;
            console.log(`New task: ${newTask.description}`);
            
            // Update UI
            if (window.ui) {
                window.ui.updateTasks();
            }
        } else {
            console.error('Failed to generate replacement task');
        }
    }

    // Get the first incomplete task (for AI)
    getFirstIncompleteTask() {
        // Always return current task if it's incomplete
        if (this.currentTask && this.currentTask.progress < 1) {
            return this.currentTask;
        }
        return null;
    }

    // Get all active tasks (current, next, and regular tasks)
    getAllTasks() {
        const allTasks = [];
        
        if (this.currentTask) allTasks.push(this.currentTask);
        if (this.nextTask) allTasks.push(this.nextTask);
        allTasks.push(...this.tasks);
        
        return allTasks;
    }

    // Get completed tasks
    getCompletedTasks() {
        return this.completedTasks;
    }

    // Clear all tasks (for debugging)
    clearTasks() {
        this.currentTask = null;
        this.nextTask = null;
        this.tasks = [];
        // Don't clear completed tasks
        
        if (window.ui) {
            window.ui.updateTasks();
        }
    }

    // Generate new batch of tasks
    generateNewTasks() {
        this.generateInitialTasks();
    }

    // Check if a task is valid/possible
    isTaskPossible(task) {
        // Check if node exists and is walkable
        const node = window.nodes ? nodes.getNode(task.nodeId) : null;
        if (!node) {
            console.error(`Task impossible - node ${task.nodeId} not found`);
            return false;
        }

        // Check if node is accessible
        if (window.collision && window.collision.initialized) {
            if (!collision.isWalkable(node.position.x, node.position.y)) {
                console.error(`Task impossible - node ${task.nodeId} not walkable`);
                return false;
            }
        }

        // Check if activity exists at node
        if (!node.activities || !node.activities.includes(task.activityId)) {
            console.error(`Task impossible - activity ${task.activityId} not at node ${task.nodeId}`);
            return false;
        }

        // For cooking tasks, check if we still have enough raw food
        if (task.isCookingTask) {
            const currentRawFood = this.getCurrentItemCount(task.itemId);
            const remaining = task.targetCount - (task.rawFoodConsumed || 0);
            
            if (currentRawFood < remaining) {
                console.error(`Cooking task impossible - need ${remaining} ${task.itemId}, have ${currentRawFood}`);
                return false;
            }
        }

        // Check level requirement
        const activityData = loadingManager.getData('activities')[task.activityId];
        if (activityData) {
            const requiredLevel = activityData.requiredLevel || 1;
            const currentLevel = window.skills ? skills.getLevel(task.skill) : 1;
            
            if (currentLevel < requiredLevel) {
                console.error(`Task impossible - need level ${requiredLevel}, have ${currentLevel}`);
                return false;
            }
        }

        return true;
    }
}

// Create global instance
window.taskManager = new TaskManager();
