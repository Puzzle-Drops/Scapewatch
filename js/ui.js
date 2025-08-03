class UIManager {
    constructor() {
        this.bankOpen = false;
        this.initializeUI();
    }

    initializeUI() {
        this.updateSkillsList();
        this.updateInventory();
        this.updateBank();
    }

    update() {
        this.updateActivity();
        this.updateInventory();
        if (this.bankOpen) {
            this.updateBank();
        }
    }

    updateActivity() {
        const activityName = document.getElementById('activity-name');
        const activityProgress = document.getElementById('activity-progress');
        const activityStatus = document.getElementById('activity-status');

        if (player.currentActivity) {
            const activityData = loadingManager.getData('activities')[player.currentActivity];
            activityName.textContent = activityData.name;
            activityProgress.style.width = `${player.activityProgress * 100}%`;

            // Calculate actions per hour
            const duration = getActionDuration(
                activityData.baseDuration,
                skills.getLevel(activityData.skill),
                activityData.requiredLevel
            );
            const actionsPerHour = Math.floor(3600000 / duration);
            const xpPerHour = actionsPerHour * activityData.xpPerAction;

            activityStatus.textContent = `${formatNumber(xpPerHour)} XP/hr`;
        } else if (player.isMoving()) {
            activityName.textContent = 'Moving';
            activityProgress.style.width = '0%';
            activityStatus.textContent = `To: ${player.targetNode || 'Unknown'}`;
        } else {
            activityName.textContent = 'Idle';
            activityProgress.style.width = '0%';
            activityStatus.textContent = 'Waiting for AI decision...';
        }
    }

    updateSkillsList() {
        const skillsList = document.getElementById('skills-list');
        skillsList.innerHTML = '';

        const allSkills = skills.getAllSkills();
        
        // Group by category
        const categories = ['combat', 'gathering', 'production', 'utility'];
        
        for (const category of categories) {
            const categorySkills = Object.values(allSkills).filter(s => s.category === category);
            
            for (const skill of categorySkills) {
                const skillDiv = document.createElement('div');
                skillDiv.className = 'skill-item';
                
                const xpPercent = skill.level < 99 ? 
                    ((skill.xp - getXpForLevel(skill.level)) / 
                    (getXpForLevel(skill.level + 1) - getXpForLevel(skill.level))) * 100 : 100;

                skillDiv.innerHTML = `
                    <div class="skill-name">${skill.name}</div>
                    <div class="skill-level">Level ${skill.level}</div>
                    <div class="skill-xp">${formatNumber(Math.floor(skill.xp))} XP</div>
                    <div class="skill-progress" style="width: ${xpPercent}%; height: 2px; background: #f39c12; margin-top: 2px;"></div>
                `;
                
                skillsList.appendChild(skillDiv);
            }
        }

        // Add total level
        const totalDiv = document.createElement('div');
        totalDiv.className = 'skill-item';
        totalDiv.style.gridColumn = '1 / -1';
        totalDiv.style.textAlign = 'center';
        totalDiv.style.marginTop = '10px';
        totalDiv.innerHTML = `
            <div class="skill-name">Total Level: ${skills.getTotalLevel()}</div>
            <div class="skill-level">Combat Level: ${skills.getCombatLevel()}</div>
        `;
        skillsList.appendChild(totalDiv);
    }

    updateInventory() {
        const inventoryGrid = document.getElementById('inventory-grid');
        inventoryGrid.innerHTML = '';

        for (let i = 0; i < inventory.maxSlots; i++) {
            const slot = inventory.slots[i];
            const slotDiv = document.createElement('div');
            slotDiv.className = 'inventory-slot';

            if (slot) {
                const itemData = loadingManager.getData('items')[slot.itemId];
                slotDiv.innerHTML = `
                    <div style="font-size: 12px;">${itemData.name.substring(0, 3)}</div>
                    ${slot.quantity > 1 ? `<div class="item-count">${formatNumber(slot.quantity)}</div>` : ''}
                `;
                slotDiv.title = `${itemData.name} x${formatNumber(slot.quantity)}`;
            }

            inventoryGrid.appendChild(slotDiv);
        }
    }

    updateBank() {
        const bankGrid = document.getElementById('bank-grid');
        bankGrid.innerHTML = '';

        const bankItems = bank.getAllItems();

        for (const [itemId, quantity] of Object.entries(bankItems)) {
            const itemData = loadingManager.getData('items')[itemId];
            const slotDiv = document.createElement('div');
            slotDiv.className = 'bank-slot';
            
            slotDiv.innerHTML = `
                <div style="font-size: 12px;">${itemData.name.substring(0, 3)}</div>
                <div class="item-count">${formatNumber(quantity)}</div>
            `;
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
