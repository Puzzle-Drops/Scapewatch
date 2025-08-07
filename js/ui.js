class UIManager {
    constructor() {
        this.bankOpen = false;
        this.lastInventoryState = null;
        this.lastBankState = null;
        this.lastActivityState = null;
        this.lastGoalState = null;
        this.itemOrder = null; // Cache for item order
        this.initializeUI();
    }

    // ==================== INITIALIZATION ====================

    initializeUI() {
        // Initialize item order from items.json
        this.initializeItemOrder();
        
        this.updateSkillsList();
        this.updateInventory();
        this.updateBank();
        this.updateActivity();
        this.updateGoal();
    }

    initializeItemOrder() {
        // Create an array of item IDs in the order they appear in items.json
        const itemsData = loadingManager.getData('items');
        this.itemOrder = Object.keys(itemsData);
        
        // Create a map for O(1) lookup of item position
        this.itemOrderMap = {};
        this.itemOrder.forEach((itemId, index) => {
            this.itemOrderMap[itemId] = index;
        });
    }

    // ==================== UPDATE CYCLE ====================

    // Called from game loop - only updates if data changed
    update() {
        // Activity updates frequently due to progress, but only if actually performing activity
        if (this.hasActivityChanged()) {
            this.updateActivity();
        }

        // Goal only updates when progress changes significantly
        if (this.hasGoalChanged()) {
            this.updateGoal();
        }
    }

    // Force update specific UI elements when data changes
    forceInventoryUpdate() {
        this.updateInventory();
    }

    forceBankUpdate() {
        if (this.bankOpen) {
            this.updateBank();
        }
    }

    forceActivityUpdate() {
        this.updateActivity();
    }

    forceGoalUpdate() {
        this.updateGoal();
    }

    // ==================== STATE CHANGE DETECTION ====================

    hasActivityChanged() {
        const currentState = {
            activity: player.currentActivity,
            moving: player.isMoving(),
            targetNode: player.targetNode,
            currentNode: player.currentNode,
            progress: player.currentActivity ? Math.floor(player.activityProgress * 100) : 0
        };

        const changed = JSON.stringify(currentState) !== JSON.stringify(this.lastActivityState);
        this.lastActivityState = currentState;
        return changed;
    }

    hasGoalChanged() {
        if (!window.ai || !window.ai.currentGoal) {
            const hasGoal = this.lastGoalState !== null;
            this.lastGoalState = null;
            return hasGoal;
        }

        const goal = window.ai.currentGoal;
        let currentState = {
            type: goal.type,
            target: goal.targetLevel || goal.targetCount || goal.questId
        };

        // Add current progress to state
        switch (goal.type) {
            case 'skill_level':
                currentState.level = skills.getLevel(goal.skill);
                currentState.xp = Math.floor(skills.getXp(goal.skill));
                break;
            case 'bank_items':
                currentState.count = bank.getItemCount(goal.itemId);
                break;
        }

        const changed = JSON.stringify(currentState) !== JSON.stringify(this.lastGoalState);
        this.lastGoalState = currentState;
        return changed;
    }

    // ==================== ACTIVITY & GOAL DISPLAY ====================

    updateActivity() {
        const activityName = document.getElementById('activity-name');
        const activityStatus = document.getElementById('activity-status');

        if (player.currentActivity) {
            this.displayCurrentActivity(activityName, activityStatus);
        } else if (player.isMoving()) {
            this.displayMovement(activityName, activityStatus);
        } else {
            this.displayIdle(activityName, activityStatus);
        }
    }

    displayCurrentActivity(activityName, activityStatus) {
        const activityData = loadingManager.getData('activities')[player.currentActivity];
        const currentNode = nodes.getNode(player.currentNode);
        
        // Format activity name with location
        let displayName = activityData.name;
        if (currentNode) {
            displayName = `${activityData.name} at ${currentNode.name}`;
        }
        activityName.textContent = displayName;

        // Get skill from registry and calculate XP rate
        const skill = skillRegistry.getSkill(activityData.skill);
        let xpPerHour = 0;
        if (skill) {
            xpPerHour = Math.floor(
                skill.calculateXpRate(activityData, skills.getLevel(activityData.skill))
            );
        }
        
        activityStatus.textContent = `${formatNumber(xpPerHour)} XP/hr`;
    }

    displayMovement(activityName, activityStatus) {
        const targetNode = nodes.getNode(player.targetNode);
        const targetName = targetNode ? targetNode.name : 'Unknown';
        activityName.textContent = 'Moving';
        activityStatus.textContent = `To: ${targetName}`;
    }

    displayIdle(activityName, activityStatus) {
        const currentNode = nodes.getNode(player.currentNode);
        if (currentNode) {
            activityName.textContent = `Idle at ${currentNode.name}`;
            if (window.ai && window.ai.currentGoal) {
                activityStatus.textContent = 'Planning next action...';
            } else {
                activityStatus.textContent = 'Waiting for AI decision...';
            }
        } else {
            activityName.textContent = 'Idle';
            activityStatus.textContent = 'Waiting for AI decision...';
        }
    }

    updateGoal() {
        const goalName = document.getElementById('goal-name');
        const goalProgress = document.getElementById('goal-progress');
        
        if (!window.ai || !window.ai.currentGoal) {
            this.displayNoGoal(goalName, goalProgress);
            return;
        }

        const goal = window.ai.currentGoal;
        
        switch (goal.type) {
            case 'skill_level':
                this.displaySkillGoal(goal, goalName, goalProgress);
                break;
                
            case 'bank_items':
                this.displayBankGoal(goal, goalName, goalProgress);
                break;
                
            case 'complete_quest':
                goalName.textContent = `Complete quest: ${goal.questId}`;
                goalProgress.textContent = 'In progress';
                break;
                
            default:
                goalName.textContent = 'Unknown goal';
                goalProgress.textContent = '-';
        }
    }

    displayNoGoal(goalName, goalProgress) {
        // Check if AI is selecting a new goal
        if (window.ai && window.ai.goals.length > 0) {
            // Find next incomplete goal
            let nextGoal = null;
            for (const goal of window.ai.goals) {
                if (!window.ai.isGoalComplete(goal)) {
                    nextGoal = goal;
                    break;
                }
            }
            
            if (nextGoal) {
                goalName.textContent = 'Selecting next goal...';
                goalProgress.textContent = 'Planning...';
            } else {
                goalName.textContent = 'All goals complete!';
                goalProgress.textContent = 'Generating new goals...';
            }
        } else {
            goalName.textContent = 'No active goal';
            goalProgress.textContent = '-';
        }
    }

    displaySkillGoal(goal, goalName, goalProgress) {
        const currentLevel = skills.getLevel(goal.skill);
        const skillData = loadingManager.getData('skills')[goal.skill];
        
        // Show starting level if different from current
        if (goal.startingLevel && goal.startingLevel < goal.targetLevel) {
            goalName.textContent = `Train ${skillData.name} from ${goal.startingLevel} to ${goal.targetLevel}`;
        } else {
            goalName.textContent = `Train ${skillData.name} to ${goal.targetLevel}`;
        }
        
        // Calculate XP progress from starting point to target
        const currentXp = skills.getXp(goal.skill);
        const targetXp = getXpForLevel(goal.targetLevel);
        
        let xpProgress;
        if (goal.startingXp !== undefined) {
            // Calculate progress from starting XP to target XP
            const xpGained = currentXp - goal.startingXp;
            const xpNeeded = targetXp - goal.startingXp;
            xpProgress = xpNeeded > 0 ? Math.floor((xpGained / xpNeeded) * 100) : 100;
        } else {
            // Fallback to old calculation
            xpProgress = Math.floor((currentXp / targetXp) * 100);
        }
        
        goalProgress.textContent = `Level ${currentLevel}/${goal.targetLevel} (${xpProgress}%)`;
    }

    displayBankGoal(goal, goalName, goalProgress) {
        const currentCount = bank.getItemCount(goal.itemId);
        const itemData = loadingManager.getData('items')[goal.itemId];
        goalName.textContent = `Bank ${goal.targetCount} ${itemData.name}`;
        
        // Calculate progress from starting count to target
        let percentage;
        if (goal.startingCount !== undefined) {
            const itemsGained = currentCount - goal.startingCount;
            const itemsNeeded = goal.targetCount - goal.startingCount;
            percentage = itemsNeeded > 0 ? Math.floor((itemsGained / itemsNeeded) * 100) : 100;
        } else {
            // Fallback to old calculation
            percentage = Math.floor((currentCount / goal.targetCount) * 100);
        }
        
        goalProgress.textContent = `${formatNumber(currentCount)}/${formatNumber(goal.targetCount)} (${percentage}%)`;
    }

    // ==================== SKILLS DISPLAY ====================

    updateSkillsList() {
        const skillsList = document.getElementById('skills-list');
        skillsList.innerHTML = '';

        const allSkills = skills.getAllSkills();
        
        // Define skill layout order
        const skillLayout = [
            // Column 1
            ['attack', 'strength', 'defence', 'ranged', 'prayer', 'magic', 'runecraft', 'construction'],
            // Column 2
            ['hitpoints', 'agility', 'herblore', 'thieving', 'crafting', 'fletching', 'slayer', 'hunter'],
            // Column 3
            ['mining', 'smithing', 'fishing', 'cooking', 'firemaking', 'woodcutting', 'farming']
        ];

        // Create skills in column order
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 3; col++) {
                const skillId = skillLayout[col][row];
                if (!skillId || !allSkills[skillId]) continue;

                const skillDiv = this.createSkillElement(skillId, allSkills[skillId]);
                skillsList.appendChild(skillDiv);
            }
        }

        // Add total level and combat level
        const levelDiv = this.createLevelTotals(allSkills);
        skillsList.appendChild(levelDiv);
    }

    createSkillElement(skillId, skill) {
        const skillDiv = document.createElement('div');
        skillDiv.className = 'skill-item';
        
        // Create content container
        const contentDiv = document.createElement('div');
        contentDiv.className = 'skill-content';
        
        // Add skill icon
        const iconElement = this.createSkillIcon(skillId, skill);
        if (iconElement) {
            contentDiv.appendChild(iconElement);
        }
        
        // Create level display
        const levelDiv = document.createElement('div');
        levelDiv.className = 'skill-level';
        levelDiv.textContent = skill.level;
        contentDiv.appendChild(levelDiv);
        
        // Create progress bar
        const progressBar = this.createSkillProgressBar(skill);
        
        // Create tooltip
        const tooltip = this.createSkillTooltip(skill);
        
        // Assemble skill item
        skillDiv.appendChild(contentDiv);
        skillDiv.appendChild(progressBar);
        skillDiv.appendChild(tooltip);
        
        return skillDiv;
    }

    createSkillIcon(skillId, skill) {
        const preloadedIcon = loadingManager.getImage(`skill_${skillId}`);
        if (preloadedIcon) {
            const icon = document.createElement('img');
            icon.className = 'skill-icon';
            icon.src = preloadedIcon.src;
            return icon;
        } else {
            // Fallback text if icon not loaded
            const textDiv = document.createElement('div');
            textDiv.style.fontSize = '12px';
            textDiv.style.fontWeight = 'bold';
            textDiv.style.width = '24px';
            textDiv.textContent = skill.name.substring(0, 3);
            return textDiv;
        }
    }

    createSkillProgressBar(skill) {
        const progressBar = document.createElement('div');
        progressBar.className = 'skill-progress-bar';
        
        const progressFill = document.createElement('div');
        progressFill.className = 'skill-progress-fill';
        
        const xpPercent = skill.level < 99 ? 
            ((skill.xp - getXpForLevel(skill.level)) / 
            (getXpForLevel(skill.level + 1) - getXpForLevel(skill.level))) * 100 : 100;
        
        progressFill.style.width = `${xpPercent}%`;
        progressBar.appendChild(progressFill);
        
        return progressBar;
    }

    createSkillTooltip(skill) {
        const tooltip = document.createElement('div');
        tooltip.className = 'skill-tooltip';
        
        // Build tooltip content
        let tooltipContent = `${skill.name}<br>Level ${skill.level}<br>`;
        
        if (skill.level < 99) {
            const totalXp = Math.floor(skill.xp);
            const nextLevelXp = getXpForLevel(skill.level + 1);
            const xpToNext = nextLevelXp - totalXp;
            
            tooltipContent += `${formatNumber(totalXp)}/${formatNumber(nextLevelXp)} exp<br>`;
            tooltipContent += `${formatNumber(xpToNext)} exp to level ${skill.level + 1}`;
        } else {
            tooltipContent += `${formatNumber(Math.floor(skill.xp))} exp`;
        }
        
        tooltip.innerHTML = tooltipContent;
        return tooltip;
    }

    createLevelTotals(allSkills) {
        const levelDiv = document.createElement('div');
        levelDiv.className = 'level-total';
        
        // Total level
        const totalLevelItem = this.createLevelItem(
            'skill_skills',
            skills.getTotalLevel(),
            '#f39c12',
            `Total Level: ${skills.getTotalLevel()}<br>Total Exp: ${formatNumber(this.calculateTotalExp(allSkills))}`
        );
        
        // Combat level
        const combatLevelItem = this.createLevelItem(
            'skill_combat',
            skills.getCombatLevel(),
            '#e74c3c',
            `Combat Level: ${skills.getCombatLevel()}`
        );
        
        levelDiv.appendChild(totalLevelItem);
        levelDiv.appendChild(combatLevelItem);
        
        return levelDiv;
    }

    createLevelItem(iconKey, value, color, tooltipText) {
        const levelItem = document.createElement('div');
        levelItem.className = 'level-item';
        levelItem.style.position = 'relative';
        
        const icon = loadingManager.getImage(iconKey);
        if (icon) {
            const iconImg = document.createElement('img');
            iconImg.className = 'level-icon';
            iconImg.src = icon.src;
            levelItem.appendChild(iconImg);
        }
        
        const text = document.createElement('div');
        text.style.fontSize = '20px';
        text.style.fontWeight = 'bold';
        text.style.color = color;
        text.textContent = value;
        
        const tooltip = document.createElement('div');
        tooltip.className = 'skill-tooltip';
        tooltip.style.textAlign = 'left';
        tooltip.innerHTML = tooltipText;
        
        levelItem.appendChild(text);
        levelItem.appendChild(tooltip);
        
        return levelItem;
    }

    calculateTotalExp(allSkills) {
        let totalExp = 0;
        for (const skill of Object.values(allSkills)) {
            totalExp += Math.floor(skill.xp);
        }
        return totalExp;
    }

    // ==================== ITEM DISPLAY HELPERS ====================

    getCoinImage(quantity) {
        if (quantity >= 10000) return 'coins_10000';
        if (quantity >= 1000) return 'coins_1000';
        if (quantity >= 250) return 'coins_250';
        if (quantity >= 100) return 'coins_100';
        if (quantity >= 25) return 'coins_25';
        if (quantity >= 5) return 'coins_5';
        if (quantity >= 4) return 'coins_4';
        if (quantity >= 3) return 'coins_3';
        if (quantity >= 2) return 'coins_2';
        return 'coins_1';
    }

    formatCoinCount(quantity) {
        if (quantity >= 10000000) {
            const millions = Math.floor(quantity / 1000000);
            return { text: `${millions}M`, isGreen: true };
        }
        return { text: formatNumber(quantity), isGreen: false };
    }

    createItemSlot(itemId, quantity, slotClass) {
        const slotDiv = document.createElement('div');
        slotDiv.className = slotClass;
        
        const itemData = loadingManager.getData('items')[itemId];
        
        // Create and setup image
        const img = this.createItemImage(itemId, quantity);
        
        // Handle missing images
        img.onerror = function() {
            this.style.display = 'none';
            const textDiv = document.createElement('div');
            textDiv.style.fontSize = '12px';
            textDiv.textContent = itemData.name.substring(0, 3);
            slotDiv.appendChild(textDiv);
        };
        
        slotDiv.appendChild(img);
        
        // Add quantity display if needed
        if (quantity > 1 || slotClass === 'bank-slot') {
            const countDiv = this.createItemCount(itemId, quantity);
            slotDiv.appendChild(countDiv);
        }
        
        slotDiv.title = `${itemData.name} x${formatNumber(quantity)}`;
        
        return slotDiv;
    }

    createItemImage(itemId, quantity) {
        const img = document.createElement('img');
        
        // Special handling for coins
        if (itemId === 'coins') {
            const coinImage = this.getCoinImage(quantity);
            img.src = `assets/items/${coinImage}.png`;
        } else {
            img.src = `assets/items/${itemId}.png`;
        }
        
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'contain';
        
        return img;
    }

    createItemCount(itemId, quantity) {
        const countDiv = document.createElement('div');
        countDiv.className = 'item-count';
        
        // Special formatting for coins
        if (itemId === 'coins') {
            const formatted = this.formatCoinCount(quantity);
            countDiv.textContent = formatted.text;
            if (formatted.isGreen) {
                countDiv.style.color = '#2ecc71';
            }
        } else {
            countDiv.textContent = formatNumber(quantity);
        }
        
        return countDiv;
    }

    // ==================== INVENTORY & BANK DISPLAY ====================

    updateInventory() {
        const inventoryGrid = document.getElementById('inventory-grid');
        
        // Store current state for comparison
        const currentState = JSON.stringify(inventory.slots);
        if (currentState === this.lastInventoryState) {
            return; // No changes, skip update
        }
        this.lastInventoryState = currentState;
        
        inventoryGrid.innerHTML = '';

        for (let i = 0; i < inventory.maxSlots; i++) {
            const slot = inventory.slots[i];
            if (slot) {
                const slotDiv = this.createItemSlot(slot.itemId, slot.quantity, 'inventory-slot');
                inventoryGrid.appendChild(slotDiv);
            } else {
                // Empty slot
                const emptySlot = document.createElement('div');
                emptySlot.className = 'inventory-slot';
                inventoryGrid.appendChild(emptySlot);
            }
        }
    }

    updateBank() {
        const bankGrid = document.getElementById('bank-grid');
        
        // Store current state for comparison
        const currentState = JSON.stringify(bank.items);
        if (currentState === this.lastBankState) {
            return; // No changes, skip update
        }
        this.lastBankState = currentState;
        
        bankGrid.innerHTML = '';

        const bankItems = bank.getAllItems();
        
        // Sort bank items according to items.json order
        const sortedItems = Object.entries(bankItems).sort((a, b) => {
            const indexA = this.itemOrderMap[a[0]] ?? Number.MAX_VALUE;
            const indexB = this.itemOrderMap[b[0]] ?? Number.MAX_VALUE;
            return indexA - indexB;
        });

        for (const [itemId, quantity] of sortedItems) {
            const slotDiv = this.createItemSlot(itemId, quantity, 'bank-slot');
            bankGrid.appendChild(slotDiv);
        }
    }

    toggleBank() {
        this.bankOpen = !this.bankOpen;
        const modal = document.getElementById('bank-modal');
        modal.style.display = this.bankOpen ? 'flex' : 'none';
        
        if (this.bankOpen) {
            this.updateBank();
        }
    }

    // ==================== NOTIFICATIONS ====================

    showNotification(message, type = 'info') {
        console.log(`[${type.toUpperCase()}] ${message}`);
        // Could add visual notifications here
    }
}
