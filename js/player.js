class Player {
    constructor() {
        this.position = { x: 4395, y: 1882 };
        this.targetPosition = null;
        this.currentNode = null;
        this.targetNode = null;
        this.currentActivity = null;
        this.activityProgress = 0;
        this.activityStartTime = 0;
        this.movementSpeed = 3;
        this.path = [];
        this.pathIndex = 0;
        this.segmentProgress = 0;
        this.isStunned = false;
        this.stunEndTime = 0;
        this.stunDuration = 0;
        this.isBanking = false;
        this.bankingEndTime = 0;
        this.bankingDuration = 600; // 0.6 seconds
        this.movementStartTime = 0;
        
        // Path preparation animation (white circle)
        this.isPreparingPath = false;
        this.pathPrepEndTime = 0;
        this.pathPrepDuration = 600; // 0.6 seconds
    }

    update(deltaTime) {
        // Handle movement along path (don't move while banking or preparing path)
        if (this.path.length > 0 && this.pathIndex < this.path.length && !this.isBanking && !this.isPreparingPath) {
            this.updateSmoothMovement(deltaTime);
        } else if (!this.currentNode && !this.isMoving()) {
            this.checkCurrentNode();
        }

        // Handle activity
        if (this.currentActivity) {
            this.updateActivity(deltaTime);
        }
        
        // Check if banking animation finished
        if (this.isBanking && Date.now() >= this.bankingEndTime) {
            this.isBanking = false;
            console.log('Banking animation complete');
            
            // Trigger AI to continue after banking
            if (window.ai) {
                window.ai.decisionCooldown = 0;
            }
        }
        
        // Check if path preparation animation finished
if (this.isPreparingPath && Date.now() >= this.pathPrepEndTime) {
    this.isPreparingPath = false;
    console.log('Path preparation complete');
    
    // CRITICAL: Reset segment progress to ensure smooth start
    // This prevents the first movement frame from using accumulated deltaTime
    this.segmentProgress = 0;
    this.pathIndex = 0;
    
    // Trigger AI to continue
    if (window.ai) {
        window.ai.decisionCooldown = 0;
    }
}
    }

    updateSmoothMovement(deltaTime) {
    
    if (this.pathIndex >= this.path.length) {
        this.path = [];
        this.pathIndex = 0;
        this.targetPosition = null;
        this.segmentProgress = 0;
        this.onReachedTarget();
        return;
    }

        const currentWaypoint = this.pathIndex === 0 ? this.position : this.path[this.pathIndex - 1];
        const targetWaypoint = this.path[this.pathIndex];

        const dx = targetWaypoint.x - currentWaypoint.x;
        const dy = targetWaypoint.y - currentWaypoint.y;
        const segmentDistance = Math.sqrt(dx * dx + dy * dy);

        if (segmentDistance < 0.001) {
            this.pathIndex++;
            this.segmentProgress = 0;
            return;
        }

        const moveDistance = (this.getMovementSpeed() * deltaTime) / 1000;
        const moveRatio = moveDistance / segmentDistance;

        this.segmentProgress += moveRatio;

        if (this.segmentProgress >= 1) {
            this.position.x = targetWaypoint.x;
            this.position.y = targetWaypoint.y;
            
            this.pathIndex++;
            this.segmentProgress = 0;
            
            if (this.pathIndex >= this.path.length) {
                this.path = [];
                this.pathIndex = 0;
                this.targetPosition = null;
                this.onReachedTarget();
            }
        } else {
            this.position.x = currentWaypoint.x + dx * this.segmentProgress;
            this.position.y = currentWaypoint.y + dy * this.segmentProgress;
        }
    }

    updateActivity(deltaTime) {
        if (!this.currentActivity) return;

        const activityData = loadingManager.getData('activities')[this.currentActivity];
        if (!activityData) return;

        // Get skill-specific duration
        const skill = skillRegistry.getSkillForActivity(this.currentActivity);
        const duration = skill ? 
            skill.getDuration(activityData.baseDuration, skills.getLevel(activityData.skill), activityData) :
            activityData.baseDuration;

        if (!duration) {
            this.stopActivity();
            return;
        }

        const elapsed = Date.now() - this.activityStartTime;
        this.activityProgress = Math.min(1, elapsed / duration);

        if (elapsed >= duration) {
            this.completeActivity();
        }
    }

    completeActivity() {
        const activityData = loadingManager.getData('activities')[this.currentActivity];
        const skill = skillRegistry.getSkillForActivity(this.currentActivity);
        
        if (!skill) {
            console.error('No skill found for activity:', this.currentActivity);
            this.stopActivity();
            return;
        }
        
        // Process rewards using skill-specific logic
        const earnedRewards = skill.processRewards(activityData, skills.getLevel(activityData.skill));
        
        // Add rewards to inventory
        for (const reward of earnedRewards) {
            const added = inventory.addItem(reward.itemId, reward.quantity);
            if (added < reward.quantity) {
                console.log('Inventory full!');
                this.stopActivity();
                if (window.ai) {
                    window.ai.decisionCooldown = 0;
                }
                return;
            }
        }

        // Consume items on success (for fishing)
        if (activityData.consumeOnSuccess && earnedRewards.length > 0) {
            for (const consumable of activityData.consumeOnSuccess) {
                inventory.removeItem(consumable.itemId, consumable.quantity);
            }
        }

        // Grant XP based on skill-specific rules
        if (skill.shouldGrantXP(earnedRewards, activityData)) {
            const xpToGrant = skill.getXpToGrant(earnedRewards, activityData);
            if (xpToGrant > 0) {
                skills.addXp(activityData.skill, xpToGrant);
            }
            
            // Grant additional XP (for combat)
            if (activityData.additionalXp) {
                for (const xp of activityData.additionalXp) {
                    skills.addXp(xp.skill, xp.amount);
                }
            }
        }
        
        // Let skill handle post-activity logic
        if (skill.onActivityComplete) {
            skill.onActivityComplete(activityData);
        }
        
        // Update UI
        if (window.ui) {
            window.ui.updateSkillsList();
        }

        // Update task progress for items earned (cooking handles its own progress)
        if (window.taskManager && earnedRewards.length > 0 && !activityData.cookingTable) {
            // Task manager will check if this contributes to the current task
            for (const reward of earnedRewards) {
                taskManager.updateProgressForItem(reward.itemId);
            }
            
            if (window.ui) {
                window.ui.updateTasks();
            }
        }

        // IMPORTANT: Check if processing skills should continue based on available materials
        if (window.ai && window.ai.currentTask) {
            const skill = skillRegistry.getSkillForActivity(this.currentActivity);
            
            // Check if this is a processing skill that needs specific materials
            if (skill && skill.isProcessingSkill) {
                if (skill.hasMaterialsForCurrentTask && !skill.hasMaterialsForCurrentTask()) {
                    console.log(`No more materials for current ${skill.id} task, stopping activity`);
                    this.stopActivity();
                    window.ai.decisionCooldown = 0;
                    return;
                }
            }
        }

        // Check if AI still has a valid task for this activity
        if (window.ai) {
            // If AI has no current task (was rerolled/invalidated), stop activity
            if (!window.ai.currentTask) {
                console.log('AI task was invalidated, stopping activity');
                this.stopActivity();
                window.ai.decisionCooldown = 0;
                return;
            }
            
            // Check if the task is complete
            if (window.ai.currentTask.progress >= 1) {
                console.log('Task completed after action!');
                this.stopActivity();
                window.ai.decisionCooldown = 0;
                window.ai.currentTask = null;
                return;
            }
            
            // Also check if this task is no longer the first incomplete task
            if (window.taskManager) {
                const firstIncomplete = taskManager.getFirstIncompleteTask();
                if (window.ai.currentTask !== firstIncomplete) {
                    console.log('Current task no longer first incomplete, switching tasks');
                    this.stopActivity();
                    window.ai.currentTask = null;
                    window.ai.decisionCooldown = 0;
                    return;
                }
            }
        }

        // Always let AI re-evaluate between actions to check for task changes
        if (window.ai) {
            // Give AI a chance to check if it should continue this activity
            window.ai.decisionCooldown = 0;
        }

        // Reset for next action
        if (this.currentActivity) {
            this.activityProgress = 0;
            this.activityStartTime = Date.now();
        }
    }

    moveTo(targetNodeId) {
        const nodesData = loadingManager.getData('nodes');
        const node = nodesData[targetNodeId];
        
        if (!node) {
            console.error(`Node ${targetNodeId} not found`);
            return;
        }

        // If we're already at the target node, don't move
        if (this.currentNode === targetNodeId) {
            console.log(`Already at node ${targetNodeId}`);
            return;
        }
        
        // Check if we should show path preparation animation
        // (not at a bank, not already preparing, and not already banking)
        const currentNodeData = this.currentNode ? nodes.getNode(this.currentNode) : null;
        const shouldPrepare = !this.isPreparingPath && 
                              !this.isBanking &&
                              (!currentNodeData || currentNodeData.type !== 'bank');
        
        // Clear current node when starting to move away
        if (this.currentNode && this.currentNode !== targetNodeId) {
            console.log(`Leaving node ${this.currentNode} to move to ${targetNodeId}`);
            this.currentNode = null;
        }

        // Calculate the path
        if (window.pathfinding) {
            const path = pathfinding.findPath(
                this.position.x,
                this.position.y,
                node.position.x,
                node.position.y
            );

            if (path && path.length > 0) {
                if (path.length > 1 && 
                    Math.abs(path[0].x - this.position.x) < 0.1 && 
                    Math.abs(path[0].y - this.position.y) < 0.1) {
                    path.shift();
                }
                
                // Set up the path (just like banking does)
                this.path = path;
                this.pathIndex = 0;
                this.segmentProgress = 0;
                this.targetPosition = { ...node.position };
                this.targetNode = targetNodeId;
                this.stopActivity();
                
                // If we should prepare, start the animation
                // Movement will be blocked by isPreparingPath check in update()
                if (shouldPrepare) {
                    this.startPathPreparation(600);
                    console.log(`Path to ${targetNodeId} prepared with animation (${path.length} waypoints)`);
                } else {
                    console.log(`Found path to ${targetNodeId} with ${path.length} waypoints`);
                }
            } else {
                console.error(`No path found to node ${targetNodeId}`);
                // Fallback path
                this.path = [{ x: node.position.x, y: node.position.y }];
                this.pathIndex = 0;
                this.segmentProgress = 0;
                this.targetPosition = { ...node.position };
                this.targetNode = targetNodeId;
                this.stopActivity();
                
                if (shouldPrepare) {
                    this.startPathPreparation(600);
                }
            }
        } else {
            // No pathfinding system fallback
            this.path = [{ x: node.position.x, y: node.position.y }];
            this.pathIndex = 0;
            this.segmentProgress = 0;
            this.targetPosition = { ...node.position };
            this.targetNode = targetNodeId;
            this.stopActivity();
            
            if (shouldPrepare) {
                this.startPathPreparation(600);
            }
        }
    }

    onReachedTarget() {
        if (this.targetNode) {
            this.currentNode = this.targetNode;
            this.targetNode = null;
            
            console.log(`Reached node: ${this.currentNode}`);
            
            if (window.ai) {
                window.ai.decisionCooldown = 0;
            }
        }
    }

    checkCurrentNode() {
        const previousNode = this.currentNode;
        
        const tolerance = 1;
        const allNodes = nodes.getAllNodes();
        let foundNode = false;
        
        // Special handling for firemaking - only check Y position
        if (this.currentActivity === 'firemaking' && this.currentNode) {
            const currentNodeData = allNodes[this.currentNode];
            if (currentNodeData) {
                // For firemaking, only check if we're on the same Y coordinate
                const yDist = Math.abs(this.position.y - currentNodeData.position.y);
                if (yDist <= tolerance) {
                    foundNode = true; // Stay at the firemaking node
                }
            }
        }
        
        // Normal node checking for non-firemaking activities
        if (!foundNode) {
            for (const [nodeId, node] of Object.entries(allNodes)) {
                const dist = distance(this.position.x, this.position.y, node.position.x, node.position.y);
                if (dist <= tolerance) {
                    if (this.currentNode !== nodeId) {
                        console.log(`Detected arrival at node: ${nodeId}`);
                        this.currentNode = nodeId;
                        foundNode = true;
                        
                        if (window.ai) {
                            window.ai.decisionCooldown = 0;
                        }
                    } else {
                        foundNode = true;
                    }
                    break;
                }
            }
        }
        
        if (!foundNode) {
            this.currentNode = null;
        }
        
        if (previousNode !== this.currentNode && this.currentActivity) {
            console.log(`Node changed, stopping activity`);
            this.stopActivity();
        }
    }

    startActivity(activityId) {
        const activityData = loadingManager.getData('activities')[activityId];
        if (!activityData) {
            console.error(`Activity ${activityId} not found`);
            return;
        }

        // Check level requirement
        const skill = skillRegistry.getSkillForActivity(activityId);
        if (skill && !skill.canPerformActivity(activityId)) {
            console.log(`Cannot perform activity ${activityId} - requirements not met`);
            return;
        }

        // Check required items
        if (!this.hasRequiredItems(activityId)) {
            console.log(`Cannot perform activity ${activityId} - missing required items`);
            return;
        }

        // Let skill handle pre-activity logic
        if (skill && skill.beforeActivityStart) {
            if (!skill.beforeActivityStart(activityData)) {
                console.log(`Activity ${activityId} cancelled by skill`);
                return;
            }
        }

        this.currentActivity = activityId;
        this.activityProgress = 0;
        this.activityStartTime = Date.now();
        
        console.log(`Started activity: ${activityData.name}`);
    }

    stopActivity() {
        if (this.currentActivity) {
            console.log(`Stopped activity: ${this.currentActivity}`);
            
            // Notify the skill that the activity was stopped
            const skill = skillRegistry.getSkillForActivity(this.currentActivity);
            if (skill && skill.onActivityStopped) {
                skill.onActivityStopped();
            }
            
            this.currentActivity = null;
            this.activityProgress = 0;
            
            // Clear the activity start time too
            this.activityStartTime = 0;
        }
    }

    startBanking(duration = 600) {
        this.isBanking = true;
        this.bankingDuration = duration;
        this.bankingEndTime = Date.now() + duration;
        console.log('Started banking animation');
    }

    startPathPreparation(duration = 600) {
        this.isPreparingPath = true;
        this.pathPrepDuration = duration;
        this.pathPrepEndTime = Date.now() + duration;
        console.log('Started path preparation animation');
    }

    getBankingProgress() {
        if (!this.isBanking) return 0;
        
        const elapsed = Date.now() - (this.bankingEndTime - this.bankingDuration);
        return Math.max(0, 1 - (elapsed / this.bankingDuration));
    }

    getPathPreparationProgress() {
        if (!this.isPreparingPath) return 0;
        
        const elapsed = Date.now() - (this.pathPrepEndTime - this.pathPrepDuration);
        return Math.max(0, 1 - (elapsed / this.pathPrepDuration));
    }

    getMovementSpeed() {
        const agilityLevel = skills.getLevel('agility');
        const speedBonus = 1 + (agilityLevel - 1) * 0.01;
        return this.movementSpeed * speedBonus;
    }

    isAtNode(nodeId) {
        return this.currentNode === nodeId && !this.targetPosition;
    }

    isMoving() {
        return this.path.length > 0 && this.pathIndex < this.path.length;
    }

    isPerformingActivity() {
        return this.currentActivity !== null;
    }

    isBusy() {
        return this.isMoving() || this.isPerformingActivity() || this.isBanking || this.isPreparingPath;
    }

    setStunned(stunned, duration = 0) {
        this.isStunned = stunned;
        if (stunned) {
            this.stunDuration = duration;
            this.stunEndTime = Date.now() + duration;
            // Stop any current activity
            this.stopActivity();
        } else {
            this.stunDuration = 0;
            this.stunEndTime = 0;
        }
    }

    getStunProgress() {
        if (!this.isStunned) return 0;
        
        const elapsed = Date.now() - (this.stunEndTime - this.stunDuration);
        return Math.min(1, elapsed / this.stunDuration);
    }

    hasRequiredItems(activityId) {
        const activityData = loadingManager.getData('activities')[activityId];
        if (!activityData) return false;

        // Check consumeOnSuccess items (fishing)
        if (activityData.consumeOnSuccess) {
            for (const required of activityData.consumeOnSuccess) {
                if (!inventory.hasItem(required.itemId, required.quantity)) {
                    console.log(`Missing required item: ${required.itemId} x${required.quantity}`);
                    return false;
                }
            }
        }

        // Check requiredItems (legacy)
        if (activityData.requiredItems) {
            for (const required of activityData.requiredItems) {
                if (!inventory.hasItem(required.itemId, required.quantity)) {
                    console.log(`Missing required item: ${required.itemId} x${required.quantity}`);
                    return false;
                }
            }
        }

        return true;
    }

    getRequiredItems(activityId) {
        const activityData = loadingManager.getData('activities')[activityId];
        if (!activityData) return [];

        const required = [];

        if (activityData.consumeOnSuccess) {
            for (const item of activityData.consumeOnSuccess) {
                required.push({
                    itemId: item.itemId,
                    quantity: item.quantity
                });
            }
        }

        if (activityData.requiredItems) {
            for (const item of activityData.requiredItems) {
                const existing = required.find(r => r.itemId === item.itemId);
                if (!existing) {
                    required.push({
                        itemId: item.itemId,
                        quantity: item.quantity
                    });
                }
            }
        }

        return required;
    }
}
