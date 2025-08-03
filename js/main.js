// Game state
window.gameState = {
    running: false,
    paused: false,
    lastTime: 0,
    deltaTime: 0
};

// Check if all required classes are loaded
function checkRequiredClasses() {
    const requiredClasses = [
        { name: 'SkillsManager', class: window.SkillsManager },
        { name: 'Inventory', class: window.Inventory },
        { name: 'Bank', class: window.Bank },
        { name: 'Player', class: window.Player },
        { name: 'NodeManager', class: window.NodeManager },
        { name: 'MapRenderer', class: window.MapRenderer },
        { name: 'UIManager', class: window.UIManager },
        { name: 'AIManager', class: window.AIManager }
    ];

    const missing = [];
    for (const req of requiredClasses) {
        if (!req.class) {
            missing.push(req.name);
        }
    }

    if (missing.length > 0) {
        const errorMsg = `Failed to load required classes: ${missing.join(', ')}. Check console for syntax errors.`;
        console.error(errorMsg);
        return { success: false, error: errorMsg };
    }

    return { success: true };
}

// Initialize the game
async function init() {
    // Check if LoadingManager exists first
    if (!window.loadingManager) {
        console.error('LoadingManager not found. Check if loadingManager.js loaded correctly.');
        if (document.querySelector('.loading-text')) {
            document.querySelector('.loading-text').textContent = 'Failed to load LoadingManager. Check console for errors.';
            document.querySelector('.loading-text').style.color = '#e74c3c';
        }
        return;
    }

    // Add assets to load
    loadingManager.addImage('worldMap', 'assets/map.png');
    loadingManager.addJSON('skills', 'data/skills.json');
    loadingManager.addJSON('items', 'data/items.json');
    loadingManager.addJSON('nodes', 'data/nodes.json');
    loadingManager.addJSON('activities', 'data/activities.json');

    // Load skill icons
    const skillIconsToLoad = [
        'bank', 'quests', 'attack', 'strength', 'defence', 'hitpoints',
        'ranged', 'prayer', 'magic', 'woodcutting', 'mining', 'fishing',
        'cooking', 'crafting', 'smithing', 'agility', 'thieving', 'runecraft',
        'construction', 'herblore', 'fletching', 'slayer', 'hunter', 'farming', 
        'firemaking', 'combat', 'skills'
    ];

    for (const icon of skillIconsToLoad) {
        loadingManager.addImage(`skill_${icon}`, `assets/skills/${icon}.png`);
    }

    // Set completion callback
    loadingManager.onComplete = () => {
        // Check classes only after assets are loaded
        const classCheck = checkRequiredClasses();
        if (classCheck.success) {
            startGame();
        } else {
            document.querySelector('.loading-text').textContent = classCheck.error;
            document.querySelector('.loading-text').style.color = '#e74c3c';
        }
    };

    // Start loading
    try {
        await loadingManager.loadAll();
    } catch (error) {
        console.error('Failed to load game assets:', error);
        document.querySelector('.loading-text').textContent = 'Failed to load game assets. Please refresh.';
    }
}

function startGame() {
    try {
        // Hide loading screen
        document.getElementById('loading-screen').style.display = 'none';
        document.getElementById('game-container').style.display = 'flex';

        // Initialize game systems
        window.skills = new SkillsManager();
        window.inventory = new Inventory();
        window.bank = new Bank();
        window.player = new Player();
        window.nodes = new NodeManager();
        window.map = new MapRenderer();
        window.ui = new UIManager();
        window.ai = new AIManager();

        // Set up canvas
        const canvas = document.getElementById('game-canvas');
        const mapContainer = document.querySelector('.map-container');
        canvas.width = mapContainer.clientWidth;
        canvas.height = mapContainer.clientHeight;

        // Handle window resize
        window.addEventListener('resize', () => {
            canvas.width = mapContainer.clientWidth;
            canvas.height = mapContainer.clientHeight;
            map.render();
        });

        // Set up controls
        document.getElementById('bank-toggle').addEventListener('click', () => {
            ui.toggleBank();
        });

        document.getElementById('pause-toggle').addEventListener('click', () => {
            gameState.paused = !gameState.paused;
            document.getElementById('pause-toggle').textContent = gameState.paused ? 'Resume AI' : 'Pause AI';
        });

        document.getElementById('close-bank').addEventListener('click', () => {
            ui.toggleBank();
        });

        // Start game loop
        gameState.running = true;
        requestAnimationFrame(gameLoop);
    } catch (error) {
        console.error('Failed to start game:', error);
        document.getElementById('loading-screen').style.display = 'flex';
        document.querySelector('.loading-text').textContent = `Failed to start game: ${error.message}`;
        document.querySelector('.loading-text').style.color = '#e74c3c';
    }
}

function gameLoop(currentTime) {
    if (!gameState.running) return;

    // Calculate delta time
    gameState.deltaTime = currentTime - gameState.lastTime;
    gameState.lastTime = currentTime;

    // Update game systems
    if (!gameState.paused) {
        ai.update(gameState.deltaTime);
        player.update(gameState.deltaTime);
    }

    // Render
    map.render();
    ui.update();

    // Continue loop
    requestAnimationFrame(gameLoop);
}

// Start initialization when ALL resources (including scripts) are loaded
window.addEventListener('load', init);
