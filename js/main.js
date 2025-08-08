// Game state
window.gameState = {
    running: false,
    paused: false,
    lastTime: 0,
    deltaTime: 0,
    fps: 0,
    frameCount: 0,
    fpsTime: 0
};

// Initialize the game
async function init() {

    // Initialize scaling system early so loading screen is scaled
    scalingSystem.initialize();
    
    // Add assets to load
    loadingManager.addImage('worldMap', 'assets/map.png');
    loadingManager.addImage('collisionMap', 'assets/collision-map.png');
    
    // Add skill icons
    const skillIcons = [
        'agility', 'attack', 'bank', 'combat', 'construction', 'cooking', 
        'crafting', 'defence', 'farming', 'firemaking', 'fishing', 'fletching', 
        'herblore', 'hitpoints', 'hunter', 'magic', 'mining', 'prayer', 
        'quests', 'ranged', 'runecraft', 'skills', 'slayer', 'smithing', 
        'strength', 'thieving', 'woodcutting'
    ];
    
    for (const icon of skillIcons) {
        loadingManager.addImage(`skill_${icon}`, `assets/skills/${icon}.png`);
    }
    
    loadingManager.addJSON('skills', 'data/skills.json');
    loadingManager.addJSON('items', 'data/items.json');
    loadingManager.addJSON('nodes', 'data/nodes.json');
    loadingManager.addJSON('activities', 'data/activities.json');

    // Set completion callback
    loadingManager.onComplete = () => {
        startGame();
    };

    // Start loading
    try {
        await loadingManager.loadAll();
    } catch (error) {
        console.error('Failed to load game assets:', error);
        document.querySelector('.loading-text').textContent = 'Failed to load game assets. Please refresh.';
    }
}

async function startGame() {
    // Hide loading screen and show game container
    document.getElementById('loading-screen').style.display = 'none';
    document.getElementById('game-container').style.display = 'block';
    
    // Scaling system is already initialized
    scalingSystem.setupInitialScaling();

    // Initialize collision system first
    window.collision = new CollisionSystem();
    await collision.initialize();
    
    // Initialize pathfinding with collision system
    window.pathfinding = new Pathfinding(collision);
    
    // Initialize skill registry before other systems
    await skillRegistry.initialize();
    
    // Initialize game systems (order matters!)
    window.skills = new SkillsManager();
    window.inventory = new Inventory();
    window.bank = new Bank();
    window.shop = new ShopSystem();
    window.taskManager = new TaskManager();
    window.player = new Player();
    window.nodes = new NodeManager();
    window.map = new MapRenderer();
    window.ui = new UIManager();
    window.ai = new AIManager();

    // Initialize task manager
    taskManager.initialize();

    // Run test scenario if enabled
    if (window.testScenario) {
        testScenario.run();
    }

    // Canvas sizing is handled by scalingSystem
    map.render();

    // Set up pause control
    document.getElementById('pause-toggle').addEventListener('click', () => {
        gameState.paused = !gameState.paused;
        document.getElementById('pause-toggle').textContent = gameState.paused ? 'Resume AI' : 'Pause AI';
    });

    // Start game loop
    gameState.running = true;
    gameState.lastTime = performance.now();
    requestAnimationFrame(gameLoop);
}

function gameLoop(currentTime) {
    if (!gameState.running) return;

    // Calculate delta time since last frame
    const deltaTime = currentTime - gameState.lastTime;
    gameState.lastTime = currentTime;
    gameState.deltaTime = deltaTime;
    
    // Update FPS counter
    gameState.frameCount++;
    if (currentTime - gameState.fpsTime >= 1000) {
        gameState.fps = gameState.frameCount;
        gameState.frameCount = 0;
        gameState.fpsTime = currentTime;
    }
    
    // Update game systems with delta time
    if (!gameState.paused) {
        ai.update(deltaTime);
        player.update(deltaTime);
    }

    // Update task progress
    if (window.taskManager) {
        taskManager.updateAllProgress();
    }

    // Render the map
    map.render();
    
    // Continue loop - runs at monitor refresh rate
    requestAnimationFrame(gameLoop);
}

// Start initialization when page loads
window.addEventListener('DOMContentLoaded', init);
