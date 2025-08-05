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
        this.setSkillLevels();

        // Add items to bank
        this.populateBank();

        // Add some items to inventory for testing
        this.populateInventory();

        // Set up test goals
        this.setupTestGoals();

        console.log('Test scenario complete!');
    }

    setPlayerPosition() {
        // Start at East Varrock Mine instead of Lumbridge
        player.position.x = 4408;
        player.position.y = 1820;
        player.currentNode = 'east_varrock_mine';
        
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
        
        // Add 1000 of each item to bank
        for (const [itemId, itemData] of Object.entries(allItems)) {
            bank.deposit(itemId, 1000);
        }
        
        console.log(`Added 1000 of each item to bank (${Object.keys(allItems).length} items)`);
    }

    populateInventory() {
        // Add some common items to inventory for testing
        inventory.addItem('coins', 10000);

        inventory.addItem('raw_shrimps', 26);
        
        console.log('Added test items to inventory');
    }

    setupTestGoals() {
        // Clear existing goals
        ai.goals = [];
        ai.currentGoal = null;
        
        // Add some test goals
        ai.addGoal({
            type: 'skill_level',
            skill: 'fishing',
            targetLevel: 60,
            priority: 1
        });
        
        ai.addGoal({
            type: 'bank_items',
            itemId: 'iron_ore',
            targetCount: 500,
            priority: 2
        });
        
        ai.addGoal({
            type: 'skill_level',
            skill: 'woodcutting',
            targetLevel: 60,
            priority: 3
        });
        
        ai.addGoal({
            type: 'bank_items',
            itemId: 'willow_logs',
            targetCount: 250,
            priority: 4
        });
        
        console.log('Set up test goals');
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
}

// Create global instance
window.testScenario = new TestScenario();
