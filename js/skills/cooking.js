class CookingSkill extends BaseSkill {
    constructor() {
        super('cooking', 'Cooking');
        this.lastCookingXp = 0;
        this.currentRawItem = null;
    }
    
    // ==================== GOAL GENERATION OVERRIDE ====================
    
    createGoalForActivity(node, activity, priority) {
        // For cooking, pick a specific food to cook
        const targetFood = this.pickTargetFood(activity);
        if (!targetFood) {
            return super.createGoalForActivity(node, activity, priority);
        }
        
        const targetCount = this.determineTargetCount(targetFood.cookedItemId);
        const itemData = loadingManager.getData('items')[targetFood.cookedItemId];
        
        return {
            type: 'skill_activity',
            skill: this.id,
            nodeId: node.id,
            activityId: activity.id,
            targetItem: targetFood.cookedItemId,
            targetCount: targetCount,
            priority: priority,
            description: `Cook ${targetCount} ${itemData.name} at ${node.name}`
        };
    }
    
    pickTargetFood(activity) {
        if (!activity.cookingTable) return null;
        
        const level = skills.getLevel(this.id);
        const availableRecipes = activity.cookingTable.filter(r => 
            level >= r.requiredLevel
        );
        
        if (availableRecipes.length === 0) return null;
        
        // Pick based on what raw food we have in bank
        // For now, just pick a random available recipe
        return availableRecipes[Math.floor(Math.random() * availableRecipes.length)];
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
    
    // ==================== BANKING DECISIONS ====================
    
    needsBanking(goal) {
        // Cooking doesn't need banking if we have raw food to cook
        if (this.hasRawFood()) {
            console.log('Have raw food to cook, no banking needed');
            return false;
        }
        
        // If inventory is full and no raw food, we need to bank
        if (inventory.isFull()) {
            console.log('Inventory full with no raw food, banking needed');
            return true;
        }
        
        return false;
    }
    
    canContinueWithInventory(goal) {
        // Cooking can continue as long as there's raw food
        return this.hasRawFood();
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
    
    calculateXpRate(activityData, level) {
        const avgDuration = 2400;
        const actionsPerHour = 3600000 / avgDuration;
        
        // Calculate average XP per action
        const expectedXp = this.getExpectedXpPerAction(activityData, level);
        
        return actionsPerHour * expectedXp;
    }
    
    getExpectedXpPerAction(activityData, level) {
        // Calculate average XP/action for cooking
        const availableRecipes = activityData.cookingTable
            .filter(recipe => level >= recipe.requiredLevel);
        
        if (availableRecipes.length === 0) return 0;
        
        // Use the lowest level recipe as that's what we'd cook first
        const recipe = availableRecipes[0];
        const successChance = this.getChance(recipe, level);
        return recipe.xpPerAction * successChance;
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
    
    // ==================== AI EXECUTION ====================
    
    executeGoal(goal, ai) {
        if (goal.type === 'skill_level') {
            this.trainCooking(ai);
        } else if (goal.type === 'skill_activity') {
            // Check if we have raw food for this specific cooked food
            if (goal.targetItem && this.isCookedFood(goal.targetItem)) {
                this.cookSpecificFood(ai, goal);
            } else {
                // Let AI handle the activity goal directly
                ai.executeActivityGoal(goal);
            }
        } else {
            // Not a cooking goal, use default
            super.executeGoal(goal, ai);
        }
    }
    
    trainCooking(ai) {
        // Check if we have raw food in inventory
        if (this.hasRawFood()) {
            ai.doActivity('cook_food');
            return;
        }
        
        // No raw food, go to bank
        this.goToBankForCooking(ai);
    }
    
    cookSpecificFood(ai, goal) {
        // Check if we have raw food in inventory
        if (this.hasRawFood()) {
            // Navigate to the cooking node if needed
            if (player.currentNode !== goal.nodeId) {
                player.moveTo(goal.nodeId);
                return;
            }
            ai.doActivity(goal.activityId);
            return;
        }
        
        // No raw food, check bank
        if (this.hasRawFoodInBank()) {
            this.goToBankForCooking(ai);
            return;
        }
        
        // No raw food at all
        console.log('No raw food available for cooking');
        ai.skipCurrentGoal('cooking goal - no raw food available');
    }
    
    hasRawFood() {
        const activityData = loadingManager.getData('activities')['cook_food'];
        if (!activityData || !activityData.cookingTable) return false;
        
        const cookingLevel = skills.getLevel('cooking');
        
        for (const recipe of activityData.cookingTable) {
            if (cookingLevel >= recipe.requiredLevel && inventory.hasItem(recipe.rawItemId, 1)) {
                return true;
            }
        }
        
        return false;
    }
    
    hasRawFoodInBank() {
        const activityData = loadingManager.getData('activities')['cook_food'];
        if (!activityData || !activityData.cookingTable) return false;
        
        const cookingLevel = skills.getLevel('cooking');
        
        for (const recipe of activityData.cookingTable) {
            if (cookingLevel >= recipe.requiredLevel && bank.getItemCount(recipe.rawItemId) > 0) {
                return true;
            }
        }
        
        return false;
    }
    
    goToBankForCooking(ai) {
        const currentNode = nodes.getNode(player.currentNode);
        if (currentNode && currentNode.type === 'bank') {
            this.handleBanking(ai, ai.currentGoal);
        } else {
            const nearestBank = nodes.getNearestBank(player.position);
            if (nearestBank) {
                console.log(`Moving to ${nearestBank.name} to get raw food for cooking`);
                player.moveTo(nearestBank.id);
            }
        }
    }
    
    // ==================== BANKING ====================
    
    handleBanking(ai, goal) {
        // Deposit all first
        bank.depositAll();
        console.log('Deposited all items for cooking');
        
        // Withdraw raw food items (prioritize by level requirement)
        const activityData = loadingManager.getData('activities')['cook_food'];
        const cookingLevel = skills.getLevel('cooking');
        
        // Sort recipes by required level (lowest first)
        const availableRecipes = activityData.cookingTable
            .filter(recipe => cookingLevel >= recipe.requiredLevel)
            .sort((a, b) => a.requiredLevel - b.requiredLevel);
        
        let withdrawnAny = false;
        let totalWithdrawn = 0;
        
        for (const recipe of availableRecipes) {
            const bankCount = bank.getItemCount(recipe.rawItemId);
            if (bankCount > 0) {
                const toWithdraw = Math.min(28 - totalWithdrawn, bankCount);
                const withdrawn = bank.withdrawUpTo(recipe.rawItemId, toWithdraw);
                
                if (withdrawn > 0) {
                    inventory.addItem(recipe.rawItemId, withdrawn);
                    console.log(`Withdrew ${withdrawn} ${recipe.rawItemId}`);
                    withdrawnAny = true;
                    totalWithdrawn += withdrawn;
                    
                    if (totalWithdrawn >= 28) break;
                }
            }
        }
        
        if (!withdrawnAny) {
            console.log('No raw food to withdraw for cooking');
            ai.skipCurrentGoal('cooking goal - no raw food in bank');
            return;
        }
        
        // Update UI
        ui.updateSkillsList();
        
        // Now go cook
        ai.clearCooldown();
        if (goal && goal.type === 'skill_activity') {
            ai.executeGoal(goal);
        } else {
            ai.doActivity('cook_food');
        }
    }
    
    isCookedFood(itemId) {
        const cookedFoods = ['meat', 'shrimps', 'anchovies', 'sardine', 'herring', 
                           'mackerel', 'trout', 'cod', 'pike', 'salmon', 
                           'tuna', 'lobster', 'bass', 'swordfish', 'shark'];
        return cookedFoods.includes(itemId);
    }
    
    shouldBankItem(itemId) {
        // Don't bank burnt food
        return itemId !== 'burnt_food';
    }
}
