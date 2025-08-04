// Utility functions

// Calculate distance between two points
function distance(x1, y1, x2, y2) {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

// Linear interpolation
function lerp(start, end, t) {
    return start + (end - start) * t;
}

// Format number with commas
function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Get XP required for level (RuneScape formula)
function getXpForLevel(level) {
    if (level === 1) return 0;
    if (level === 2) return 83;
    
    let total = 0;
    for (let i = 1; i < level; i++) {
        total += Math.floor(i + 300 * Math.pow(2, i / 7));
    }
    return Math.floor(total / 4);
}

// Get level from XP
function getLevelFromXp(xp) {
    let level = 1;
    while (level < 99 && xp >= getXpForLevel(level + 1)) {
        level++;
    }
    return level;
}

// Get action duration with level scaling - MODIFIED to always return base duration
function getActionDuration(baseDuration, skillLevel, requiredLevel) {
    if (skillLevel < requiredLevel) return null;
    // No more scaling - always return base duration
    return baseDuration;
}

// Get scaled reward chance based on level for woodcutting
function getScaledChance(activityId, baseChance, skillLevel) {
    // Define chance ranges for each woodcutting activity
    const chanceRanges = {
        'chop_tree': { min: 0.254, max: 1.0, minLevel: 1, maxLevel: 30 },
        'chop_oak': { min: 0.168, max: 1.0, minLevel: 15, maxLevel: 60 },
        'chop_willow': { min: 0.3, max: 0.734, minLevel: 30, maxLevel: 99 },
        'chop_teak': { min: 0.313, max: 0.785, minLevel: 35, maxLevel: 99 },
        'chop_maple': { min: 0.214, max: 0.367, minLevel: 45, maxLevel: 99 },
        'chop_mahogany': { min: 0.234, max: 0.383, minLevel: 50, maxLevel: 99 },
        'chop_yew': { min: 0.129, max: 0.187, minLevel: 60, maxLevel: 99 },
        'chop_magic': { min: 0.074, max: 0.09, minLevel: 75, maxLevel: 99 },
        'chop_redwood': { min: 0.133, max: 0.141, minLevel: 90, maxLevel: 99 }
    };
    
    const range = chanceRanges[activityId];
    if (!range) {
        // Not a woodcutting activity, return base chance
        return baseChance;
    }
    
    // Clamp level to valid range
    const clampedLevel = Math.max(range.minLevel, Math.min(skillLevel, range.maxLevel));
    
    // Calculate progress through the level range (0 to 1)
    const levelProgress = (clampedLevel - range.minLevel) / (range.maxLevel - range.minLevel);
    
    // Linear interpolation between min and max chance
    return lerp(range.min, range.max, levelProgress);
}

// Random float between min and max
function randomFloat(min, max) {
    return Math.random() * (max - min) + min;
}

// Check if point is within rectangle
function pointInRect(px, py, rx, ry, rw, rh) {
    return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
}

// Find path between nodes (simple for now, can upgrade to A* later)
function findPath(startNode, endNode, allNodes) {
    // For now, just return direct path
    return [startNode, endNode];
}

// Deep clone object
function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}
