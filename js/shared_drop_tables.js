// Shared drop tables used by multiple skills/activities
class SharedDropTables {
    constructor() {
        this.tables = {
            herbs: [
                { itemId: 'grimy_guam_leaf', chance: 1/22.3 },
                { itemId: 'grimy_marrentill', chance: 1/29.7 },
                { itemId: 'grimy_tarromin', chance: 1/39.6 },
                { itemId: 'grimy_harralander', chance: 1/50.9 },
                { itemId: 'grimy_ranarr_weed', chance: 1/64.8 },
                { itemId: 'grimy_irit_leaf', chance: 1/89 },
                { itemId: 'grimy_avantoe', chance: 1/118.7 },
                { itemId: 'grimy_kwuarm', chance: 1/142.5 },
                { itemId: 'grimy_cadantine', chance: 1/178.1 },
                { itemId: 'grimy_lantadyme', chance: 1/237.4 },
                { itemId: 'grimy_dwarf_weed', chance: 1/237.4 },
                { itemId: 'grimy_snapdragon', chance: 1/800 },
                { itemId: 'grimy_toadflax', chance: 1/1000 },
                { itemId: 'grimy_torstol', chance: 1/1600 }
            ]
        };
    }
    
    rollHerbTable() {
        const roll = Math.random();
        let cumulative = 0;
        
        for (const herb of this.tables.herbs) {
            cumulative += herb.chance;
            if (roll < cumulative) {
                return { itemId: herb.itemId, quantity: 1 };
            }
        }
        
        return null; // No herb dropped
    }
    
    getTable(tableName) {
        return this.tables[tableName] || null;
    }
}

// Create global instance
window.sharedDropTables = new SharedDropTables();
