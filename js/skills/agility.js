class AgilitySkill extends BaseSkill {
    constructor() {
        super('agility', 'Agility');
        this.isRunningLap = false;
        this.lapWaypoints = [];
        this.currentWaypointIndex = 0;
        this.originalMovementSpeed = 3;
        this.lapMovementSpeed = 3;
    }
    
    // ==================== TASK GENERATION ====================
    
    getTaskVerb() {
        return 'Complete';
    }
    
    generateTask() {
        // Get all possible agility courses at current level
        const possibleCourses = this.getAvailableCourses();
        if (possibleCourses.length === 0) {
            console.log('No agility courses available at current level');
            return null;
        }
        
        // Select a course using weighted distribution
        const selectedCourse = this.selectWeightedItem(possibleCourses);
        if (!selectedCourse) {
            console.log('Failed to select agility course');
            return null;
        }
        
        // Find the node for this course
        const courseNode = this.findNodeForCourse(selectedCourse.activityId);
        if (!courseNode) {
            console.log(`No node found for agility course ${selectedCourse.activityId}`);
            return null;
        }
        
        // Determine number of laps
        const lapCount = this.determineLapCount(selectedCourse.activityId);
        
        // Get activity data for the name
        const activityData = loadingManager.getData('activities')[selectedCourse.activityId];
        const nodeData = nodes.getNode(courseNode);
        
        return {
            skill: this.id,
            itemId: `agility_laps_${selectedCourse.activityId}`, // Virtual item for tracking
            targetCount: lapCount,
            nodeId: courseNode,
            activityId: selectedCourse.activityId,
            description: `${lapCount} laps at ${nodeData.name}`,
            startingCount: 0,
            progress: 0,
            isAgilityTask: true,
            lapsCompleted: 0
        };
    }
    
    getAvailableCourses() {
        const courses = [];
        const activities = loadingManager.getData('activities');
        const currentLevel = skills.getLevel('agility');
        
        for (const [activityId, activity] of Object.entries(activities)) {
            if (activity.skill !== 'agility') continue;
            
            const requiredLevel = activity.requiredLevel || 1;
            if (currentLevel < requiredLevel) continue;
            
            courses.push({
                activityId: activityId,
                requiredLevel: requiredLevel
            });
        }
        
        return courses;
    }
    
    findNodeForCourse(activityId) {
        const allNodes = nodes.getAllNodes();
        
        for (const [nodeId, node] of Object.entries(allNodes)) {
            if (node.activities && node.activities.includes(activityId)) {
                return nodeId;
            }
        }
        
        return null;
    }
    
    determineLapCount(activityId) {
        // Base lap counts on course difficulty/level
        const lapCounts = {
            'draynor_rooftop': { min: 10, max: 25 },
            'al_kharid_rooftop': { min: 10, max: 20 },
            'varrock_rooftop': { min: 8, max: 18 },
            'canifis_rooftop': { min: 10, max: 20 },
            'falador_rooftop': { min: 8, max: 15 },
            'seers_rooftop': { min: 10, max: 20 },
            'pollnivneach_rooftop': { min: 8, max: 15 },
            'rellekka_rooftop': { min: 8, max: 15 },
            'ardougne_rooftop': { min: 8, max: 15 }
        };
        
        const counts = lapCounts[activityId] || { min: 10, max: 20 };
        const baseCount = counts.min + Math.random() * (counts.max - counts.min);
        return Math.round(baseCount);
    }
    
    // Update task progress when lap completes
    updateAgilityTaskProgress() {
        if (!window.taskManager) return;
        
        const currentTask = taskManager.getFirstIncompleteTask();
        
        if (currentTask && currentTask.isAgilityTask) {
            currentTask.lapsCompleted = (currentTask.lapsCompleted || 0) + 1;
            const progress = currentTask.lapsCompleted / currentTask.targetCount;
            
            console.log(`Agility progress: ${currentTask.lapsCompleted}/${currentTask.targetCount} laps`);
            
            taskManager.setTaskProgress(currentTask, progress);
        }
    }
    
    // ==================== CORE BEHAVIOR ====================
    
    getDuration(baseDuration, level, activityData) {
        // For agility, duration is the lap time
        return activityData.lapTime || baseDuration;
    }
    
    beforeActivityStart(activityData) {
        // Check if inventory is full (need space for marks of grace)
        if (inventory.isFull()) {
            console.log('Inventory full - need space for marks of grace');
            if (window.ai) {
                window.ai.decisionCooldown = 0;
            }
            return false;
        }
        
        // Store lap data
        this.lapWaypoints = activityData.lapPositions || [];
        this.currentWaypointIndex = 0;
        this.lapMovementSpeed = activityData.lapSpeed || 3;
        this.originalMovementSpeed = player.movementSpeed;
        
        // Start the lap movement
        this.startLapMovement();
        
        return true;
    }
    
    startLapMovement() {
    if (this.lapWaypoints.length === 0) {
        console.error('No waypoints defined for agility course');
        return;
    }
    
    // Debug: Calculate total lap distance
    let totalDistance = 0;
    for (let i = 1; i < this.lapWaypoints.length; i++) {
        const prev = this.lapWaypoints[i - 1];
        const curr = this.lapWaypoints[i];
        const dist = Math.sqrt(Math.pow(curr.x - prev.x, 2) + Math.pow(curr.y - prev.y, 2));
        totalDistance += dist;
    }
    
    // Also add distance from player's current position to first waypoint
    if (window.player && this.lapWaypoints.length > 0) {
        const distToFirst = Math.sqrt(
            Math.pow(this.lapWaypoints[0].x - player.position.x, 2) + 
            Math.pow(this.lapWaypoints[0].y - player.position.y, 2)
        );
        totalDistance += distToFirst;
    }
    
    const expectedTime = totalDistance / this.lapMovementSpeed;
    console.log(`=== AGILITY LAP DEBUG ===`);
    console.log(`Waypoints: ${this.lapWaypoints.length}`);
    console.log(`Lap distance: ${totalDistance.toFixed(1)} tiles`);
    console.log(`Movement speed: ${this.lapMovementSpeed} tiles/second`);
    console.log(`Expected movement time: ${(expectedTime * 1000).toFixed(0)}ms (${expectedTime.toFixed(1)}s)`);
    console.log(`Activity duration (lapTime): ${player.currentActivity ? loadingManager.getData('activities')[player.currentActivity].lapTime : 'unknown'}ms`);
    console.log(`=========================`);
    
    this.isRunningLap = true;
    this.currentWaypointIndex = 0;
    
    // Set lap movement speed
    if (window.player) {
        player.movementSpeed = this.lapMovementSpeed;
        
        // Start moving to first waypoint (no collision)
        this.moveToNextWaypoint();
    }
}
    
    moveToNextWaypoint() {
        if (!this.isRunningLap || this.currentWaypointIndex >= this.lapWaypoints.length) {
            // Lap complete
            this.onLapComplete();
            return;
        }
        
        const waypoint = this.lapWaypoints[this.currentWaypointIndex];
        
        // Set up direct path to waypoint (no pathfinding, ignore collision)
        if (window.player) {
            player.path = [{ x: waypoint.x, y: waypoint.y }];
            player.pathIndex = 0;
            player.segmentProgress = 0;
            player.targetPosition = { x: waypoint.x, y: waypoint.y };
            
            // Set a flag so player knows this is agility movement
            player.isAgilityMovement = true;
            
            console.log(`Moving to waypoint ${this.currentWaypointIndex + 1}/${this.lapWaypoints.length}`);
        }
    }
    
    onReachedWaypoint() {
        console.log(`Reached waypoint ${this.currentWaypointIndex + 1}/${this.lapWaypoints.length}`);
        
        this.currentWaypointIndex++;
        
        if (this.currentWaypointIndex < this.lapWaypoints.length) {
            // Move to next waypoint
            this.moveToNextWaypoint();
        } else {
            // Lap complete
            this.onLapComplete();
        }
    }
    
    onLapComplete() {
        console.log('Agility lap complete!');
        
        this.isRunningLap = false;
        
        // Reset movement speed
        if (window.player) {
            player.movementSpeed = this.originalMovementSpeed;
            player.isAgilityMovement = false;
        }
        
        // The activity will complete naturally after this
    }
    
    processRewards(activityData, level) {
        const rewards = [];
        
        // Always grant XP (handled separately)
        
        // Check for mark of grace
        const markChance = activityData.markOfGraceChance || (1/8);
        if (Math.random() < markChance) {
            rewards.push({
                itemId: 'mark_of_grace',
                quantity: 1
            });
            console.log('Received mark of grace!');
        }
        
        // Update task progress
        this.updateAgilityTaskProgress();
        
        return rewards;
    }
    
    shouldGrantXP(rewards, activityData) {
        // Always grant XP for completing a lap
        return true;
    }
    
    getXpToGrant(rewards, activityData) {
        return activityData.xpPerLap || activityData.xpPerAction || 0;
    }
    
    onActivityComplete(activityData) {
        // Make sure we've reset everything
        this.isRunningLap = false;
        if (window.player) {
            player.movementSpeed = this.originalMovementSpeed;
            player.isAgilityMovement = false;
        }
    }
    
    onActivityStopped() {
        // Clean up if activity is interrupted
        console.log('Agility activity stopped, cleaning up');
        this.isRunningLap = false;
        if (window.player) {
            player.movementSpeed = this.originalMovementSpeed;
            player.isAgilityMovement = false;
        }
    }
    
    // ==================== BANKING ====================
    
    needsBankingForTask(task) {
        // Bank if inventory is full (need space for marks of grace)
        return inventory.isFull();
    }
    
    handleBanking(task) {
        // Simple banking - just deposit all
        const deposited = bank.depositAll();
        console.log(`Deposited ${deposited} items before agility`);
        return true;
    }
    
    // Check if player reached a waypoint (called from player.js)
    checkWaypointReached(position) {
        if (!this.isRunningLap || this.currentWaypointIndex >= this.lapWaypoints.length) {
            return false;
        }
        
        const waypoint = this.lapWaypoints[this.currentWaypointIndex];
        const distance = Math.sqrt(
            Math.pow(position.x - waypoint.x, 2) + 
            Math.pow(position.y - waypoint.y, 2)
        );
        
        // Check if close enough to waypoint (within 0.5 tiles)
        if (distance < 0.5) {
            this.onReachedWaypoint();
            return true;
        }
        
        return false;
    }
}
