// Loading manager
class LoadingManager {
    constructor() {
        this.assets = {
            images: {},
            data: {}
        };
        this.loadQueue = [];
        this.totalAssets = 0;
        this.loadedAssets = 0;
        this.failedAssets = [];
        this.onComplete = null;
        this.progressBar = document.querySelector('.loading-progress');
        this.loadingText = document.querySelector('.loading-text');
        this.loadingScreen = document.querySelector('.loading-screen');
        this.gameContainer = document.querySelector('.game-container');
        this.hasError = false;
    }

    addImage(key, path) {
        this.loadQueue.push({ type: 'image', key, path, name: `${key} image` });
        this.totalAssets++;
    }

    addJSON(key, path) {
        this.loadQueue.push({ type: 'json', key, path, name: `${key} data` });
        this.totalAssets++;
    }

    addScript(path, name) {
        this.loadQueue.push({ type: 'script', path, name });
        this.totalAssets++;
    }

    async loadAll() {
        // Reset state
        this.loadedAssets = 0;
        this.failedAssets = [];
        this.hasError = false;

        for (const item of this.loadQueue) {
            if (this.hasError) {
                console.error('Stopping load due to previous error');
                break;
            }

            try {
                this.updateLoadingDisplay(`Loading ${item.name}...`);
                
                if (item.type === 'image') {
                    await this.loadImage(item.key, item.path, item.name);
                } else if (item.type === 'json') {
                    await this.loadJSON(item.key, item.path, item.name);
                } else if (item.type === 'script') {
                    await this.loadScript(item.path, item.name);
                }
            } catch (error) {
                this.hasError = true;
                this.failedAssets.push(item.name);
                console.error(`Failed to load ${item.name}:`, error);
            }
        }

        if (this.hasError) {
            this.showError();
        } else {
            this.updateLoadingDisplay('Starting game...');
            setTimeout(() => this.hideLoadingScreen(), 500);
        }
    }

    loadImage(key, path, name) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                this.assets.images[key] = img;
                this.updateProgress(name);
                resolve();
            };
            img.onerror = () => {
                reject(new Error(`Failed to load image: ${path}`));
            };
            img.src = path;
        });
    }

    async loadJSON(key, path, name) {
        try {
            const response = await fetch(path);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            this.assets.data[key] = data;
            this.updateProgress(name);
        } catch (error) {
            throw new Error(`Failed to load JSON: ${path} - ${error.message}`);
        }
    }

    loadScript(src, name) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = () => {
                this.updateProgress(name);
                resolve();
            };
            script.onerror = () => {
                reject(new Error(`Failed to load script: ${src}`));
            };
            document.head.appendChild(script);
        });
    }

    updateProgress(assetName) {
        this.loadedAssets++;
        const progress = (this.loadedAssets / this.totalAssets) * 100;
        this.progressBar.style.width = `${progress}%`;
        this.updateLoadingDisplay(`Loading ${assetName}... (${this.loadedAssets}/${this.totalAssets})`);
        
        if (this.loadedAssets === this.totalAssets && !this.hasError) {
            if (this.onComplete) {
                this.onComplete();
            }
        }
    }

    updateLoadingDisplay(message, isError = false) {
        this.loadingText.textContent = message;
        if (isError) {
            this.loadingText.style.color = '#e74c3c';
        } else {
            this.loadingText.style.color = '#aaa';
        }
    }

    showError() {
        console.error('Loading error - failed assets:', this.failedAssets);
        
        let errorMsg = 'Failed to load game resources:\n\n';
        this.failedAssets.forEach(asset => {
            errorMsg += `• ${asset}\n`;
        });
        errorMsg += '\nPlease refresh the page to try again.';
        
        this.updateLoadingDisplay(errorMsg, true);
        
        // Add retry button if it doesn't exist
        if (!document.querySelector('.retry-button')) {
            const retryBtn = document.createElement('button');
            retryBtn.className = 'retry-button';
            retryBtn.textContent = 'Retry';
            retryBtn.style.cssText = `
                margin-top: 20px;
                padding: 10px 20px;
                background: #e74c3c;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 16px;
            `;
            retryBtn.onclick = () => location.reload();
            this.loadingText.parentElement.appendChild(retryBtn);
        }
    }

    hideLoadingScreen() {
        if (this.loadingScreen) {
            this.loadingScreen.style.display = 'none';
        }
        if (this.gameContainer) {
            this.gameContainer.style.display = 'flex';
        }
    }

    getImage(key) {
        return this.assets.images[key];
    }

    getData(key) {
        return this.assets.data[key];
    }

    checkForScriptErrors() {
        if (window.scriptErrors && window.scriptErrors.length > 0) {
            const errors = window.scriptErrors;
            let errorMsg = 'JavaScript errors detected:\n\n';
            errors.forEach(err => {
                const filename = err.file.split('/').pop();
                errorMsg += `• ${filename} (line ${err.line}): ${err.message}\n`;
            });
            this.updateLoadingDisplay(errorMsg, true);
            return false;
        }
        return true;
    }

    // Additional helper methods
    getTotalProgress() {
        return this.totalAssets > 0 ? (this.loadedAssets / this.totalAssets) * 100 : 0;
    }

    isLoading() {
        return this.loadedAssets < this.totalAssets;
    }

    hasFailures() {
        return this.failedAssets.length > 0;
    }

    reset() {
        this.assets = { images: {}, data: {} };
        this.loadQueue = [];
        this.totalAssets = 0;
        this.loadedAssets = 0;
        this.failedAssets = [];
        this.hasError = false;
    }
}

// Create global instance
window.loadingManager = new LoadingManager();
