class BaseSkill {
    constructor(id, name) {
        this.id = id;
        this.name = name;
    }
    
    // ==================== NEW GOAL GENERATION ====================
    
    generateSpecificGoals(count, startPriority) {
        const goals = [];
        let priority = startPriority;
        
        // Get all nodes that have activities for this skill
        const skillNodes = this.getNodesWithSkillActivities();
        if (skillNodes.length === 0) return goals;
        
        for (let i = 0; i < count; i++) {
            // Randomly decide: level goal (30%) or item goal (70%)
            if (Math.random() < 0.3 && skills.getLevel(this.id) < 99) {
                // Generate a level goal
                const levelGoal = this.createLevelGoal(priority);
                if (levelGoal) {
                    goals.push(levelGoal);
                    priority++;
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
    
    createLevelGoal(priority) {
        const currentLevel = skills.getLevel(this.id);
        if (currentLevel >= 99) return null;
        
        const targetLevel = this.calculateTargetLevel(currentLevel);
        
        return {
            type: 'skill_level',
            skill: this.id,
            targetLevel: targetLevel,
            priority: priority,
            description: `Train ${this.name} to level ${targetLevel}`
        };
    }
    
    createActivityGoal(skillNodes, priority) {
        // Pick a random node that has activities for THIS skill
        const node = skillNodes[Math.floor(Math.random() * skillNodes.length)];
        
        // Get activities at this node that are SPECIFICALLY for our skill
        const nodeActivities = this.getNodeActivitiesForSkill(node);
        if (nodeActivities.length === 0) return null;
        
        // Pick one of the activities that's actually at this node
        const activity = nodeActivities[Math.floor(Math.random() * nodeActivities.length)];
        
        // Verify this makes sense
        console.log(`Creating goal: ${activity.name} (${activity.id}) at ${node.name} (${node.id}) for ${this.name}`);
        
        // Generate goal based on activity
        return this.createGoalForActivity(node, activity, priority);
    }
    
    createGoalForActivity(node, activity, priority) {
        // Default implementation - subclasses should override
        // This creates a generic training goal
        return {
            type: 'skill_activity',
            skill: this.id,
            nodeId: node.id,
            activityId: activity.id,
            priority: priority,
            description: `${activity.name} at ${node.name}`
        };
    }
    
    getNodesWithSkillActivities() {
        const allNodes = nodes.getAllNodes();
        const skillNodes = [];
        
        for (const node of Object.values(allNodes)) {
            if (!node.activities) continue;
            
            // Check if any of this node's activities are for our skill
            const hasSkillActivity = node.activities.some(activityId => {
                const activity = loadingManager.getData('activities')[activityId];
                return activity && activity.skill === this.id;
            });
            
            if (hasSkillActivity) {
                skillNodes.push(node);
            }
        }
        
        return skillNodes;
    }
    
    getNodeActivitiesForSkill(node) {
        const activities = [];
        const allActivities = loadingManager.getData('activities');
        
        for (const activityId of node.activities || []) {
            const activity = allActivities[activityId];
            if (activity && activity.skill === this.id && this.canPerformActivity(activityId)) {
                activities.push({ id: activityId, ...activity });
            }
        }
        
        return activities;
    }
    
    calculateTargetLevel(currentLevel) {
        const mod = currentLevel % 10;
        return Math.min(99,
            mod <= 2 || mod >= 7 ? Math.ceil(currentLevel / 10) * 10 :
            currentLevel + (Math.random() < 0.5 ? 5 : 10)
        );
    }
    
    // ==================== CORE BEHAVIOR ====================
    
    getDuration(baseDuration, level, activityData) {
        return baseDuration; // Default: no scaling
    }
    
    processRewards(activityData, level) {
        // Default: standard reward processing
        return this.standardRewards(activityData, level);
    }
    
    shouldGrantXP(rewards, activityData) {
        return true; // Default: always grant XP
    }
    
    getXpToGrant(rewards, activityData) {
        return activityData.xpPerAction || 0;
    }
    
    // Called before activity starts - return false to prevent activity
    beforeActivityStart(activityData) {
        return true;
    }
    
    // Called after activity completes
    onActivityComplete(activityData) {
        // Override in subclass if needed
    }
    
    // ==================== BANKING DECISIONS ====================
    
    // Check if this skill needs banking given current inventory state
    needsBanking(goal) {
        // Default behavior for gathering skills: bank when inventory is full
        if (inventory.isFull()) {
            return true;
        }
        return false;
    }
    
    // Check if this skill can continue working with current inventory
    canContinueWithInventory(goal) {
        // Default: can continue if not full
        return !inventory.isFull();
    }
    
    // ==================== XP & PROGRESSION ====================
    
    calculateXpRate(activityData, level) {
        const avgDuration = this.getAverageDuration(activityData, level);
        const actionsPerHour = 3600000 / avgDuration;
        const xpPerAction = activityData.xpPerAction || 0;
        return actionsPerHour * xpPerAction;
    }
    
    getAverageDuration(activityData, level) {
        return this.getDuration(activityData.baseDuration, level, activityData);
    }
    
    chooseBestActivity(availableActivities, level) {
        // Default: choose highest XP rate
        let best = null;
        let bestXpRate = 0;
        
        for (const [activityId, activityData] of availableActivities) {
            const xpRate = this.calculateXpRate(activityData, level);
            if (xpRate > bestXpRate) {
                bestXpRate = xpRate;
                best = activityId;
            }
        }
        
        return best;
    }
    
    canPerformActivity(activityId) {
        const activityData = loadingManager.getData('activities')[activityId];
        if (!activityData || activityData.skill !== this.id) return false;
        
        const requiredLevel = activityData.requiredLevel || 1;
        const currentLevel = skills.getLevel(this.id);
        
        return currentLevel >= requiredLevel;
    }
    
    shouldBankItem(itemId) {
        return true; // Default: bank everything
    }
    
    // ==================== AI EXECUTION ====================
    
    executeGoal(goal, ai) {
        if (goal.type === 'skill_level') {
            this.trainSkill(ai);
        } else if (goal.type === 'skill_activity') {
            // The AI handles this directly now
            ai.executeActivityGoal(goal);
        }
    }
    
    trainSkill(ai) {
        const activities = this.getAvailableActivities();
        if (activities.length === 0) {
            console.log(`No available activities for ${this.id}`);
            ai.skipCurrentGoal(`${this.id} training impossible`);
            return;
        }
        
        const bestActivity = this.chooseBestActivity(activities, skills.getLevel(this.id));
        if (bestActivity) {
            ai.doActivity(bestActivity);
        }
    }
    
    getAvailableActivities() {
        const activities = loadingManager.getData('activities');
        const available = [];
        
        for (const [id, data] of Object.entries(activities)) {
            if (data.skill === this.id && this.canPerformActivity(id)) {
                available.push([id, data]);
            }
        }
        
        return available;
    }
    
    findActivityForItem(itemId) {
        const activities = this.getAvailableActivities();
        
        for (const [activityId, activityData] of activities) {
            if (activityData.rewards) {
                for (const reward of activityData.rewards) {
                    if (reward.itemId === itemId) {
                        return activityId;
                    }
                }
            }
        }
        
        return null;
    }
    
    // ==================== BANKING ====================
    
    handleBanking(ai, goal) {
        // Default: just deposit all
        bank.depositAll();
        ai.clearCooldown();
    }
    
    getItemsToWithdraw(goal) {
        return []; // Override in subclass if needed
    }
    
    // ==================== UTILITIES ====================
    
    getChance(reward, level) {
        if (Array.isArray(reward.chanceScaling)) {
            for (const range of reward.chanceScaling) {
                if (level >= range.minLevel && level <= range.maxLevel) {
                    return this.interpolateChance(range, level);
                }
            }
            return 0;
        } else if (reward.chanceScaling) {
            return this.interpolateChance(reward.chanceScaling, level);
        }
        return reward.chance || 1.0;
    }
    
    interpolateChance(scaling, level) {
        const clampedLevel = Math.max(scaling.minLevel, Math.min(level, scaling.maxLevel));
        const progress = (clampedLevel - scaling.minLevel) / (scaling.maxLevel - scaling.minLevel);
        return lerp(scaling.minChance, scaling.maxChance, progress);
    }
    
    standardRewards(activityData, level) {
        const rewards = [];
        if (activityData.rewards) {
            for (const reward of activityData.rewards) {
                if (!reward.requiredLevel || level >= reward.requiredLevel) {
                    if (Math.random() <= this.getChance(reward, level)) {
                        rewards.push({
                            itemId: reward.itemId,
                            quantity: reward.quantity || 1
                        });
                    }
                }
            }
        }
        return rewards;
    }
}
