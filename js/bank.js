class Bank {
    constructor() {
        this.items = {}; // itemId -> quantity
    }

    deposit(itemId, quantity) {
        if (!this.items[itemId]) {
            this.items[itemId] = 0;
        }
        this.items[itemId] += quantity;
        
        // Notify UI - using new UI system
        if (window.ui) {
            window.ui.updateBank();
        }
    }

    withdraw(itemId, quantity) {
        if (!this.items[itemId] || this.items[itemId] < quantity) {
            return 0;
        }

        this.items[itemId] -= quantity;
        if (this.items[itemId] <= 0) {
            delete this.items[itemId];
        }

        // Notify UI - using new UI system
        if (window.ui) {
            window.ui.updateBank();
        }

        return quantity;
    }

    // Withdraw up to a maximum amount (useful for non-stackable items)
    withdrawUpTo(itemId, maxQuantity) {
        if (!this.items[itemId]) {
            return 0;
        }

        const available = this.items[itemId];
        const toWithdraw = Math.min(available, maxQuantity);

        this.items[itemId] -= toWithdraw;
        if (this.items[itemId] <= 0) {
            delete this.items[itemId];
        }

        // Notify UI - using new UI system
        if (window.ui) {
            window.ui.updateBank();
        }

        return toWithdraw;
    }

    getItemCount(itemId) {
        return this.items[itemId] || 0;
    }

    depositAll() {
        const inventory = window.inventory;
        let deposited = 0;

        for (let i = 0; i < inventory.maxSlots; i++) {
            const slot = inventory.slots[i];
            if (slot) {
                this.deposit(slot.itemId, slot.quantity);
                deposited += slot.quantity;
            }
        }

        inventory.clear();
        
        // Note: deposit() and clear() already notify UI, no need to do it again
        
        return deposited;
    }

    depositItem(itemId) {
        const inventory = window.inventory;
        const count = inventory.getItemCount(itemId);
        if (count > 0) {
            const removed = inventory.removeItem(itemId, count);
            this.deposit(itemId, removed);
            return removed;
        }
        return 0;
    }

    getAllItems() {
        return { ...this.items };
    }

    getTotalItems() {
        return Object.values(this.items).reduce((sum, count) => sum + count, 0);
    }

    getUniqueItems() {
        return Object.keys(this.items).length;
    }
}
