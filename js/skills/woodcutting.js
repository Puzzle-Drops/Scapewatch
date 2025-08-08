class WoodcuttingSkill extends BaseSkill {
    constructor() {
        super('woodcutting', 'Woodcutting');
        // requiresBankingBeforeTask = false (inherited from BaseSkill)
    }
    
    // ==================== TASK GENERATION OVERRIDES ====================
    
    getTaskVerb() {
        return 'Chop';
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
}
