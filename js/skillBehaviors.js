class SkillBehaviors {
    constructor() {
        this.behaviors = {
            fishing: {
                getDuration: this.fishingDuration.bind(this),
                processRewards: this.fishingRewards.bind(this),
                shouldGrantXP: this.fishingShouldGrantXP.bind(this)
            },
            woodcutting: {
                getDuration: this.woodcuttingDuration.bind(this),
                processRewards: this.woodcuttingRewards.bind(this),
                shouldGrantXP: this.woodcuttingShouldGrantXP.bind(this)
            },
            mining: {
                getDuration: this.miningDuration.bind(this),
                processRewards: this.miningRewards.bind(this),
                shouldGrantXP: this.miningShouldGrantXP.bind(this)
            },
            default: {
                getDuration: this.defaultDuration.bind(this),
                processRewards: this.defaultRewards.bind(this),
                shouldGrantXP: this.defaultShouldGrantXP.bind(this)
            }
        };
    }

    // Get behavior for a skill
    getBehavior(skillName) {
        return this.behaviors[skillName] || this.behaviors.default;
    }

    // Default behaviors (for skills without special mechanics)
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

    // Fishing specific behaviors
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
        // First, calculate all possible chances
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

    // Woodcutting specific behaviors
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

    // Mining specific behaviors
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

    // Utility function for chance scaling (moved from utils.js)
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

    // Helper method for multi-range scaling
    getScaledChanceFromRange(range, skillLevel) {
        // Clamp level to valid range
        const clampedLevel = Math.max(range.minLevel, Math.min(skillLevel, range.maxLevel));
        
        // Calculate progress through the level range (0 to 1)
        const levelProgress = (clampedLevel - range.minLevel) / (range.maxLevel - range.minLevel);
        
        // Linear interpolation between min and max chance
        return lerp(range.minChance, range.maxChance, levelProgress);
    }
    
}

// Create global instance
window.skillBehaviors = new SkillBehaviors();
