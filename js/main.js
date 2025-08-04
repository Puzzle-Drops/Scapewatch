// Game state
window.gameState = {
    running: false,
    paused: false,
    lastTime: 0,
    deltaTime: 0
};

// Fixed game dimensions
const GAME_WIDTH = 2560;
const GAME_HEIGHT = 1440;
const UI_PANEL_WIDTH = 350;
const CANVAS_WIDTH = GAME_WIDTH - UI_PANEL_WIDTH;
const CANVAS_HEIGHT = GAME_HEIGHT;

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

function updateScale() {
    const gameScaler = document.getElementById('game-scaler');
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    // Calculate scale to fit window while maintaining aspect ratio
    const scaleX = windowWidth / GAME_WIDTH;
    const scaleY = windowHeight / GAME_HEIGHT;
    const scale = Math.min(scaleX, scaleY);
    
    // Apply scale transform
    gameScaler.style.transform = `scale(${scale})`;
}

function startGame() {
    // Hide loading screen
    document.getElementById('loading-screen').style.display = 'none';
    document.getElementById('game-wrapper').style.display = 'flex';

    // Initialize game systems
    window.skills = new SkillsManager();
    window.inventory = new Inventory();
    window.bank = new Bank();
    window.player = new Player();
    window.nodes = new NodeManager();
    window.map = new MapRenderer();
    window.ui = new UIManager();
    window.ai = new AIManager();

    // Set up canvas with fixed dimensions
    const canvas = document.getElementById('game-canvas');
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    // Set initial scale
    updateScale();

    // Handle window resize
    window.addEventListener('resize', () => {
        updateScale();
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

// Start initialization when page loads
window.addEventListener('DOMContentLoaded', init);
