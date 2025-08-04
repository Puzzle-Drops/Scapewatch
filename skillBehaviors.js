class SkillBehaviors {
    constructor() {
        this.behaviors = {
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
}

// Create global instance
window.skillBehaviors = new SkillBehaviors();
