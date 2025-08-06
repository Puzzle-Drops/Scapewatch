class SkillBehaviors {
    constructor() {
        this.behaviors = {
            woodcutting: {
                getDuration: (base, level, data) => base, // No scaling
                processRewards: this.standardRewards.bind(this),
                shouldGrantXP: (rewards) => rewards.length > 0, // Only if logs obtained
                getEffectiveXpRate: this.calculateXpRate.bind(this, 'success'), // XP on success only
                getXpToGrant: (rewards, data) => rewards.length > 0 ? (data.xpPerAction || 0) : 0
            },
            mining: {
                getDuration: this.miningDuration.bind(this),
                processRewards: this.miningRewards.bind(this),
                shouldGrantXP: (rewards, activityData) => this.miningGrantsXP(rewards, activityData),
                getEffectiveXpRate: this.calculateXpRate.bind(this, 'mining'),
                getXpToGrant: this.miningXpToGrant.bind(this)
            },
            fishing: {
                getDuration: this.fishingDuration.bind(this),
                processRewards: this.fishingRewards.bind(this),
                shouldGrantXP: (rewards) => rewards.length > 0, // Only if fish caught
                getEffectiveXpRate: this.calculateXpRate.bind(this, 'fishing'),
                getXpToGrant: () => this.lastCatchXp || 0
            },
            default: {
                getDuration: (base) => base,
                processRewards: this.standardRewards.bind(this),
                shouldGrantXP: () => true,
                getEffectiveXpRate: this.calculateXpRate.bind(this, 'default'),
                getXpToGrant: (rewards, data) => data.xpPerAction || 0
            }
        };
    }

    getBehavior(skillName) {
        return this.behaviors[skillName] || this.behaviors.default;
    }

    // ==================== SHARED UTILITY METHODS ====================
    
    getChance(reward, skillLevel) {
        if (Array.isArray(reward.chanceScaling)) {
            // Multi-range scaling (like fishing)
            for (const range of reward.chanceScaling) {
                if (skillLevel >= range.minLevel && skillLevel <= range.maxLevel) {
                    return this.interpolateChance(range, skillLevel);
                }
            }
            return 0;
        } else if (reward.chanceScaling) {
            return this.interpolateChance(reward.chanceScaling, skillLevel);
        }
        return reward.chance || 1.0;
    }

    interpolateChance(scaling, skillLevel) {
        const clampedLevel = Math.max(scaling.minLevel, Math.min(skillLevel, scaling.maxLevel));
        const progress = (clampedLevel - scaling.minLevel) / (scaling.maxLevel - scaling.minLevel);
        return lerp(scaling.minChance, scaling.maxChance, progress);
    }

    standardRewards(activityData, skillLevel) {
        const rewards = [];
        if (activityData.rewards) {
            for (const reward of activityData.rewards) {
                if (Math.random() <= this.getChance(reward, skillLevel)) {
                    rewards.push({
                        itemId: reward.itemId,
                        quantity: reward.quantity || 1
                    });
                }
            }
        }
        return rewards;
    }

    getAverageDuration(activityData, skillLevel) {
        // Handle mining duration scaling
        if (activityData.durationScaling?.breakpoints) {
            const breakpoint = activityData.durationScaling.breakpoints
                .filter(bp => skillLevel >= bp.level)
                .pop(); // Get last matching breakpoint
            
            if (breakpoint) {
                if (breakpoint.boostChance && breakpoint.boostDuration) {
                    return (breakpoint.duration * (1 - breakpoint.boostChance)) +
                           (breakpoint.boostDuration * breakpoint.boostChance);
                }
                return breakpoint.duration;
            }
        }
        
        // Handle fishing duration boost
        if (activityData.durationBoost) {
            return (activityData.baseDuration * (1 - activityData.durationBoost.chance)) +
                   (activityData.durationBoost.duration * activityData.durationBoost.chance);
        }
        
        return activityData.baseDuration;
    }

    calculateXpRate(type, activityData, skillLevel) {
        const xpPerAction = activityData.xpPerAction || 0;
        const avgDuration = this.getAverageDuration(activityData, skillLevel);
        const actionsPerHour = 3600000 / avgDuration;
        
        switch (type) {
            case 'success': // Woodcutting - XP only on success
                const successChance = this.getSuccessChance(activityData, skillLevel);
                return actionsPerHour * xpPerAction * successChance;
                
            case 'mining':
                // Mining uses same success chance calculation
                // (gems don't affect the XP rate since you don't get XP for gems anyway)
                const miningChance = this.getSuccessChance(activityData, skillLevel);
                return actionsPerHour * xpPerAction * miningChance;
                
            case 'fishing':
                return actionsPerHour * this.getFishingExpectedXp(activityData, skillLevel);
                
            default:
                return actionsPerHour * xpPerAction;
        }
    }

    getSuccessChance(activityData, skillLevel) {
        // For alternating rewards (like copper & tin)
        if (activityData.alternatingRewards) {
            return activityData.alternatingRewards.reduce((sum, reward) => 
                sum + this.getChance(reward, skillLevel), 0) / activityData.alternatingRewards.length;
        }
        
        // For regular rewards
        if (activityData.rewards?.length > 0) {
            return this.getChance(activityData.rewards[0], skillLevel);
        }
        
        return 1.0;
    }

    getFishingExpectedXp(activityData, skillLevel) {
        if (!activityData.rewards) return 0;
        
        return activityData.rewards
            .filter(reward => !reward.requiredLevel || skillLevel >= reward.requiredLevel)
            .reduce((total, reward) => {
                const chance = this.getChance(reward, skillLevel);
                return total + (reward.xpPerAction || 0) * chance;
            }, 0);
    }

    // ==================== MINING SPECIFIC ====================
    
    miningDuration(baseDuration, skillLevel, activityData) {
        if (!activityData.durationScaling?.breakpoints) return baseDuration;
        
        const breakpoint = activityData.durationScaling.breakpoints
            .filter(bp => skillLevel >= bp.level)
            .pop();
        
        if (!breakpoint) return baseDuration;
        
        if (breakpoint.boostChance && breakpoint.boostDuration && Math.random() < breakpoint.boostChance) {
            return breakpoint.boostDuration;
        }
        
        return breakpoint.duration;
    }

    miningRewards(activityData, skillLevel) {
        const rewards = [];
        
        // Handle alternating rewards (copper & tin)
        if (activityData.alternatingRewards) {
            const stateKey = activityData.id;
            if (!window.player.alternatingStates[stateKey]) {
                window.player.alternatingStates[stateKey] = 0;
            }
            
            const index = window.player.alternatingStates[stateKey];
            const reward = activityData.alternatingRewards[index];
            
            if (Math.random() <= this.getChance(reward, skillLevel)) {
                rewards.push({
                    itemId: reward.itemId,
                    quantity: reward.quantity || 1
                });
                // Move to next ore type
                window.player.alternatingStates[stateKey] = 
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
        return this.standardRewards(activityData, skillLevel);
    }

    miningGrantsXP(rewards, activityData) {
        // Mining grants XP only if you get ore (not gems)
        if (rewards.length === 0) return false;
        
        // Get gem IDs from this specific activity's gemTable
        const gemIds = activityData.gemTable ? 
            activityData.gemTable.map(gem => gem.itemId) : [];
        
        // Check if any reward is NOT a gem
        return rewards.some(r => !gemIds.includes(r.itemId));
    }

    miningXpToGrant(rewards, activityData) {
        // Get gem IDs from this specific activity's gemTable
        const gemIds = activityData.gemTable ? 
            activityData.gemTable.map(gem => gem.itemId) : [];
        
        const gotOre = rewards.some(r => !gemIds.includes(r.itemId));
        return gotOre ? (activityData.xpPerAction || 0) : 0;
    }

    // ==================== FISHING SPECIFIC ====================
    
    fishingDuration(baseDuration, skillLevel, activityData) {
        if (activityData.durationBoost && Math.random() < activityData.durationBoost.chance) {
            return activityData.durationBoost.duration;
        }
        return baseDuration;
    }

    fishingRewards(activityData, skillLevel) {
        if (!activityData.rewards) return [];
        
        // Build weighted list of possible catches
        const catches = activityData.rewards
            .filter(r => !r.requiredLevel || skillLevel >= r.requiredLevel)
            .map(reward => ({
                itemId: reward.itemId,
                quantity: reward.quantity || 1,
                chance: this.getChance(reward, skillLevel),
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

    // ==================== GOAL GENERATION ====================
    
    generateItemGoals(currentSkillLevels, existingGoalCount) {
    const goals = [];
    const activities = loadingManager.getData('activities');
    const processedItems = new Set();
    
    for (const [activityId, activityData] of Object.entries(activities)) {
        if (!activityData.rewards) continue;
        
        const currentLevel = currentSkillLevels[activityData.skill] || 1;
        if (currentLevel < (activityData.requiredLevel || 1)) continue;
        
        for (const reward of activityData.rewards) {
            // Check if we can actually get this specific reward
            if (reward.requiredLevel && currentLevel < reward.requiredLevel) {
                continue; // Skip rewards we don't have the level for
            }
            
            if (processedItems.has(reward.itemId) || this.shouldSkipBankingItem(reward.itemId)) {
                continue;
            }
            
            const targetQuantity = this.calculateItemGoalQuantity(
                reward.requiredLevel || activityData.requiredLevel || 1,
                this.getChance(reward, currentLevel)
            );
                
                if (targetQuantity > 0) {
    // Get current count from bank + inventory
    const currentBankCount = window.bank ? window.bank.getItemCount(reward.itemId) : 0;
    const currentInvCount = window.inventory ? window.inventory.getItemCount(reward.itemId) : 0;
    const currentTotal = currentBankCount + currentInvCount;
    
    goals.push({
        type: 'bank_items',
        itemId: reward.itemId,
        targetCount: currentTotal + targetQuantity,  // Add to existing amount
        priority: existingGoalCount + goals.length + 1,
        skill: activityData.skill,
        requiredLevel: activityData.requiredLevel || 1
    });
    processedItems.add(reward.itemId);
}
            }
        }
        
        return goals.sort((a, b) => a.requiredLevel - b.requiredLevel || a.skill.localeCompare(b.skill));
    }
    
    calculateItemGoalQuantity(requiredLevel, successRate) {
        const [min, max] = requiredLevel < 20 ? [50, 200] :
                          requiredLevel < 50 ? [30, 150] :
                          requiredLevel < 75 ? [20, 100] : [10, 50];
        
        const adjusted = [min * successRate, max * successRate];
        const target = adjusted[0] + Math.random() * (adjusted[1] - adjusted[0]);
        return Math.round(target / 10) * 10; // Round to nearest 10
    }
    
    shouldSkipBankingItem(itemId) {
        const items = loadingManager.getData('items');
        const item = items[itemId];
        if (!item) return true;
        
        // Skip gems (they have category: 'gem')
        if (item.category === 'gem') return true;
        
        // Skip specific items we don't want to bank
        const skipList = ['coins', 'goblin_mail', 'feather', 'fishing_bait'];
        return skipList.includes(itemId);
    }
    
    generateSkillGoals(currentSkillLevels, existingGoalCount) {
        const goals = [];
        const trainableSkills = ['woodcutting', 'mining', 'fishing', 'attack'];
        
        for (const skill of trainableSkills) {
            const currentLevel = currentSkillLevels[skill] || 1;
            if (currentLevel >= 99) continue;
            
            const mod = currentLevel % 10;
            const targetLevel = Math.min(99,
                mod <= 2 || mod >= 7 ? Math.ceil(currentLevel / 10) * 10 :
                currentLevel + (Math.random() < 0.5 ? 5 : 10)
            );
            
            if (targetLevel > currentLevel) {
                goals.push({
                    type: 'skill_level',
                    skill: skill,
                    targetLevel: targetLevel,
                    priority: existingGoalCount + goals.length + 1
                });
            }
        }
        
        return goals;
    }

    // ==================== AI DECISION MAKING ====================

    chooseBestActivity(skillId, availableActivities, currentLevel) {
        const behavior = this.getBehavior(skillId);
        
        const evaluated = availableActivities.map(([id, data]) => ({
            id,
            xpRate: behavior.getEffectiveXpRate(data, currentLevel),
            requiredLevel: data.requiredLevel || 1
        }));
        
        const bestXp = evaluated.reduce((best, curr) => 
            curr.xpRate > best.xpRate ? curr : best
        );
        
        const highestLevel = evaluated
            .filter(a => currentLevel >= a.requiredLevel)
            .reduce((best, curr) => 
                curr.requiredLevel > best.requiredLevel ? curr : best, 
                { requiredLevel: 0 }
            );
        
        // 50/50 chance between best XP and highest level
        const chosen = bestXp.id === highestLevel.id ? bestXp :
                      Math.random() < 0.5 ? bestXp : (highestLevel.id ? highestLevel : bestXp);
        
        console.log(`Choosing ${chosen.id} (${Math.floor(chosen.xpRate)} XP/hr)`);
        return chosen.id;
    }

    getActivityXpRate(activityId) {
        const activities = loadingManager.getData('activities');
        const activityData = activities[activityId];
        if (!activityData) return 0;
        
        const behavior = this.getBehavior(activityData.skill);
        return behavior.getEffectiveXpRate(activityData, skills.getLevel(activityData.skill));
    }

    // Legacy compatibility methods
    getScaledChance(reward, skillLevel) {
        return this.getChance(reward, skillLevel);
    }
    
    getScaledChanceFromRange(range, skillLevel) {
        return this.interpolateChance(range, skillLevel);
    }
}

// Create global instance
window.skillBehaviors = new SkillBehaviors();
