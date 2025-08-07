class CombatSkill extends BaseSkill {
    constructor() {
        super('attack', 'Combat'); // Primary skill is attack
        this.combatSkills = ['attack', 'strength', 'defence', 'hitpoints'];
    }
    
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
    
    generateLevelGoals(currentLevel, priority) {
        const goals = [];
        
        // Generate goals for all combat skills
        for (const skillId of this.combatSkills) {
            const level = skills.getLevel(skillId);
            if (level >= 99) continue;
            
            const targetLevel = this.calculateTargetLevel(level);
            if (targetLevel > level) {
                goals.push({
                    type: 'skill_level',
                    skill: skillId,
                    targetLevel: targetLevel,
                    priority: priority + goals.length
                });
            }
        }
        
        return goals;
    }
    
    generateItemGoals(currentLevel, priority) {
        // Combat doesn't generate item banking goals by default
        return [];
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
