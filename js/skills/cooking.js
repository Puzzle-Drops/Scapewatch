class CookingSkill extends BaseSkill {
    constructor() {
        super('cooking', 'Cooking');
        this.lastCookingXp = 0;
        this.currentRawItem = null;
    }
    
    // ==================== TASK GENERATION OVERRIDES ====================
    
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
    
    // Override generateTask to check if raw materials exist
    generateTask() {
        // First check if we can actually cook anything
        if (!this.hasAccessToRawFood()) {
            console.log('No raw food available for cooking tasks');
            return null;
        }
        
        return super.generateTask();
    }
    
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
    
    // ==================== CORE BEHAVIOR ====================
    
    getDuration(baseDuration, level, activityData) {
        return 2400; // Cooking is always 2400ms
    }
    
    beforeActivityStart(activityData) {
        // Find what raw item we have in inventory
        const rawItem = this.findRawItemToCook(activityData.cookingTable, skills.getLevel('cooking'));
        
        if (!rawItem) {
            console.log('No raw items to cook');
            return false;
        }
        
        // Store for processing
        this.currentRawItem = rawItem;
        
        // Consume the raw item
        inventory.removeItem(rawItem.rawItemId, 1);
        
        return true;
    }
    
    processRewards(activityData, level) {
        if (!this.currentRawItem) {
            this.lastCookingXp = 0;
            return [];
        }
        
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
}
