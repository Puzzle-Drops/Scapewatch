class FishingSkill extends BaseSkill {
    constructor() {
        super('fishing', 'Fishing');
        this.lastCatchXp = 0;
    }
    
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
    
    generateItemGoals(currentLevel, priority) {
        const goals = [];
        const fish = [
            { itemId: 'raw_shrimps', requiredLevel: 1, minCount: 100, maxCount: 300 },
            { itemId: 'raw_anchovies', requiredLevel: 15, minCount: 100, maxCount: 250 },
            { itemId: 'raw_sardine', requiredLevel: 5, minCount: 100, maxCount: 250 },
            { itemId: 'raw_herring', requiredLevel: 10, minCount: 100, maxCount: 200 },
            { itemId: 'raw_mackerel', requiredLevel: 16, minCount: 80, maxCount: 180 },
            { itemId: 'raw_trout', requiredLevel: 20, minCount: 80, maxCount: 150 },
            { itemId: 'raw_cod', requiredLevel: 23, minCount: 70, maxCount: 140 },
            { itemId: 'raw_pike', requiredLevel: 25, minCount: 60, maxCount: 120 },
            { itemId: 'raw_salmon', requiredLevel: 30, minCount: 60, maxCount: 100 },
            { itemId: 'raw_tuna', requiredLevel: 35, minCount: 50, maxCount: 100 },
            { itemId: 'raw_lobster', requiredLevel: 40, minCount: 40, maxCount: 80 },
            { itemId: 'raw_bass', requiredLevel: 46, minCount: 40, maxCount: 70 },
            { itemId: 'raw_swordfish', requiredLevel: 50, minCount: 30, maxCount: 60 },
            { itemId: 'raw_shark', requiredLevel: 76, minCount: 20, maxCount: 40 }
        ];
        
        for (const f of fish) {
            if (currentLevel >= f.requiredLevel) {
                const currentCount = bank.getItemCount(f.itemId);
                const targetCount = currentCount + 
                    Math.round((f.minCount + Math.random() * (f.maxCount - f.minCount)) / 10) * 10;
                
                goals.push({
                    type: 'bank_items',
                    itemId: f.itemId,
                    targetCount: targetCount,
                    priority: priority + goals.length
                });
            }
        }
        
        return goals;
    }
    
    canPerformActivity(activityId) {
        const activityData = loadingManager.getData('activities')[activityId];
        if (!activityData || activityData.skill !== this.id) return false;
        
        const requiredLevel = activityData.requiredLevel || 1;
        const currentLevel = skills.getLevel(this.id);
        
        if (currentLevel < requiredLevel) return false;
        
        // Check for required items (bait/feathers)
        if (activityData.consumeOnSuccess) {
            for (const required of activityData.consumeOnSuccess) {
                const hasInInventory = inventory.hasItem(required.itemId, required.quantity);
                const hasInBank = bank.getItemCount(required.itemId) > 0;
                if (!hasInInventory && !hasInBank) {
                    return false;
                }
            }
        }
        
        return true;
    }
    
    executeGoal(goal, ai) {
        if (goal.type === 'skill_level') {
            this.trainFishing(ai);
        } else if (goal.type === 'bank_items') {
            this.gatherFish(goal.itemId, ai);
        }
    }
    
    trainFishing(ai) {
        // Check if we need bait/feathers
        if (this.needsFishingSupplies(ai)) {
            this.getFishingSupplies(ai);
            return;
        }
        
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
    
    gatherFish(itemId, ai) {
        const activity = this.findActivityForItem(itemId);
        if (!activity) {
            console.log(`No fishing activity for ${itemId}`);
            ai.skipCurrentGoal(`Cannot fish ${itemId}`);
            return;
        }
        
        // Check if this activity needs supplies
        const activityData = loadingManager.getData('activities')[activity];
        if (activityData.consumeOnSuccess) {
            const hasSupplies = activityData.consumeOnSuccess.every(req => 
                inventory.hasItem(req.itemId, req.quantity)
            );
            
            if (!hasSupplies) {
                this.getFishingSupplies(ai);
                return;
            }
        }
        
        ai.doActivity(activity);
    }
    
    needsFishingSupplies(ai) {
        // Check if any of our available activities need supplies
        const activities = this.getAvailableActivities();
        
        for (const [id, data] of activities) {
            if (data.consumeOnSuccess) {
                for (const required of data.consumeOnSuccess) {
                    if (!inventory.hasItem(required.itemId, 1)) {
                        return true;
                    }
                }
            }
        }
        
        return false;
    }
    
    getFishingSupplies(ai) {
        // Go to bank to get bait/feathers
        const currentNode = nodes.getNode(player.currentNode);
        if (currentNode && currentNode.type === 'bank') {
            this.handleBanking(ai, ai.currentGoal);
        } else {
            ai.goToBank();
        }
    }
    
    handleBanking(ai, goal) {
        bank.depositAll();
        
        // Withdraw fishing supplies (bait and feathers)
        let withdrew = false;
        
        const baitCount = bank.getItemCount('fishing_bait');
        if (baitCount > 0) {
            const toWithdraw = Math.min(500, baitCount);
            bank.withdrawUpTo('fishing_bait', toWithdraw);
            inventory.addItem('fishing_bait', toWithdraw);
            withdrew = true;
            console.log(`Withdrew ${toWithdraw} fishing bait`);
        }
        
        const featherCount = bank.getItemCount('feather');
        if (featherCount > 0) {
            const toWithdraw = Math.min(500, featherCount);
            bank.withdrawUpTo('feather', toWithdraw);
            inventory.addItem('feather', toWithdraw);
            withdrew = true;
            console.log(`Withdrew ${toWithdraw} feathers`);
        }
        
        if (!withdrew) {
            console.log('No fishing supplies in bank');
            ai.skipCurrentGoal('No fishing supplies available');
            return;
        }
        
        ai.clearCooldown();
        ai.executeGoal(goal);
    }
}
