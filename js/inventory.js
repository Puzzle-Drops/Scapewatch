class Inventory {
    constructor() {
        this.slots = [];
        this.maxSlots = 28; // 4x7 grid
        this.initializeSlots();
    }

    initializeSlots() {
        for (let i = 0; i < this.maxSlots; i++) {
            this.slots[i] = null;
        }
    }

    addItem(itemId, quantity = 1) {
        const itemData = loadingManager.getData('items')[itemId];
        if (!itemData) {
            console.error(`Item ${itemId} not found`);
            return 0;
        }

        let remaining = quantity;

        if (itemData.stackable) {
            // First, try to add to existing stacks
            for (let i = 0; i < this.maxSlots && remaining > 0; i++) {
                const slot = this.slots[i];
                if (slot && slot.itemId === itemId) {
                    const spaceInStack = itemData.maxStack - slot.quantity;
                    const toAdd = Math.min(remaining, spaceInStack);
                    slot.quantity += toAdd;
                    remaining -= toAdd;
                }
            }
        }

        // Then add to empty slots
        for (let i = 0; i < this.maxSlots && remaining > 0; i++) {
            if (!this.slots[i]) {
                if (itemData.stackable) {
                    const toAdd = Math.min(remaining, itemData.maxStack);
                    this.slots[i] = {
                        itemId: itemId,
                        quantity: toAdd
                    };
                    remaining -= toAdd;
                } else {
                    this.slots[i] = {
                        itemId: itemId,
                        quantity: 1
                    };
                    remaining -= 1;
                }
            }
        }

        const added = quantity - remaining;
        
        // Notify UI if items were added - using new UI system
        if (added > 0 && window.ui) {
            window.ui.updateInventory();
        }

        return added; // Return amount actually added
    }

    removeItem(itemId, quantity = 1) {
        let remaining = quantity;

        for (let i = 0; i < this.maxSlots && remaining > 0; i++) {
            const slot = this.slots[i];
            if (slot && slot.itemId === itemId) {
                const toRemove = Math.min(remaining, slot.quantity);
                slot.quantity -= toRemove;
                remaining -= toRemove;

                if (slot.quantity <= 0) {
                    this.slots[i] = null;
                }
            }
        }

        const removed = quantity - remaining;
        
        // Notify UI if items were removed - using new UI system
        if (removed > 0 && window.ui) {
            window.ui.updateInventory();
        }

        return removed; // Return amount actually removed
    }

    hasItem(itemId, quantity = 1) {
        let total = 0;
        for (const slot of this.slots) {
            if (slot && slot.itemId === itemId) {
                total += slot.quantity;
            }
        }
        return total >= quantity;
    }

    getItemCount(itemId) {
        let total = 0;
        for (const slot of this.slots) {
            if (slot && slot.itemId === itemId) {
                total += slot.quantity;
            }
        }
        return total;
    }

    isFull() {
        return this.getEmptySlots() === 0;
    }

    getEmptySlots() {
        return this.slots.filter(slot => slot === null).length;
    }

    getUsedSlots() {
        return this.maxSlots - this.getEmptySlots();
    }

    getAllItems() {
        const items = {};
        for (const slot of this.slots) {
            if (slot) {
                if (items[slot.itemId]) {
                    items[slot.itemId] += slot.quantity;
                } else {
                    items[slot.itemId] = slot.quantity;
                }
            }
        }
        return items;
    }

    clear() {
        this.initializeSlots();
        
        // Notify UI - using new UI system
        if (window.ui) {
            window.ui.updateInventory();
        }
    }
}
