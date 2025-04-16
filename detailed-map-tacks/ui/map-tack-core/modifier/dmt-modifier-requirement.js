import MapTackUtils from "../dmt-map-tack-utils.js";

class ModifierRequirementSingleton {
    /**
     * Singleton accessor
     */
    static getInstance() {
        if (!ModifierRequirementSingleton.singletonInstance) {
            ModifierRequirementSingleton.singletonInstance = new ModifierRequirementSingleton();
        }
        return ModifierRequirementSingleton.singletonInstance;
    }
    constructor() {
        // Map of: RequirementSetId => [ RequirementId1, RequirementId2 ]
        this.requirementSetRequirement = {};
        // RequirementId => [ {name, value}, {name, value}, ... ]
        this.requirementArguments = {};

        engine.whenReady.then(() => { this.onReady(); });
    }
    onReady() {
        this.cacheData();
    }
    cacheData() {
        // requirementSetRequirement
        this.requirementSetRequirement = {};
        for (const e of GameInfo.RequirementSetRequirements) {
            const current = this.requirementSetRequirement[e.RequirementSetId] || [];
            current.push(e.RequirementId);
            this.requirementSetRequirement[e.RequirementSetId] = current;
        }
        // requirementArguments
        this.requirementArguments = {};
        for (const e of GameInfo.RequirementArguments) {
            const current = this.requirementArguments[e.RequirementId] || [];
            current.push({
                name: e.Name,
                value: e.Value
            });
            this.requirementArguments[e.RequirementId] = current;
        }
    }
    isModifierRequirementMet(modifierId, args) {
        // Check if the modifier has requirements
        const modifierDef = GameInfo.Modifiers.lookup(modifierId);
        return this.isRequirementSetMet(modifierDef?.OwnerRequirementSetId, args)
            && this.isRequirementSetMet(modifierDef?.SubjectRequirementSetId, args);
    }
    isRequirementSetMet(requirementSetId, args) {
        if (requirementSetId == null) {
            return true;
        }
        const requirementSetType = GameInfo.RequirementSets.lookup(requirementSetId)?.RequirementSetType;
        const requirements = this.requirementSetRequirement[requirementSetId];
        if (requirementSetType == "REQUIREMENTSET_TEST_ALL") {
            return requirements.every(requirementId => this.isRequirementMet(requirementId, args));
        } else if (requirementSetType == "REQUIREMENTSET_TEST_ANY") {
            return requirements.some(requirementId => this.isRequirementMet(requirementId, args));
        }
        return false;
    }
    isRequirementMet(requirementId, args = {}) {
        // Skip certain requirement type check.
        const requirementType = GameInfo.Requirements.lookup(requirementId)?.RequirementType;
        switch (requirementType) {
            case "REQUIREMENT_WONDER_IS_ACTIVE": {
                const reqArgs = this.requirementArguments[requirementId];
                const reqConstructibleType = reqArgs?.find(arg => arg.name == "ConstructibleType")?.value;
                return MapTackUtils.hasConstructible(reqConstructibleType);
            }
            case "REQUIREMENT_PLOT_FEATURE_TYPE_MATCHES":{
                const reqArgs = this.requirementArguments[requirementId];
                const reqFeatureClassType = reqArgs?.find(arg => arg.name == "FeatureClassType")?.value;
                const feature = args?.plotDetails?.feature;
                if (feature) {
                    return GameInfo.Features.lookup(feature)?.FeatureClassType == reqFeatureClassType;
                }
                return false;
            }
            case "REQUIREMENT_PLOT_HAS_CONSTRUCTIBLE": {
                const reqArgs = this.requirementArguments[requirementId];
                const reqConstructibleType = reqArgs?.find(arg => arg.name == "ConstructibleType")?.value;
                return args?.constructible == reqConstructibleType
                    || args?.plotDetails?.constructibles?.includes(reqConstructibleType);
            }
            case "REQUIREMENT_PLOT_TERRAIN_TYPE_MATCHES": {
                const reqArgs = this.requirementArguments[requirementId];
                const reqTerrainType = reqArgs?.find(arg => arg.name == "TerrainType")?.value;
                return args?.plotDetails?.terrain == reqTerrainType;
            }
        }
        return false;
    }
}

const ModifierRequirement = ModifierRequirementSingleton.getInstance();
export { ModifierRequirement as default };