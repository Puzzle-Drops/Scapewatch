class MiningSkill extends BaseSkill {
    constructor() {
        super('mining', 'Mining');
        this.alternatingStates = {};
    }
    
    getDuration(baseDuration, level, activityData) {
        if (!activityData.durationScaling?.breakpoints) return baseDuration;
        
        const breakpoint = activityData.durationScaling.breakpoints
            .filter(bp => level >= bp.level)
            .pop();
        
        if (!breakpoint) return baseDuration;
        
        if (breakpoint.boostChance && breakpoint.boostDuration && Math.random() < breakpoint.boostChance) {
            return breakpoint.boostDuration;
        }
        
        return breakpoint.duration;
    }
    
    getAverageDuration(activityData, level) {
        if (!activityData.durationScaling?.breakpoints) return activityData.baseDuration;
        
        const breakpoint = activityData.durationScaling.breakpoints
            .filter(bp => level >= bp.level)
            .pop();
        
        if (breakpoint) {
            if (breakpoint.boostChance && breakpoint.boostDuration) {
                return (breakpoint.duration * (1 - breakpoint.boostChance)) +
                       (breakpoint.boostDuration * breakpoint.boostChance);
            }
            return breakpoint.duration;
        }
        
        return activityData.baseDuration;
    }
    
    processRewards(activityData, level) {
        const rewards = [];
        
        // Handle alternating rewards (copper & tin)
        if (activityData.alternatingRewards) {
            const stateKey = activityData.id;
            if (this.alternatingStates[stateKey] === undefined) {
                this.alternatingStates[stateKey] = 0;
            }
            
            const index = this.alternatingStates[stateKey];
            const reward = activityData.alternatingRewards[index];
            
            if (Math.random() <= this.getChance(reward, level)) {
                rewards.push({
                    itemId: reward.itemId,
                    quantity: reward.quantity || 1
                });
                // Move to next ore type
                this.alternatingStates[stateKey] = 
                    (index + 1) % activityData.alternatingRewards.length;
            }
            return rewards;
        }
        
        // Check for gems first
        if (activityData.gemTable) {
            for (const gem of activityData.gemTable) {
                if (Math.random() <= gem.chance) {
                    return [{ itemId: gem.itemId, quantity: 1 }];
                }
            }
        }
        
        // Standard ore rewards
        return this.standardRewards(activityData, level);
    }
    
    shouldGrantXP(rewards, activityData) {
        // Mining grants XP only if you get ore (not gems)
        if (rewards.length === 0) return false;
        
        const gemIds = activityData.gemTable ? 
            activityData.gemTable.map(gem => gem.itemId) : [];
        
        return rewards.some(r => !gemIds.includes(r.itemId));
    }
    
    getXpToGrant(rewards, activityData) {
        const gemIds = activityData.gemTable ? 
            activityData.gemTable.map(gem => gem.itemId) : [];
        
        const gotOre = rewards.some(r => !gemIds.includes(r.itemId));
        return gotOre ? (activityData.xpPerAction || 0) : 0;
    }
    
    calculateXpRate(activityData, level) {
        const avgDuration = this.getAverageDuration(activityData, level);
        const actionsPerHour = 3600000 / avgDuration;
        const xpPerAction = activityData.xpPerAction || 0;
        
        // Calculate success chance (for ores, not gems)
        let successChance = 1.0;
        
        if (activityData.alternatingRewards) {
            // Average of alternating rewards
            successChance = activityData.alternatingRewards.reduce((sum, reward) => 
                sum + this.getChance(reward, level), 0) / activityData.alternatingRewards.length;
        } else if (activityData.rewards && activityData.rewards.length > 0) {
            successChance = this.getChance(activityData.rewards[0], level);
        }
        
        return actionsPerHour * xpPerAction * successChance;
    }
    
    generateItemGoals(currentLevel, priority) {
        const goals = [];
        const ores = [
            { itemId: 'copper_ore', requiredLevel: 1, minCount: 100, maxCount: 300 },
            { itemId: 'tin_ore', requiredLevel: 1, minCount: 100, maxCount: 300 },
            { itemId: 'iron_ore', requiredLevel: 15, minCount: 100, maxCount: 250 },
            { itemId: 'silver_ore', requiredLevel: 20, minCount: 50, maxCount: 150 },
            { itemId: 'coal', requiredLevel: 30, minCount: 100, maxCount: 200 },
            { itemId: 'gold_ore', requiredLevel: 40, minCount: 50, maxCount: 100 },
            { itemId: 'mithril_ore', requiredLevel: 55, minCount: 30, maxCount: 80 },
            { itemId: 'adamantite_ore', requiredLevel: 70, minCount: 20, maxCount: 50 },
            { itemId: 'runite_ore', requiredLevel: 85, minCount: 10, maxCount: 30 },
            { itemId: 'amethyst', requiredLevel: 92, minCount: 10, maxCount: 30 }
        ];
        
        for (const ore of ores) {
            if (currentLevel >= ore.requiredLevel) {
                const currentCount = bank.getItemCount(ore.itemId);
                const targetCount = currentCount + 
                    Math.round((ore.minCount + Math.random() * (ore.maxCount - ore.minCount)) / 10) * 10;
                
                goals.push({
                    type: 'bank_items',
                    itemId: ore.itemId,
                    targetCount: targetCount,
                    priority: priority + goals.length
                });
            }
        }
        
        return goals;
    }
    
    shouldBankItem(itemId) {
        // Don't auto-bank gems
        const gems = ['uncut_sapphire', 'uncut_emerald', 'uncut_ruby', 'uncut_diamond'];
        return !gems.includes(itemId);
    }
    
    // Save/restore alternating states
    saveState() {
        return { alternatingStates: this.alternatingStates };
    }
    
    loadState(state) {
        if (state.alternatingStates) {
            this.alternatingStates = state.alternatingStates;
        }
    }
}
