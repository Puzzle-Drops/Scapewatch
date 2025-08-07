class CookingSkill extends BaseSkill {
    constructor() {
        super('cooking', 'Cooking');
        this.lastCookingXp = 0;
        this.currentRawItem = null;
    }
    
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
    
    generateItemGoals(currentLevel, priority) {
        const goals = [];
        const cookedFoods = [
            { itemId: 'meat', requiredLevel: 1, minCount: 50, maxCount: 150 },
            { itemId: 'shrimps', requiredLevel: 1, minCount: 50, maxCount: 150 },
            { itemId: 'sardine', requiredLevel: 1, minCount: 50, maxCount: 150 },
            { itemId: 'herring', requiredLevel: 5, minCount: 50, maxCount: 120 },
            { itemId: 'mackerel', requiredLevel: 10, minCount: 40, maxCount: 100 },
            { itemId: 'trout', requiredLevel: 15, minCount: 40, maxCount: 100 },
            { itemId: 'cod', requiredLevel: 18, minCount: 40, maxCount: 90 },
            { itemId: 'pike', requiredLevel: 20, minCount: 30, maxCount: 80 },
            { itemId: 'salmon', requiredLevel: 25, minCount: 30, maxCount: 70 },
            { itemId: 'tuna', requiredLevel: 30, minCount: 30, maxCount: 60 },
            { itemId: 'lobster', requiredLevel: 40, minCount: 20, maxCount: 50 },
            { itemId: 'bass', requiredLevel: 43, minCount: 20, maxCount: 40 },
            { itemId: 'swordfish', requiredLevel: 45, minCount: 20, maxCount: 40 },
            { itemId: 'shark', requiredLevel: 80, minCount: 10, maxCount: 30 }
        ];
        
        for (const food of cookedFoods) {
            if (currentLevel >= food.requiredLevel) {
                const currentCount = bank.getItemCount(food.itemId);
                const targetCount = currentCount + 
                    Math.round((food.minCount + Math.random() * (food.maxCount - food.minCount)) / 10) * 10;
                
                goals.push({
                    type: 'bank_items',
                    itemId: food.itemId,
                    targetCount: targetCount,
                    priority: priority + goals.length
                });
            }
        }
        
        return goals;
    }
    
    canPerformActivity(activityId) {
        const activityData = loadingManager.getData('activities')[activityId];
        if (!activityData || activityData.skill !== this.id) return false;
        
        // For cooking, we need raw food in inventory
        const level = skills.getLevel('cooking');
        const rawItem = this.findRawItemToCook(activityData.cookingTable, level);
        
        return rawItem !== null;
    }
    
    executeGoal(goal, ai) {
        if (goal.type === 'skill_level') {
            this.trainCooking(ai);
        } else if (goal.type === 'bank_items' && this.isCookedFood(goal.itemId)) {
            this.cookFood(ai, goal.itemId);
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
    
    cookFood(ai, targetItemId) {
        // Check if we have raw food in inventory
        if (this.hasRawFood()) {
            ai.doActivity('cook_food');
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
        ai.doActivity('cook_food');
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
