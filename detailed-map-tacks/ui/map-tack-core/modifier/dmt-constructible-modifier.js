import MapTackUtils from "../dmt-map-tack-utils.js";

class ConstructibleModifierSingleton {
    /**
     * Singleton accessor
     */
    static getInstance() {
        if (!ConstructibleModifierSingleton.singletonInstance) {
            ConstructibleModifierSingleton.singletonInstance = new ConstructibleModifierSingleton();
        }
        return ConstructibleModifierSingleton.singletonInstance;
    }
    constructor() {
        // Map of: ModifierId => [ constructibleType1, constructibleType2 ]
        this.modifierConstructible = {};

        engine.whenReady.then(() => { this.onReady(); });
    }
    onReady() {
        this.cacheData();
    }
    cacheData() {
        this.modifierConstructible = {};
        for (const e of GameInfo.ConstructibleModifiers) {
            const current = this.modifierConstructible[e.ModifierId] || [];
            current.push(e.ConstructibleType);
            this.modifierConstructible[e.ModifierId] = current;
        }
    }
    isModifierActive(modifierId, args) {
        const constructibles = this.modifierConstructible[modifierId] || [];
        for (const constructible of constructibles) {
            if (this.hasConstructible(constructible, args)) {
                return true;
            }
        }
        return false;
    }
    hasConstructible(constructible, args = {}) {
        if (args.constructible == constructible) {
            return true;
        }
        return MapTackUtils.hasConstructible(constructible);
    }
}

const ConstructibleModifier = ConstructibleModifierSingleton.getInstance();
export { ConstructibleModifier as default };