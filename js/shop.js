class ShopSystem {
    constructor() {
        this.shopItems = [
            {
                itemId: 'fishing_bait',
                name: 'Fishing Bait',
                price: 1,
                stock: -1 // Infinite stock
            },
            {
                itemId: 'feather',
                name: 'Feather',
                price: 1,
                stock: -1 // Infinite stock
            }
        ];
        
        this.isOpen = false;
    }

    // Open the shop modal
    open() {
        this.isOpen = true;
        const modal = document.getElementById('shop-modal');
        if (modal) {
            modal.style.display = 'flex';
            this.updateDisplay();
        }
    }

    // Close the shop modal
    close() {
        this.isOpen = false;
        const modal = document.getElementById('shop-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    // Toggle shop open/closed
    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    // Update the shop display
    updateDisplay() {
        const container = document.getElementById('shop-items');
        if (!container) return;
        
        container.innerHTML = '';
        
        // Show player's coins at top
        const coinsDiv = document.createElement('div');
        coinsDiv.style.gridColumn = '1 / -1';
        coinsDiv.style.textAlign = 'center';
        coinsDiv.style.marginBottom = '20px';
        coinsDiv.style.fontSize = '18px';
        coinsDiv.style.color = '#f39c12';
        
        const playerCoins = window.inventory ? inventory.getItemCount('coins') : 0;
        coinsDiv.textContent = `Your coins: ${formatNumber(playerCoins)}`;
        container.appendChild(coinsDiv);
        
        // Create shop items
        for (const shopItem of this.shopItems) {
            const itemDiv = this.createShopItemElement(shopItem);
            container.appendChild(itemDiv);
        }
    }

    // Create a shop item element
    createShopItemElement(shopItem) {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'shop-item';
        
        // Item icon
        const icon = document.createElement('img');
        icon.className = 'shop-item-icon';
        icon.src = `assets/items/${shopItem.itemId}.png`;
        icon.onerror = function() {
            this.style.display = 'none';
            const textDiv = document.createElement('div');
            textDiv.style.fontSize = '24px';
            textDiv.textContent = shopItem.name.substring(0, 3);
            itemDiv.insertBefore(textDiv, itemDiv.firstChild);
        };
        
        // Item name
        const nameDiv = document.createElement('div');
        nameDiv.className = 'shop-item-name';
        nameDiv.textContent = shopItem.name;
        
        // Item price
        const priceDiv = document.createElement('div');
        priceDiv.className = 'shop-item-price';
        priceDiv.textContent = `${shopItem.price} gp each`;
        
        // Controls
        const controlsDiv = document.createElement('div');
        controlsDiv.className = 'shop-item-controls';
        
        // Quantity input
        const quantityInput = document.createElement('input');
        quantityInput.type = 'number';
        quantityInput.className = 'shop-quantity';
        quantityInput.value = '1';
        quantityInput.min = '1';
        quantityInput.max = '10000';
        
        // Buy button
        const buyBtn = document.createElement('button');
        buyBtn.className = 'shop-buy-btn';
        buyBtn.textContent = 'Buy';
        
        // Check if player can afford at least 1
        const playerCoins = window.inventory ? inventory.getItemCount('coins') : 0;
        if (playerCoins < shopItem.price) {
            buyBtn.disabled = true;
        }
        
        // Buy button click handler
        buyBtn.addEventListener('click', () => {
            const quantity = parseInt(quantityInput.value) || 1;
            this.buyItem(shopItem.itemId, quantity);
        });
        
        // Update button state when quantity changes
        quantityInput.addEventListener('input', () => {
            const quantity = parseInt(quantityInput.value) || 1;
            const totalCost = quantity * shopItem.price;
            const playerCoins = window.inventory ? inventory.getItemCount('coins') : 0;
            
            buyBtn.disabled = playerCoins < totalCost;
            buyBtn.textContent = `Buy (${formatNumber(totalCost)} gp)`;
        });
        
        controlsDiv.appendChild(quantityInput);
        controlsDiv.appendChild(buyBtn);
        
        itemDiv.appendChild(icon);
        itemDiv.appendChild(nameDiv);
        itemDiv.appendChild(priceDiv);
        itemDiv.appendChild(controlsDiv);
        
        return itemDiv;
    }

    // Buy an item from the shop
    buyItem(itemId, quantity) {
        // Find the shop item
        const shopItem = this.shopItems.find(item => item.itemId === itemId);
        if (!shopItem) {
            console.error(`Item ${itemId} not found in shop`);
            return false;
        }
        
        // Calculate total cost
        const totalCost = shopItem.price * quantity;
        
        // Check if player has enough coins
        const playerCoins = window.inventory ? inventory.getItemCount('coins') : 0;
        if (playerCoins < totalCost) {
            console.log(`Not enough coins! Need ${totalCost}, have ${playerCoins}`);
            return false;
        }
        
        // Check if inventory has space (coins are stackable, items might not be)
        const itemData = loadingManager.getData('items')[itemId];
        if (!itemData) {
            console.error(`Item data not found for ${itemId}`);
            return false;
        }
        
        // Calculate how many slots needed
        let slotsNeeded = 0;
        if (!itemData.stackable) {
            slotsNeeded = quantity;
        } else {
            // Check if we already have a stack
            const currentCount = inventory.getItemCount(itemId);
            if (currentCount === 0) {
                slotsNeeded = 1; // Need one new slot for the stack
            }
            // Otherwise it goes into existing stack
        }
        
        const emptySlots = inventory.getEmptySlots();
        if (slotsNeeded > emptySlots) {
            console.log(`Not enough inventory space! Need ${slotsNeeded} slots, have ${emptySlots}`);
            return false;
        }
        
        // Perform the transaction
        inventory.removeItem('coins', totalCost);
        const added = inventory.addItem(itemId, quantity);
        
        if (added < quantity) {
            // Shouldn't happen due to our checks, but handle it
            console.error(`Only added ${added} of ${quantity} items`);
            // Refund the difference
            const refund = (quantity - added) * shopItem.price;
            inventory.addItem('coins', refund);
        }
        
        console.log(`Bought ${added} ${shopItem.name} for ${totalCost} gp`);
        
        // Update displays
        this.updateDisplay();
        if (window.ui) {
            window.ui.updateInventory();
        }
        
        return true;
    }

    // Get the price of an item
    getPrice(itemId) {
        const shopItem = this.shopItems.find(item => item.itemId === itemId);
        return shopItem ? shopItem.price : null;
    }

    // Check if shop sells an item
    sellsItem(itemId) {
        return this.shopItems.some(item => item.itemId === itemId);
    }
}

// Create global instance
window.shop = new ShopSystem();
