class CombatSkill extends BaseSkill {
    constructor() {
        super('attack', 'Combat'); // Primary skill is attack
        this.combatSkills = ['attack', 'strength', 'defence', 'hitpoints'];
    }
    
    // ==================== GOAL GENERATION OVERRIDE ====================
    
    createGoalForActivity(node, activity, priority) {
        // For combat, we're training, not collecting items usually
        // But we might want to collect specific drops
        const drops = this.getValuableDrops(activity);
        
        if (drops.length > 0 && Math.random() < 0.3) {
            // 30% chance to make a loot goal
            const targetDrop = drops[0];
            const targetCount = 50 + Math.floor(Math.random() * 100);
            
            return {
                type: 'skill_activity',
                skill: this.id,
                nodeId: node.id,
                activityId: activity.id,
                targetItem: targetDrop.itemId,
                targetCount: targetCount,
                priority: priority,
                description: `Fight at ${node.name} for ${targetCount} ${targetDrop.itemId}`
            };
        } else {
            // Training goal
            return {
                type: 'skill_activity',
                skill: this.id,
                nodeId: node.id,
                activityId: activity.id,
                priority: priority,
                description: `Train combat at ${node.name}`
            };
        }
    }
    
    getValuableDrops(activity) {
        if (!activity.rewards) return [];
        
        // Filter for non-coin drops
        return activity.rewards.filter(r => 
            r.itemId !== 'coins' && r.chance < 0.5
        );
    }
    
    // Combat generates goals for multiple skills
    generateSpecificGoals(count, startPriority) {
        const goals = [];
        let priority = startPriority;
        
        // Get all nodes that have combat activities
        const skillNodes = this.getNodesWithSkillActivities();
        if (skillNodes.length === 0) return goals;
        
        for (let i = 0; i < count; i++) {
            // Mix between level goals (40%) and activity goals (60%)
            if (Math.random() < 0.4) {
                // Generate a level goal for a combat skill
                const skillIndex = i % this.combatSkills.length;
                const targetSkill = this.combatSkills[skillIndex];
                
                const currentLevel = skills.getLevel(targetSkill);
                if (currentLevel < 99) {
                    const targetLevel = this.calculateTargetLevel(currentLevel);
                    
                    goals.push({
                        type: 'skill_level',
                        skill: targetSkill,
                        targetLevel: targetLevel,
                        priority: priority++,
                        description: `Train ${targetSkill} to level ${targetLevel}`
                    });
                }
            } else {
                // Generate a specific activity goal
                const activityGoal = this.createActivityGoal(skillNodes, priority);
                if (activityGoal) {
                    goals.push(activityGoal);
                    priority++;
                }
            }
        }
        
        return goals;
    }
    
    // ==================== BANKING DECISIONS ====================
    
    needsBanking(goal) {
        // Combat banks when inventory is full since loot takes space
        if (inventory.isFull()) {
            console.log('Inventory full from combat loot, banking needed');
            return true;
        }
        return false;
    }
    
    canContinueWithInventory(goal) {
        // Combat can continue as long as inventory isn't full
        return !inventory.isFull();
    }
    
    // ==================== CORE BEHAVIOR ====================
    
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
    
    // ==================== BANKING ====================
    
    handleBanking(ai, goal) {
        // Combat just deposits everything
        const deposited = bank.depositAll();
        console.log(`Deposited ${deposited} items from combat`);
        
        // Update UI
        if (window.ui) {
            window.ui.updateSkillsList();
        }
        
        // Continue combat
        ai.clearCooldown();
        if (goal) {
            ai.executeGoal(goal);
        }
    }
}
