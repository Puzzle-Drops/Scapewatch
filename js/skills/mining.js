class MiningSkill extends BaseSkill {
    constructor() {
        super('mining', 'Mining');
        this.alternatingStates = {};
    }
    
    // ==================== GOAL GENERATION OVERRIDE ====================
    
    createGoalForActivity(node, activity, priority) {
        // Get what this activity produces
        const primaryReward = this.getPrimaryReward(activity);
        if (!primaryReward) {
            // Fallback to generic training goal
            return super.createGoalForActivity(node, activity, priority);
        }
        
        // Determine target count based on ore type and level
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
            description: `Mine ${targetCount} ${itemData.name} at ${node.name}`
        };
    }
    
    getPrimaryReward(activity) {
        // Handle alternating rewards (copper/tin)
        if (activity.alternatingRewards && activity.alternatingRewards.length > 0) {
            // Pick one randomly for the goal
            return activity.alternatingRewards[Math.floor(Math.random() * activity.alternatingRewards.length)];
        }
        
        // Handle standard rewards
        if (activity.rewards && activity.rewards.length > 0) {
            return activity.rewards[0]; // Primary ore
        }
        
        return null;
    }
    
    determineTargetCount(itemId) {
        // Base counts for different ore types
        const oreCounts = {
            'copper_ore': { min: 50, max: 150 },
            'tin_ore': { min: 50, max: 150 },
            'iron_ore': { min: 40, max: 120 },
            'silver_ore': { min: 30, max: 80 },
            'coal': { min: 50, max: 100 },
            'gold_ore': { min: 25, max: 60 },
            'mithril_ore': { min: 20, max: 50 },
            'adamantite_ore': { min: 15, max: 35 },
            'runite_ore': { min: 10, max: 20 },
            'amethyst': { min: 10, max: 25 }
        };
        
        const counts = oreCounts[itemId] || { min: 20, max: 50 };
        const baseCount = counts.min + Math.random() * (counts.max - counts.min);
        
        // Round to nearest 5 or 10
        return Math.round(baseCount / 5) * 5;
    }
    
    // ==================== BANKING DECISIONS ====================
    
    needsBanking(goal) {
        // Mining is a gathering skill - bank when inventory is full
        if (inventory.isFull()) {
            console.log('Inventory full of ores/gems, banking needed');
            return true;
        }
        return false;
    }
    
    canContinueWithInventory(goal) {
        // Mining can continue as long as there's inventory space
        return !inventory.isFull();
    }
    
    // ==================== CORE BEHAVIOR ====================
    
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
    
    shouldBankItem(itemId) {
        // Don't auto-bank gems (player might want to keep them for crafting)
        const gems = ['uncut_sapphire', 'uncut_emerald', 'uncut_ruby', 'uncut_diamond'];
        return !gems.includes(itemId);
    }
    
    // ==================== BANKING ====================
    
    handleBanking(ai, goal) {
        // Mining just deposits everything
        const deposited = bank.depositAll();
        console.log(`Deposited ${deposited} ores and gems`);
        
        // Update UI
        if (window.ui) {
            window.ui.updateSkillsList();
        }
        
        // Continue mining
        ai.clearCooldown();
        if (goal) {
            ai.executeGoal(goal);
        }
    }
    
    // ==================== STATE MANAGEMENT ====================
    
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
