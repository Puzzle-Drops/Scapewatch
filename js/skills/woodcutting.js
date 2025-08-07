class WoodcuttingSkill extends BaseSkill {
    constructor() {
        super('woodcutting', 'Woodcutting');
    }
    
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
    
    generateItemGoals(currentLevel, priority) {
        const goals = [];
        const logs = [
            { itemId: 'logs', requiredLevel: 1, minCount: 100, maxCount: 500 },
            { itemId: 'oak_logs', requiredLevel: 15, minCount: 100, maxCount: 400 },
            { itemId: 'willow_logs', requiredLevel: 30, minCount: 100, maxCount: 300 },
            { itemId: 'teak_logs', requiredLevel: 35, minCount: 50, maxCount: 200 },
            { itemId: 'maple_logs', requiredLevel: 45, minCount: 50, maxCount: 150 },
            { itemId: 'mahogany_logs', requiredLevel: 50, minCount: 50, maxCount: 150 },
            { itemId: 'yew_logs', requiredLevel: 60, minCount: 30, maxCount: 100 },
            { itemId: 'magic_logs', requiredLevel: 75, minCount: 20, maxCount: 50 },
            { itemId: 'redwood_logs', requiredLevel: 90, minCount: 20, maxCount: 50 }
        ];
        
        for (const log of logs) {
            if (currentLevel >= log.requiredLevel) {
                const currentCount = bank.getItemCount(log.itemId);
                const targetCount = currentCount + 
                    Math.round((log.minCount + Math.random() * (log.maxCount - log.minCount)) / 10) * 10;
                
                goals.push({
                    type: 'bank_items',
                    itemId: log.itemId,
                    targetCount: targetCount,
                    priority: priority + goals.length
                });
            }
        }
        
        return goals;
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
}
