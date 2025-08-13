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
        bank.deposit('fishing_bait', 1000000);
        bank.deposit('feather', 1000000);
        
        // Add runecrafting supplies
        bank.deposit('rune_essence', 1000000);
        bank.deposit('small_pouch', 1);
        bank.deposit('medium_pouch', 1);
        bank.deposit('large_pouch', 1);
        bank.deposit('giant_pouch', 1);

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
            
            // Task 1: Runecraft 5 trips at test abyss crafting air runes (Current Task)
const runecraftingTask1 = {
    skill: 'runecraft',
    itemId: 'runecraft_trips_craft_air_runes',
    targetCount: 5,
    nodeId: 'test_abyss',
    activityId: 'craft_air_runes',
    description: 'Runecraft 5 trips of air runes at The Abyss',
    startingCount: 0,
    progress: 0,
    isRunecraftingTask: true,
    tripsCompleted: 0,
    runeType: 'air_rune'
};

// Task 2: Runecraft 5 trips at water altar crafting water runes (Next Task)
const runecraftingTask2 = {
    skill: 'runecraft',
    itemId: 'runecraft_trips_craft_water_runes',
    targetCount: 5,
    nodeId: 'water_altar',
    activityId: 'craft_water_runes',
    description: 'Runecraft 5 trips of water runes at Water Altar',
    startingCount: 0,
    progress: 0,
    isRunecraftingTask: true,
    tripsCompleted: 0,
    runeType: 'water_rune'
};
            
            // Task 3: Pickpocket Rogue 50 times
            const thievingTask = {
                skill: 'thieving',
                itemId: 'thieving_pickpocket_rogue',
                targetCount: 50,
                nodeId: 'test_thieving',
                activityId: 'pickpocket_rogue',
                description: 'Pickpocket Rogue 50 times at Test Thieving',
                startingCount: 0,
                progress: 0,
                isThievingTask: true,
                successfulThefts: 0
            };
            
            // Task 4: Complete 10 laps at Draynor agility
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
            
            // Task 5: Fish 30 shrimp
            const fishingTask = {
                skill: 'fishing',
                itemId: 'raw_shrimps',
                targetCount: 30,
                nodeId: 'lumbridge_fishing',
                activityId: 'small_fishing_net',
                description: 'Catch 30 Raw shrimps at River Lum',
                startingCount: null,
                progress: 0,
                isCookingTask: false
            };
            
            // Task 6: Cook 25 shrimp
            const cookingTask = {
                skill: 'cooking',
                itemId: 'raw_shrimps',
                targetCount: 25,
                nodeId: 'lumbridge_kitchen',
                activityId: 'cook_food',
                description: 'Cook 25 Raw shrimps at Lumbridge Kitchen',
                startingCount: 0,
                progress: 0,
                isCookingTask: true,
                cookedItemId: 'shrimps',
                rawFoodConsumed: 0
            };
            
            // Task 7: Woodcut 20 logs
            const woodcuttingTask = {
                skill: 'woodcutting',
                itemId: 'logs',
                targetCount: 20,
                nodeId: 'lumbridge_trees',
                activityId: 'chop_tree',
                description: 'Chop 20 Logs at Lumbridge Trees',
                startingCount: null,
                progress: 0,
                isCookingTask: false
            };
            
            // Set up the task structure
            taskManager.currentTask = runecraftingTask1;
            taskManager.nextTask = runecraftingTask2;
            taskManager.tasks = [thievingTask, agilityTask, fishingTask, cookingTask, woodcuttingTask];
            
            console.log('Set up test tasks:');
            console.log('Current:', runecraftingTask1.description);
            console.log('Next:', runecraftingTask2.description);
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
            if (!taskManager.currentTask.isCookingTask && !taskManager.currentTask.isRunecraftingTask) {
                const needed = taskManager.currentTask.targetCount;
                bank.deposit(taskManager.currentTask.itemId, needed);
                taskManager.updateTaskProgress(taskManager.currentTask);
            } else if (taskManager.currentTask.isCookingTask) {
                // For cooking tasks, set the consumption counter
                taskManager.currentTask.rawFoodConsumed = taskManager.currentTask.targetCount;
                taskManager.setTaskProgress(taskManager.currentTask, 1);
            } else if (taskManager.currentTask.isRunecraftingTask) {
                // For runecrafting tasks, set trips completed
                taskManager.currentTask.tripsCompleted = taskManager.currentTask.targetCount;
                taskManager.setTaskProgress(taskManager.currentTask, 1);
            }
            
            console.log('Completed current task:', taskManager.currentTask.description);
        }
    }
}

// Create global instance
window.testScenario = new TestScenario();
