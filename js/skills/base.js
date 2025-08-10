class BaseSkill {
    constructor(id, name) {
        this.id = id;
        this.name = name;
        this.requiresBankingBeforeTask = false; // Default: most skills don't need to bank first
        this.isProcessingSkill = false; // Default: gathering skills are not processing skills
    }
    
    // ==================== PROCESSING SKILL INTERFACE ====================
    // These methods provide a generic interface for processing skills
    // (cooking, smithing, fletching, herblore, crafting, etc.)
    
    // Check if we have the specific materials needed for the current task
    hasMaterialsForCurrentTask() {
        // Default implementation for gathering skills
        return true;
    }
    
    // Get information about what materials are needed for the current task
    getMaterialsNeededForTask(task) {
        // Default: no materials needed (gathering skills)
        return null;
    }
    
    // ==================== TASK GENERATION ====================
    
    generateTask() {
        // Get all possible items this skill can produce at current level
        const possibleItems = this.getPossibleItems();
        if (possibleItems.length === 0) {
            console.log(`No items available for ${this.name} at current level`);
            return null;
        }
        
        // Select an item using weighted distribution
        const selectedItem = this.selectWeightedItem(possibleItems);
        if (!selectedItem) {
            console.log(`Failed to select item for ${this.name}`);
            return null;
        }
        
        // Find activities that produce this item
        const activities = this.findActivitiesForItem(selectedItem.itemId);
        if (activities.length === 0) {
            console.log(`No activities found for item ${selectedItem.itemId}`);
            return null;
        }
        
        // Find viable nodes for these activities
        const viableNodes = this.findViableNodes(activities);
        if (viableNodes.length === 0) {
            console.log(`No viable nodes found for ${selectedItem.itemId}`);
            return null;
        }
        
        // Randomly select a node and its activity
        const selected = viableNodes[Math.floor(Math.random() * viableNodes.length)];
        
        // Determine target count
        const targetCount = this.determineTargetCount(selectedItem.itemId);
        
        // Create the task
        const itemData = loadingManager.getData('items')[selectedItem.itemId];
        const nodeData = nodes.getNode(selected.nodeId);
        
        return {
            skill: this.id,
            itemId: selectedItem.itemId,
            targetCount: targetCount,
            nodeId: selected.nodeId,
            activityId: selected.activityId,
            description: `${this.getTaskVerb()} ${targetCount} ${itemData.name} at ${nodeData.name}`,
            startingCount: 0,
            progress: 0
        };
    }
    
    // Get verb for task description (override in subclasses)
    getTaskVerb() {
        return 'Gather';
    }
    
    // Get all items this skill can produce at current level
    getPossibleItems() {
        const items = [];
        const activities = loadingManager.getData('activities');
        const currentLevel = skills.getLevel(this.id);
        
        for (const [activityId, activity] of Object.entries(activities)) {
            if (activity.skill !== this.id) continue;
            
            const requiredLevel = activity.requiredLevel || 1;
            if (currentLevel < requiredLevel) continue;
            
            // Get items from this activity
            const activityItems = this.getItemsFromActivity(activity);
            for (const item of activityItems) {
                // IMPORTANT: Check if we meet the item's specific level requirement
                if (item.requiredLevel && currentLevel < item.requiredLevel) {
                    continue; // Skip items we don't have the level for
                }
                
                // Don't add duplicates
                if (!items.some(i => i.itemId === item.itemId)) {
                    items.push({
                        itemId: item.itemId,
                        requiredLevel: item.requiredLevel || requiredLevel
                    });
                }
            }
        }
        
        return items;
    }
    
    // Extract items from an activity (handles different structures)
    getItemsFromActivity(activity) {
        const items = [];
        
        // Standard rewards
        if (activity.rewards) {
            for (const reward of activity.rewards) {
                if (reward.itemId && !this.isIgnoredItem(reward.itemId)) {
                    items.push({
                        itemId: reward.itemId,
                        requiredLevel: reward.requiredLevel || activity.requiredLevel || 1
                    });
                }
            }
        }
        
        // Alternating rewards (mining copper/tin)
        if (activity.alternatingRewards) {
            for (const reward of activity.alternatingRewards) {
                if (reward.itemId && !this.isIgnoredItem(reward.itemId)) {
                    items.push({
                        itemId: reward.itemId,
                        requiredLevel: reward.requiredLevel || activity.requiredLevel || 1
                    });
                }
            }
        }
        
        // Cooking table
        if (activity.cookingTable) {
            for (const recipe of activity.cookingTable) {
                if (recipe.cookedItemId && !this.isIgnoredItem(recipe.cookedItemId)) {
                    items.push({
                        itemId: recipe.cookedItemId,
                        requiredLevel: recipe.requiredLevel || 1
                    });
                }
            }
        }
        
        return items;
    }
    
    // Check if an item should be ignored (override in subclasses)
    isIgnoredItem(itemId) {
        // Ignore burnt food and gems by default
        const ignored = ['burnt_food', 'uncut_sapphire', 'uncut_emerald', 'uncut_ruby', 'uncut_diamond'];
        return ignored.includes(itemId);
    }
    
    // Select an item using weighted distribution
    selectWeightedItem(items) {
        if (items.length === 0) return null;
        
        // Sort by required level (highest first)
        items.sort((a, b) => b.requiredLevel - a.requiredLevel);
        
        // Apply weights: 40% highest, 30% second highest, 30% split among rest
        const weights = [];
        
        if (items.length === 1) {
            weights.push(1.0);
        } else if (items.length === 2) {
            weights.push(0.4); // Highest
            weights.push(0.6); // Rest
        } else {
            weights.push(0.4); // Highest
            weights.push(0.3); // Second highest
            
            // Split remaining 30% among the rest
            const remaining = items.length - 2;
            const eachWeight = 0.3 / remaining;
            for (let i = 2; i < items.length; i++) {
                weights.push(eachWeight);
            }
        }
        
        // Random selection based on weights
        const random = Math.random();
        let cumulative = 0;
        
        for (let i = 0; i < items.length; i++) {
            cumulative += weights[i];
            if (random < cumulative) {
                return items[i];
            }
        }
        
        return items[items.length - 1]; // Fallback
    }
    
    // Find activities that produce a specific item
    findActivitiesForItem(itemId) {
        const activities = loadingManager.getData('activities');
        const matching = [];
        const currentLevel = skills.getLevel(this.id);
        
        for (const [activityId, activity] of Object.entries(activities)) {
            if (activity.skill !== this.id) continue;
            
            // Check if we can do this activity
            const requiredLevel = activity.requiredLevel || 1;
            if (currentLevel < requiredLevel) continue;
            
            const items = this.getItemsFromActivity(activity);
            // Check if this activity can produce the item AND we have the level for it
            const canProduceItem = items.some(item => 
                item.itemId === itemId && 
                (!item.requiredLevel || currentLevel >= item.requiredLevel)
            );
            
            if (canProduceItem) {
                matching.push(activityId);
            }
        }
        
        return matching;
    }
    
    // Find viable nodes that have any of the given activities
    findViableNodes(activityIds) {
        const viableNodes = [];
        const allNodes = nodes.getAllNodes();
        
        for (const [nodeId, node] of Object.entries(allNodes)) {
            if (!node.activities) continue;
            
            // Check if node is walkable
            if (window.collision && window.collision.initialized) {
                if (!collision.isWalkable(Math.floor(node.position.x), Math.floor(node.position.y))) {
                    continue;
                }
            }
            
            // Check if node has any of our activities
            for (const activityId of activityIds) {
                if (node.activities.includes(activityId)) {
                    viableNodes.push({
                        nodeId: nodeId,
                        activityId: activityId
                    });
                    break; // Only add once per node
                }
            }
        }
        
        return viableNodes;
    }
    
    // Determine target count for an item (override in subclasses for custom logic)
    determineTargetCount(itemId) {
        // Default: 50-150 items
        const base = 50 + Math.floor(Math.random() * 100);
        return Math.round(base / 5) * 5; // Round to nearest 5
    }
    
    // ==================== CORE BEHAVIOR ====================
    
    getDuration(baseDuration, level, activityData) {
        return baseDuration; // Default: no scaling
    }
    
    processRewards(activityData, level) {
        // Default: standard reward processing
        return this.standardRewards(activityData, level);
    }
    
    shouldGrantXP(rewards, activityData) {
        return true; // Default: always grant XP
    }
    
    getXpToGrant(rewards, activityData) {
        return activityData.xpPerAction || 0;
    }
    
    // Called before activity starts - return false to prevent activity
    beforeActivityStart(activityData) {
        return true;
    }
    
    // Called after activity completes
    onActivityComplete(activityData) {
        // Override in subclass if needed
    }
    
    // ==================== BANKING INTERFACE ====================
    // Skills can override these methods for custom banking behavior
    
    // Check if we need banking for a specific task
    needsBankingForTask(task) {
        // Processing skills should override this to check for materials
        // Gathering skills just check if inventory is full
        if (this.isProcessingSkill) {
            // Processing skill - check if we have materials
            return !this.hasMaterialsForCurrentTask();
        } else {
            // Gathering skill - bank when inventory is full
            return inventory.isFull();
        }
    }
    
    // Handle skill-specific banking
    handleBanking(task) {
        // Default: just deposit all for gathering skills
        const deposited = bank.depositAll();
        console.log(`Deposited ${deposited} items`);
        return true;
    }
    
    // Check if we can continue with a task
    canContinueTask(task) {
        // Processing skills should check if they have enough materials
        // Gathering skills can always continue (unless impossible)
        if (this.isProcessingSkill) {
            // Let the processing skill decide
            return true; // Subclass should override
        }
        // Gathering skills can always continue
        return true;
    }
    
    // Check if we have materials to work with (for production skills)
    hasMaterials() {
        // Default: gathering skills always have "materials" (the resource nodes)
        return true;
    }
    
    // ==================== UTILITIES ====================
    
    canPerformActivity(activityId) {
        const activityData = loadingManager.getData('activities')[activityId];
        if (!activityData || activityData.skill !== this.id) return false;
        
        const requiredLevel = activityData.requiredLevel || 1;
        const currentLevel = skills.getLevel(this.id);
        
        return currentLevel >= requiredLevel;
    }
    
    shouldBankItem(itemId) {
        return true; // Default: bank everything
    }
    
    getChance(reward, level) {
        if (Array.isArray(reward.chanceScaling)) {
            for (const range of reward.chanceScaling) {
                if (level >= range.minLevel && level <= range.maxLevel) {
                    return this.interpolateChance(range, level);
                }
            }
            return 0;
        } else if (reward.chanceScaling) {
            return this.interpolateChance(reward.chanceScaling, level);
        }
        return reward.chance || 1.0;
    }
    
    interpolateChance(scaling, level) {
        const clampedLevel = Math.max(scaling.minLevel, Math.min(level, scaling.maxLevel));
        const progress = (clampedLevel - scaling.minLevel) / (scaling.maxLevel - scaling.minLevel);
        return lerp(scaling.minChance, scaling.maxChance, progress);
    }
    
    standardRewards(activityData, level) {
        const rewards = [];
        if (activityData.rewards) {
            for (const reward of activityData.rewards) {
                if (!reward.requiredLevel || level >= reward.requiredLevel) {
                    if (Math.random() <= this.getChance(reward, level)) {
                        rewards.push({
                            itemId: reward.itemId,
                            quantity: reward.quantity || 1
                        });
                    }
                }
            }
        }
        return rewards;
    }
}
