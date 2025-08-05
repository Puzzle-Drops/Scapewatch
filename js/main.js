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
    // Add assets to load
    loadingManager.addImage('worldMap', 'assets/map.png');
    
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

function startGame() {
    // Hide loading screen and show game wrapper
    document.getElementById('loading-screen').style.display = 'none';
    document.getElementById('game-wrapper').style.display = 'block';
    
    // Initialize scaling system
    scalingSystem.initialize();

    // Initialize game systems (order matters!)
    // skillBehaviors is already instantiated in skillBehaviors.js
    window.skills = new SkillsManager();
    window.inventory = new Inventory();
    window.bank = new Bank();
    window.player = new Player();
    window.nodes = new NodeManager();
    window.map = new MapRenderer();
    window.ui = new UIManager();
    window.ai = new AIManager();

    // Canvas sizing is now handled by scalingSystem
    // Just trigger initial render
    map.render();

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
    gameState.lastTime = performance.now();
    requestAnimationFrame(gameLoop);
}

function gameLoop(currentTime) {
    if (!gameState.running) return;

    // Calculate actual time since last frame
    const deltaTime = Math.min(currentTime - gameState.lastTime, 100); // Cap at 100ms to prevent huge jumps
    gameState.lastTime = currentTime;
    gameState.deltaTime = deltaTime;
    
    // Update FPS counter
    gameState.frameCount++;
    if (currentTime - gameState.fpsTime >= 1000) {
        gameState.fps = gameState.frameCount;
        gameState.frameCount = 0;
        gameState.fpsTime = currentTime;
    }
    
    // Update game systems with actual delta time
    if (!gameState.paused) {
        ai.update(deltaTime);
        player.update(deltaTime);
    }

    // Update UI only for frequently changing elements
    ui.update();

    // Always render the map
    map.render();
    
    // Continue loop
    requestAnimationFrame(gameLoop);
}

// Start initialization when page loads
window.addEventListener('DOMContentLoaded', init);
