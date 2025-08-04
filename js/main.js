// Game state
window.gameState = {
    running: false,
    paused: false,
    lastTime: 0,
    deltaTime: 0,
    frameCount: 0,
    fps: 0,
    fpsUpdateTime: 0,
    targetFPS: 30  // Limit to 30 FPS for performance
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

    // Handle window resize with debouncing
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            canvas.width = mapContainer.clientWidth;
            canvas.height = mapContainer.clientHeight;
            map.render();
        }, 250); // Wait 250ms after resize stops
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

    // Add FPS display (optional - can be removed in production)
    const fpsDisplay = document.createElement('div');
    fpsDisplay.style.position = 'fixed';
    fpsDisplay.style.top = '10px';
    fpsDisplay.style.left = '10px';
    fpsDisplay.style.color = '#fff';
    fpsDisplay.style.fontSize = '12px';
    fpsDisplay.style.fontFamily = 'monospace';
    fpsDisplay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    fpsDisplay.style.padding = '5px';
    fpsDisplay.style.borderRadius = '3px';
    fpsDisplay.style.zIndex = '1000';
    fpsDisplay.id = 'fps-display';
    document.body.appendChild(fpsDisplay);

    // Start game loop
    gameState.running = true;
    requestAnimationFrame(gameLoop);
}

function gameLoop(currentTime) {
    if (!gameState.running) return;

    // Calculate delta time
    gameState.deltaTime = currentTime - gameState.lastTime;
    
    // Frame rate limiting
    const frameTime = 1000 / gameState.targetFPS;
    
    if (gameState.deltaTime >= frameTime) {
        // Update FPS counter
        gameState.frameCount++;
        if (currentTime - gameState.fpsUpdateTime >= 1000) {
            gameState.fps = gameState.frameCount;
            gameState.frameCount = 0;
            gameState.fpsUpdateTime = currentTime;
            
            // Update FPS display
            const fpsDisplay = document.getElementById('fps-display');
            if (fpsDisplay) {
                fpsDisplay.textContent = `FPS: ${gameState.fps}`;
            }
        }
        
        // Update game systems
        if (!gameState.paused) {
            ai.update(gameState.deltaTime);
            player.update(gameState.deltaTime);
        }

        // Render only when frame time has passed
        map.render();
        ui.update();
        
        // Update last time to maintain consistent frame rate
        gameState.lastTime = currentTime - (gameState.deltaTime % frameTime);
    }

    // Continue loop
    requestAnimationFrame(gameLoop);
}

// Start initialization when page loads
window.addEventListener('DOMContentLoaded', init);
