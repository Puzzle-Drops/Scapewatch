class DevConsole {
    constructor() {
        this.visible = false;
        this.history = [];
        this.historyIndex = -1;
        this.commandHistory = [];
        this.maxHistory = 100;
        this.consoleOutput = [];
        this.maxConsoleOutput = 500;
        
        // Testing speed modifiers
        this.speedModifiers = {
            playerSpeed: 3, // Default 3 tiles/second
            actionDuration: 1.0, // Multiplier for action durations
            defaultPlayerSpeed: 3,
            defaultActionDuration: 1.0
        };
        
        // Store original skill methods for speed modifications
        this.originalSkillMethods = null;
        
        // Capture console methods before anything else loads
        this.captureConsole();
        
        this.initializeCommands();
        
        // Initialize after DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initialize());
        } else {
            this.initialize();
        }
    }

    // ==================== INITIALIZATION ====================

    initializeCommands() {
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
            
            // Speed controls
            playerspeed: {
                description: 'Set player movement speed',
                usage: 'playerspeed [speed] (default: 3 tiles/sec)',
                fn: (args) => this.cmdPlayerSpeed(args)
            },
            actionspeed: {
                description: 'Set action duration multiplier',
                usage: 'actionspeed [multiplier] (0.01 = 100x faster, 0.1 = 10x faster, 2 = 2x slower)',
                fn: (args) => this.cmdActionSpeed(args)
            },
            testmode: {
                description: 'Toggle fast testing mode',
                usage: 'testmode [on/off]',
                fn: (args) => this.cmdTestMode(args)
            },
            t: {
                description: 'Toggle fast testing mode (shortcut)',
                usage: 't',
                fn: (args) => this.cmdTestMode(args)
            },
            resetspeeds: {
                description: 'Reset all speeds to default',
                usage: 'resetspeeds',
                fn: () => this.cmdResetSpeeds()
            },
            r: {
                description: 'Reset all speeds to default (shortcut)',
                usage: 'r',
                fn: () => this.cmdResetSpeeds()
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
            
            // Task commands (NEW - replacing goals)
            tasks: {
                description: 'List all current tasks',
                usage: 'tasks',
                fn: () => this.cmdListTasks()
            },
            completetask: {
                description: 'Instantly complete a task',
                usage: 'completetask <index>',
                fn: (args) => this.cmdCompleteTask(args)
            },
            rerolltask: {
                description: 'Reroll a specific task',
                usage: 'rerolltask <index>',
                fn: (args) => this.cmdRerollTask(args)
            },
            cleartasks: {
                description: 'Clear all tasks and regenerate',
                usage: 'cleartasks',
                fn: () => this.cmdClearTasks()
            },
            generatetasks: {
                description: 'Generate new batch of tasks',
                usage: 'generatetasks',
                fn: () => this.cmdGenerateTasks()
            },
            
            // AI commands
            pauseai: {
                description: 'Toggle AI pause',
                usage: 'pauseai',
                fn: () => this.cmdPauseAI()
            },
            aistatus: {
                description: 'Show AI status and current task',
                usage: 'aistatus',
                fn: () => this.cmdAIStatus()
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
        
        // Display all captured console output when toggling on
        if (this.consoleOutputDiv && this.consoleOutput.length > 0) {
            // Clear existing display
            this.consoleOutputDiv.innerHTML = '';
            
            // Re-display all captured output
            this.consoleOutput.forEach(output => {
                this.appendConsoleOutput(output);
            });
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

    // ==================== HELPER METHODS ====================

    requireSystem(systemName, windowProperty) {
        if (!window[windowProperty]) {
            this.log(`${systemName} not initialized yet`, 'error');
            return false;
        }
        return true;
    }

    parseIntArg(arg, name, min = null, max = null) {
        const value = parseInt(arg);
        if (isNaN(value)) {
            this.log(`${name} must be a number`, 'error');
            return null;
        }
        if (min !== null && value < min) {
            this.log(`${name} must be at least ${min}`, 'error');
            return null;
        }
        if (max !== null && value > max) {
            this.log(`${name} must be at most ${max}`, 'error');
            return null;
        }
        return value;
    }

    parseFloatArg(arg, name, min = null, max = null) {
        const value = parseFloat(arg);
        if (isNaN(value)) {
            this.log(`${name} must be a number`, 'error');
            return null;
        }
        if (min !== null && value < min) {
            this.log(`${name} must be at least ${min}`, 'error');
            return null;
        }
        if (max !== null && value > max) {
            this.log(`${name} must be at most ${max}`, 'error');
            return null;
        }
        return value;
    }

    validateSkill(skillId) {
        if (!this.requireSystem('Skills', 'skills')) return null;
        
        const skill = skills.skills[skillId.toLowerCase()];
        if (!skill) {
            this.log(`Unknown skill: ${skillId}`, 'error');
            return null;
        }
        return skillId.toLowerCase();
    }

    validateItem(itemId) {
        if (!this.requireSystem('Loading manager', 'loadingManager')) return null;
        
        const items = loadingManager.getData('items');
        if (!items || !items[itemId]) {
            this.log(`Unknown item: ${itemId}`, 'error');
            return null;
        }
        return itemId;
    }

    validateActivity(activityId) {
        if (!this.requireSystem('Loading manager', 'loadingManager')) return null;
        
        const activities = loadingManager.getData('activities');
        if (!activities || !activities[activityId]) {
            this.log(`Unknown activity: ${activityId}`, 'error');
            return null;
        }
        return activityId;
    }

    searchData(dataType, searchTerm) {
        if (!this.requireSystem('Loading manager', 'loadingManager')) return [];
        
        const data = loadingManager.getData(dataType);
        if (!data) {
            this.log(`${dataType} data not loaded`, 'error');
            return [];
        }
        
        let matches = Object.entries(data);
        if (searchTerm) {
            const search = searchTerm.toLowerCase();
            matches = matches.filter(([id, item]) => {
                // Search in ID
                if (id.toLowerCase().includes(search)) return true;
                // Search in name
                if (item.name && item.name.toLowerCase().includes(search)) return true;
                // Search in skill (for activities)
                if (item.skill && item.skill.toLowerCase().includes(search)) return true;
                return false;
            });
        }
        
        return matches;
    }

    // ==================== SPEED CONTROL COMMANDS ====================

    cmdPlayerSpeed(args) {
        if (args.length === 0) {
            this.log(`Current player speed: ${this.speedModifiers.playerSpeed} tiles/second`, 'info');
            this.log(`Default: ${this.speedModifiers.defaultPlayerSpeed} tiles/second`, 'info');
            return;
        }
        
        const speed = this.parseFloatArg(args[0], 'Speed', 0.1, 100);
        if (speed === null) return;
        
        this.speedModifiers.playerSpeed = speed;
        
        // Apply to player if exists
        if (window.player) {
            player.movementSpeed = speed;
        }
        
        this.log(`Player speed set to ${speed} tiles/second`, 'success');
    }

    cmdActionSpeed(args) {
        if (args.length === 0) {
            this.log(`Current action speed multiplier: ${this.speedModifiers.actionDuration}x`, 'info');
            this.log(`(0.01 = 100x faster, 0.1 = 10x faster, 1.0 = normal, 2.0 = 2x slower)`, 'info');
            return;
        }
        
        const multiplier = this.parseFloatArg(args[0], 'Multiplier', 0.001, 10);
        if (multiplier === null) return;
        
        this.speedModifiers.actionDuration = multiplier;
        
        // Hook into skill registry if it exists
        if (window.skillRegistry && window.skillRegistry.initialized) {
            // Store original methods if not already stored
            if (!this.originalSkillMethods) {
                this.originalSkillMethods = {};
            }
            
            // Override getDuration methods for all skills
            const allSkills = skillRegistry.getAllSkills();
            for (const skill of allSkills) {
                // Store original method if not already stored
                if (!this.originalSkillMethods[skill.id]) {
                    this.originalSkillMethods[skill.id] = skill.getDuration.bind(skill);
                }
                
                // Override with multiplier
                const originalMethod = this.originalSkillMethods[skill.id];
                skill.getDuration = (baseDuration, level, activityData) => {
                    const duration = originalMethod(baseDuration, level, activityData);
                    return duration * window.devConsole.speedModifiers.actionDuration;
                };
            }
        }
        
        this.log(`Action speed multiplier set to ${multiplier}x`, 'success');
        if (multiplier < 1) {
            this.log(`Actions are now ${Math.round(1/multiplier)}x faster`, 'info');
        } else if (multiplier > 1) {
            this.log(`Actions are now ${multiplier}x slower`, 'info');
        }
    }

    cmdTestMode(args) {
        const mode = args.length > 0 ? args[0].toLowerCase() : 'toggle';
        
        let enable = false;
        if (mode === 'toggle') {
            enable = this.speedModifiers.playerSpeed === this.speedModifiers.defaultPlayerSpeed;
        } else {
            enable = mode === 'on' || mode === 'true' || mode === '1';
        }
        
        if (enable) {
            // Fast testing mode
            this.speedModifiers.playerSpeed = 30; // 30 tiles/sec
            this.speedModifiers.actionDuration = 0.01; // 100x faster actions
            
            if (window.player) {
                player.movementSpeed = 30;
            }
            
            // Apply action speed (0.01 = 100x faster)
            this.cmdActionSpeed(['0.01']);
            
            this.log('Test mode ENABLED', 'success');
            this.log('- Player speed: 30 tiles/sec', 'info');
            this.log('- Actions: 100x faster', 'info');
        } else {
            // Reset to defaults
            this.cmdResetSpeeds();
        }
    }

    cmdResetSpeeds() {
        this.speedModifiers.playerSpeed = this.speedModifiers.defaultPlayerSpeed;
        this.speedModifiers.actionDuration = this.speedModifiers.defaultActionDuration;
        
        if (window.player) {
            player.movementSpeed = this.speedModifiers.defaultPlayerSpeed;
        }
        
        // Restore original skill methods if they were overridden
        if (this.originalSkillMethods && window.skillRegistry) {
            const allSkills = skillRegistry.getAllSkills();
            for (const skill of allSkills) {
                if (this.originalSkillMethods[skill.id]) {
                    skill.getDuration = this.originalSkillMethods[skill.id];
                }
            }
        }
        
        this.log('All speeds reset to default', 'success');
    }

    // ==================== COMMAND IMPLEMENTATIONS ====================

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
            
            // Group commands by category
            const categories = {
                'Console': ['help', 'clear', 'clearconsole', 'clearall'],
                'Player': ['tp', 'pos', 'resetplayer'],
                'Speed': ['playerspeed', 'actionspeed', 'testmode', 't', 'resetspeeds', 'r'],
                'Skills': ['setlevel', 'addxp', 'maxskills'],
                'Inventory': ['give', 'clearinv'],
                'Bank': ['bank', 'giveall'],
                'Tasks': ['tasks', 'completetask', 'rerolltask', 'cleartasks', 'generatetasks'],
                'AI': ['pauseai', 'aistatus'],
                'Activity': ['startactivity', 'stopactivity'],
                'Debug': ['nodes', 'items', 'activities', 'collision', 'nodetext']
            };
            
            for (const [category, cmds] of Object.entries(categories)) {
                this.log(`--- ${category} ---`, 'info');
                for (const cmdName of cmds) {
                    if (this.commands[cmdName]) {
                        this.log(`  ${cmdName} - ${this.commands[cmdName].description}`, 'info');
                    }
                }
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
        if (!this.requireSystem('Player', 'player')) return;
        
        if (args.length === 2) {
            // Teleport to coordinates
            const x = this.parseIntArg(args[0], 'X coordinate');
            const y = this.parseIntArg(args[1], 'Y coordinate');
            if (x === null || y === null) return;
            
            player.position.x = x;
            player.position.y = y;
            player.path = [];
            player.targetPosition = null;
            player.targetNode = null;
            player.currentNode = null;
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
            
            player.position.x = node.position.x + 0.5;
            player.position.y = node.position.y + 0.5;
            player.path = [];
            player.targetPosition = null;
            player.targetNode = null;
            player.currentNode = nodeId;
            player.stopActivity();
            
            this.log(`Teleported to ${node.name} (${nodeId})`, 'success');
        } else {
            this.log('Usage: tp <x> <y> or tp <nodeId>', 'error');
        }
    }

    cmdPosition() {
        if (!this.requireSystem('Player', 'player')) return;
        
        this.log(`Position: ${Math.round(player.position.x)}, ${Math.round(player.position.y)}`, 'info');
        if (player.currentNode) {
            const node = nodes.getNode(player.currentNode);
            this.log(`Current node: ${player.currentNode} (${node ? node.name : 'unknown'})`, 'info');
        } else {
            this.log(`Current node: none`, 'info');
        }
    }

    cmdResetPlayer() {
        if (!this.requireSystem('Test scenario', 'testScenario')) return;
        
        testScenario.resetPlayer();
        this.log('Player reset to starting position', 'success');
    }

    cmdSetLevel(args) {
        if (args.length !== 2) {
            this.log('Usage: setlevel <skill> <level>', 'error');
            return;
        }
        
        const skillId = this.validateSkill(args[0]);
        if (!skillId) return;
        
        const level = this.parseIntArg(args[1], 'Level', 1, 99);
        if (level === null) return;
        
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
        if (args.length !== 2) {
            this.log('Usage: addxp <skill> <amount>', 'error');
            return;
        }
        
        const skillId = this.validateSkill(args[0]);
        if (!skillId) return;
        
        const amount = this.parseIntArg(args[1], 'Amount', 0);
        if (amount === null) return;
        
        skills.addXp(skillId, amount);
        if (window.ui) ui.updateSkillsList();
        this.log(`Added ${window.formatNumber(amount)} XP to ${skillId}`, 'success');
    }

    cmdMaxSkills() {
        if (!this.requireSystem('Test scenario', 'testScenario')) return;
        
        testScenario.maxAllSkills();
        if (window.ui) ui.updateSkillsList();
        this.log('All skills set to 99', 'success');
    }

    cmdGive(args) {
        if (!this.requireSystem('Inventory', 'inventory')) return;
        
        if (args.length < 1) {
            this.log('Usage: give <itemId> [quantity]', 'error');
            return;
        }
        
        const itemId = this.validateItem(args[0]);
        if (!itemId) return;
        
        const quantity = args.length > 1 ? this.parseIntArg(args[1], 'Quantity', 1) : 1;
        if (quantity === null) return;
        
        const items = loadingManager.getData('items');
        const added = inventory.addItem(itemId, quantity);
        this.log(`Added ${added} ${items[itemId].name} to inventory`, 'success');
    }

    cmdClearInv() {
        if (!this.requireSystem('Inventory', 'inventory')) return;
        
        inventory.clear();
        this.log('Inventory cleared', 'success');
    }

    cmdBank(args) {
        if (!this.requireSystem('Bank', 'bank')) return;
        
        if (args.length < 1) {
            this.log('Usage: bank <itemId> [quantity]', 'error');
            return;
        }
        
        const itemId = this.validateItem(args[0]);
        if (!itemId) return;
        
        const quantity = args.length > 1 ? this.parseIntArg(args[1], 'Quantity', 1) : 1;
        if (quantity === null) return;
        
        const items = loadingManager.getData('items');
        bank.deposit(itemId, quantity);
        this.log(`Added ${quantity} ${items[itemId].name} to bank`, 'success');
    }

    cmdGiveAll(args) {
        if (!this.requireSystem('Test scenario', 'testScenario')) return;
        
        const quantity = args.length > 0 ? this.parseIntArg(args[0], 'Quantity', 1) : 100;
        if (quantity === null) return;
        
        testScenario.giveAllItems(quantity);
        this.log(`Added ${quantity} of each item to bank`, 'success');
    }

    // ==================== TASK COMMANDS (NEW) ====================

    cmdListTasks() {
        if (!this.requireSystem('Task Manager', 'taskManager')) return;
        
        const tasks = taskManager.getAllTasks();
        
        if (tasks.length === 0) {
            this.log('No tasks available', 'info');
            return;
        }
        
        this.log('=== CURRENT TASKS ===', 'info');
        
        // Check which task is current (first incomplete)
        const currentTask = taskManager.getFirstIncompleteTask();
        
        tasks.forEach((task, index) => {
            const isComplete = task.progress >= 1;
            const isCurrent = task === currentTask;
            
            let status = '';
            if (isCurrent) status = ' [ACTIVE]';
            else if (isComplete) status = ' [COMPLETE]';
            
            let progressText = '';
            if (task.isCookingTask) {
                // Cooking task - show raw food consumed
                const consumed = task.rawFoodConsumed || 0;
                progressText = `${consumed}/${task.targetCount}`;
            } else {
                // Gathering task - show items collected
                const current = Math.floor(task.progress * task.targetCount);
                progressText = `${current}/${task.targetCount}`;
            }
            
            const percentage = Math.floor(task.progress * 100);
            
            this.log(
                `#${index + 1}: ${task.description} - ${progressText} (${percentage}%)${status}`,
                isComplete ? 'success' : (isCurrent ? 'command' : 'info')
            );
        });
        
        // Show AI status if available
        if (window.ai && window.ai.currentTask) {
            this.log('', 'info');
            this.log(`AI working on: ${window.ai.currentTask.description}`, 'info');
        }
    }

    cmdCompleteTask(args) {
        if (!this.requireSystem('Task Manager', 'taskManager')) return;
        
        if (args.length !== 1) {
            this.log('Usage: completetask <index>', 'error');
            this.log('Example: completetask 1 (completes first task)', 'info');
            return;
        }
        
        const index = this.parseIntArg(args[0], 'Task index', 1, taskManager.tasks.length);
        if (index === null) return;
        
        const taskIndex = index - 1; // Convert to 0-based index
        const task = taskManager.tasks[taskIndex];
        
        if (!task) {
            this.log(`Task #${index} not found`, 'error');
            return;
        }
        
        // For gathering tasks, add items to bank to complete
        if (!task.isCookingTask) {
            const currentCount = taskManager.getCurrentItemCount(task.itemId);
            const needed = task.targetCount - currentCount + (task.startingCount || 0);
            
            if (needed > 0) {
                bank.deposit(task.itemId, needed);
                this.log(`Added ${needed} ${task.itemId} to bank`, 'info');
            }
        } else {
            // For cooking tasks, just mark as complete
            task.rawFoodConsumed = task.targetCount;
        }
        
        // Mark task as complete
        taskManager.setTaskProgress(task, 1);
        
        this.log(`Completed task: ${task.description}`, 'success');
        
        // Update UI
        if (window.ui) {
            window.ui.updateTasks();
        }
    }

    cmdRerollTask(args) {
        if (!this.requireSystem('Task Manager', 'taskManager')) return;
        
        if (args.length !== 1) {
            this.log('Usage: rerolltask <index>', 'error');
            this.log('Example: rerolltask 1 (rerolls first task)', 'info');
            return;
        }
        
        const index = this.parseIntArg(args[0], 'Task index', 1, taskManager.tasks.length);
        if (index === null) return;
        
        const taskIndex = index - 1; // Convert to 0-based index
        const oldTask = taskManager.tasks[taskIndex];
        
        if (!oldTask) {
            this.log(`Task #${index} not found`, 'error');
            return;
        }
        
        this.log(`Rerolling task: ${oldTask.description}`, 'info');
        taskManager.rerollTask(taskIndex);
        
        const newTask = taskManager.tasks[taskIndex];
        if (newTask && newTask !== oldTask) {
            this.log(`New task: ${newTask.description}`, 'success');
        }
    }

    cmdClearTasks() {
        if (!this.requireSystem('Task Manager', 'taskManager')) return;
        
        taskManager.clearTasks();
        this.log('All tasks cleared', 'success');
        
        // Generate new tasks
        taskManager.generateNewTasks();
        this.log('Generated new batch of tasks', 'success');
    }

    cmdGenerateTasks() {
        if (!this.requireSystem('Task Manager', 'taskManager')) return;
        
        taskManager.generateNewTasks();
        this.log('Generated new batch of tasks', 'success');
    }

    // ==================== AI COMMANDS ====================

    cmdPauseAI() {
        if (!this.requireSystem('Game', 'gameState')) return;
        
        gameState.paused = !gameState.paused;
        const pauseBtn = document.getElementById('pause-toggle');
        if (pauseBtn) {
            pauseBtn.textContent = gameState.paused ? 'Resume AI' : 'Pause AI';
        }
        this.log(`AI ${gameState.paused ? 'paused' : 'resumed'}`, 'success');
    }

    cmdAIStatus() {
        if (!this.requireSystem('AI', 'ai')) return;
        
        this.log('=== AI STATUS ===', 'info');
        
        // Paused state
        const isPaused = window.gameState ? gameState.paused : false;
        this.log(`State: ${isPaused ? 'PAUSED' : 'RUNNING'}`, isPaused ? 'error' : 'success');
        
        // Current task
        if (ai.currentTask) {
            const progress = Math.floor(ai.currentTask.progress * 100);
            this.log(`Current Task: ${ai.currentTask.description}`, 'info');
            this.log(`Progress: ${progress}%`, 'info');
            this.log(`Node: ${ai.currentTask.nodeId}`, 'info');
            this.log(`Activity: ${ai.currentTask.activityId}`, 'info');
        } else {
            this.log('Current Task: None (selecting...)', 'info');
        }
        
        // Player status
        if (window.player) {
            this.log('', 'info');
            this.log('=== PLAYER STATUS ===', 'info');
            
            if (player.isMoving()) {
                this.log('Status: Moving', 'info');
                if (player.targetNode) {
                    this.log(`Target: ${player.targetNode}`, 'info');
                }
            } else if (player.isPerformingActivity()) {
                this.log('Status: Performing Activity', 'info');
                this.log(`Activity: ${player.currentActivity}`, 'info');
                const progress = Math.floor(player.activityProgress * 100);
                this.log(`Progress: ${progress}%`, 'info');
            } else {
                this.log('Status: Idle', 'info');
            }
            
            this.log(`Current Node: ${player.currentNode || 'none'}`, 'info');
        }
        
        // Decision cooldown
        this.log('', 'info');
        this.log(`Decision Cooldown: ${Math.floor(ai.decisionCooldown)}ms`, 'info');
    }

    cmdStartActivity(args) {
        if (!this.requireSystem('Player', 'player')) return;
        
        if (args.length !== 1) {
            this.log('Usage: startactivity <activityId>', 'error');
            return;
        }
        
        const activityId = this.validateActivity(args[0]);
        if (!activityId) return;
        
        const activities = loadingManager.getData('activities');
        player.startActivity(activityId);
        this.log(`Started activity: ${activities[activityId].name}`, 'success');
    }

    cmdStopActivity() {
        if (!this.requireSystem('Player', 'player')) return;
        
        player.stopActivity();
        this.log('Activity stopped', 'success');
    }

    cmdNodes(args) {
        const search = args.length > 0 ? args.join(' ').toLowerCase() : '';
        const matches = this.searchData('nodes', search);
        
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
        const matches = this.searchData('items', search);
        
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
        const matches = this.searchData('activities', search);
        
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
        if (!this.requireSystem('Map', 'map')) return;
        
        map.toggleCollisionDebug();
        this.log(`Collision debug ${map.showCollisionDebug ? 'enabled' : 'disabled'}`, 'success');
    }

    cmdNodeText() {
        if (!this.requireSystem('Map', 'map')) return;
        
        map.toggleNodeText();
        this.log(`Node text ${map.showNodeText ? 'enabled' : 'disabled'}`, 'success');
    }
}

// Create global instance
window.devConsole = new DevConsole();
