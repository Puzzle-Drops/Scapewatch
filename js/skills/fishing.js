class FishingSkill extends BaseSkill {
    constructor() {
        super('fishing', 'Fishing');
        this.lastCatchXp = 0;
    }
    
    // ==================== TASK GENERATION OVERRIDES ====================
    
    getTaskVerb() {
        return 'Catch';
    }
    
    determineTargetCount(itemId) {
        const fishCounts = {
            'raw_shrimps': { min: 50, max: 150 },
            'raw_anchovies': { min: 50, max: 125 },
            'raw_sardine': { min: 50, max: 125 },
            'raw_herring': { min: 40, max: 100 },
            'raw_mackerel': { min: 40, max: 90 },
            'raw_trout': { min: 35, max: 80 },
            'raw_cod': { min: 35, max: 75 },
            'raw_pike': { min: 30, max: 70 },
            'raw_salmon': { min: 30, max: 60 },
            'raw_tuna': { min: 25, max: 50 },
            'raw_lobster': { min: 20, max: 40 },
            'raw_bass': { min: 20, max: 35 },
            'raw_swordfish': { min: 15, max: 30 },
            'raw_shark': { min: 10, max: 20 }
        };
        
        const counts = fishCounts[itemId] || { min: 20, max: 50 };
        const baseCount = counts.min + Math.random() * (counts.max - counts.min);
        return Math.round(baseCount / 5) * 5;
    }
    
    // ==================== CORE BEHAVIOR ====================
    
    getDuration(baseDuration, level, activityData) {
        // Handle duration boosts (pike has 20% chance of 3600ms boost)
        if (activityData.durationBoost && Math.random() < activityData.durationBoost.chance) {
            return activityData.durationBoost.duration;
        }
        return baseDuration;
    }
    
    processRewards(activityData, level) {
        if (!activityData.rewards) return [];
        
        // Build weighted list of possible catches
        const catches = activityData.rewards
            .filter(r => !r.requiredLevel || level >= r.requiredLevel)
            .map(reward => ({
                itemId: reward.itemId,
                quantity: reward.quantity || 1,
                chance: this.getChance(reward, level),
                xp: reward.xpPerAction || 0
            }));
        
        // Single roll for all fish
        const roll = Math.random();
        let cumulative = 0;
        
        for (const fish of catches) {
            cumulative += fish.chance;
            if (roll < cumulative) {
                this.lastCatchXp = fish.xp;
                return [{ itemId: fish.itemId, quantity: fish.quantity }];
            }
        }
        
        this.lastCatchXp = 0;
        return [];
    }
    
    shouldGrantXP(rewards, activityData) {
        return rewards.length > 0; // Only grant XP if fish caught
    }
    
    getXpToGrant(rewards, activityData) {
        return this.lastCatchXp || 0;
    }
    
    canPerformActivity(activityId) {
        const activityData = loadingManager.getData('activities')[activityId];
        if (!activityData || activityData.skill !== this.id) return false;
        
        const requiredLevel = activityData.requiredLevel || 1;
        const currentLevel = skills.getLevel(this.id);
        
        if (currentLevel < requiredLevel) return false;
        
        // Check for required items (bait/feathers) in bank or inventory
        if (activityData.consumeOnSuccess) {
            for (const required of activityData.consumeOnSuccess) {
                const hasInInventory = inventory.hasItem(required.itemId, 1);
                const hasInBank = bank.getItemCount(required.itemId) > 0;
                if (!hasInInventory && !hasInBank) {
                    return false;
                }
            }
        }
        
        return true;
    }
}
