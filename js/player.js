class Player {
    constructor() {
        // Validate starting position
        const startNode = loadingManager.getData('nodes')['lumbridge_bank'];
        if (startNode) {
            // Use node position if available
            this.position = { x: startNode.position.x, y: startNode.position.y };
        } else {
            // Fallback position
            this.position = { x: 4395, y: 1882 };
        }
        
        this.targetPosition = null;
        this.currentNode = 'lumbridge_bank';
        this.targetNode = null;
        this.currentActivity = null;
        this.activityProgress = 0;
        this.activityStartTime = 0;
        this.path = [];
        this.pathIndex = 0;
        this.speed = 3; // 3 pixels per second
        this.radius = 0.5; // Half a tile hitbox
    }

    update(deltaTime) {
        // Handle smooth movement along path
        if (this.path.length > 0 && this.pathIndex < this.path.length) {
            this.updateMovement(deltaTime);
        }

        // Handle activity
        if (this.currentActivity) {
            this.updateActivity(deltaTime);
        }
    }

    updateMovement(deltaTime) {
        if (this.pathIndex >= this.path.length) {
            // Reached the end of the path
            this.onReachedTarget();
            this.path = [];
            this.pathIndex = 0;
            this.targetPosition = null;
            return;
        }

        const targetPoint = this.path[this.pathIndex];
        const dx = targetPoint.x - this.position.x;
        const dy = targetPoint.y - this.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 0.1) {
            // Close enough to current waypoint, move to next
            this.pathIndex++;
            return;
        }

        // Calculate movement for this frame
        const moveDistance = this.speed * (deltaTime / 1000); // Convert ms to seconds
        
        if (distance <= moveDistance) {
            // We'll reach the waypoint this frame
            this.position.x = targetPoint.x;
            this.position.y = targetPoint.y;
            this.pathIndex++;
        } else {
            // Move towards the waypoint
            const moveRatio = moveDistance / distance;
            this.position.x += dx * moveRatio;
            this.position.y += dy * moveRatio;
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
                node.position.y,
                this.radius
            );

            if (path && path.length > 0) {
                this.path = path;
                this.pathIndex = 0;
                
                // Skip the first waypoint if we're very close to it
                if (path.length > 0) {
                    const dist = distance(this.position.x, this.position.y, path[0].x, path[0].y);
                    if (dist < 0.1) {
                        this.pathIndex = 1;
                    }
                }
                
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
            }
        } else {
            // Fallback to direct movement if pathfinding not available
            this.path = [{ x: node.position.x, y: node.position.y }];
            this.pathIndex = 0;
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
