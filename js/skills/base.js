class BaseSkill {
    constructor(id, name) {
        this.id = id;
        this.name = name;
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
    
    // ==================== BANKING DECISIONS ====================
    
    // Check if this skill needs banking given current inventory state
    needsBanking(goal) {
        // Default behavior for gathering skills: bank when inventory is full
        if (inventory.isFull()) {
            return true;
        }
        return false;
    }
    
    // Check if this skill can continue working with current inventory
    canContinueWithInventory(goal) {
        // Default: can continue if not full
        return !inventory.isFull();
    }
    
    // ==================== XP & PROGRESSION ====================
    
    calculateXpRate(activityData, level) {
        const avgDuration = this.getAverageDuration(activityData, level);
        const actionsPerHour = 3600000 / avgDuration;
        const xpPerAction = activityData.xpPerAction || 0;
        return actionsPerHour * xpPerAction;
    }
    
    getAverageDuration(activityData, level) {
        return this.getDuration(activityData.baseDuration, level, activityData);
    }
    
    chooseBestActivity(availableActivities, level) {
        // Default: choose highest XP rate
        let best = null;
        let bestXpRate = 0;
        
        for (const [activityId, activityData] of availableActivities) {
            const xpRate = this.calculateXpRate(activityData, level);
            if (xpRate > bestXpRate) {
                bestXpRate = xpRate;
                best = activityId;
            }
        }
        
        return best;
    }
    
    canPerformActivity(activityId) {
        const activityData = loadingManager.getData('activities')[activityId];
        if (!activityData || activityData.skill !== this.id) return false;
        
        const requiredLevel = activityData.requiredLevel || 1;
        const currentLevel = skills.getLevel(this.id);
        
        return currentLevel >= requiredLevel;
    }
    
    // ==================== GOAL GENERATION ====================
    
    generateLevelGoals(currentLevel, priority) {
        if (currentLevel >= 99) return [];
        
        const targetLevel = this.calculateTargetLevel(currentLevel);
        if (targetLevel <= currentLevel) return [];
        
        return [{
            type: 'skill_level',
            skill: this.id,
            targetLevel: targetLevel,
            priority: priority
        }];
    }
    
    generateItemGoals(currentLevel, priority) {
        return []; // Override in subclass
    }
    
    calculateTargetLevel(currentLevel) {
        const mod = currentLevel % 10;
        return Math.min(99,
            mod <= 2 || mod >= 7 ? Math.ceil(currentLevel / 10) * 10 :
            currentLevel + (Math.random() < 0.5 ? 5 : 10)
        );
    }
    
    shouldBankItem(itemId) {
        return true; // Default: bank everything
    }
    
    // ==================== AI EXECUTION ====================
    
    executeGoal(goal, ai) {
        if (goal.type === 'skill_level') {
            this.trainSkill(ai);
        } else if (goal.type === 'bank_items') {
            this.gatherItem(goal.itemId, ai);
        }
    }
    
    trainSkill(ai) {
        const activities = this.getAvailableActivities();
        if (activities.length === 0) {
            console.log(`No available activities for ${this.id}`);
            ai.skipCurrentGoal(`${this.id} training impossible`);
            return;
        }
        
        const bestActivity = this.chooseBestActivity(activities, skills.getLevel(this.id));
        if (bestActivity) {
            ai.doActivity(bestActivity);
        }
    }
    
    gatherItem(itemId, ai) {
        // Default: find activity that produces this item
        const activity = this.findActivityForItem(itemId);
        if (activity) {
            ai.doActivity(activity);
        } else {
            ai.skipCurrentGoal(`Cannot gather ${itemId}`);
        }
    }
    
    getAvailableActivities() {
        const activities = loadingManager.getData('activities');
        const available = [];
        
        for (const [id, data] of Object.entries(activities)) {
            if (data.skill === this.id && this.canPerformActivity(id)) {
                available.push([id, data]);
            }
        }
        
        return available;
    }
    
    findActivityForItem(itemId) {
        const activities = this.getAvailableActivities();
        
        for (const [activityId, activityData] of activities) {
            if (activityData.rewards) {
                for (const reward of activityData.rewards) {
                    if (reward.itemId === itemId) {
                        return activityId;
                    }
                }
            }
        }
        
        return null;
    }
    
    // ==================== BANKING ====================
    
    handleBanking(ai, goal) {
        // Default: just deposit all
        bank.depositAll();
        ai.clearCooldown();
    }
    
    getItemsToWithdraw(goal) {
        return []; // Override in subclass if needed
    }
    
    // ==================== UTILITIES ====================
    
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
