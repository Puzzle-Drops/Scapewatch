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
                // Set initial progress tracking
                task.startingCount = this.getCurrentItemCount(task.itemId);
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

    // Update task progress
    updateTaskProgress(task) {
        const currentCount = this.getCurrentItemCount(task.itemId);
        const itemsGained = currentCount - task.startingCount;
        task.progress = Math.min(itemsGained / task.targetCount, 1);
        
        // Check if complete
        if (task.progress >= 1) {
            this.completeTask(task);
        }
    }

    // Update all task progress
    updateAllProgress() {
        let anyComplete = false;
        
        for (const task of this.tasks) {
            const wasComplete = task.progress >= 1;
            this.updateTaskProgress(task);
            
            if (!wasComplete && task.progress >= 1) {
                anyComplete = true;
            }
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

    // Reroll a specific task
    rerollTask(index) {
        if (index < 0 || index >= this.tasks.length) {
            console.error('Invalid task index');
            return;
        }

        const oldTask = this.tasks[index];
        console.log(`Rerolling task: ${oldTask.description}`);

        // Get the skill that generated this task
        const skill = window.skillRegistry.getSkill(oldTask.skill);
        if (!skill || typeof skill.generateTask !== 'function') {
            console.error(`Cannot reroll task - skill ${oldTask.skill} not found`);
            return;
        }

        // Try to generate a new task
        let attempts = 0;
        let newTask = null;
        
        while (attempts < 10 && !newTask) {
            attempts++;
            newTask = skill.generateTask();
            
            // Make sure it's different from the old task
            if (newTask && newTask.itemId === oldTask.itemId && 
                newTask.nodeId === oldTask.nodeId) {
                newTask = null; // Try again
            }
        }

        if (newTask) {
            newTask.startingCount = this.getCurrentItemCount(newTask.itemId);
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

    // Get next incomplete task for AI
    getNextTask() {
        for (const task of this.tasks) {
            if (task.progress < 1) {
                return task;
            }
        }
        return null;
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
