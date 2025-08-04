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
// NOTE: This is deprecated - use skillBehaviors.getDuration() instead
function getActionDuration(baseDuration, skillLevel, requiredLevel) {
    if (skillLevel < requiredLevel) return null;
    // No more scaling - always return base duration
    return baseDuration;
}

// Get scaled reward chance based on level
// NOTE: This is deprecated - use skillBehaviors.getScaledChance() instead
function getScaledChance(reward, skillLevel) {
    // If no scaling data, return the flat chance
    if (!reward.chanceScaling) {
        return reward.chance || 1.0;
    }
    
    const scaling = reward.chanceScaling;
    
    // Clamp level to valid range
    const clampedLevel = Math.max(scaling.minLevel, Math.min(skillLevel, scaling.maxLevel));
    
    // Calculate progress through the level range (0 to 1)
    const levelProgress = (clampedLevel - scaling.minLevel) / (scaling.maxLevel - scaling.minLevel);
    
    // Linear interpolation between min and max chance
    return lerp(scaling.minChance, scaling.maxChance, levelProgress);
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
