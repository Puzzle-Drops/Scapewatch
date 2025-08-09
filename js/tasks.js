class TaskManager {
    constructor() {
        this.tasks = []; // Always exactly 7 tasks
        this.completedTasks = []; // Stores completed tasks in order
        this.totalTasks = 7; // Always maintain 7 tasks
        this.skillWeights = null; // For future weighted distribution
    }

    // Initialize with first set of tasks
    initialize() {
        if (this.tasks.length === 0) {
            this.generateInitialTasks();
        }
    }

    // Generate initial 7 tasks
    generateInitialTasks() {
        this.tasks = [];
        const availableSkills = this.getAvailableSkills();
        
        if (availableSkills.length === 0) {
            console.error('No skills available to generate tasks');
            return;
        }

        let attempts = 0;
        const maxAttempts = 50;

        while (this.tasks.length < this.totalTasks && attempts < maxAttempts) {
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
                    // For the first task (active), set starting count
                    // For others, leave null until they become active
                    task.startingCount = this.tasks.length === 0 ? this.getCurrentItemCount(task.itemId) : null;
                }
                task.progress = 0;
                this.tasks.push(task);
                console.log(`Generated task: ${task.description}`);
            }
        }

        if (this.tasks.length < this.totalTasks) {
            console.warn(`Only generated ${this.tasks.length} tasks after ${attempts} attempts`);
        }

        // Notify UI to update
        if (window.ui) {
            window.ui.updateTasks();
        }
    }

    // Generate a single new task (called when task completes)
    generateSingleTask() {
        const availableSkills = this.getAvailableSkills();
        
        if (availableSkills.length === 0) {
            console.error('No skills available to generate task');
            return null;
        }

        let attempts = 0;
        const maxAttempts = 20;

        while (attempts < maxAttempts) {
            attempts++;
            
            // Pick a random skill
            const skill = availableSkills[Math.floor(Math.random() * availableSkills.length)];
            
            // Try to generate a task for this skill
            const task = skill.generateTask();
            
            if (task) {
                // Set initial progress tracking
                if (task.isCookingTask) {
                    task.rawFoodConsumed = 0;
                    task.startingCount = 0;
                } else {
                    // Don't set startingCount yet - will be set when it becomes active
                    task.startingCount = null;
                }
                task.progress = 0;
                console.log(`Generated new task: ${task.description}`);
                return task;
            }
        }

        console.error('Failed to generate new task');
        return null;
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

    // Complete the current active task
    completeCurrentTask() {
        if (this.tasks.length === 0) return;
        
        const completedTask = this.tasks[0];
        if (!completedTask) return;
        
        console.log(`Task complete: ${completedTask.description}`);
        
        // Mark with completion timestamp
        completedTask.completedAt = Date.now();
        completedTask.completionNumber = this.completedTasks.length + 1;
        
        // Add to completed tasks
        this.completedTasks.push(completedTask);
        
        // Shift all tasks up
        this.tasks.shift();
        
        // If the new active task (was position 1) hasn't been initialized, initialize it
        if (this.tasks.length > 0 && this.tasks[0].startingCount === null && !this.tasks[0].isCookingTask) {
            this.tasks[0].startingCount = this.getCurrentItemCount(this.tasks[0].itemId);
            console.log(`New active task "${this.tasks[0].description}", starting count: ${this.tasks[0].startingCount}`);
        }
        
        // Generate a new task to maintain 7 total
        const newTask = this.generateSingleTask();
        if (newTask) {
            this.tasks.push(newTask);
        }
        
        // Notify UI
        if (window.ui) {
            window.ui.updateTasks();
        }
        
        // Notify AI to switch to new task
        if (window.ai) {
            window.ai.currentTask = this.tasks.length > 0 ? this.tasks[0] : null;
            window.ai.decisionCooldown = 0;
        }
    }

    // Update progress for the active task
    updateActiveTaskProgress() {
        if (this.tasks.length === 0) return;
        
        const activeTask = this.tasks[0];
        
        if (activeTask.isCookingTask) {
            // Cooking progress is updated via updateCookingTaskProgress
            if (activeTask.progress >= 1) {
                this.completeCurrentTask();
            }
        } else {
            // Normal gathering task - track items gained
            const currentCount = this.getCurrentItemCount(activeTask.itemId);
            const itemsGained = currentCount - activeTask.startingCount;
            activeTask.progress = Math.min(itemsGained / activeTask.targetCount, 1);
            
            if (activeTask.progress >= 1) {
                this.completeCurrentTask();
            }
        }
        
        // Update UI
        if (window.ui) {
            window.ui.updateTasks();
        }
    }

    // Update cooking task progress (called by cooking skill)
    updateCookingTaskProgress(rawItemId) {
        if (this.tasks.length === 0) return;
        
        const activeTask = this.tasks[0];
        
        // Only update if active task is a cooking task for this raw item
        if (activeTask && activeTask.isCookingTask && activeTask.itemId === rawItemId) {
            // Increment the consumption counter
            activeTask.rawFoodConsumed = (activeTask.rawFoodConsumed || 0) + 1;
            
            // Calculate progress
            activeTask.progress = activeTask.rawFoodConsumed / activeTask.targetCount;
            
            console.log(`Cooking progress: ${activeTask.rawFoodConsumed}/${activeTask.targetCount}`);
            
            if (activeTask.progress >= 1) {
                this.completeCurrentTask();
            } else {
                // Just update UI if not complete
                if (window.ui) {
                    window.ui.updateTasks();
                }
            }
        }
    }

    // Update progress for items (called when items are gained)
    updateProgressForItem(itemId) {
        if (this.tasks.length === 0) return;
        
        const activeTask = this.tasks[0];
        
        // Only update if active task matches this item and is NOT a cooking task
        if (activeTask && !activeTask.isCookingTask && activeTask.itemId === itemId) {
            this.updateActiveTaskProgress();
        }
    }

    // Update all task progress (called periodically)
    updateAllProgress() {
        if (this.tasks.length === 0) return;
        
        // Only update the active task
        this.updateActiveTaskProgress();
    }

    // Reroll a task (only positions 2-6 can be rerolled)
    rerollTask(index) {
        if (index < 2 || index >= this.tasks.length) {
            console.error('Only tasks 3-7 can be rerolled');
            return;
        }

        const oldTask = this.tasks[index];
        console.log(`Rerolling task: ${oldTask.description}`);

        const availableSkills = this.getAvailableSkills();
        if (availableSkills.length === 0) {
            console.error('No skills available for reroll');
            return;
        }

        // Try to generate a new task
        let attempts = 0;
        let newTask = null;
        
        while (attempts < 20 && !newTask) {
            attempts++;
            
            // Pick a random skill
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

    // Reorder tasks (only positions 2-6 can be reordered among themselves)
    reorderTasks(fromIndex, toIndex) {
        // Validate that both indices are in the modifiable range
        if (fromIndex < 2 || fromIndex > 6 || toIndex < 2 || toIndex > 6) {
            console.error('Can only reorder tasks 3-7');
            return false;
        }
        
        if (fromIndex === toIndex) return false;
        
        // Remove task from old position
        const [movedTask] = this.tasks.splice(fromIndex, 1);
        
        // Insert at new position
        this.tasks.splice(toIndex, 0, movedTask);
        
        console.log(`Reordered task from position ${fromIndex + 1} to ${toIndex + 1}`);
        
        // Update UI
        if (window.ui) {
            window.ui.updateTasks();
        }
        
        return true;
    }

    // Get the active task (always position 0)
    getActiveTask() {
        return this.tasks[0] || null;
    }

    // Get the next task (position 1)
    getNextTask() {
        return this.tasks[1] || null;
    }

    // Get modifiable tasks (positions 2-6)
    getModifiableTasks() {
        return this.tasks.slice(2, 7);
    }

    // Get all tasks
    getAllTasks() {
        return this.tasks;
    }

    // Get completed tasks
    getCompletedTasks() {
        return this.completedTasks;
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

    // Clear completed tasks (for debugging or reset)
    clearCompletedTasks() {
        this.completedTasks = [];
        console.log('Cleared completed tasks history');
    }

    // Get stats about completed tasks
    getCompletedTaskStats() {
        const stats = {
            total: this.completedTasks.length,
            bySkill: {},
            totalTime: 0
        };
        
        for (const task of this.completedTasks) {
            // Count by skill
            if (!stats.bySkill[task.skill]) {
                stats.bySkill[task.skill] = 0;
            }
            stats.bySkill[task.skill]++;
        }
        
        return stats;
    }
}

// Create global instance
window.taskManager = new TaskManager();
