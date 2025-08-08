class FishingSkill extends BaseSkill {
    constructor() {
        super('fishing', 'Fishing');
        this.lastCatchXp = 0;
    }
    
    // ==================== GOAL GENERATION OVERRIDE ====================
    
    createGoalForActivity(node, activity, priority) {
        // For fishing, pick a specific fish to catch from this activity
        const targetFish = this.pickTargetFish(activity);
        if (!targetFish) {
            return super.createGoalForActivity(node, activity, priority);
        }
        
        const targetCount = this.determineTargetCount(targetFish.itemId);
        const itemData = loadingManager.getData('items')[targetFish.itemId];
        
        return {
            type: 'skill_activity',
            skill: this.id,
            nodeId: node.id,
            activityId: activity.id,
            targetItem: targetFish.itemId,
            targetCount: targetCount,
            priority: priority,
            description: `Catch ${targetCount} ${itemData.name} at ${node.name}`
        };
    }
    
    pickTargetFish(activity) {
        if (!activity.rewards) return null;
        
        // Get available fish based on level
        const level = skills.getLevel(this.id);
        const availableFish = activity.rewards.filter(r => 
            !r.requiredLevel || level >= r.requiredLevel
        );
        
        if (availableFish.length === 0) return null;
        
        // Pick the highest level fish we can catch (most of the time)
        // or a random one (sometimes) for variety
        if (Math.random() < 0.7) {
            // Pick highest level fish
            return availableFish.reduce((best, curr) => 
                (curr.requiredLevel || 1) > (best.requiredLevel || 1) ? curr : best
            );
        } else {
            // Pick random fish
            return availableFish[Math.floor(Math.random() * availableFish.length)];
        }
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
    
    // ==================== BANKING DECISIONS ====================
    
    needsBanking(goal) {
        // Check if goal requires supplies we don't have
        if (goal.type === 'skill_activity' && goal.activityId) {
            const activityData = loadingManager.getData('activities')[goal.activityId];
            if (activityData && activityData.consumeOnSuccess) {
                // Check if we have the required items
                for (const required of activityData.consumeOnSuccess) {
                    if (!inventory.hasItem(required.itemId, 1)) {
                        console.log(`Need ${required.itemId} for ${goal.activityId}, banking needed`);
                        return true;
                    }
                }
            }
        }
        
        // Standard banking when inventory is full
        if (inventory.isFull()) {
            console.log('Inventory full of fish, banking needed');
            return true;
        }
        
        return false;
    }
    
    canContinueWithInventory(goal) {
        // Can continue if we have space and supplies
        if (inventory.isFull()) return false;
        
        // Check for required supplies
        if (goal.type === 'skill_activity' && goal.activityId) {
            const activityData = loadingManager.getData('activities')[goal.activityId];
            if (activityData && activityData.consumeOnSuccess) {
                for (const required of activityData.consumeOnSuccess) {
                    if (!inventory.hasItem(required.itemId, 1)) {
                        return false;
                    }
                }
            }
        }
        
        return true;
    }
    
    // ==================== CORE BEHAVIOR ====================
    
    getDuration(baseDuration, level, activityData) {
        // Handle duration boosts (pike has 20% chance of 3600ms boost)
        if (activityData.durationBoost && Math.random() < activityData.durationBoost.chance) {
            return activityData.durationBoost.duration;
        }
        return baseDuration;
    }
    
    getAverageDuration(activityData, level) {
        if (activityData.durationBoost) {
            return (activityData.baseDuration * (1 - activityData.durationBoost.chance)) +
                   (activityData.durationBoost.duration * activityData.durationBoost.chance);
        }
        return activityData.baseDuration;
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
    
    calculateXpRate(activityData, level) {
        const avgDuration = this.getAverageDuration(activityData, level);
        const actionsPerHour = 3600000 / avgDuration;
        
        // Calculate expected XP per action
        const expectedXp = this.getExpectedXpPerAction(activityData, level);
        
        return actionsPerHour * expectedXp;
    }
    
    getExpectedXpPerAction(activityData, level) {
        if (!activityData.rewards) return 0;
        
        return activityData.rewards
            .filter(reward => !reward.requiredLevel || level >= reward.requiredLevel)
            .reduce((total, reward) => {
                const chance = this.getChance(reward, level);
                return total + (reward.xpPerAction || 0) * chance;
            }, 0);
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
    
    // ==================== AI EXECUTION ====================
    
    executeGoal(goal, ai) {
        if (goal.type === 'skill_level') {
            this.trainFishing(ai);
        } else if (goal.type === 'skill_activity') {
            // The AI handles this directly now
            ai.executeActivityGoal(goal);
        }
    }
    
    trainFishing(ai) {
        const activities = this.getAvailableActivities();
        if (activities.length === 0) {
            console.log('No fishing activities available');
            ai.skipCurrentGoal('fishing training impossible');
            return;
        }
        
        const bestActivity = this.chooseBestActivity(activities, skills.getLevel(this.id));
        if (bestActivity) {
            ai.doActivity(bestActivity);
        }
    }
    
    // ==================== BANKING ====================
    
    handleBanking(ai, goal) {
        // Deposit all fish first
        const deposited = bank.depositAll();
        console.log(`Deposited ${deposited} items`);
        
        // If we have a specific activity goal, get supplies for it
        if (goal.type === 'skill_activity' && goal.activityId) {
            const activityData = loadingManager.getData('activities')[goal.activityId];
            
            if (activityData && activityData.consumeOnSuccess) {
                for (const required of activityData.consumeOnSuccess) {
                    const bankCount = bank.getItemCount(required.itemId);
                    if (bankCount > 0) {
                        const toWithdraw = Math.min(500, bankCount);
                        bank.withdrawUpTo(required.itemId, toWithdraw);
                        inventory.addItem(required.itemId, toWithdraw);
                        console.log(`Withdrew ${toWithdraw} ${required.itemId} for fishing`);
                    }
                }
            }
        }
        
        // Update UI
        if (window.ui) {
            window.ui.updateSkillsList();
        }
        
        // Continue with goal
        ai.clearCooldown();
        if (goal) {
            ai.executeGoal(goal);
        }
    }
}
