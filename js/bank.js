class Bank {
    constructor() {
        this.items = {}; // itemId -> quantity
    }

    deposit(itemId, quantity) {
        if (!this.items[itemId]) {
            this.items[itemId] = 0;
        }
        this.items[itemId] += quantity;
    }

    withdraw(itemId, quantity) {
        if (!this.items[itemId] || this.items[itemId] < quantity) {
            return 0;
        }

        this.items[itemId] -= quantity;
        if (this.items[itemId] <= 0) {
            delete this.items[itemId];
        }

        return quantity;
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
