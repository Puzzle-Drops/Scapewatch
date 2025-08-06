class Player {
constructor() {
    this.position = { x: 4395, y: 1882 }; // Start at Lumbridge bank
    this.targetPosition = null;
    this.currentNode = null;
    this.targetNode = null; // Store target node ID
    this.currentActivity = null;
    this.activityProgress = 0;
    this.activityStartTime = 0;
    this.movementSpeed = 3; // 3 tiles per second
    this.path = [];
    this.pathIndex = 0;
    this.segmentProgress = 0; // Progress along current path segment (0-1)
    
    // Track alternating states for activities
    this.alternatingStates = {};
}

    update(deltaTime) {
        // Handle movement along path
        if (this.path.length > 0 && this.pathIndex < this.path.length) {
            this.updateSmoothMovement(deltaTime);
        }

        // Handle activity
        if (this.currentActivity) {
            this.updateActivity(deltaTime);
        }
    }

    updateSmoothMovement(deltaTime) {
        if (this.pathIndex >= this.path.length) {
            // Reached end of path
            this.path = [];
            this.pathIndex = 0;
            this.targetPosition = null;
            this.segmentProgress = 0;
            this.onReachedTarget();
            return;
        }

        // Get current and next waypoint
        const currentWaypoint = this.pathIndex === 0 ? this.position : this.path[this.pathIndex - 1];
        const targetWaypoint = this.path[this.pathIndex];

        // Calculate distance between waypoints
        const dx = targetWaypoint.x - currentWaypoint.x;
        const dy = targetWaypoint.y - currentWaypoint.y;
        const segmentDistance = Math.sqrt(dx * dx + dy * dy);

        // If segment distance is 0, skip to next waypoint
        if (segmentDistance < 0.001) {
            this.pathIndex++;
            this.segmentProgress = 0;
            return;
        }

        // Calculate how much to move this frame
        const moveDistance = (this.getMovementSpeed() * deltaTime) / 1000; // Convert ms to seconds
        const moveRatio = moveDistance / segmentDistance;

        // Update segment progress
        this.segmentProgress += moveRatio;

        // Check if we've reached the target waypoint
        if (this.segmentProgress >= 1) {
            // Move to exact waypoint position
            this.position.x = targetWaypoint.x;
            this.position.y = targetWaypoint.y;
            
            // Move to next segment
            this.pathIndex++;
            this.segmentProgress = 0;
            
            // Check if we've completed the path
            if (this.pathIndex >= this.path.length) {
                this.path = [];
                this.pathIndex = 0;
                this.targetPosition = null;
                this.onReachedTarget();
            }
        } else {
            // Interpolate position along the segment
            this.position.x = currentWaypoint.x + dx * this.segmentProgress;
            this.position.y = currentWaypoint.y + dy * this.segmentProgress;
        }
    }

    updateActivity(deltaTime) {
        if (!this.currentActivity) return;

        const activityData = loadingManager.getData('activities')[this.currentActivity];
        if (!activityData) return;

        // Get skill-specific behavior
        const behavior = skillBehaviors.getBehavior(activityData.skill);
        const duration = behavior.getDuration(
            activityData.baseDuration,
            skills.getLevel(activityData.skill),
            activityData
        );

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
        
        // Check for required items (old system compatibility)
        if (activityData.requiredItems) {
            for (const req of activityData.requiredItems) {
                if (!inventory.hasItem(req.itemId, req.quantity)) {
                    this.stopActivity();
                    return;
                }
            }
            // Consume required items
            for (const req of activityData.requiredItems) {
                inventory.removeItem(req.itemId, req.quantity);
            }
        }

        // Get skill-specific behavior
        const behavior = skillBehaviors.getBehavior(activityData.skill);
        
        // Process rewards using skill-specific logic
        const earnedRewards = behavior.processRewards(activityData, skills.getLevel(activityData.skill));
        
        // Add rewards to inventory
        for (const reward of earnedRewards) {
            const added = inventory.addItem(reward.itemId, reward.quantity);
            if (added < reward.quantity) {
                // Inventory full
                console.log('Inventory full!');
                this.stopActivity();
                // Reset AI decision cooldown to react immediately
                if (window.ai) {
                    window.ai.decisionCooldown = 0;
                }
                return;
            }
        }

        // Consume items on success (for fishing bait/feathers)
        if (activityData.consumeOnSuccess && earnedRewards.length > 0) {
            for (const consumable of activityData.consumeOnSuccess) {
                inventory.removeItem(consumable.itemId, consumable.quantity);
            }
        }

        // Grant XP based on skill-specific rules
        if (behavior.shouldGrantXP(earnedRewards, activityData)) {
            const xpToGrant = behavior.getXpToGrant(earnedRewards, activityData);
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
        
        // Update UI to show new XP/levels
        if (window.ui) {
            window.ui.updateSkillsList();
        }

        // Check if current goal is complete after this action
        if (window.ai && window.ai.currentGoal && window.ai.isGoalComplete(window.ai.currentGoal)) {
            console.log('Goal completed after action!');
            this.stopActivity();
            // Force AI to make a new decision immediately
            if (window.ai) {
                window.ai.decisionCooldown = 0;
                window.ai.currentGoal = null;
                window.ai.plannedActivity = null;
            }
            return;
        }

        // Reset for next action if we're continuing
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

        // Find path to target
        if (window.pathfinding) {
            const path = pathfinding.findPath(
                this.position.x,
                this.position.y,
                node.position.x,
                node.position.y
            );

            if (path && path.length > 0) {
                // Remove the first point if it's our current position
                if (path.length > 1 && 
                    Math.abs(path[0].x - this.position.x) < 0.1 && 
                    Math.abs(path[0].y - this.position.y) < 0.1) {
                    path.shift();
                }
                
                this.path = path;
                this.pathIndex = 0;
                this.segmentProgress = 0;
                this.targetPosition = { ...node.position };
                this.targetNode = targetNodeId;
                this.stopActivity();
                
                console.log(`Found path to ${targetNodeId} with ${path.length} waypoints`);
                
                // Notify UI about movement change
                if (window.ui) {
                    window.ui.forceActivityUpdate();
                }
            } else {
                console.error(`No path found to node ${targetNodeId}`);
                // Still try to move there directly as fallback
                this.path = [{ x: node.position.x, y: node.position.y }];
                this.pathIndex = 0;
                this.segmentProgress = 0;
                this.targetPosition = { ...node.position };
                this.targetNode = targetNodeId;
                this.stopActivity();
            }
        } else {
            // Fallback to direct movement if pathfinding not available
            this.path = [{ x: node.position.x, y: node.position.y }];
            this.pathIndex = 0;
            this.segmentProgress = 0;
            this.targetPosition = { ...node.position };
            this.targetNode = targetNodeId;
            this.stopActivity();
        }
    }

    onReachedTarget() {
        if (this.targetNode) {
            this.currentNode = this.targetNode;
            this.targetNode = null;
            
            console.log(`Reached node: ${this.currentNode}`);
            
            // Reset AI decision cooldown when reaching a destination
            if (window.ai) {
                window.ai.decisionCooldown = 0;
            }
            
            // Notify UI
            if (window.ui) {
                window.ui.forceActivityUpdate();
            }
        }
    }

    startActivity(activityId) {
        const activityData = loadingManager.getData('activities')[activityId];
        if (!activityData) {
            console.error(`Activity ${activityId} not found`);
            return;
        }

        if (!skills.canPerformActivity(activityId)) {
            console.log(`Cannot perform activity ${activityId} - level too low`);
            return;
        }

        // Check for required items (consumeOnSuccess acts as required items for fishing)
        if (!this.hasRequiredItems(activityId)) {
            console.log(`Cannot perform activity ${activityId} - missing required items`);
            return;
        }

        this.currentActivity = activityId;
        this.activityProgress = 0;
        this.activityStartTime = Date.now();
        
        console.log(`Started activity: ${activityData.name}`);
        
        // Notify UI
        if (window.ui) {
            window.ui.forceActivityUpdate();
        }
    }

    stopActivity() {
        if (this.currentActivity) {
            console.log(`Stopped activity: ${this.currentActivity}`);
        }
        this.currentActivity = null;
        this.activityProgress = 0;
        
        // Notify UI
        if (window.ui) {
            window.ui.forceActivityUpdate();
        }
    }

    getMovementSpeed() {
        // Calculate speed with agility bonus
        const agilityLevel = skills.getLevel('agility');
        const speedBonus = 1 + (agilityLevel - 1) * 0.01; // 1% per level
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
        return this.isMoving() || this.isPerformingActivity();
    }

    // Check if player has required items for an activity
    hasRequiredItems(activityId) {
        const activityData = loadingManager.getData('activities')[activityId];
        if (!activityData) return false;

        // Check consumeOnSuccess items (used as required items for fishing)
        if (activityData.consumeOnSuccess) {
            for (const required of activityData.consumeOnSuccess) {
                if (!inventory.hasItem(required.itemId, required.quantity)) {
                    console.log(`Missing required item: ${required.itemId} x${required.quantity}`);
                    return false;
                }
            }
        }

        // Check requiredItems if they exist (for compatibility)
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

    // Get list of required items for an activity
    getRequiredItems(activityId) {
        const activityData = loadingManager.getData('activities')[activityId];
        if (!activityData) return [];

        const required = [];

        // Add consumeOnSuccess items (used as required items for fishing)
        if (activityData.consumeOnSuccess) {
            for (const item of activityData.consumeOnSuccess) {
                required.push({
                    itemId: item.itemId,
                    quantity: item.quantity
                });
            }
        }

        // Add requiredItems if they exist (for compatibility)
        if (activityData.requiredItems) {
            for (const item of activityData.requiredItems) {
                // Check if not already in list
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
