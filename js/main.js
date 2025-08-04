// Game state
window.gameState = {
    running: false,
    paused: false,
    lastTime: 0,
    deltaTime: 0,
    frameTime: 1000 / 60, // 60 FPS limit
    accumulator: 0,
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
}

function gameLoop(currentTime) {
    if (!gameState.running) return;

    // Calculate time since last frame
    const frameTime = currentTime - gameState.lastTime;
    gameState.lastTime = currentTime;
    
    // Update FPS counter
    gameState.frameCount++;
    if (currentTime - gameState.fpsTime >= 1000) {
        gameState.fps = gameState.frameCount;
        gameState.frameCount = 0;
        gameState.fpsTime = currentTime;
    }
    
    // Accumulate time for fixed timestep
    gameState.accumulator += frameTime;
    
    // Only update if enough time has passed (60 FPS limit)
    if (gameState.accumulator >= gameState.frameTime) {
        // Use the actual frame time for deltaTime (not the accumulator)
        gameState.deltaTime = gameState.frameTime;
        
        // Update game systems
        if (!gameState.paused) {
            ai.update(gameState.deltaTime);
            player.update(gameState.deltaTime);
        }

        // Render
        map.render();
        ui.update();
        
        // Subtract frame time from accumulator (don't reset to 0)
        gameState.accumulator -= gameState.frameTime;
    }

    // Continue loop
    requestAnimationFrame(gameLoop);
}

// Start initialization when page loads
window.addEventListener('DOMContentLoaded', init);
