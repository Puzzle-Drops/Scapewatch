class CombatSkill extends BaseSkill {
    constructor() {
        super('attack', 'Combat'); // Primary skill is attack
        this.combatSkills = ['attack', 'strength', 'defence', 'hitpoints'];
    }
    
    // ==================== TASK GENERATION OVERRIDES ====================
    
    getTaskVerb() {
        return 'Collect';
    }
    
    isIgnoredItem(itemId) {
        // Ignore coins for tasks
        return itemId === 'coins';
    }
    
    determineTargetCount(itemId) {
        // Combat drops are rarer, so lower counts
        const dropCounts = {
            'goblin_mail': { min: 5, max: 15 }
        };
        
        const counts = dropCounts[itemId] || { min: 10, max: 30 };
        const baseCount = counts.min + Math.random() * (counts.max - counts.min);
        return Math.round(baseCount / 5) * 5;
    }
    
    // Override to only generate tasks for valuable drops
    getPossibleItems() {
        const items = [];
        const activities = loadingManager.getData('activities');
        const currentLevel = skills.getLevel(this.id);
        
        for (const [activityId, activity] of Object.entries(activities)) {
            // Check if it's a combat activity
            const combatSkills = ['attack', 'strength', 'defence', 'ranged', 'magic'];
            if (!combatSkills.includes(activity.skill)) continue;
            
            const requiredLevel = activity.requiredLevel || 1;
            if (currentLevel < requiredLevel) continue;
            
            // Get valuable drops from this activity (not coins)
            if (activity.rewards) {
                for (const reward of activity.rewards) {
                    if (reward.itemId && reward.itemId !== 'coins' && reward.chance < 0.5) {
                        // Only rare drops (less than 50% chance)
                        if (!items.some(i => i.itemId === reward.itemId)) {
                            items.push({
                                itemId: reward.itemId,
                                requiredLevel: requiredLevel
                            });
                        }
                    }
                }
            }
        }
        
        return items;
    }
    
    // ==================== CORE BEHAVIOR ====================
    
    processRewards(activityData, level) {
        // Standard reward processing for combat
        const rewards = [];
        
        if (activityData.rewards) {
            for (const reward of activityData.rewards) {
                if (Math.random() <= (reward.chance || 1.0)) {
                    rewards.push({
                        itemId: reward.itemId,
                        quantity: reward.quantity || 1
                    });
                }
            }
        }
        
        return rewards;
    }
    
    shouldGrantXP(rewards, activityData) {
        return true; // Combat always grants XP
    }
    
    getXpToGrant(rewards, activityData) {
        // Combat grants XP to multiple skills (handled in player.js)
        return activityData.xpPerAction || 0;
    }
    
    canPerformActivity(activityId) {
        const activityData = loadingManager.getData('activities')[activityId];
        if (!activityData) return false;
        
        // Check if it's a combat activity (uses any combat skill)
        const combatSkills = ['attack', 'strength', 'defence', 'ranged', 'magic'];
        if (!combatSkills.includes(activityData.skill)) return false;
        
        const requiredLevel = activityData.requiredLevel || 1;
        const currentLevel = skills.getLevel(activityData.skill);
        
        return currentLevel >= requiredLevel;
    }
}
