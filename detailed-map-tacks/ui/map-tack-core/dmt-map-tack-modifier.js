
import BeliefModifier from './modifier/dmt-belief-modifier.js';
import ConstructibleModifier from './modifier/dmt-constructible-modifier.js';
import ModifierRequirement from './modifier/dmt-modifier-requirement.js';
import TraditionModifier from './modifier/dmt-tradition-modifier.js';
import TraitModifier from './modifier/dmt-trait-modifier.js';
import TreeModifier from './modifier/dmt-tree-modifier.js';

const SUPPORTED_COLLECTIONS = [
    "COLLECTION_PLAYER_CITIES",
    "COLLECTION_CITY_PLOT_YIELDS",
];

const SUPPORTED_EFFECTS = [
    "EFFECT_CITY_ACTIVATE_CONSTRUCTIBLE_ADJACENCY",
    "EFFECT_CITY_ADJUST_ADJACENCY_FLAT_AMOUNT",
    "EFFECT_PLOT_ADJUST_YIELD",
    // "EFFECT_CITY_ADJUST_CONSTRUCTIBLE_YIELD",
    // "EFFECT_CITY_ACTIVATE_CONSTRUCTIBLE_WAREHOUSE_YIELD",
    // "EFFECT_PLAYER_ADJUST_CONSTRUCTIBLE_YIELD"
];

