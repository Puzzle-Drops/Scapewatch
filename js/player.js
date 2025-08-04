class Player {
    constructor() {
        this.position = { x: 4395, y: 1882 }; // Start at Lumbridge bank
        this.targetPosition = null;
        this.currentNode = 'lumbridge_bank';
        this.targetNode = null; // Store target node ID
        this.currentActivity = null;
        this.activityProgress = 0;
        this.activityStartTime = 0;
        this.movementSpeed = 5; // pixels per second base
        this.path = [];
        this.pathIndex = 0;
    }

    update(deltaTime) {
        // Handle movement
        if (this.targetPosition) {
            this.updateMovement(deltaTime);
        }

        // Handle activity
        if (this.currentActivity) {
            this.updateActivity(deltaTime);
        }
    }

    updateMovement(deltaTime) {
        const speed = this.getMovementSpeed();
        const moveDistance = (speed * deltaTime) / 1000;

        const dx = this.targetPosition.x - this.position.x;
        const dy = this.targetPosition.y - this.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance <= moveDistance) {
            // Reached target
            this.position = { ...this.targetPosition };
            this.targetPosition = null;
            this.onReachedTarget();
        } else {
            // Move towards target
            const ratio = moveDistance / distance;
            this.position.x += dx * ratio;
            this.position.y += dy * ratio;
        }
    }

    updateActivity(deltaTime) {
        if (!this.currentActivity) return;

        const activityData = loadingManager.getData('activities')[this.currentActivity];
        if (!activityData) return;

        const duration = getActionDuration(
            activityData.baseDuration,
            skills.getLevel(activityData.skill),
            activityData.requiredLevel
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

        // Flag to track if we got a resource (for XP granting)
        let gotResource = false;

        // Give rewards
        if (activityData.rewards) {
            for (const reward of activityData.rewards) {
                // Get scaled chance for activities with scaling
                const scaledChance = getScaledChance(reward, skills.getLevel(activityData.skill));
                
                if (Math.random() <= scaledChance) {
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
                    gotResource = true; // We successfully got a resource
                }
            }
        }

        // Grant XP only if we got a resource (for woodcutting) or if it's not woodcutting
        const isWoodcutting = activityData.skill === 'woodcutting';
        if (!isWoodcutting || gotResource) {
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

        this.targetPosition = { ...node.position };
        this.targetNode = targetNodeId;
        this.stopActivity();
        
        // Notify UI about movement change
        if (window.ui) {
            window.ui.forceActivityUpdate();
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
        // Base speed modified by agility level
        const agilityLevel = skills.getLevel('agility');
        const speedBonus = 1 + (agilityLevel - 1) * 0.01; // 1% per level
        return this.movementSpeed * speedBonus;
    }

    isAtNode(nodeId) {
        return this.currentNode === nodeId && !this.targetPosition;
    }

    isMoving() {
        return this.targetPosition !== null;
    }

    isPerformingActivity() {
        return this.currentActivity !== null;
    }

    isBusy() {
        return this.isMoving() || this.isPerformingActivity();
    }
}
