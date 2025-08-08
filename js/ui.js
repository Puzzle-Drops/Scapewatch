class UIManager {
    constructor() {
        this.currentPanel = 'inventory';
        this.bankOpen = false;
        this.itemOrder = null;
        this.itemOrderMap = {};
        this.initializeUI();
    }

    // ==================== INITIALIZATION ====================

    initializeUI() {
        // Initialize item order from items.json
        this.initializeItemOrder();
        
        // Set up panel switching
        this.setupPanelButtons();
        
        // Set up modal close buttons
        this.setupModalButtons();
        
        // Initial updates
        this.updateInventory();
        this.updateSkillsList();
        this.updateTasks();
    }

    initializeItemOrder() {
        const itemsData = loadingManager.getData('items');
        this.itemOrder = Object.keys(itemsData);
        
        this.itemOrderMap = {};
        this.itemOrder.forEach((itemId, index) => {
            this.itemOrderMap[itemId] = index;
        });
    }

    setupPanelButtons() {
        const buttons = document.querySelectorAll('.panel-btn');
        
        buttons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const panel = btn.dataset.panel;
                
                if (panel === 'bank') {
                    this.openBank();
                } else if (panel === 'shop') {
                    this.openShop();
                } else {
                    this.switchPanel(panel);
                }
            });
        });
    }

    setupModalButtons() {
        // Bank close button
        const closeBankBtn = document.getElementById('close-bank');
        if (closeBankBtn) {
            closeBankBtn.addEventListener('click', () => {
                this.closeBank();
            });
        }
        
        // Shop close button
        const closeShopBtn = document.getElementById('close-shop');
        if (closeShopBtn) {
            closeShopBtn.addEventListener('click', () => {
                this.closeShop();
            });
        }
        
        // Generate tasks button
        const generateTasksBtn = document.getElementById('generate-tasks-btn');
        if (generateTasksBtn) {
            generateTasksBtn.addEventListener('click', () => {
                if (window.taskManager) {
                    taskManager.generateNewTasks();
                }
            });
        }
    }

    // ==================== PANEL MANAGEMENT ====================

    switchPanel(panelName) {
        // Update button states
        document.querySelectorAll('.panel-btn').forEach(btn => {
            if (btn.dataset.panel === panelName) {
                btn.classList.add('active');
            } else if (btn.dataset.panel !== 'bank' && btn.dataset.panel !== 'shop') {
                btn.classList.remove('active');
            }
        });
        
        // Update panel visibility
        document.querySelectorAll('.panel').forEach(panel => {
            panel.classList.remove('active');
        });
        
        const targetPanel = document.getElementById(`${panelName}-panel`);
        if (targetPanel) {
            targetPanel.classList.add('active');
        }
        
        this.currentPanel = panelName;
        
        // Update panel content
        switch (panelName) {
            case 'inventory':
                this.updateInventory();
                break;
            case 'skills':
                this.updateSkillsList();
                break;
            case 'tasks':
                this.updateTasks();
                break;
        }
    }

    // ==================== INVENTORY DISPLAY ====================

    updateInventory() {
        if (this.currentPanel !== 'inventory') return;
        
        const inventoryGrid = document.getElementById('inventory-grid');
        if (!inventoryGrid) return;
        
        inventoryGrid.innerHTML = '';

        for (let i = 0; i < inventory.maxSlots; i++) {
            const slot = inventory.slots[i];
            if (slot) {
                const slotDiv = this.createItemSlot(slot.itemId, slot.quantity, 'inventory-slot');
                inventoryGrid.appendChild(slotDiv);
            } else {
                const emptySlot = document.createElement('div');
                emptySlot.className = 'inventory-slot';
                inventoryGrid.appendChild(emptySlot);
            }
        }
    }

    // ==================== SKILLS DISPLAY ====================

    updateSkillsList() {
        if (this.currentPanel !== 'skills') return;
        
        const skillsList = document.getElementById('skills-list');
        if (!skillsList) return;
        
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
        
        const totalLevelItem = this.createLevelItem(
            'skill_skills',
            skills.getTotalLevel(),
            '#f39c12',
            `Total Level: ${skills.getTotalLevel()}<br>Total Exp: ${formatNumber(this.calculateTotalExp(allSkills))}`
        );
        
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

    // ==================== TASKS DISPLAY ====================

    updateTasks() {
        if (this.currentPanel !== 'tasks') return;
        
        const tasksList = document.getElementById('tasks-list');
        if (!tasksList || !window.taskManager) return;
        
        tasksList.innerHTML = '';
        
        const tasks = taskManager.getAllTasks();
        
        if (tasks.length === 0) {
            const emptyDiv = document.createElement('div');
            emptyDiv.style.textAlign = 'center';
            emptyDiv.style.color = '#999';
            emptyDiv.textContent = 'No tasks available. Click button below to generate.';
            tasksList.appendChild(emptyDiv);
            return;
        }
        
        tasks.forEach((task, index) => {
            const taskDiv = this.createTaskElement(task, index);
            tasksList.appendChild(taskDiv);
        });
    }

    createTaskElement(task, index) {
        const taskDiv = document.createElement('div');
        taskDiv.className = 'task-item';
        
        // Header with description and reroll button
        const headerDiv = document.createElement('div');
        headerDiv.className = 'task-header';
        
        const descDiv = document.createElement('div');
        descDiv.className = 'task-description';
        descDiv.textContent = task.description;
        
        const rerollBtn = document.createElement('button');
        rerollBtn.className = 'task-reroll';
        rerollBtn.textContent = '↻';
        rerollBtn.title = 'Reroll task';
        rerollBtn.addEventListener('click', () => {
            if (window.taskManager) {
                taskManager.rerollTask(index);
            }
        });
        
        headerDiv.appendChild(descDiv);
        headerDiv.appendChild(rerollBtn);
        
        // Progress section
        const progressDiv = document.createElement('div');
        progressDiv.className = 'task-progress';
        
        const progressBar = document.createElement('div');
        progressBar.className = 'task-progress-bar';
        
        const progressFill = document.createElement('div');
        progressFill.className = 'task-progress-fill';
        progressFill.style.width = `${task.progress * 100}%`;
        
        progressBar.appendChild(progressFill);
        
        const countDiv = document.createElement('div');
        countDiv.className = 'task-count';
        const current = Math.floor(task.progress * task.targetCount);
        countDiv.textContent = `${current}/${task.targetCount}`;
        
        progressDiv.appendChild(progressBar);
        progressDiv.appendChild(countDiv);
        
        taskDiv.appendChild(headerDiv);
        taskDiv.appendChild(progressDiv);
        
        // Mark complete tasks
        if (task.progress >= 1) {
            taskDiv.style.opacity = '0.6';
            progressFill.style.backgroundColor = '#f39c12';
        }
        
        return taskDiv;
    }

    // ==================== BANK DISPLAY ====================

    openBank() {
        this.bankOpen = true;
        const modal = document.getElementById('bank-modal');
        if (modal) {
            modal.style.display = 'flex';
            this.updateBank();
        }
    }

    closeBank() {
        this.bankOpen = false;
        const modal = document.getElementById('bank-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    updateBank() {
        if (!this.bankOpen) return;
        
        const bankGrid = document.getElementById('bank-grid');
        if (!bankGrid) return;
        
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

    // ==================== SHOP DISPLAY ====================

    openShop() {
        if (window.shop) {
            shop.open();
        }
    }

    closeShop() {
        if (window.shop) {
            shop.close();
        }
    }

    // ==================== ITEM DISPLAY HELPERS ====================

    createItemSlot(itemId, quantity, slotClass) {
        const slotDiv = document.createElement('div');
        slotDiv.className = slotClass;
        
        const itemData = loadingManager.getData('items')[itemId];
        
        const img = this.createItemImage(itemId, quantity);
        
        img.onerror = function() {
            this.style.display = 'none';
            const textDiv = document.createElement('div');
            textDiv.style.fontSize = '12px';
            textDiv.textContent = itemData.name.substring(0, 3);
            slotDiv.appendChild(textDiv);
        };
        
        slotDiv.appendChild(img);
        
        if (quantity > 1 || slotClass === 'bank-slot') {
            const countDiv = this.createItemCount(itemId, quantity);
            slotDiv.appendChild(countDiv);
        }
        
        slotDiv.title = `${itemData.name} x${formatNumber(quantity)}`;
        
        return slotDiv;
    }

    createItemImage(itemId, quantity) {
        const img = document.createElement('img');
        
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
}
