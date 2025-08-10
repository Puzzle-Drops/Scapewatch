class TaskManager {
    constructor() {
        this.tasks = [];
        this.maxTasks = 7; // Current + Next + 5 pool tasks
        this.completedTasks = []; // Track all completed tasks
        this.skillWeights = null; // For future weighted distribution
    }

    // Initialize with first set of tasks
    initialize() {
        if (this.tasks.length === 0) {
            this.generateNewTasks();
        }
    }

    // Generate a new batch of 7 tasks
    generateNewTasks() {
        this.tasks = [];
        const availableSkills = this.getAvailableSkills();
        
        if (availableSkills.length === 0) {
            console.error('No skills available to generate tasks');
            return;
        }

        let attempts = 0;
        const maxAttempts = 50; // Prevent infinite loops

        while (this.tasks.length < this.maxTasks && attempts < maxAttempts) {
            attempts++;
            
            // Pick a random skill
            const skill = availableSkills[Math.floor(Math.random() * availableSkills.length)];
            
            // Try to generate a task for this skill
            const task = skill.generateTask();
            
            if (task) {
                // Set initial progress tracking based on task type
                if (task.isCookingTask) {
                    // For cooking tasks, initialize the consumption counter
                    task.rawFoodConsumed = 0;
                    task.startingCount = 0; // We track consumption, not bank amount
                } else {
                    // For gathering tasks, DON'T set startingCount yet!
                    // It will be set when the task becomes active
                    task.startingCount = null; // Mark as not yet initialized
                }
                task.progress = 0;
                this.tasks.push(task);
                console.log(`Generated task: ${task.description}`);
            }
        }

        if (this.tasks.length < this.maxTasks) {
            console.warn(`Only generated ${this.tasks.length} tasks after ${attempts} attempts`);
        }

        // Notify UI to update
        if (window.ui) {
            window.ui.updateTasks();
        }

        // Notify AI that tasks have changed - it should re-evaluate what it's doing
        if (window.ai) {
            console.log('New tasks generated, notifying AI to re-evaluate');
            window.ai.currentTask = null;
            window.ai.decisionCooldown = 0;
        }
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

    // Update progress for ONLY the first incomplete task if it matches the given item
    updateProgressForItem(itemId) {
        // Get the current task (index 0)
        const currentTask = this.tasks[0];
        
        // Only update if the current task matches this item and is NOT a cooking task
        if (currentTask && !currentTask.isCookingTask && currentTask.itemId === itemId) {
            this.updateTaskProgress(currentTask);
        }
    }

    // Update all task progress (called periodically to sync)
    updateAllProgress() {
        // Only update the current task (index 0)
        const currentTask = this.tasks[0];
        
        if (!currentTask || currentTask.progress >= 1) {
            // Current task is complete, check if we need to promote next task
            if (currentTask && currentTask.progress >= 1) {
                this.promoteNextTask();
            }
            return;
        }
        
        if (currentTask.isCookingTask) {
            // Cooking tasks manage their own progress through the cooking skill
            // Just check if complete
            if (currentTask.progress >= 1) {
                this.completeTask(currentTask);
            }
        } else {
            // Initialize startingCount if this is the first time this task is active
            if (currentTask.startingCount === null) {
                currentTask.startingCount = this.getCurrentItemCount(currentTask.itemId);
                console.log(`Task "${currentTask.description}" now active, starting count: ${currentTask.startingCount}`);
            }
            
            // Update gathering task based on current counts
            const currentCount = this.getCurrentItemCount(currentTask.itemId);
            const itemsGained = currentCount - currentTask.startingCount;
            currentTask.progress = Math.min(itemsGained / currentTask.targetCount, 1);
            
            if (currentTask.progress >= 1) {
                this.completeTask(currentTask);
            }
        }
        
        // Update UI if needed
        if (window.ui) {
            window.ui.updateTasks();
        }
    }

    // Mark a task as complete and move to completed list
    completeTask(task) {
        console.log(`Task complete: ${task.description}`);
        task.progress = 1;
        task.completedAt = Date.now();
        
        // Add to completed tasks with a completion number
        this.completedTasks.push({
            ...task,
            completionNumber: this.completedTasks.length + 1
        });
        
        // Promote next task to current
        this.promoteNextTask();
    }

    // Move tasks up when current task completes
    promoteNextTask() {
        // Remove completed current task
        if (this.tasks[0] && this.tasks[0].progress >= 1) {
            this.tasks.shift();
        }
        
        // Generate a new task to fill the empty slot at the end
        const availableSkills = this.getAvailableSkills();
        if (availableSkills.length > 0) {
            let attempts = 0;
            let newTask = null;
            
            while (attempts < 20 && !newTask) {
                attempts++;
                const skill = availableSkills[Math.floor(Math.random() * availableSkills.length)];
                newTask = skill.generateTask();
            }
            
            if (newTask) {
                // Initialize based on task type
                if (newTask.isCookingTask) {
                    newTask.rawFoodConsumed = 0;
                    newTask.startingCount = 0;
                } else {
                    newTask.startingCount = null;
                }
                newTask.progress = 0;
                this.tasks.push(newTask);
                console.log(`Generated new pool task: ${newTask.description}`);
            }
        }
        
        // Update UI
        if (window.ui) {
            window.ui.updateTasks();
        }
        
        // Notify AI to check the new current task
        if (window.ai) {
            console.log('Tasks promoted, notifying AI to check new current task');
            window.ai.currentTask = null;
            window.ai.decisionCooldown = 0;
        }
    }

    // Reroll a specific task (only works for pool tasks, indices 2-6)
    rerollTask(index) {
        if (index < 2 || index >= this.tasks.length) {
            console.error('Can only reroll pool tasks (indices 2-6)');
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
            
            // Make sure it's different from the old task (different item or location)
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
                // Don't set startingCount yet - will be set when task becomes active
                newTask.startingCount = null;
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

    // Reorder pool tasks (indices 2-6)
    reorderPoolTasks(fromIndex, toIndex) {
        // Validate indices are in pool range
        if (fromIndex < 2 || fromIndex > 6 || toIndex < 2 || toIndex > 6) {
            console.error('Can only reorder pool tasks (indices 2-6)');
            return;
        }
        
        if (fromIndex === toIndex) return;
        
        // Move the task
        const [movedTask] = this.tasks.splice(fromIndex, 1);
        this.tasks.splice(toIndex, 0, movedTask);
        
        // Update UI
        if (window.ui) {
            window.ui.updateTasks();
        }
    }

    // Get the current task (always first incomplete)
    getFirstIncompleteTask() {
        return this.tasks[0] && this.tasks[0].progress < 1 ? this.tasks[0] : null;
    }

    // Get next incomplete task for AI (same as getFirstIncompleteTask)
    getNextTask() {
        return this.getFirstIncompleteTask();
    }

    // Check if a given task is the current task
    isCurrentTask(task) {
        return this.tasks[0] === task;
    }

    // Get all tasks
    getAllTasks() {
        return this.tasks;
    }

    // Get all completed tasks
    getCompletedTasks() {
        return this.completedTasks;
    }

    // Clear all tasks (for debugging)
    clearTasks() {
        this.tasks = [];
        if (window.ui) {
            window.ui.updateTasks();
        }
    }

    // Clear completed tasks history
    clearCompletedTasks() {
        this.completedTasks = [];
        if (window.ui) {
            window.ui.updateCompletedTasks();
        }
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
