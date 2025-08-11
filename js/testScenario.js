class TestScenario {
    constructor() {
        this.enabled = true; // Set to false to disable test scenario
    }

    run() {
        if (!this.enabled) {
            console.log('Test scenario disabled');
            return;
        }

        console.log('Running test scenario...');

        // Set player starting position
        //this.setPlayerPosition();

        // Set skill levels (each on its own line for easy modification)
        //this.setSkillLevels();

        // Add items to bank
        //this.populateBank();

        // Add some items to inventory for testing
        //this.populateInventory();

        // Set up specific test tasks
        this.setupTestTasks();

        // Add bait and feathers for fishing activities that need them
        bank.deposit('fishing_bait', 1000);
        bank.deposit('feather', 1000);

        console.log('Test scenario complete!');
    }

    setPlayerPosition() {
        // Start at Lumbridge Bank for easy access
        player.position.x = 4361;
        player.position.y = 1903;
        player.currentNode = 'lumbridge_bank';
        
        // Update camera to match
        if (window.map) {
            map.camera.x = player.position.x;
            map.camera.y = player.position.y;
        }
    }

    setSkillLevels() {
        // Each skill on its own line for easy modification
        this.setSkillLevel('attack', 50);
        this.setSkillLevel('strength', 50);
        this.setSkillLevel('defence', 50);
        this.setSkillLevel('hitpoints', 50);
        this.setSkillLevel('ranged', 50);
        this.setSkillLevel('magic', 50);
        this.setSkillLevel('prayer', 50);
        this.setSkillLevel('woodcutting', 50);
        this.setSkillLevel('mining', 50);
        this.setSkillLevel('fishing', 50);
        this.setSkillLevel('cooking', 50);
        this.setSkillLevel('crafting', 50);
        this.setSkillLevel('smithing', 50);
        this.setSkillLevel('agility', 50);
        this.setSkillLevel('thieving', 50);
        this.setSkillLevel('runecraft', 50);
        this.setSkillLevel('hunter', 50);
        this.setSkillLevel('farming', 50);
        this.setSkillLevel('slayer', 50);
        this.setSkillLevel('herblore', 50);
        this.setSkillLevel('fletching', 50);
        this.setSkillLevel('construction', 50);
        this.setSkillLevel('firemaking', 50);

        // Force UI update after setting all levels
        if (window.ui) {
            window.ui.updateSkillsList();
        }
    }

    setSkillLevel(skillId, level) {
        const targetXp = getXpForLevel(level);
        const skill = skills.skills[skillId];
        if (skill) {
            skill.xp = targetXp;
            skill.level = level;
            skill.xpForNextLevel = getXpForLevel(level + 1);
            console.log(`Set ${skillId} to level ${level}`);
        }
    }

    populateBank() {
        const allItems = loadingManager.getData('items');
        
        bank.deposit('coins', 9999000);
        
        // Add 1000 of each item to bank
        for (const [itemId, itemData] of Object.entries(allItems)) {
            bank.deposit(itemId, 1000);
        }
        
        console.log(`Added 1000 of each item to bank (${Object.keys(allItems).length} items)`);
    }

    populateInventory() {
        // Add some common items to inventory for testing
        inventory.addItem('coins', 5);
        inventory.addItem('raw_shrimps', 26);
        
        console.log('Added test items to inventory');
    }

    setupTestTasks() {
    // Clear existing tasks first
    if (window.taskManager) {
        taskManager.clearTasks();
        
        // Task 1: Complete 10 laps at Draynor agility (Current Task)
        const agilityTask = {
            skill: 'agility',
            itemId: 'agility_laps_draynor_rooftop',
            targetCount: 10,
            nodeId: 'draynor_rooftop',
            activityId: 'draynor_rooftop',
            description: '10 laps at Draynor Rooftop',
            startingCount: 0,
            progress: 0,
            isAgilityTask: true,
            lapsCompleted: 0
        };
        
        // Task 2: Fish 30 shrimp (Next Task)
        const fishingTask1 = {
            skill: 'fishing',
            itemId: 'raw_shrimps',
            targetCount: 30,
            nodeId: 'lumbridge_fishing',
            activityId: 'small_fishing_net',
            description: 'Catch 30 Raw shrimps at River Lum',
            startingCount: null, // Will be set when task becomes current
            progress: 0,
            isCookingTask: false
        };
        
        // Task 3: Cook 29 shrimp
        const cookingTask = {
            skill: 'cooking',
            itemId: 'raw_shrimps', // Raw item being consumed
            targetCount: 29,
            nodeId: 'lumbridge_kitchen',
            activityId: 'cook_food',
            description: 'Cook 29 Raw shrimps at Lumbridge Kitchen',
            startingCount: 0,
            progress: 0,
            isCookingTask: true,
            cookedItemId: 'shrimps',
            rawFoodConsumed: 0
        };
        
        // Task 4: Mine 20 tin ore
        const miningTask1 = {
            skill: 'mining',
            itemId: 'tin_ore',
            targetCount: 20,
            nodeId: 'east_lumbridge_mine',
            activityId: 'mine_copper_tin',
            description: 'Mine 20 Tin ore at East Lumbridge Mine',
            startingCount: null, // Will be set when task becomes current
            progress: 0,
            isCookingTask: false
        };
        
        // Task 5: Woodcut 28 logs
        const woodcuttingTask1 = {
            skill: 'woodcutting',
            itemId: 'logs',
            targetCount: 28,
            nodeId: 'lumbridge_trees',
            activityId: 'chop_tree',
            description: 'Chop 28 Logs at Lumbridge Trees',
            startingCount: null, // Will be set when task becomes current
            progress: 0,
            isCookingTask: false
        };
        
        // Task 6: Mine 20 copper ore
        const miningTask2 = {
            skill: 'mining',
            itemId: 'copper_ore',
            targetCount: 20,
            nodeId: 'west_lumbridge_mine',
            activityId: 'mine_copper_tin',
            description: 'Mine 20 Copper ore at West Lumbridge Mine',
            startingCount: null, // Will be set when task becomes current
            progress: 0,
            isCookingTask: false
        };
        
        // Task 7: Woodcut 28 logs (again)
        const woodcuttingTask2 = {
            skill: 'woodcutting',
            itemId: 'logs',
            targetCount: 28,
            nodeId: 'lumbridge_trees',
            activityId: 'chop_tree',
            description: 'Chop 28 Logs at Lumbridge Trees',
            startingCount: null, // Will be set when task becomes current
            progress: 0,
            isCookingTask: false
        };
        
        // Set up the task structure
        taskManager.currentTask = agilityTask;
        taskManager.nextTask = fishingTask1;
        taskManager.tasks = [cookingTask, miningTask1, woodcuttingTask1, miningTask2, woodcuttingTask2];
        
        console.log('Set up test tasks:');
        console.log('Current:', agilityTask.description);
        console.log('Next:', fishingTask1.description);
        taskManager.tasks.forEach((task, index) => {
            console.log(`Task ${index + 1}:`, task.description);
        });
        
        // Update UI to show the new tasks
        if (window.ui) {
            window.ui.updateTasks();
        }
        
        // Notify AI to start working on the current task
        if (window.ai) {
            window.ai.currentTask = null;
            window.ai.decisionCooldown = 0;
        }
    }
}

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

    // Utility methods that can be called from dev console
    giveAllItems(quantity = 100) {
        const allItems = loadingManager.getData('items');
        for (const itemId of Object.keys(allItems)) {
            bank.deposit(itemId, quantity);
        }
        console.log(`Added ${quantity} of each item to bank`);
    }

    maxAllSkills() {
        for (const skillId of Object.keys(skills.skills)) {
            this.setSkillLevel(skillId, 99);
        }
        console.log('Set all skills to level 99');
    }

    resetPlayer() {
        // Reset to default position
        player.position.x = 4395;
        player.position.y = 1882;
        player.currentNode = 'lumbridge_bank';
        player.stopActivity();
        player.path = [];
        player.pathIndex = 0;
        player.targetPosition = null;
        player.targetNode = null;
        
        console.log('Reset player to Lumbridge bank');
    }

    // Method to quickly set up fishing -> cooking test
    setupFishingCookingTest() {
        // Clear bank and inventory first
        inventory.clear();
        
        // Give player some raw shrimps to start cooking task testing
        bank.deposit('raw_shrimps', 100);
        
        // Give bait for other fishing activities
        bank.deposit('fishing_bait', 1000);
        bank.deposit('feather', 1000);
        
        // Set up the specific test tasks
        this.setupTestTasks();
        
        console.log('Set up fishing -> cooking test scenario');
    }

    // Method to test task completion
    completeCurrentTask() {
        if (window.taskManager && taskManager.currentTask) {
            // For gathering tasks, add items to complete
            if (!taskManager.currentTask.isCookingTask) {
                const needed = taskManager.currentTask.targetCount;
                bank.deposit(taskManager.currentTask.itemId, needed);
                taskManager.updateTaskProgress(taskManager.currentTask);
            } else {
                // For cooking tasks, set the consumption counter
                taskManager.currentTask.rawFoodConsumed = taskManager.currentTask.targetCount;
                taskManager.setTaskProgress(taskManager.currentTask, 1);
            }
            
            console.log('Completed current task:', taskManager.currentTask.description);
        }
    }
}

// Create global instance
window.testScenario = new TestScenario();
