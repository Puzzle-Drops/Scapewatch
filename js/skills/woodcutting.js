class WoodcuttingSkill extends BaseSkill {
    constructor() {
        super('woodcutting', 'Woodcutting');
    }
    
    // ==================== GOAL GENERATION OVERRIDE ====================
    
    createGoalForActivity(node, activity, priority) {
        // Get what logs this activity produces
        const primaryReward = this.getPrimaryReward(activity);
        if (!primaryReward) {
            return super.createGoalForActivity(node, activity, priority);
        }
        
        const targetCount = this.determineTargetCount(primaryReward.itemId);
        const itemData = loadingManager.getData('items')[primaryReward.itemId];
        
        return {
            type: 'skill_activity',
            skill: this.id,
            nodeId: node.id,
            activityId: activity.id,
            targetItem: primaryReward.itemId,
            targetCount: targetCount,
            priority: priority,
            description: `Chop ${targetCount} ${itemData.name} at ${node.name}`
        };
    }
    
    getPrimaryReward(activity) {
        if (activity.rewards && activity.rewards.length > 0) {
            return activity.rewards[0];
        }
        return null;
    }
    
    determineTargetCount(itemId) {
        const logCounts = {
            'logs': { min: 50, max: 150 },
            'oak_logs': { min: 40, max: 120 },
            'willow_logs': { min: 40, max: 100 },
            'teak_logs': { min: 25, max: 75 },
            'maple_logs': { min: 25, max: 60 },
            'mahogany_logs': { min: 25, max: 60 },
            'yew_logs': { min: 15, max: 40 },
            'magic_logs': { min: 10, max: 25 },
            'redwood_logs': { min: 10, max: 25 }
        };
        
        const counts = logCounts[itemId] || { min: 20, max: 50 };
        const baseCount = counts.min + Math.random() * (counts.max - counts.min);
        return Math.round(baseCount / 5) * 5;
    }
    
    // ==================== BANKING DECISIONS ====================
    
    needsBanking(goal) {
        // Woodcutting is a gathering skill - bank when inventory is full
        if (inventory.isFull()) {
            console.log('Inventory full of logs, banking needed');
            return true;
        }
        return false;
    }
    
    canContinueWithInventory(goal) {
        // Woodcutting can continue as long as there's inventory space
        return !inventory.isFull();
    }
    
    // ==================== CORE BEHAVIOR ====================
    
    // Woodcutting has no duration scaling
    getDuration(baseDuration, level, activityData) {
        return baseDuration;
    }
    
    // Standard reward processing
    processRewards(activityData, level) {
        return this.standardRewards(activityData, level);
    }
    
    // Only grant XP if logs were obtained
    shouldGrantXP(rewards, activityData) {
        return rewards.length > 0;
    }
    
    getXpToGrant(rewards, activityData) {
        return rewards.length > 0 ? (activityData.xpPerAction || 0) : 0;
    }
    
    calculateXpRate(activityData, level) {
        const avgDuration = this.getAverageDuration(activityData, level);
        const actionsPerHour = 3600000 / avgDuration;
        const xpPerAction = activityData.xpPerAction || 0;
        
        // Calculate success chance for logs
        let successChance = 1.0;
        if (activityData.rewards && activityData.rewards.length > 0) {
            successChance = this.getChance(activityData.rewards[0], level);
        }
        
        return actionsPerHour * xpPerAction * successChance;
    }
    
    chooseBestActivity(availableActivities, level) {
        // Woodcutting: 50/50 between best XP and highest level tree
        const evaluated = availableActivities.map(([id, data]) => ({
            id,
            xpRate: this.calculateXpRate(data, level),
            requiredLevel: data.requiredLevel || 1
        }));
        
        const bestXp = evaluated.reduce((best, curr) => 
            curr.xpRate > best.xpRate ? curr : best
        );
        
        const highestLevel = evaluated
            .filter(a => level >= a.requiredLevel)
            .reduce((best, curr) => 
                curr.requiredLevel > best.requiredLevel ? curr : best, 
                { requiredLevel: 0 }
            );
        
        const chosen = bestXp.id === highestLevel.id ? bestXp :
                      Math.random() < 0.5 ? bestXp : (highestLevel.id ? highestLevel : bestXp);
        
        console.log(`Choosing ${chosen.id} for woodcutting (${Math.floor(chosen.xpRate)} XP/hr)`);
        return chosen.id;
    }
    
    // ==================== BANKING ====================
    
    handleBanking(ai, goal) {
        // Woodcutting just deposits everything
        const deposited = bank.depositAll();
        console.log(`Deposited ${deposited} logs`);
        
        // Update UI
        if (window.ui) {
            window.ui.updateSkillsList();
        }
        
        // Continue woodcutting
        ai.clearCooldown();
        if (goal) {
            ai.executeGoal(goal);
        }
    }
}
