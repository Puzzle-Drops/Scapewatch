class DevConsole {
    constructor() {
        this.visible = false;
        this.history = [];
        this.historyIndex = -1;
        this.commandHistory = [];
        this.maxHistory = 100;
        
        this.commands = {
            // Help
            help: {
                description: 'Show available commands',
                usage: 'help [command]',
                fn: (args) => this.cmdHelp(args)
            },
            
            // Player commands
            tp: {
                description: 'Teleport to coordinates or node',
                usage: 'tp <x> <y> or tp <nodeId>',
                fn: (args) => this.cmdTeleport(args)
            },
            pos: {
                description: 'Show current position',
                usage: 'pos',
                fn: () => this.cmdPosition()
            },
            resetplayer: {
                description: 'Reset player to starting position',
                usage: 'resetplayer',
                fn: () => this.cmdResetPlayer()
            },
            
            // Skill commands
            setlevel: {
                description: 'Set skill level',
                usage: 'setlevel <skill> <level>',
                fn: (args) => this.cmdSetLevel(args)
            },
            addxp: {
                description: 'Add XP to skill',
                usage: 'addxp <skill> <amount>',
                fn: (args) => this.cmdAddXp(args)
            },
            maxskills: {
                description: 'Set all skills to 99',
                usage: 'maxskills',
                fn: () => this.cmdMaxSkills()
            },
            
            // Inventory commands
            give: {
                description: 'Add items to inventory',
                usage: 'give <itemId> [quantity]',
                fn: (args) => this.cmdGive(args)
            },
            clear: {
                description: 'Clear inventory',
                usage: 'clear',
                fn: () => this.cmdClear()
            },
            
            // Bank commands
            bank: {
                description: 'Add items to bank',
                usage: 'bank <itemId> [quantity]',
                fn: (args) => this.cmdBank(args)
            },
            giveall: {
                description: 'Add all items to bank',
                usage: 'giveall [quantity]',
                fn: (args) => this.cmdGiveAll(args)
            },
            
            // AI/Goal commands
            cleargoals: {
                description: 'Clear all AI goals',
                usage: 'cleargoals',
                fn: () => this.cmdClearGoals()
            },
            addgoal: {
                description: 'Add a goal',
                usage: 'addgoal <type> <target> <value>',
                fn: (args) => this.cmdAddGoal(args)
            },
            pauseai: {
                description: 'Toggle AI pause',
                usage: 'pauseai',
                fn: () => this.cmdPauseAI()
            },
            
            // Activity commands
            startactivity: {
                description: 'Start an activity',
                usage: 'startactivity <activityId>',
                fn: (args) => this.cmdStartActivity(args)
            },
            stopactivity: {
                description: 'Stop current activity',
                usage: 'stopactivity',
                fn: () => this.cmdStopActivity()
            },
            
            // Debug commands
            nodes: {
                description: 'List all nodes or search',
                usage: 'nodes [search]',
                fn: (args) => this.cmdNodes(args)
            },
            items: {
                description: 'List all items or search',
                usage: 'items [search]',
                fn: (args) => this.cmdItems(args)
            },
            activities: {
                description: 'List all activities or search',
                usage: 'activities [search]',
                fn: (args) => this.cmdActivities(args)
            },
            collision: {
                description: 'Toggle collision debug',
                usage: 'collision',
                fn: () => this.cmdCollision()
            },
            nodetext: {
                description: 'Toggle node text',
                usage: 'nodetext',
                fn: () => this.cmdNodeText()
            }
        };
        
        this.createUI();
        this.setupEventListeners();
    }

    createUI() {
        // Create console container
        const consoleDiv = document.createElement('div');
        consoleDiv.id = 'dev-console';
        consoleDiv.className = 'dev-console';
        consoleDiv.style.display = 'none';
        
        // Create output area
        const outputDiv = document.createElement('div');
        outputDiv.id = 'dev-console-output';
        outputDiv.className = 'dev-console-output';
        
        // Create input container
        const inputContainer = document.createElement('div');
        inputContainer.className = 'dev-console-input-container';
        
        // Create prompt
        const prompt = document.createElement('span');
        prompt.className = 'dev-console-prompt';
        prompt.textContent = '> ';
        
        // Create input field
        const input = document.createElement('input');
        input.id = 'dev-console-input';
        input.className = 'dev-console-input';
        input.type = 'text';
        input.autocomplete = 'off';
        
        inputContainer.appendChild(prompt);
        inputContainer.appendChild(input);
        
        consoleDiv.appendChild(outputDiv);
        consoleDiv.appendChild(inputContainer);
        
        // Add to scaled container
        const scaledContainer = document.getElementById('scaled-container');
        scaledContainer.appendChild(consoleDiv);
        
        this.consoleDiv = consoleDiv;
        this.outputDiv = outputDiv;
        this.inputField = input;
    }

    setupEventListeners() {
        // Toggle console with ` key
        window.addEventListener('keydown', (e) => {
            if (e.key === '`') {
                e.preventDefault();
                this.toggle();
            }
        });
        
        // Handle input
        this.inputField.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.executeCommand(this.inputField.value);
                this.inputField.value = '';
                this.historyIndex = -1;
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.navigateHistory(-1);
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.navigateHistory(1);
            }
        });
    }

    toggle() {
        this.visible = !this.visible;
        this.consoleDiv.style.display = this.visible ? 'block' : 'none';
        
        if (this.visible) {
            this.inputField.focus();
            this.log('Developer Console - Type "help" for commands', 'info');
        }
    }

    log(message, type = 'normal') {
        const entry = document.createElement('div');
        entry.className = `dev-console-entry dev-console-${type}`;
        entry.textContent = message;
        
        this.outputDiv.appendChild(entry);
        this.outputDiv.scrollTop = this.outputDiv.scrollHeight;
        
        // Limit history
        while (this.outputDiv.children.length > this.maxHistory) {
            this.outputDiv.removeChild(this.outputDiv.firstChild);
        }
    }

    executeCommand(commandStr) {
        if (!commandStr.trim()) return;
        
        // Add to history
        this.commandHistory.unshift(commandStr);
        if (this.commandHistory.length > 50) {
            this.commandHistory.pop();
        }
        
        // Log the command
        this.log(`> ${commandStr}`, 'command');
        
        // Parse command
        const parts = commandStr.trim().split(' ');
        const cmd = parts[0].toLowerCase();
        const args = parts.slice(1);
        
        // Execute command
        if (this.commands[cmd]) {
            try {
                this.commands[cmd].fn(args);
            } catch (error) {
                this.log(`Error: ${error.message}`, 'error');
            }
        } else {
            this.log(`Unknown command: ${cmd}`, 'error');
        }
    }

    navigateHistory(direction) {
        if (direction === -1 && this.historyIndex < this.commandHistory.length - 1) {
            this.historyIndex++;
        } else if (direction === 1 && this.historyIndex > -1) {
            this.historyIndex--;
        }
        
        if (this.historyIndex >= 0 && this.historyIndex < this.commandHistory.length) {
            this.inputField.value = this.commandHistory[this.historyIndex];
        } else if (this.historyIndex === -1) {
            this.inputField.value = '';
        }
    }

    // Command implementations
    cmdHelp(args) {
        if (args.length > 0) {
            const cmd = args[0].toLowerCase();
            if (this.commands[cmd]) {
                this.log(`${cmd}: ${this.commands[cmd].description}`, 'info');
                this.log(`Usage: ${this.commands[cmd].usage}`, 'info');
            } else {
                this.log(`Unknown command: ${cmd}`, 'error');
            }
        } else {
            this.log('Available commands:', 'info');
            for (const [name, cmd] of Object.entries(this.commands)) {
                this.log(`  ${name} - ${cmd.description}`, 'info');
            }
        }
    }

    cmdTeleport(args) {
        if (args.length === 2) {
            // Teleport to coordinates
            const x = parseInt(args[0]);
            const y = parseInt(args[1]);
            
            if (isNaN(x) || isNaN(y)) {
                this.log('Invalid coordinates', 'error');
                return;
            }
            
            player.position.x = x;
            player.position.y = y;
            player.path = [];
            player.targetPosition = null;
            player.stopActivity();
            
            this.log(`Teleported to ${x}, ${y}`, 'success');
        } else if (args.length === 1) {
            // Teleport to node
            const nodeId = args[0];
            const node = nodes.getNode(nodeId);
            
            if (!node) {
                this.log(`Node not found: ${nodeId}`, 'error');
                return;
            }
            
            player.position.x = node.position.x;
            player.position.y = node.position.y;
            player.currentNode = nodeId;
            player.path = [];
            player.targetPosition = null;
            player.stopActivity();
            
            this.log(`Teleported to ${node.name}`, 'success');
        } else {
            this.log('Usage: tp <x> <y> or tp <nodeId>', 'error');
        }
    }

    cmdPosition() {
        this.log(`Position: ${Math.round(player.position.x)}, ${Math.round(player.position.y)}`, 'info');
        this.log(`Current node: ${player.currentNode}`, 'info');
    }

    cmdResetPlayer() {
        testScenario.resetPlayer();
        this.log('Player reset to starting position', 'success');
    }

    cmdSetLevel(args) {
        if (args.length !== 2) {
            this.log('Usage: setlevel <skill> <level>', 'error');
            return;
        }
        
        const skillId = args[0].toLowerCase();
        const level = parseInt(args[1]);
        
        if (!skills.skills[skillId]) {
            this.log(`Unknown skill: ${skillId}`, 'error');
            return;
        }
        
        if (isNaN(level) || level < 1 || level > 99) {
            this.log('Level must be between 1 and 99', 'error');
            return;
        }
        
        testScenario.setSkillLevel(skillId, level);
        ui.updateSkillsList();
        this.log(`Set ${skillId} to level ${level}`, 'success');
    }

    cmdAddXp(args) {
        if (args.length !== 2) {
            this.log('Usage: addxp <skill> <amount>', 'error');
            return;
        }
        
        const skillId = args[0].toLowerCase();
        const amount = parseInt(args[1]);
        
        if (!skills.skills[skillId]) {
            this.log(`Unknown skill: ${skillId}`, 'error');
            return;
        }
        
        if (isNaN(amount) || amount < 0) {
            this.log('Amount must be a positive number', 'error');
            return;
        }
        
        skills.addXp(skillId, amount);
        ui.updateSkillsList();
        this.log(`Added ${formatNumber(amount)} XP to ${skillId}`, 'success');
    }

    cmdMaxSkills() {
        testScenario.maxAllSkills();
        ui.updateSkillsList();
        this.log('All skills set to 99', 'success');
    }

    cmdGive(args) {
        if (args.length < 1) {
            this.log('Usage: give <itemId> [quantity]', 'error');
            return;
        }
        
        const itemId = args[0];
        const quantity = args.length > 1 ? parseInt(args[1]) : 1;
        
        const items = loadingManager.getData('items');
        if (!items[itemId]) {
            this.log(`Unknown item: ${itemId}`, 'error');
            return;
        }
        
        if (isNaN(quantity) || quantity < 1) {
            this.log('Quantity must be a positive number', 'error');
            return;
        }
        
        const added = inventory.addItem(itemId, quantity);
        this.log(`Added ${added} ${items[itemId].name} to inventory`, 'success');
    }

    cmdClear() {
        inventory.clear();
        this.log('Inventory cleared', 'success');
    }

    cmdBank(args) {
        if (args.length < 1) {
            this.log('Usage: bank <itemId> [quantity]', 'error');
            return;
        }
        
        const itemId = args[0];
        const quantity = args.length > 1 ? parseInt(args[1]) : 1;
        
        const items = loadingManager.getData('items');
        if (!items[itemId]) {
            this.log(`Unknown item: ${itemId}`, 'error');
            return;
        }
        
        if (isNaN(quantity) || quantity < 1) {
            this.log('Quantity must be a positive number', 'error');
            return;
        }
        
        bank.deposit(itemId, quantity);
        this.log(`Added ${quantity} ${items[itemId].name} to bank`, 'success');
    }

    cmdGiveAll(args) {
        const quantity = args.length > 0 ? parseInt(args[0]) : 100;
        
        if (isNaN(quantity) || quantity < 1) {
            this.log('Quantity must be a positive number', 'error');
            return;
        }
        
        testScenario.giveAllItems(quantity);
        this.log(`Added ${quantity} of each item to bank`, 'success');
    }

    cmdClearGoals() {
        ai.goals = [];
        ai.currentGoal = null;
        ui.updateGoal();
        this.log('All goals cleared', 'success');
    }

    cmdAddGoal(args) {
        if (args.length < 3) {
            this.log('Usage: addgoal <type> <target> <value>', 'error');
            this.log('Examples:', 'info');
            this.log('  addgoal skill woodcutting 60', 'info');
            this.log('  addgoal item oak_logs 100', 'info');
            return;
        }
        
        const type = args[0].toLowerCase();
        const priority = ai.goals.length + 1;
        
        if (type === 'skill') {
            const skillId = args[1].toLowerCase();
            const level = parseInt(args[2]);
            
            if (!skills.skills[skillId]) {
                this.log(`Unknown skill: ${skillId}`, 'error');
                return;
            }
            
            ai.addGoal({
                type: 'skill_level',
                skill: skillId,
                targetLevel: level,
                priority: priority
            });
            
            this.log(`Added goal: ${skillId} to level ${level}`, 'success');
        } else if (type === 'item') {
            const itemId = args[1];
            const count = parseInt(args[2]);
            
            const items = loadingManager.getData('items');
            if (!items[itemId]) {
                this.log(`Unknown item: ${itemId}`, 'error');
                return;
            }
            
            ai.addGoal({
                type: 'bank_items',
                itemId: itemId,
                targetCount: count,
                priority: priority
            });
            
            this.log(`Added goal: bank ${count} ${items[itemId].name}`, 'success');
        } else {
            this.log('Type must be "skill" or "item"', 'error');
        }
    }

    cmdPauseAI() {
        gameState.paused = !gameState.paused;
        document.getElementById('pause-toggle').textContent = gameState.paused ? 'Resume AI' : 'Pause AI';
        this.log(`AI ${gameState.paused ? 'paused' : 'resumed'}`, 'success');
    }

    cmdStartActivity(args) {
        if (args.length !== 1) {
            this.log('Usage: startactivity <activityId>', 'error');
            return;
        }
        
        const activityId = args[0];
        const activities = loadingManager.getData('activities');
        
        if (!activities[activityId]) {
            this.log(`Unknown activity: ${activityId}`, 'error');
            return;
        }
        
        player.startActivity(activityId);
        this.log(`Started activity: ${activities[activityId].name}`, 'success');
    }

    cmdStopActivity() {
        player.stopActivity();
        this.log('Activity stopped', 'success');
    }

    cmdNodes(args) {
        const search = args.length > 0 ? args.join(' ').toLowerCase() : '';
        const allNodes = nodes.getAllNodes();
        
        let matches = Object.entries(allNodes);
        if (search) {
            matches = matches.filter(([id, node]) => 
                id.toLowerCase().includes(search) || 
                node.name.toLowerCase().includes(search)
            );
        }
        
        if (matches.length === 0) {
            this.log('No nodes found', 'info');
            return;
        }
        
        this.log(`Found ${matches.length} nodes:`, 'info');
        matches.slice(0, 20).forEach(([id, node]) => {
            this.log(`  ${id}: ${node.name} (${node.position.x}, ${node.position.y})`, 'info');
        });
        
        if (matches.length > 20) {
            this.log(`  ... and ${matches.length - 20} more`, 'info');
        }
    }

    cmdItems(args) {
        const search = args.length > 0 ? args.join(' ').toLowerCase() : '';
        const allItems = loadingManager.getData('items');
        
        let matches = Object.entries(allItems);
        if (search) {
            matches = matches.filter(([id, item]) => 
                id.toLowerCase().includes(search) || 
                item.name.toLowerCase().includes(search)
            );
        }
        
        if (matches.length === 0) {
            this.log('No items found', 'info');
            return;
        }
        
        this.log(`Found ${matches.length} items:`, 'info');
        matches.slice(0, 20).forEach(([id, item]) => {
            this.log(`  ${id}: ${item.name}`, 'info');
        });
        
        if (matches.length > 20) {
            this.log(`  ... and ${matches.length - 20} more`, 'info');
        }
    }

    cmdActivities(args) {
        const search = args.length > 0 ? args.join(' ').toLowerCase() : '';
        const allActivities = loadingManager.getData('activities');
        
        let matches = Object.entries(allActivities);
        if (search) {
            matches = matches.filter(([id, activity]) => 
                id.toLowerCase().includes(search) || 
                activity.name.toLowerCase().includes(search) ||
                activity.skill.toLowerCase().includes(search)
            );
        }
        
        if (matches.length === 0) {
            this.log('No activities found', 'info');
            return;
        }
        
        this.log(`Found ${matches.length} activities:`, 'info');
        matches.slice(0, 20).forEach(([id, activity]) => {
            this.log(`  ${id}: ${activity.name} (${activity.skill} lvl ${activity.requiredLevel})`, 'info');
        });
        
        if (matches.length > 20) {
            this.log(`  ... and ${matches.length - 20} more`, 'info');
        }
    }

    cmdCollision() {
        map.toggleCollisionDebug();
        this.log(`Collision debug ${map.showCollisionDebug ? 'enabled' : 'disabled'}`, 'success');
    }

    cmdNodeText() {
        map.toggleNodeText();
        this.log(`Node text ${map.showNodeText ? 'enabled' : 'disabled'}`, 'success');
    }
}

// Create global instance
window.devConsole = new DevConsole();
