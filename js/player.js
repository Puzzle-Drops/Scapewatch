class Player {
    constructor() {
        this.position = { x: 500, y: 400 }; // Start at Lumbridge bank
        this.targetPosition = null;
        this.currentNode = 'lumbridge_bank';
        this.currentActivity = null;
        this.activityProgress = 0;
        this.activityStartTime = 0;
        this.movementSpeed = 100; // pixels per second base
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

        if (this.activityProgress >= 1) {
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

        // Grant XP
        skills.addXp(activityData.skill, activityData.xpPerAction);

        // Grant additional XP (for combat)
        if (activityData.additionalXp) {
            for (const xp of activityData.additionalXp) {
                skills.addXp(xp.skill, xp.amount);
            }
        }

        // Give rewards
        if (activityData.rewards) {
            for (const reward of activityData.rewards) {
                if (Math.random() <= reward.chance) {
                    const added = inventory.addItem(reward.itemId, reward.quantity);
                    if (added < reward.quantity) {
                        // Inventory full
                        console.log('Inventory full!');
                        this.stopActivity();
                        return;
                    }
                }
            }
        }

        // Reset for next action
        this.activityProgress = 0;
        this.activityStartTime = Date.now();
    }

    moveTo(targetNode) {
        const nodesData = loadingManager.getData('nodes');
        const node = nodesData[targetNode];
        
        if (!node) {
            console.error(`Node ${targetNode} not found`);
            return;
        }

        this.targetPosition = { ...node.position };
        this.targetNode = targetNode;
        this.stopActivity();
    }

    onReachedTarget() {
        if (this.targetNode) {
            this.currentNode = this.targetNode;
            this.targetNode = null;
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
    }

    stopActivity() {
        this.currentActivity = null;
        this.activityProgress = 0;
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
