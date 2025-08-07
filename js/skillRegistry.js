class SkillRegistry {
    constructor() {
        this.skills = {};
        this.initialized = false;
    }
    
    async initialize() {
        // Register all skills
        this.register(new WoodcuttingSkill());
        this.register(new MiningSkill());
        this.register(new FishingSkill());
        this.register(new CookingSkill());
        this.register(new CombatSkill());
        
        this.initialized = true;
        console.log('Skill registry initialized with', Object.keys(this.skills).length, 'skills');
    }
    
    register(skill) {
        this.skills[skill.id] = skill;
        console.log(`Registered skill: ${skill.name}`);
    }
    
    getSkill(skillId) {
        return this.skills[skillId] || null;
    }
    
    getSkillForActivity(activityId) {
        const activityData = loadingManager.getData('activities')[activityId];
        if (!activityData) return null;
        
        return this.getSkill(activityData.skill);
    }
    
    getAllSkills() {
        return Object.values(this.skills);
    }
    
    generateAllGoals(existingGoalCount) {
        const goals = [];
        let priority = existingGoalCount + 1;
        
        // Get all registered skills
        const allSkills = this.getAllSkills();
        
        for (const skill of allSkills) {
            const level = skills.getLevel(skill.id);
            
            // Generate level goals
            const levelGoals = skill.generateLevelGoals(level, priority);
            goals.push(...levelGoals);
            priority += levelGoals.length;
            
            // Generate item goals
            const itemGoals = skill.generateItemGoals(level, priority);
            goals.push(...itemGoals);
            priority += itemGoals.length;
        }
        
        return goals;
    }
    
    // Check if an item should be banked
    shouldBankItem(itemId) {
        // Check all skills to see if any don't want this item banked
        for (const skill of this.getAllSkills()) {
            if (!skill.shouldBankItem(itemId)) {
                return false;
            }
        }
        return true;
    }
    
    // Save skill states
    saveStates() {
        const states = {};
        for (const [id, skill] of Object.entries(this.skills)) {
            if (skill.saveState) {
                states[id] = skill.saveState();
            }
        }
        return states;
    }
    
    // Load skill states
    loadStates(states) {
        for (const [id, state] of Object.entries(states)) {
            if (this.skills[id] && this.skills[id].loadState) {
                this.skills[id].loadState(state);
            }
        }
    }
}

// Create global instance
window.skillRegistry = new SkillRegistry();
