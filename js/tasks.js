class TaskManager {
    constructor() {
        this.tasks = [];
        this.maxTasks = 5;
        this.skillWeights = null; // For future weighted distribution
    }

    // Initialize with first set of tasks
    initialize() {
        if (this.tasks.length === 0) {
            this.generateNewTasks();
        }
    }

    // Generate a new batch of 5 tasks
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
                    // For gathering tasks, track items in bank/inventory
                    task.startingCount = this.getCurrentItemCount(task.itemId);
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
        
        // Check if all tasks are complete
        if (this.areAllTasksComplete()) {
            console.log('All tasks complete! Generating new batch...');
            this.generateNewTasks();
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
        // Get the first incomplete task overall
        const currentTask = this.getFirstIncompleteTask();
        
        // Only update if the current task matches this item and is NOT a cooking task
        if (currentTask && !currentTask.isCookingTask && currentTask.itemId === itemId) {
            this.updateTaskProgress(currentTask);
        }
    }

    // Update all task progress (called periodically to sync)
updateAllProgress() {
    let anyComplete = false;
    
    // Only update the FIRST incomplete task
    const firstIncomplete = this.getFirstIncompleteTask();
    
    for (const task of this.tasks) {
        const wasComplete = task.progress >= 1;
        
        // Skip if this task is already complete
        if (wasComplete) continue;
        
        // Only update progress for the FIRST incomplete task
        if (task === firstIncomplete) {
            if (task.isCookingTask) {
                // Cooking tasks manage their own progress through the cooking skill
                // Just check if complete
                if (task.progress >= 1) {
                    anyComplete = true;
                }
            } else {
                // Update gathering task based on current counts
                const currentCount = this.getCurrentItemCount(task.itemId);
                const itemsGained = currentCount - task.startingCount;
                task.progress = Math.min(itemsGained / task.targetCount, 1);
                
                if (task.progress >= 1) {
                    anyComplete = true;
                    this.completeTask(task);
                }
            }
        }
        // For other incomplete tasks, keep their progress as-is (don't update)
    }
    
    // Check if all tasks are complete
    if (this.areAllTasksComplete()) {
        console.log('All tasks complete! Generating new batch...');
        this.generateNewTasks();
    } else if (anyComplete && window.ui) {
        window.ui.updateTasks();
    }
}

    // Mark a task as complete
    completeTask(task) {
        console.log(`Task complete: ${task.description}`);
        task.progress = 1;
    }

    // Check if all tasks are complete
    areAllTasksComplete() {
        return this.tasks.length > 0 && this.tasks.every(task => task.progress >= 1);
    }

    // Reroll a specific task - now picks a random skill
    rerollTask(index) {
        if (index < 0 || index >= this.tasks.length) {
            console.error('Invalid task index');
            return;
        }

        const oldTask = this.tasks[index];
        console.log(`Rerolling task: ${oldTask.description}`);

        // Check if this was the current task BEFORE rerolling
// Also check if it was the AI's current task (they should be the same, but let's be explicit)
const wasCurrentTask = (oldTask === this.getFirstIncompleteTask());
const wasAICurrentTask = window.ai && (oldTask === window.ai.currentTask);

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
                newTask.startingCount = this.getCurrentItemCount(newTask.itemId);
            }
            newTask.progress = 0;
            this.tasks[index] = newTask;
            console.log(`New task: ${newTask.description}`);
            
            // Update UI
            if (window.ui) {
                window.ui.updateTasks();
            }
            
            // If this was the current task being worked on, notify AI to re-evaluate
if ((wasCurrentTask || wasAICurrentTask) && window.ai) {
    console.log('Current task was rerolled, notifying AI to re-evaluate');
    window.ai.currentTask = null;
    window.ai.decisionCooldown = 0;
}
        } else {
            console.error('Failed to generate replacement task');
        }
    }

    // Get next incomplete task for AI (always the first incomplete one)
    getNextTask() {
        for (const task of this.tasks) {
            if (task.progress < 1) {
                return task;
            }
        }
        return null;
    }

    // Get the first incomplete task (same as getNextTask but more explicit)
    getFirstIncompleteTask() {
        return this.getNextTask();
    }

    // Check if a given task is the current task (first incomplete)
    isCurrentTask(task) {
        const current = this.getFirstIncompleteTask();
        return current === task;
    }

    // Get all tasks
    getAllTasks() {
        return this.tasks;
    }

    // Clear all tasks (for debugging)
    clearTasks() {
        this.tasks = [];
        if (window.ui) {
            window.ui.updateTasks();
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