class MapTackModifierSingleton {
    /**
     * Singleton accessor
     */
    static getInstance() {
        if (!MapTackModifierSingleton.singletonInstance) {
            MapTackModifierSingleton.singletonInstance = new MapTackModifierSingleton();
        }
        return MapTackModifierSingleton.singletonInstance;
    }
    constructor() {
        // ModifierId => [ {name, value}, {name, value}, ... ]
        this.modifierArguments = {};
        // RequirementId => [ {name, value}, {name, value}, ... ]
        this.requirementArguments = {};
        // Stores modifier map. < ModifierId, ModifierObject >
        // ModifierObject contains the following fields:
        //      modifierId: ModifierId
        //      collection: CollectionType
        //      effect: EffectType
        //      args: [ { name, value }, {name, value}, ... ]
        //      ownerReqSet: OwnerRequirementSetId
        //      subjectReqSet: SubjectRequirementSetId
        this.modifiers = {};
        // AdjacencyId => ModifierId (Assume one id can only be mapped to one modifier for now)
        this.adjacencyModifiers = {};
        // AdjacencyId => {modifierId, amount, divisor, name}
        this.flatAmountModifiers = {};
        // ConstructibleType => [ {modifierId, type, amount, name}, ... ]
        this.plotYieldModifiers = {};

        engine.whenReady.then(() => { this.onReady(); });
    }
    onReady() {
        this.cacheModifierArguments();
        this.cacheRequirementArguments();
        this.cacheModifiers();
        // The above must be executed first.
        this.cacheAdjacencyModifiers();
        this.cacheFlatAmountModifiers();
        this.cachePlotYieldModifiers();
    }
    cacheModifierArguments() {
        this.modifierArguments = {};
        for (const e of GameInfo.ModifierArguments) {
            const current = this.modifierArguments[e.ModifierId] || [];
            current.push({
                name: e.Name,
                value: e.Value
            });
            this.modifierArguments[e.ModifierId] = current;
        }
    }
    cacheRequirementArguments() {
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
    cacheModifiers() {
        this.modifiers = {};
        for (const e of GameInfo.DynamicModifiers) {
            if (SUPPORTED_COLLECTIONS.includes(e.CollectionType) && SUPPORTED_EFFECTS.includes(e.EffectType)) {
                const modifierType = e.ModifierType;
                if (modifierType.endsWith("_TYPE")) {
                    const modifierId = modifierType.slice(0, -5);
                    // Create ModifierObject
                    const modifierDef = GameInfo.Modifiers.lookup(modifierId);
                    this.modifiers[modifierId] = {
                        modifierId: modifierId,
                        collection: e.CollectionType,
                        effect: e.EffectType,
                        args: this.modifierArguments[modifierId],
                        ownerReqSet: modifierDef?.OwnerRequirementSetId,
                        subjectReqSet: modifierDef?.SubjectRequirementSetId
                    };
                }
            }
        }
    }
    cacheAdjacencyModifiers() { // EFFECT_CITY_ACTIVATE_CONSTRUCTIBLE_ADJACENCY
        this.adjacencyModifiers = {};
        for (const [modifierId, modifierObject] of Object.entries(this.modifiers)) {
            if (modifierObject.effect != "EFFECT_CITY_ACTIVATE_CONSTRUCTIBLE_ADJACENCY") {
                continue;
            }
            const args = modifierObject.args;
            for (const arg of args) {
                if (arg.name == "ConstructibleAdjacency") {
                    const values = arg.value?.split(", ") || []; // e.g. INTERLACUSTRINE_MOD_LAKE_ADJACENCY_BONUS_GOLD
                    for (const value of values) {
                        this.adjacencyModifiers[value] = modifierId;
                    }
                }
            }
        }
    }
    cacheFlatAmountModifiers() { // EFFECT_CITY_ADJUST_ADJACENCY_FLAT_AMOUNT
        this.flatAmountModifiers = {};
        for (const [modifierId, modifierObject] of Object.entries(this.modifiers)) {
            if (modifierObject.effect != "EFFECT_CITY_ADJUST_ADJACENCY_FLAT_AMOUNT") {
                continue;
            }
            const args = modifierObject.args;
            const adjacencyId = args.find(arg => arg.name == "Adjacency_YieldChange")?.value;
            if (adjacencyId) {
                this.flatAmountModifiers[adjacencyId] = {
                    modifierId: modifierId
                };
                for (const arg of args) {
                    switch (arg.name) {
                        case "Amount":
                            this.flatAmountModifiers[adjacencyId]["amount"] = Number(arg.value);
                            break;
                        case "Divisor":
                            this.flatAmountModifiers[adjacencyId]["divisor"] = Number(arg.value);
                            break;
                        case "Tooltip":
                            this.flatAmountModifiers[adjacencyId]["name"] = arg.value;
                            break;
                    }
                }
            }
        }
    }
    cachePlotYieldModifiers() { // EFFECT_PLOT_ADJUST_YIELD
        this.plotYieldModifiers = {};
        for (const [modifierId, modifierObject] of Object.entries(this.modifiers)) {
            if (modifierObject.effect != "EFFECT_PLOT_ADJUST_YIELD") {
                continue;
            }
            const subjectReqSet = modifierObject.subjectReqSet;
            if (!subjectReqSet) {
                continue;
            }
            for (const e of GameInfo.RequirementSetRequirements) {
                if (e.RequirementSetId == subjectReqSet) {
                    const requirementType = GameInfo.Requirements.lookup(e.RequirementId)?.RequirementType;
                    if (requirementType == "REQUIREMENT_PLOT_HAS_CONSTRUCTIBLE") {
                        // Plot yield constructible modifier.
                        const reqArgs = this.requirementArguments[e.RequirementId];
                        const constructibleType = reqArgs?.find(arg => arg.name == "ConstructibleType")?.value;
                        if (constructibleType) {
                            const args = modifierObject.args;
                            const type = args?.find(arg => arg.name == "YieldType")?.value;
                            const amount = Number(args?.find(arg => arg.name == "Amount")?.value ?? 0);
                            const name = args?.find(arg => arg.name == "Tooltip")?.value;
                            const current = this.plotYieldModifiers[constructibleType] || [];
                            current.push({ modifierId, type, amount, name });
                            this.plotYieldModifiers[constructibleType] = current;
                        }
                    }
                }
            }
        }
    }
    isAdjacencyUnlocked(adjacencyId) {
        const modifierId = this.adjacencyModifiers[adjacencyId];
        return this.isModifierActive(modifierId);
    }
    getFlatAmountYield(adjacencyId) {
        const flatAmountObj = this.flatAmountModifiers[adjacencyId];
        if (flatAmountObj && this.isModifierActive(flatAmountObj["modifierId"])) {
            return {
                amount: flatAmountObj["amount"] / flatAmountObj["divisor"],
                name: flatAmountObj["name"]
            };
        }
        return;
    }
    getPlotYields(constructibleType, args) {
        const modifierObjs = this.plotYieldModifiers[constructibleType] || [];
        const yields = [];
        for (const modifierObj of modifierObjs) {
            if (this.isModifierActive(modifierObj.modifierId, args)) {
                yields.push({
                    type: modifierObj.type,
                    amount: modifierObj.amount,
                    name: modifierObj.name
                });
            }
        }
        return yields;
    }
    isModifierActive(modifierId, args) {
        if (!modifierId) {
            return false;
        }
        const isModifierActive = TraitModifier.isModifierActive(modifierId)
            || TraditionModifier.isModifierActive(modifierId)
            || TreeModifier.isModifierActive(modifierId)
            || BeliefModifier.isModifierActive(modifierId)
            || ConstructibleModifier.isModifierActive(modifierId, args);
        return isModifierActive && ModifierRequirement.isModifierRequirementMet(modifierId, args);
    }
}

const MapTackModifier = MapTackModifierSingleton.getInstance();
export { MapTackModifier as default };