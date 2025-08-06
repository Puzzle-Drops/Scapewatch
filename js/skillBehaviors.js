class SkillBehaviors {
    constructor() {
        this.behaviors = {
            woodcutting: {
                getDuration: this.woodcuttingDuration.bind(this),
                processRewards: this.woodcuttingRewards.bind(this),
                shouldGrantXP: this.woodcuttingShouldGrantXP.bind(this),
                getEffectiveXpRate: this.woodcuttingXpRate.bind(this),
                getXpToGrant: this.woodcuttingXpToGrant.bind(this)
            },
            mining: {
                getDuration: this.miningDuration.bind(this),
                processRewards: this.miningRewards.bind(this),
                shouldGrantXP: this.miningShouldGrantXP.bind(this),
                getEffectiveXpRate: this.miningXpRate.bind(this),
                getXpToGrant: this.miningXpToGrant.bind(this)
            },
            fishing: {
                getDuration: this.fishingDuration.bind(this),
                processRewards: this.fishingRewards.bind(this),
                shouldGrantXP: this.fishingShouldGrantXP.bind(this),
                getEffectiveXpRate: this.fishingXpRate.bind(this),
                getXpToGrant: this.fishingXpToGrant.bind(this)
            },
            default: {
                getDuration: this.defaultDuration.bind(this),
                processRewards: this.defaultRewards.bind(this),
                shouldGrantXP: this.defaultShouldGrantXP.bind(this),
                getEffectiveXpRate: this.defaultXpRate.bind(this),
                getXpToGrant: this.defaultXpToGrant.bind(this)
            }
        };
    }

    // Get behavior for a skill
    getBehavior(skillName) {
        return this.behaviors[skillName] || this.behaviors.default;
    }

    // ==================== GOAL GENERATION ====================
    
    // Generate item banking goals based on current skill levels
    generateItemGoals(currentSkillLevels, existingGoalCount) {
        const goals = [];
        const activities = loadingManager.getData('activities');
        
        // Track which items we've already made goals for to avoid duplicates
        const processedItems = new Set();
        
        // Process each activity
        for (const [activityId, activityData] of Object.entries(activities)) {
            if (!activityData.rewards) continue;
            
            const skill = activityData.skill;
            const currentLevel = currentSkillLevels[skill] || 1;
            const requiredLevel = activityData.requiredLevel || 1;
            
            // Skip if we can't do this activity yet
            if (currentLevel < requiredLevel) continue;
            
            // Process each reward from the activity
            for (const reward of activityData.rewards) {
                const itemId = reward.itemId;
                
                // Skip if we already have a goal for this item
                if (processedItems.has(itemId)) continue;
                
                // Skip certain items we don't want to bank (like coins, gems)
                if (this.shouldSkipBankingItem(itemId)) continue;
                
                // Calculate appropriate goal quantity
                const targetQuantity = this.calculateItemGoalQuantity(
                    activityData,
                    reward,
                    currentLevel
                );
                
                if (targetQuantity > 0) {
                    goals.push({
                        type: 'bank_items',
                        itemId: itemId,
                        targetCount: targetQuantity,
                        priority: existingGoalCount + goals.length + 1,
                        skill: skill, // Track which skill this is from
                        requiredLevel: requiredLevel
                    });
                    
                    processedItems.add(itemId);
                }
            }
        }
        
        // Sort goals by skill and level requirement for better progression
        goals.sort((a, b) => {
            // Prioritize lower level requirements first
            if (a.requiredLevel !== b.requiredLevel) {
                return a.requiredLevel - b.requiredLevel;
            }
            // Then by skill name for consistency
            return a.skill.localeCompare(b.skill);
        });
        
        return goals;
    }
    
    // Calculate appropriate quantity for an item goal
    calculateItemGoalQuantity(activityData, reward, currentLevel) {
        const requiredLevel = reward.requiredLevel || activityData.requiredLevel || 1;
        
        // Base calculation: level requirement influences quantity
        // Higher level items are rarer/harder, so we want fewer
        const levelMultiplier = Math.max(1, 100 - requiredLevel); // 99 at level 1, 1 at level 99
        
        // Factor in success rate if available
        let successRate = 1.0;
        if (reward.chanceScaling) {
            successRate = this.getScaledChance(reward, currentLevel);
        } else if (reward.chance) {
            successRate = reward.chance;
        }
        
        // Base quantity formula
        // For low level items (level 1-20): 50-200 items
        // For mid level items (level 20-50): 30-150 items  
        // For high level items (level 50+): 20-100 items
        let minQuantity, maxQuantity;
        
        if (requiredLevel < 20) {
            minQuantity = 50;
            maxQuantity = 200;
        } else if (requiredLevel < 50) {
            minQuantity = 30;
            maxQuantity = 150;
        } else if (requiredLevel < 75) {
            minQuantity = 20;
            maxQuantity = 100;
        } else {
            minQuantity = 10;
            maxQuantity = 50;
        }
        
        // Adjust for success rate (lower success = lower targets)
        minQuantity = Math.ceil(minQuantity * successRate);
        maxQuantity = Math.ceil(maxQuantity * successRate);
        
        // Add some randomization for variety
        const targetQuantity = minQuantity + Math.floor(Math.random() * (maxQuantity - minQuantity));
        
        // Round to nearest 10 for cleaner goals
        return Math.round(targetQuantity / 10) * 10;
    }
    
    // Determine if we should skip making a banking goal for this item
    shouldSkipBankingItem(itemId) {
        const skipItems = [
            'coins', // Currency
            'uncut_sapphire', 'uncut_emerald', 'uncut_ruby', 'uncut_diamond', // Gems (rare)
            'goblin_mail', // Junk armor
            'feather', 'fishing_bait' // Consumables we buy/find
        ];
        
        return skipItems.includes(itemId);
    }
    
    // Generate skill training goals
    generateSkillGoals(currentSkillLevels, existingGoalCount) {
        const goals = [];
        const trainableSkills = ['woodcutting', 'mining', 'fishing', 'attack'];
        
        for (const skill of trainableSkills) {
            const currentLevel = currentSkillLevels[skill] || 1;
            
            if (currentLevel >= 99) continue; // Max level
            
            // Generate milestone goals (every 10 levels, or next 5 if close)
            let targetLevel;
            if (currentLevel % 10 <= 2) {
                // Just reached a milestone, aim for next 10
                targetLevel = Math.ceil(currentLevel / 10) * 10;
            } else if (currentLevel % 10 >= 7) {
                // Close to milestone, aim for it
                targetLevel = Math.ceil(currentLevel / 10) * 10;
            } else {
                // In the middle, aim for +5 or +10 randomly
                targetLevel = currentLevel + (Math.random() < 0.5 ? 5 : 10);
            }
            
            targetLevel = Math.min(targetLevel, 99);
            
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

    // ==================== DEFAULT BEHAVIORS ====================
    
    defaultDuration(baseDuration, skillLevel, activityData) {
        // Simple duration - no scaling
        return baseDuration;
    }

    defaultRewards(activityData, skillLevel) {
        const rewards = [];
        
        if (activityData.rewards) {
            for (const reward of activityData.rewards) {
                const chance = reward.chanceScaling ? 
                    this.getScaledChance(reward, skillLevel) : 
                    (reward.chance || 1.0);
                
                if (Math.random() <= chance) {
                    rewards.push({
                        itemId: reward.itemId,
                        quantity: reward.quantity
                    });
                }
            }
        }
        
        return rewards;
    }

    defaultShouldGrantXP(earnedRewards, activityData) {
        // Most skills grant XP regardless of rewards
        return true;
    }

    defaultXpRate(activityData, skillLevel) {
        // For other skills: simple calculation
        const xpPerAction = activityData.xpPerAction || 0;
        const duration = activityData.baseDuration || 1000;
        const actionsPerHour = 3600000 / duration;
        return actionsPerHour * xpPerAction;
    }

    defaultXpToGrant(earnedRewards, activityData) {
        // Default skills always grant their base XP
        return activityData.xpPerAction || 0;
    }

    // ==================== WOODCUTTING BEHAVIORS ====================
    
    woodcuttingDuration(baseDuration, skillLevel, activityData) {
        // Woodcutting doesn't scale duration with level
        return baseDuration;
    }

    woodcuttingRewards(activityData, skillLevel) {
        const rewards = [];
        
        if (activityData.rewards) {
            for (const reward of activityData.rewards) {
                const chance = reward.chanceScaling ? 
                    this.getScaledChance(reward, skillLevel) : 
                    (reward.chance || 1.0);
                
                if (Math.random() <= chance) {
                    rewards.push({
                        itemId: reward.itemId,
                        quantity: reward.quantity
                    });
                }
            }
        }
        
        return rewards;
    }

    woodcuttingShouldGrantXP(earnedRewards, activityData) {
        // Woodcutting only grants XP if you get logs
        return earnedRewards.length > 0;
    }

    woodcuttingXpRate(activityData, skillLevel) {
        // For woodcutting: XP * success chance / duration
        if (!activityData.rewards || activityData.rewards.length === 0) return 0;
        
        const mainReward = activityData.rewards[0];
        const successChance = mainReward.chanceScaling ? 
            this.getScaledChance(mainReward, skillLevel) :
            (mainReward.chance || 1.0);
        
        const duration = this.woodcuttingDuration(activityData.baseDuration, skillLevel, activityData);
        const xpPerAction = activityData.xpPerAction || 0;
        
        // Calculate XP per hour
        const actionsPerHour = 3600000 / duration;
        return actionsPerHour * xpPerAction * successChance;
    }

    woodcuttingXpToGrant(earnedRewards, activityData) {
        // Woodcutting grants XP only if logs were obtained
        if (earnedRewards.length > 0) {
            return activityData.xpPerAction || 0;
        }
        return 0;
    }

    // ==================== MINING BEHAVIORS ====================
    
    miningDuration(baseDuration, skillLevel, activityData) {
        // Check if activity has duration scaling data
        if (!activityData.durationScaling || !activityData.durationScaling.breakpoints) {
            return baseDuration;
        }

        const breakpoints = activityData.durationScaling.breakpoints;
        let applicableBreakpoint = null;

        // Find the highest breakpoint that the player's level meets
        for (const breakpoint of breakpoints) {
            if (skillLevel >= breakpoint.level) {
                applicableBreakpoint = breakpoint;
            } else {
                break; // Breakpoints should be ordered by level
            }
        }

        if (!applicableBreakpoint) {
            return baseDuration;
        }

        // Check if there's a boost chance at this level
        if (applicableBreakpoint.boostChance && applicableBreakpoint.boostDuration) {
            if (Math.random() < applicableBreakpoint.boostChance) {
                return applicableBreakpoint.boostDuration;
            }
        }

        return applicableBreakpoint.duration;
    }

    miningRewards(activityData, skillLevel) {
        const rewards = [];

        // First, roll for gems if gem table exists
        if (activityData.gemTable) {
            for (const gem of activityData.gemTable) {
                if (Math.random() <= gem.chance) {
                    rewards.push({
                        itemId: gem.itemId,
                        quantity: 1
                    });
                    // In OSRS, you can get multiple gems in one action
                    // but for simplicity, we'll return after first gem
                    return rewards;
                }
            }
        }

        // If no gem, roll for ore
        if (activityData.rewards) {
            for (const reward of activityData.rewards) {
                const chance = reward.chanceScaling ? 
                    this.getScaledChance(reward, skillLevel) : 
                    (reward.chance || 1.0);
                
                if (Math.random() <= chance) {
                    rewards.push({
                        itemId: reward.itemId,
                        quantity: reward.quantity
                    });
                }
            }
        }

        return rewards;
    }

    miningShouldGrantXP(earnedRewards, activityData) {
        // Mining only grants XP if you get ore (not gems)
        if (earnedRewards.length === 0) return false;

        // Check if any reward is an ore (not a gem)
        const gems = ['uncut_sapphire', 'uncut_emerald', 'uncut_ruby', 'uncut_diamond'];
        return earnedRewards.some(reward => !gems.includes(reward.itemId));
    }

    miningXpRate(activityData, skillLevel) {
        // For mining: XP * ore chance / average duration
        if (!activityData.rewards || activityData.rewards.length === 0) return 0;
        
        const mainReward = activityData.rewards[0];
        const successChance = mainReward.chanceScaling ? 
            this.getScaledChance(mainReward, skillLevel) :
            (mainReward.chance || 1.0);
        
        // Get average duration (accounting for boost chances)
        let avgDuration = activityData.baseDuration;
        if (activityData.durationScaling && activityData.durationScaling.breakpoints) {
            const breakpoints = activityData.durationScaling.breakpoints;
            let applicableBreakpoint = null;
            
            for (const breakpoint of breakpoints) {
                if (skillLevel >= breakpoint.level) {
                    applicableBreakpoint = breakpoint;
                } else {
                    break;
                }
            }
            
            if (applicableBreakpoint) {
                if (applicableBreakpoint.boostChance && applicableBreakpoint.boostDuration) {
                    // Calculate weighted average duration
                    avgDuration = (applicableBreakpoint.duration * (1 - applicableBreakpoint.boostChance)) +
                                  (applicableBreakpoint.boostDuration * applicableBreakpoint.boostChance);
                } else {
                    avgDuration = applicableBreakpoint.duration;
                }
            }
        }
        
        const xpPerAction = activityData.xpPerAction || 0;
        const actionsPerHour = 3600000 / avgDuration;
        return actionsPerHour * xpPerAction * successChance;
    }

    miningXpToGrant(earnedRewards, activityData) {
        // Mining grants XP only for ores, not gems
        const gems = ['uncut_sapphire', 'uncut_emerald', 'uncut_ruby', 'uncut_diamond'];
        const gotOre = earnedRewards.some(reward => !gems.includes(reward.itemId));
        
        if (gotOre) {
            return activityData.xpPerAction || 0;
        }
        return 0;
    }

    // ==================== FISHING BEHAVIORS ====================
    
    fishingDuration(baseDuration, skillLevel, activityData) {
        // Handle pike fishing special duration (1/5 chance for 3600ms instead of 3000ms)
        if (activityData.durationBoost) {
            if (Math.random() < activityData.durationBoost.chance) {
                return activityData.durationBoost.duration;
            }
        }
        return baseDuration;
    }

    fishingRewards(activityData, skillLevel) {
        // Fishing uses one-roll weighted distribution
        // First, calculate all possible catches
        const possibleCatches = [];
        let totalChance = 0;

        if (activityData.rewards) {
            for (const reward of activityData.rewards) {
                // Check if player meets level requirement for this fish
                if (reward.requiredLevel && skillLevel < reward.requiredLevel) {
                    continue;
                }

                let chance = 0;
                
                // Handle multi-range scaling (like raw trout has two ranges)
                if (Array.isArray(reward.chanceScaling)) {
                    // Find applicable range
                    for (const range of reward.chanceScaling) {
                        if (skillLevel >= range.minLevel && skillLevel <= range.maxLevel) {
                            chance = this.getScaledChanceFromRange(range, skillLevel);
                            break;
                        }
                    }
                } else if (reward.chanceScaling) {
                    chance = this.getScaledChance(reward, skillLevel);
                } else {
                    chance = reward.chance || 1.0;
                }

                if (chance > 0) {
                    possibleCatches.push({
                        itemId: reward.itemId,
                        quantity: reward.quantity,
                        chance: chance,
                        xpPerAction: reward.xpPerAction
                    });
                    totalChance += chance;
                }
            }
        }

        // Make ONE roll
        const roll = Math.random();
        
        // Determine what was caught based on the roll
        let cumulativeChance = 0;
        for (const catchOption of possibleCatches) {
            cumulativeChance += catchOption.chance;
            if (roll < cumulativeChance) {
                // Store the XP value for this catch so we can grant it later
                this.lastCatchXp = catchOption.xpPerAction;
                return [{
                    itemId: catchOption.itemId,
                    quantity: catchOption.quantity
                }];
            }
        }

        // No catch
        this.lastCatchXp = 0;
        return [];
    }

    fishingShouldGrantXP(earnedRewards, activityData) {
        // Fishing only grants XP if you catch something
        return earnedRewards.length > 0;
    }

    fishingXpRate(activityData, skillLevel) {
        // For fishing: sum of (fish XP * fish chance) / duration
        if (!activityData.rewards || activityData.rewards.length === 0) return 0;
        
        let expectedXpPerAction = 0;
        
        for (const reward of activityData.rewards) {
            // Skip fish the player can't catch yet
            if (reward.requiredLevel && skillLevel < reward.requiredLevel) {
                continue;
            }
            
            let chance = 0;
            
            // Handle multi-range scaling
            if (Array.isArray(reward.chanceScaling)) {
                for (const range of reward.chanceScaling) {
                    if (skillLevel >= range.minLevel && skillLevel <= range.maxLevel) {
                        chance = this.getScaledChanceFromRange(range, skillLevel);
                        break;
                    }
                }
            } else if (reward.chanceScaling) {
                chance = this.getScaledChance(reward, skillLevel);
            } else {
                chance = reward.chance || 1.0;
            }
            
            // Add this fish's expected XP contribution
            const fishXp = reward.xpPerAction || 0;
            expectedXpPerAction += fishXp * chance;
        }
        
        // Handle duration variations (like pike fishing)
        let avgDuration = activityData.baseDuration;
        if (activityData.durationBoost) {
            avgDuration = (activityData.baseDuration * (1 - activityData.durationBoost.chance)) +
                          (activityData.durationBoost.duration * activityData.durationBoost.chance);
        }
        
        const actionsPerHour = 3600000 / avgDuration;
        return actionsPerHour * expectedXpPerAction;
    }

    fishingXpToGrant(earnedRewards, activityData) {
        // Fishing uses the stored XP from the specific fish caught
        // This was set when we rolled for the catch in fishingRewards()
        return this.lastCatchXp || 0;
    }

    // ==================== UTILITY METHODS ====================
    
    // Helper method for multi-range scaling
    getScaledChanceFromRange(range, skillLevel) {
        // Clamp level to valid range
        const clampedLevel = Math.max(range.minLevel, Math.min(skillLevel, range.maxLevel));
        
        // Calculate progress through the level range (0 to 1)
        const levelProgress = (clampedLevel - range.minLevel) / (range.maxLevel - range.minLevel);
        
        // Linear interpolation between min and max chance
        return lerp(range.minChance, range.maxChance, levelProgress);
    }

    // Utility function for chance scaling
    getScaledChance(reward, skillLevel) {
        if (!reward.chanceScaling) {
            return reward.chance || 1.0;
        }
        
        const scaling = reward.chanceScaling;
        
        // Clamp level to valid range
        const clampedLevel = Math.max(scaling.minLevel, Math.min(skillLevel, scaling.maxLevel));
        
        // Calculate progress through the level range (0 to 1)
        const levelProgress = (clampedLevel - scaling.minLevel) / (scaling.maxLevel - scaling.minLevel);
        
        // Linear interpolation between min and max chance
        return lerp(scaling.minChance, scaling.maxChance, levelProgress);
    }

    // ==================== AI DECISION MAKING ====================

    // AI decision-making method - adds randomness between best XP and highest level
    chooseBestActivity(skillId, availableActivities, currentLevel) {
        let bestXpActivity = null;
        let bestXpRate = 0;
        let highestLevelActivity = null;
        let highestLevelReq = 0;
        
        const behavior = this.getBehavior(skillId);
        
        for (const [activityId, activityData] of availableActivities) {
            // Calculate XP rate for this activity
            const xpRate = behavior.getEffectiveXpRate(activityData, currentLevel);
            
            // Track best XP rate activity
            if (xpRate > bestXpRate) {
                bestXpRate = xpRate;
                bestXpActivity = activityId;
            }
            
            // Track highest level requirement activity (that we can do)
            const reqLevel = activityData.requiredLevel || 1;
            if (reqLevel > highestLevelReq && currentLevel >= reqLevel) {
                highestLevelReq = reqLevel;
                highestLevelActivity = activityId;
            }
        }
        
        // If both are the same, just return it
        if (bestXpActivity === highestLevelActivity) {
            return bestXpActivity;
        }
        
        // 50% chance to pick highest XP rate vs highest level requirement
        if (Math.random() < 0.5) {
            console.log(`Choosing best XP rate activity: ${bestXpActivity} (${Math.floor(bestXpRate)} XP/hr)`);
            return bestXpActivity;
        } else {
            console.log(`Choosing highest level activity: ${highestLevelActivity} (lvl ${highestLevelReq})`);
            return highestLevelActivity || bestXpActivity; // Fallback to best XP if no high level found
        }
    }

    // Public method to get XP rate for any activity
    getActivityXpRate(activityId) {
        const activities = loadingManager.getData('activities');
        const activityData = activities[activityId];
        if (!activityData) return 0;
        
        const behavior = this.getBehavior(activityData.skill);
        const skillLevel = skills.getLevel(activityData.skill);
        
        return behavior.getEffectiveXpRate(activityData, skillLevel);
    }
}

// Create global instance
window.skillBehaviors = new SkillBehaviors();
