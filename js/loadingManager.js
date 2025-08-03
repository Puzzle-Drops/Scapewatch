class LoadingManager {
    constructor() {
        this.assets = {
            images: {},
            data: {}
        };
        this.loadQueue = [];
        this.loaded = 0;
        this.total = 0;
        this.onComplete = null;
        this.progressBar = document.querySelector('.loading-progress');
        this.loadingText = document.querySelector('.loading-text');
    }

    addImage(key, path) {
        this.loadQueue.push({ type: 'image', key, path });
        this.total++;
    }

    addJSON(key, path) {
        this.loadQueue.push({ type: 'json', key, path });
        this.total++;
    }

    async loadAll() {
        for (const item of this.loadQueue) {
            try {
                if (item.type === 'image') {
                    await this.loadImage(item.key, item.path);
                } else if (item.type === 'json') {
                    await this.loadJSON(item.key, item.path);
                }
            } catch (error) {
                console.error(`Failed to load ${item.type}: ${item.path}`, error);
                // Continue loading other assets even if one fails
            }
        }

        if (this.onComplete) {
            this.onComplete();
        }
    }

    loadImage(key, path) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                this.assets.images[key] = img;
                this.updateProgress();
                resolve();
            };
            img.onerror = () => {
                reject(new Error(`Failed to load image: ${path}`));
            };
            img.src = path;
        });
    }

    async loadJSON(key, path) {
        try {
            const response = await fetch(path);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            this.assets.data[key] = data;
            this.updateProgress();
        } catch (error) {
            throw new Error(`Failed to load JSON: ${path} - ${error.message}`);
        }
    }

    updateProgress() {
        this.loaded++;
        const progress = (this.loaded / this.total) * 100;
        this.progressBar.style.width = `${progress}%`;
        this.loadingText.textContent = `Loading assets... ${this.loaded}/${this.total}`;
    }

    getImage(key) {
        return this.assets.images[key];
    }

    getData(key) {
        return this.assets.data[key];
    }
}

// Create global instance
window.loadingManager = new LoadingManager();
