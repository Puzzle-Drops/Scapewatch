class UIManager {
    constructor() {
        this.bankOpen = false;
        this.lastInventoryState = null;
        this.lastBankState = null;
        this.lastActivityState = null;
        this.lastGoalState = null;
        this.initializeUI();
    }

    initializeUI() {
        this.updateSkillsList();
        this.updateInventory();
        this.updateBank();
        this.updateActivity();
        this.updateGoal();
    }

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

    updateActivity() {
        const activityName = document.getElementById('activity-name');
        const activityStatus = document.getElementById('activity-status');

        if (player.currentActivity) {
            const activityData = loadingManager.getData('activities')[player.currentActivity];
            const currentNode = nodes.getNode(player.currentNode);
            
            // Format activity name with location
            let displayName = activityData.name;
            if (currentNode) {
                displayName = `${activityData.name} at ${currentNode.name}`;
            }
            activityName.textContent = displayName;

            // Get skill-specific behavior
            const behavior = skillBehaviors.getBehavior(activityData.skill);
            
            // Calculate actions per hour based on skill-specific duration
            const duration = behavior.getDuration(
                activityData.baseDuration,
                skills.getLevel(activityData.skill),
                activityData
            );
            const actionsPerHour = Math.floor(3600000 / duration);
            
            // Calculate XP/hr based on skill-specific mechanics
            let xpPerHour;
            
            // For skills that only grant XP on success (woodcutting, mining)
            if (activityData.skill === 'woodcutting' || activityData.skill === 'mining') {
                let successChance = 1.0;
                
                if (activityData.rewards && activityData.rewards.length > 0) {
                    const mainReward = activityData.rewards[0];
                    successChance = mainReward.chanceScaling ? 
                        behavior.getScaledChance(mainReward, skills.getLevel(activityData.skill)) :
                        (mainReward.chance || 1.0);
                }
                
                xpPerHour = Math.floor(actionsPerHour * activityData.xpPerAction * successChance);
            } else {
                // For other activities, use the standard calculation
                xpPerHour = actionsPerHour * activityData.xpPerAction;
            }

            activityStatus.textContent = `${formatNumber(xpPerHour)} XP/hr`;
        } else if (player.isMoving()) {
            const targetNode = nodes.getNode(player.targetNode);
            const targetName = targetNode ? targetNode.name : 'Unknown';
            activityName.textContent = 'Moving';
            activityStatus.textContent = `To: ${targetName}`;
        } else {
            // Player is idle
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
    }

    updateGoal() {
        const goalName = document.getElementById('goal-name');
        const goalProgress = document.getElementById('goal-progress');
        
        if (!window.ai || !window.ai.currentGoal) {
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
            return;
        }

        const goal = window.ai.currentGoal;
        
        switch (goal.type) {
            case 'skill_level':
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
                break;
                
            case 'bank_items':
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

                const skill = allSkills[skillId];
                const skillDiv = document.createElement('div');
                skillDiv.className = 'skill-item';
                
                // Create content container
                const contentDiv = document.createElement('div');
                contentDiv.className = 'skill-content';
                
                // Use preloaded skill icon
                const icon = document.createElement('img');
                icon.className = 'skill-icon';
                const preloadedIcon = loadingManager.getImage(`skill_${skillId}`);
                if (preloadedIcon) {
                    icon.src = preloadedIcon.src;
                } else {
                    // Fallback text if icon not loaded
                    const textDiv = document.createElement('div');
                    textDiv.style.fontSize = '12px';
                    textDiv.style.fontWeight = 'bold';
                    textDiv.style.width = '24px';
                    textDiv.textContent = skill.name.substring(0, 3);
                    contentDiv.appendChild(textDiv);
                }
                
                // Create level display
                const levelDiv = document.createElement('div');
                levelDiv.className = 'skill-level';
                levelDiv.textContent = skill.level;
                
                // Add icon and level to content
                if (preloadedIcon) {
                    contentDiv.appendChild(icon);
                }
                contentDiv.appendChild(levelDiv);
                
                // Create progress bar
                const progressBar = document.createElement('div');
                progressBar.className = 'skill-progress-bar';
                
                const progressFill = document.createElement('div');
                progressFill.className = 'skill-progress-fill';
                
                const xpPercent = skill.level < 99 ? 
                    ((skill.xp - getXpForLevel(skill.level)) / 
                    (getXpForLevel(skill.level + 1) - getXpForLevel(skill.level))) * 100 : 100;
                
                progressFill.style.width = `${xpPercent}%`;
                progressBar.appendChild(progressFill);
                
                // Create tooltip
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
                
                // Assemble skill item
                skillDiv.appendChild(contentDiv);
                skillDiv.appendChild(progressBar);
                skillDiv.appendChild(tooltip);
                
                skillsList.appendChild(skillDiv);
            }
        }

        // Add total level and combat level
        const levelDiv = document.createElement('div');
        levelDiv.className = 'level-total';
        
        // Total level
        const totalLevelItem = document.createElement('div');
        totalLevelItem.className = 'level-item';
        totalLevelItem.style.position = 'relative';
        
        const totalIcon = document.createElement('img');
        totalIcon.className = 'level-icon';
        const skillsIcon = loadingManager.getImage('skill_skills');
        if (skillsIcon) {
            totalIcon.src = skillsIcon.src;
        }
        
        const totalText = document.createElement('div');
        totalText.style.fontSize = '20px';
        totalText.style.fontWeight = 'bold';
        totalText.style.color = '#f39c12';
        totalText.textContent = skills.getTotalLevel();
        
        // Create tooltip for total level
        const totalTooltip = document.createElement('div');
        totalTooltip.className = 'skill-tooltip';
        totalTooltip.style.textAlign = 'left';
        
        // Calculate total exp
        let totalExp = 0;
        for (const skill of Object.values(allSkills)) {
            totalExp += Math.floor(skill.xp);
        }
        
        totalTooltip.innerHTML = `Total Level: ${skills.getTotalLevel()}<br>Total Exp: ${formatNumber(totalExp)}`;
        
        if (skillsIcon) {
            totalLevelItem.appendChild(totalIcon);
        }
        totalLevelItem.appendChild(totalText);
        totalLevelItem.appendChild(totalTooltip);
        
        // Combat level
        const combatLevelItem = document.createElement('div');
        combatLevelItem.className = 'level-item';
        combatLevelItem.style.position = 'relative';
        
        const combatIcon = document.createElement('img');
        combatIcon.className = 'level-icon';
        const combatIconImg = loadingManager.getImage('skill_combat');
        if (combatIconImg) {
            combatIcon.src = combatIconImg.src;
        }
        
        const combatText = document.createElement('div');
        combatText.style.fontSize = '20px';
        combatText.style.fontWeight = 'bold';
        combatText.style.color = '#e74c3c';
        combatText.textContent = skills.getCombatLevel();
        
        // Create tooltip for combat level
        const combatTooltip = document.createElement('div');
        combatTooltip.className = 'skill-tooltip';
        combatTooltip.style.textAlign = 'left';
        combatTooltip.innerHTML = `Combat Level: ${skills.getCombatLevel()}`;
        
        if (combatIconImg) {
            combatLevelItem.appendChild(combatIcon);
        }
        combatLevelItem.appendChild(combatText);
        combatLevelItem.appendChild(combatTooltip);
        
        levelDiv.appendChild(totalLevelItem);
        levelDiv.appendChild(combatLevelItem);
        
        skillsList.appendChild(levelDiv);
    }

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
            const slotDiv = document.createElement('div');
            slotDiv.className = 'inventory-slot';

            if (slot) {
                const itemData = loadingManager.getData('items')[slot.itemId];
                
                // Create image element
                const img = document.createElement('img');
                img.src = `assets/items/${slot.itemId}.png`;
                img.style.width = '100%';
                img.style.height = '100%';
                img.style.objectFit = 'contain';
                
                // Handle missing images
                img.onerror = function() {
                    this.style.display = 'none';
                    const textDiv = document.createElement('div');
                    textDiv.style.fontSize = '12px';
                    textDiv.textContent = itemData.name.substring(0, 3);
                    slotDiv.appendChild(textDiv);
                };
                
                slotDiv.appendChild(img);
                
                if (slot.quantity > 1) {
                    const countDiv = document.createElement('div');
                    countDiv.className = 'item-count';
                    countDiv.textContent = formatNumber(slot.quantity);
                    slotDiv.appendChild(countDiv);
                }
                
                slotDiv.title = `${itemData.name} x${formatNumber(slot.quantity)}`;
            }

            inventoryGrid.appendChild(slotDiv);
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

        for (const [itemId, quantity] of Object.entries(bankItems)) {
            const itemData = loadingManager.getData('items')[itemId];
            const slotDiv = document.createElement('div');
            slotDiv.className = 'bank-slot';
            
            // Create image element
            const img = document.createElement('img');
            img.src = `assets/items/${itemId}.png`;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'contain';
            
            // Handle missing images
            img.onerror = function() {
                this.style.display = 'none';
                const textDiv = document.createElement('div');
                textDiv.style.fontSize = '12px';
                textDiv.textContent = itemData.name.substring(0, 3);
                slotDiv.appendChild(textDiv);
            };
            
            slotDiv.appendChild(img);
            
            const countDiv = document.createElement('div');
            countDiv.className = 'item-count';
            countDiv.textContent = formatNumber(quantity);
            slotDiv.appendChild(countDiv);
            
            slotDiv.title = `${itemData.name} x${formatNumber(quantity)}`;

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

    showNotification(message, type = 'info') {
        console.log(`[${type.toUpperCase()}] ${message}`);
        // Could add visual notifications here
    }
}
