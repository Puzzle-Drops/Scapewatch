class Player {
    constructor() {
        this.position = { x: 4395, y: 1882 }; // Start at Lumbridge bank
        this.targetPosition = null;
        this.currentNode = 'lumbridge_bank';
        this.targetNode = null; // Store target node ID
        this.currentActivity = null;
        this.activityProgress = 0;
        this.activityStartTime = 0;
        this.movementTimer = 0; // Timer for smooth interpolation
        this.movementInterval = 600; // 0.6 seconds in milliseconds
        this.movementStartPos = null; // Starting position for interpolation
        this.movementEndPos = null; // End position for interpolation
        this.path = [];
        this.pathIndex = 0;
        this.tilesMovedThisInterval = 0; // Track tiles moved in current interval
    }

    update(deltaTime) {
        // Handle movement along path
        if (this.path.length > 0 && this.pathIndex < this.path.length) {
            this.updatePathMovement(deltaTime);
        }

        // Handle activity
        if (this.currentActivity) {
            this.updateActivity(deltaTime);
        }
    }

    updatePathMovement(deltaTime) {
        // Initialize movement if not started
        if (!this.movementStartPos) {
            this.setupNextMovement();
        }

        // Update movement timer
        this.movementTimer += deltaTime;

        // Calculate interpolation progress (0 to 1)
        const progress = Math.min(this.movementTimer / this.movementInterval, 1);

        // Smoothly interpolate position
        if (this.movementEndPos) {
            this.position.x = this.movementStartPos.x + (this.movementEndPos.x - this.movementStartPos.x) * progress;
            this.position.y = this.movementStartPos.y + (this.movementEndPos.y - this.movementStartPos.y) * progress;
        }

        // Check if movement interval is complete
        if (this.movementTimer >= this.movementInterval) {
            // Complete the current movement
            if (this.movementEndPos) {
                this.position.x = this.movementEndPos.x;
                this.position.y = this.movementEndPos.y;
            }
            
            // Reset for next movement
            this.movementTimer = 0;
            this.movementStartPos = null;
            this.movementEndPos = null;
            this.tilesMovedThisInterval = 0;
            
            // Check if we've reached the end of the path
            if (this.pathIndex >= this.path.length) {
                this.onReachedTarget();
                this.path = [];
                this.pathIndex = 0;
                this.targetPosition = null;
            }
        }
    }

    setupNextMovement() {
        if (this.pathIndex >= this.path.length) return;

        // Set starting position
        this.movementStartPos = { x: this.position.x, y: this.position.y };
        
        // Calculate how far we can move (up to 2 tiles)
        let tilesLeft = 2;
        let endX = this.position.x;
        let endY = this.position.y;
        let finalPathIndex = this.pathIndex;
        
        // Move along the path up to 2 tiles
        while (tilesLeft > 0 && finalPathIndex < this.path.length) {
            const nextPoint = this.path[finalPathIndex];
            
            // Calculate tile distance to next point (using Chebyshev distance for grid movement)
            const dx = Math.abs(nextPoint.x - endX);
            const dy = Math.abs(nextPoint.y - endY);
            const tilesToNext = Math.max(dx, dy); // Chebyshev distance
            
            if (tilesToNext === 0) {
                // Already at this point, skip to next
                finalPathIndex++;
                continue;
            }
            
            if (tilesToNext <= tilesLeft) {
                // We can reach this point
                endX = nextPoint.x;
                endY = nextPoint.y;
                tilesLeft -= tilesToNext;
                finalPathIndex++;
            } else {
                // This point is too far, move partially towards it
                // Calculate the direction
                const dirX = Math.sign(nextPoint.x - endX);
                const dirY = Math.sign(nextPoint.y - endY);
                
                // Move the remaining tiles in that direction
                endX += dirX * tilesLeft;
                endY += dirY * tilesLeft;
                tilesLeft = 0;
                // Don't increment finalPathIndex since we didn't reach this waypoint
            }
        }
        
        // Set the end position and update path index
        this.movementEndPos = { x: endX, y: endY };
        this.pathIndex = finalPathIndex;
        
        // Update target position for visualization
        if (this.path.length > 0) {
            this.targetPosition = this.path[this.path.length - 1];
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
        
        // Check for required items
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

        // Grant XP based on skill-specific rules
        if (behavior.shouldGrantXP(earnedRewards, activityData)) {
            skills.addXp(activityData.skill, activityData.xpPerAction);
            
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
                this.path = path;
                this.pathIndex = 0;
                this.targetPosition = { ...node.position };
                this.targetNode = targetNodeId;
                this.movementTimer = 0;
                this.movementStartPos = null;
                this.movementEndPos = null;
                this.tilesMovedThisInterval = 0;
                this.stopActivity();
                
                console.log(`Found path to ${targetNodeId} with ${path.length} waypoints`);
                
                // Notify UI about movement change
                if (window.ui) {
                    window.ui.forceActivityUpdate();
                }
            } else {
                console.error(`No path found to node ${targetNodeId}`);
                // Still try to move there directly as fallback
                this.path = [
                    { x: this.position.x, y: this.position.y },
                    { x: node.position.x, y: node.position.y }
                ];
                this.pathIndex = 0;
                this.targetPosition = { ...node.position };
                this.targetNode = targetNodeId;
                this.movementTimer = 0;
                this.movementStartPos = null;
                this.movementEndPos = null;
                this.tilesMovedThisInterval = 0;
                this.stopActivity();
            }
        } else {
            // Fallback to direct movement if pathfinding not available
            this.path = [
                { x: this.position.x, y: this.position.y },
                { x: node.position.x, y: node.position.y }
            ];
            this.pathIndex = 0;
            this.targetPosition = { ...node.position };
            this.targetNode = targetNodeId;
            this.movementTimer = 0;
            this.movementStartPos = null;
            this.movementEndPos = null;
            this.tilesMovedThisInterval = 0;
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
        // This method is no longer used with discrete movement
        // Keeping it for compatibility but it doesn't affect movement
        const agilityLevel = skills.getLevel('agility');
        const speedBonus = 1 + (agilityLevel - 1) * 0.01; // 1% per level
        return 3.333 * speedBonus; // Original speed value
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
}
