class DevConsole {
    constructor() {
        this.visible = false;
        this.history = [];
        this.historyIndex = -1;
        this.commandHistory = [];
        this.maxHistory = 100;
        this.consoleOutput = [];
        this.maxConsoleOutput = 500;
        
        // Capture console methods before anything else loads
        this.captureConsole();
        
        this.commands = {
            // Help
            help: {
                description: 'Show available commands',
                usage: 'help [command]',
                fn: (args) => this.cmdHelp(args)
            },
            
            // Console management
            clear: {
                description: 'Clear command output',
                usage: 'clear',
                fn: () => this.cmdClearCommands()
            },
            clearconsole: {
                description: 'Clear console output',
                usage: 'clearconsole',
                fn: () => this.cmdClearConsole()
            },
            clearall: {
                description: 'Clear both command and console output',
                usage: 'clearall',
                fn: () => this.cmdClearAll()
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
            clearinv: {
                description: 'Clear inventory',
                usage: 'clearinv',
                fn: () => this.cmdClearInv()
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
            goals: {
                description: 'List all current goals',
                usage: 'goals',
                fn: () => this.cmdListGoals()
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
        
        // Initialize after DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initialize());
        } else {
            this.initialize();
        }
    }

    captureConsole() {
        // Store original console methods
        this.originalConsole = {
            log: console.log.bind(console),
            error: console.error.bind(console),
            warn: console.warn.bind(console),
            info: console.info.bind(console),
            debug: console.debug.bind(console)
        };

        // Capture window errors
        window.addEventListener('error', (e) => {
            this.addConsoleOutput({
                type: 'error',
                message: e.message,
                file: e.filename,
                line: e.lineno,
                col: e.colno,
                timestamp: Date.now()
            });
        });

        // Capture unhandled promise rejections
        window.addEventListener('unhandledrejection', (e) => {
            this.addConsoleOutput({
                type: 'error',
                message: `Unhandled Promise Rejection: ${e.reason}`,
                timestamp: Date.now()
            });
        });

        // Override console methods
        console.log = (...args) => {
            this.originalConsole.log(...args);
            this.addConsoleOutput({
                type: 'log',
                message: this.formatConsoleArgs(args),
                timestamp: Date.now()
            });
        };

        console.error = (...args) => {
            this.originalConsole.error(...args);
            this.addConsoleOutput({
                type: 'error',
                message: this.formatConsoleArgs(args),
                timestamp: Date.now()
            });
        };

        console.warn = (...args) => {
            this.originalConsole.warn(...args);
            this.addConsoleOutput({
                type: 'warn',
                message: this.formatConsoleArgs(args),
                timestamp: Date.now()
            });
        };

        console.info = (...args) => {
            this.originalConsole.info(...args);
            this.addConsoleOutput({
                type: 'info',
                message: this.formatConsoleArgs(args),
                timestamp: Date.now()
            });
        };

        console.debug = (...args) => {
            this.originalConsole.debug(...args);
            this.addConsoleOutput({
                type: 'debug',
                message: this.formatConsoleArgs(args),
                timestamp: Date.now()
            });
        };
    }

    formatConsoleArgs(args) {
        return args.map(arg => {
            if (typeof arg === 'object') {
                try {
                    return JSON.stringify(arg, null, 2);
                } catch (e) {
                    return String(arg);
                }
            }
            return String(arg);
        }).join(' ');
    }

    addConsoleOutput(output) {
        this.consoleOutput.push(output);
        
        // Limit console output size
        while (this.consoleOutput.length > this.maxConsoleOutput) {
            this.consoleOutput.shift();
        }
        
        // Update UI if console is visible
        if (this.visible && this.consoleOutputDiv) {
            this.appendConsoleOutput(output);
        }
    }

    appendConsoleOutput(output) {
        const entry = document.createElement('div');
        entry.className = `console-output-entry console-output-${output.type}`;
        
        // Format timestamp
        const time = new Date(output.timestamp);
        const timeStr = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}:${time.getSeconds().toString().padStart(2, '0')}`;
        
        // Build entry content
        let content = `[${timeStr}] `;
        
        if (output.file && output.line) {
            const filename = output.file.split('/').pop();
            content += `${filename}:${output.line} - `;
        }
        
        content += output.message;
        
        entry.textContent = content;
        this.consoleOutputDiv.appendChild(entry);
        
        // Auto-scroll to bottom
        this.consoleOutputDiv.scrollTop = this.consoleOutputDiv.scrollHeight;
        
        // Limit displayed entries
        while (this.consoleOutputDiv.children.length > this.maxConsoleOutput) {
            this.consoleOutputDiv.removeChild(this.consoleOutputDiv.firstChild);
        }
    }

    initialize() {
        this.createUI();
        this.setupEventListeners();
        
        // Display any console output that was captured before UI was ready
        if (this.consoleOutput.length > 0) {
            this.consoleOutput.forEach(output => this.appendConsoleOutput(output));
        }
    }

    createUI() {
        // Create console container
        const consoleDiv = document.createElement('div');
        consoleDiv.id = 'dev-console';
        consoleDiv.className = 'dev-console';
        consoleDiv.style.display = 'none';
        
        // Create split container
        const splitContainer = document.createElement('div');
        splitContainer.className = 'dev-console-split';
        
        // LEFT SIDE - Commands
        const leftSide = document.createElement('div');
        leftSide.className = 'dev-console-left';
        
        // Create header for left side
        const leftHeader = document.createElement('div');
        leftHeader.className = 'dev-console-header';
        leftHeader.innerHTML = '<span>Commands</span><span style="color: #666; font-size: 12px; margin-left: 10px;">Press ` to toggle</span>';
        
        // Create output area for commands
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
        
        leftSide.appendChild(leftHeader);
        leftSide.appendChild(outputDiv);
        leftSide.appendChild(inputContainer);
        
        // RIGHT SIDE - Console Output
        const rightSide = document.createElement('div');
        rightSide.className = 'dev-console-right';
        
        // Create header for right side
        const rightHeader = document.createElement('div');
        rightHeader.className = 'dev-console-header';
        rightHeader.innerHTML = '<span>Console Output</span><span style="color: #666; font-size: 12px; margin-left: 10px;">Logs & Errors</span>';
        
        // Create console output area
        const consoleOutputDiv = document.createElement('div');
        consoleOutputDiv.id = 'console-output';
        consoleOutputDiv.className = 'console-output';
        
        rightSide.appendChild(rightHeader);
        rightSide.appendChild(consoleOutputDiv);
        
        // Assemble the console
        splitContainer.appendChild(leftSide);
        splitContainer.appendChild(rightSide);
        consoleDiv.appendChild(splitContainer);
        
        // Add to scaled container
        const scaledContainer = document.getElementById('scaled-container');
        if (scaledContainer) {
            scaledContainer.appendChild(consoleDiv);
        } else {
            // Fallback to body if scaled container doesn't exist yet
            document.body.appendChild(consoleDiv);
        }
        
        this.consoleDiv = consoleDiv;
        this.outputDiv = outputDiv;
        this.inputField = input;
        this.consoleOutputDiv = consoleOutputDiv;
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
            if (this.outputDiv.children.length === 0) {
                this.log('Developer Console - Type "help" for commands', 'info');
            }
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

    cmdClearCommands() {
        this.outputDiv.innerHTML = '';
        this.log('Command output cleared', 'success');
    }

    cmdClearConsole() {
        this.consoleOutputDiv.innerHTML = '';
        this.consoleOutput = [];
        this.log('Console output cleared', 'success');
    }

    cmdClearAll() {
        this.outputDiv.innerHTML = '';
        this.consoleOutputDiv.innerHTML = '';
        this.consoleOutput = [];
        this.log('All output cleared', 'success');
    }

    cmdTeleport(args) {
        if (!window.player) {
            this.log('Player not initialized yet', 'error');
            return;
        }
        
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
        if (!window.player) {
            this.log('Player not initialized yet', 'error');
            return;
        }
        this.log(`Position: ${Math.round(player.position.x)}, ${Math.round(player.position.y)}`, 'info');
        this.log(`Current node: ${player.currentNode}`, 'info');
    }

    cmdResetPlayer() {
        if (!window.testScenario) {
            this.log('Test scenario not available', 'error');
            return;
        }
        testScenario.resetPlayer();
        this.log('Player reset to starting position', 'success');
    }

    cmdSetLevel(args) {
        if (!window.skills) {
            this.log('Skills not initialized yet', 'error');
            return;
        }
        
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
        
        if (window.testScenario) {
            testScenario.setSkillLevel(skillId, level);
        } else {
            // Direct method if testScenario not available
            const targetXp = window.getXpForLevel(level);
            const skill = skills.skills[skillId];
            if (skill) {
                skill.xp = targetXp;
                skill.level = level;
                skill.xpForNextLevel = window.getXpForLevel(level + 1);
            }
        }
        
        if (window.ui) ui.updateSkillsList();
        this.log(`Set ${skillId} to level ${level}`, 'success');
    }

    cmdAddXp(args) {
        if (!window.skills) {
            this.log('Skills not initialized yet', 'error');
            return;
        }
        
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
        if (window.ui) ui.updateSkillsList();
        this.log(`Added ${window.formatNumber(amount)} XP to ${skillId}`, 'success');
    }

    cmdMaxSkills() {
        if (!window.testScenario) {
            this.log('Test scenario not available', 'error');
            return;
        }
        testScenario.maxAllSkills();
        if (window.ui) ui.updateSkillsList();
        this.log('All skills set to 99', 'success');
    }

    cmdGive(args) {
        if (!window.inventory) {
            this.log('Inventory not initialized yet', 'error');
            return;
        }
        
        if (args.length < 1) {
            this.log('Usage: give <itemId> [quantity]', 'error');
            return;
        }
        
        const itemId = args[0];
        const quantity = args.length > 1 ? parseInt(args[1]) : 1;
        
        if (!window.loadingManager) {
            this.log('Loading manager not ready', 'error');
            return;
        }
        
        const items = loadingManager.getData('items');
        if (!items || !items[itemId]) {
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

    cmdClearInv() {
        if (!window.inventory) {
            this.log('Inventory not initialized yet', 'error');
            return;
        }
        inventory.clear();
        this.log('Inventory cleared', 'success');
    }

    cmdBank(args) {
        if (!window.bank) {
            this.log('Bank not initialized yet', 'error');
            return;
        }
        
        if (args.length < 1) {
            this.log('Usage: bank <itemId> [quantity]', 'error');
            return;
        }
        
        const itemId = args[0];
        const quantity = args.length > 1 ? parseInt(args[1]) : 1;
        
        if (!window.loadingManager) {
            this.log('Loading manager not ready', 'error');
            return;
        }
        
        const items = loadingManager.getData('items');
        if (!items || !items[itemId]) {
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
        if (!window.testScenario) {
            this.log('Test scenario not available', 'error');
            return;
        }
        
        const quantity = args.length > 0 ? parseInt(args[0]) : 100;
        
        if (isNaN(quantity) || quantity < 1) {
            this.log('Quantity must be a positive number', 'error');
            return;
        }
        
        testScenario.giveAllItems(quantity);
        this.log(`Added ${quantity} of each item to bank`, 'success');
    }

    cmdClearGoals() {
        if (!window.ai) {
            this.log('AI not initialized yet', 'error');
            return;
        }
        ai.goals = [];
        ai.currentGoal = null;
        if (window.ui) ui.updateGoal();
        this.log('All goals cleared', 'success');
    }

    cmdAddGoal(args) {
        if (!window.ai) {
            this.log('AI not initialized yet', 'error');
            return;
        }
        
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
            
            if (!window.skills || !skills.skills[skillId]) {
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
            
            if (!window.loadingManager) {
                this.log('Loading manager not ready', 'error');
                return;
            }
            
            const items = loadingManager.getData('items');
            if (!items || !items[itemId]) {
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
        if (!window.gameState) {
            this.log('Game not initialized yet', 'error');
            return;
        }
        gameState.paused = !gameState.paused;
        const pauseBtn = document.getElementById('pause-toggle');
        if (pauseBtn) {
            pauseBtn.textContent = gameState.paused ? 'Resume AI' : 'Pause AI';
        }
        this.log(`AI ${gameState.paused ? 'paused' : 'resumed'}`, 'success');
    }

    cmdStartActivity(args) {
        if (!window.player) {
            this.log('Player not initialized yet', 'error');
            return;
        }
        
        if (args.length !== 1) {
            this.log('Usage: startactivity <activityId>', 'error');
            return;
        }
        
        const activityId = args[0];
        
        if (!window.loadingManager) {
            this.log('Loading manager not ready', 'error');
            return;
        }
        
        const activities = loadingManager.getData('activities');
        if (!activities || !activities[activityId]) {
            this.log(`Unknown activity: ${activityId}`, 'error');
            return;
        }
        
        player.startActivity(activityId);
        this.log(`Started activity: ${activities[activityId].name}`, 'success');
    }

    cmdStopActivity() {
        if (!window.player) {
            this.log('Player not initialized yet', 'error');
            return;
        }
        player.stopActivity();
        this.log('Activity stopped', 'success');
    }

    cmdNodes(args) {
        if (!window.nodes) {
            this.log('Nodes not initialized yet', 'error');
            return;
        }
        
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
        if (!window.loadingManager) {
            this.log('Loading manager not ready', 'error');
            return;
        }
        
        const search = args.length > 0 ? args.join(' ').toLowerCase() : '';
        const allItems = loadingManager.getData('items');
        
        if (!allItems) {
            this.log('Items data not loaded', 'error');
            return;
        }
        
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
        if (!window.loadingManager) {
            this.log('Loading manager not ready', 'error');
            return;
        }
        
        const search = args.length > 0 ? args.join(' ').toLowerCase() : '';
        const allActivities = loadingManager.getData('activities');
        
        if (!allActivities) {
            this.log('Activities data not loaded', 'error');
            return;
        }
        
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
        if (!window.map) {
            this.log('Map not initialized yet', 'error');
            return;
        }
        map.toggleCollisionDebug();
        this.log(`Collision debug ${map.showCollisionDebug ? 'enabled' : 'disabled'}`, 'success');
    }

    cmdNodeText() {
    if (!window.map) {
        this.log('Map not initialized yet', 'error');
        return;
    }
    map.toggleNodeText();
    this.log(`Node text ${map.showNodeText ? 'enabled' : 'disabled'}`, 'success');
}

cmdListGoals() {
    if (!window.ai) {
        this.log('AI not initialized yet', 'error');
        return;
    }
    
    if (ai.goals.length === 0) {
        this.log('No goals in queue', 'info');
        return;
    }
    
    // Show current goal
    if (ai.currentGoal) {
        this.log('=== CURRENT GOAL ===', 'info');
        this.formatGoal(ai.currentGoal, true);
        this.log('', 'info');
    } else {
        this.log('No active goal (selecting...)', 'info');
        this.log('', 'info');
    }
    
    // Show all goals in queue
    this.log('=== GOAL QUEUE ===', 'info');
    for (const goal of ai.goals) {
        const isComplete = ai.isGoalComplete(goal);
        const isCurrent = ai.currentGoal === goal;
        this.formatGoal(goal, false, isComplete, isCurrent);
    }
    
    this.log(`Total goals: ${ai.goals.length}`, 'info');
}

formatGoal(goal, detailed = false, isComplete = false, isCurrent = false) {
    let status = '';
    if (isCurrent) status = ' [ACTIVE]';
    else if (isComplete) status = ' [COMPLETE]';
    
    switch (goal.type) {
        case 'skill_level':
            const currentLevel = skills.getLevel(goal.skill);
            const currentXp = Math.floor(skills.getXp(goal.skill));
            const targetXp = getXpForLevel(goal.targetLevel);
            const progress = Math.floor((currentXp / targetXp) * 100);
            
            if (detailed) {
                this.log(`Type: Skill Training`, 'info');
                this.log(`Skill: ${goal.skill}`, 'info');
                this.log(`Target: Level ${goal.targetLevel}`, 'info');
                this.log(`Current: Level ${currentLevel} (${formatNumber(currentXp)} XP)`, 'info');
                this.log(`Progress: ${progress}%`, 'info');
                this.log(`Priority: ${goal.priority}`, 'info');
            } else {
                this.log(`#${goal.priority}: Train ${goal.skill} to ${goal.targetLevel} (currently ${currentLevel}) - ${progress}%${status}`, 
                    isComplete ? 'success' : (isCurrent ? 'command' : 'info'));
            }
            break;
            
        case 'bank_items':
            const currentCount = bank.getItemCount(goal.itemId);
            const itemData = loadingManager.getData('items')[goal.itemId];
            const itemProgress = Math.floor((currentCount / goal.targetCount) * 100);
            
            if (detailed) {
                this.log(`Type: Item Banking`, 'info');
                this.log(`Item: ${itemData.name} (${goal.itemId})`, 'info');
                this.log(`Target: ${formatNumber(goal.targetCount)}`, 'info');
                this.log(`Current: ${formatNumber(currentCount)}`, 'info');
                this.log(`Progress: ${itemProgress}%`, 'info');
                this.log(`Priority: ${goal.priority}`, 'info');
            } else {
                this.log(`#${goal.priority}: Bank ${formatNumber(goal.targetCount)} ${itemData.name} (${formatNumber(currentCount)}/${formatNumber(goal.targetCount)}) - ${itemProgress}%${status}`, 
                    isComplete ? 'success' : (isCurrent ? 'command' : 'info'));
            }
            break;
            
        default:
            this.log(`#${goal.priority}: Unknown goal type: ${goal.type}${status}`, 'error');
    }
}

    




    
}

// Create global instance immediately
window.devConsole = new DevConsole();
