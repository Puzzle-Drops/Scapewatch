class ScalingSystem {
    constructor() {
        // Fixed internal resolution
        this.baseWidth = 2560;
        this.baseHeight = 1440;
        this.scale = 1;
        this.offsetX = 0;
        this.offsetY = 0;
        
        // Get DOM elements
        this.gameWrapper = null;
        this.scaledContainer = null;
        this.gameContainer = null;
        this.mapContainer = null;
        
        // Bind resize handler
        this.handleResize = this.handleResize.bind(this);
    }

    initialize() {
        // Get references to DOM elements
        this.gameWrapper = document.getElementById('game-wrapper');
        this.scaledContainer = document.getElementById('scaled-container');
        this.gameContainer = document.getElementById('game-container');
        this.mapContainer = document.querySelector('.map-container');
        
        // Set up initial scaling
        this.setupInitialScaling();
        
        // Add resize listener
        window.addEventListener('resize', this.handleResize);
        
        // Do initial resize
        this.handleResize();
    }

    setupInitialScaling() {
        // Set the scaled container to our fixed resolution
        this.scaledContainer.style.width = `${this.baseWidth}px`;
        this.scaledContainer.style.height = `${this.baseHeight}px`;
        
        // Make sure the game container uses the full resolution
        this.gameContainer.style.width = `${this.baseWidth}px`;
        this.gameContainer.style.height = `${this.baseHeight}px`;
        
        // Make sure the canvas uses the full fixed resolution for the map area
        // The map container is baseWidth minus UI panel width (350px)
        const mapWidth = this.baseWidth;
        this.mapContainer.style.width = `${mapWidth}px`;
        this.mapContainer.style.height = `${this.baseHeight}px`;
    }

    handleResize() {
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    // Calculate scale to fit screen while maintaining aspect ratio
    const scaleX = windowWidth / this.baseWidth;
    const scaleY = windowHeight / this.baseHeight;
    
    // Use the smaller scale to ensure the entire game fits
    this.scale = Math.min(scaleX, scaleY);
    
    // Calculate centering offsets
    const scaledWidth = this.baseWidth * this.scale;
    const scaledHeight = this.baseHeight * this.scale;
    this.offsetX = (windowWidth - scaledWidth) / 2;
    this.offsetY = (windowHeight - scaledHeight) / 2;
    
    // Apply the transformation to the scaled container
    this.scaledContainer.style.transform = `scale(${this.scale})`;
    this.scaledContainer.style.transformOrigin = 'top left';
    this.scaledContainer.style.position = 'absolute';
    this.scaledContainer.style.left = `${this.offsetX}px`;
    this.scaledContainer.style.top = `${this.offsetY}px`;
    
    // Update canvas size if it exists
    const canvas = document.getElementById('game-canvas');
    if (canvas) {
        // Canvas should fill the map container at our fixed resolution
        canvas.width = this.baseWidth;
        canvas.height = this.baseHeight;
        
        // Reapply no smoothing after canvas resize
        if (window.map) {
            window.map.applyNoSmoothing();
        }
    }
}

    // Convert mouse coordinates from screen space to game space
    screenToGame(screenX, screenY) {
        const gameX = (screenX - this.offsetX) / this.scale;
        const gameY = (screenY - this.offsetY) / this.scale;
        return { x: gameX, y: gameY };
    }

    // Get the current scale
    getScale() {
        return this.scale;
    }

    // Get the base dimensions
    getBaseDimensions() {
        return {
            width: this.baseWidth,
            height: this.baseHeight
        };
    }

    // Clean up
    destroy() {
        window.removeEventListener('resize', this.handleResize);
    }
}

// Create global instance
window.scalingSystem = new ScalingSystem();
