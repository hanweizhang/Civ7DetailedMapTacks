
import MapTackGenerics from './dmt-map-tack-generics.js';
import MapTackUtils from './dmt-map-tack-utils.js';
import { YieldTypes, ConstructibleClassType } from './dmt-map-tack-constants.js';
import { getConstructibleEffectStrings, parseConstructibleAdjacency } from '/core/ui/utilities/utilities-core-textprovider.js';

const YieldClassNames = new Map([
    ["YIELD_FOOD", "food"],
    ["YIELD_PRODUCTION", "production"],
    ["YIELD_GOLD", "gold"],
    ["YIELD_SCIENCE", "science"],
    ["YIELD_CULTURE", "culture"],
    ["YIELD_HAPPINESS", "happiness"],
    ["YIELD_DIPLOMACY", "diplomacy"]
]);
class MapTackUIUtilsSingleton {
    /**
     * Singleton accessor
     */
    static getInstance() {
        if (!MapTackUIUtilsSingleton.singletonInstance) {
            MapTackUIUtilsSingleton.singletonInstance = new MapTackUIUtilsSingleton();
        }
        return MapTackUIUtilsSingleton.singletonInstance;
    }
    constructor() {
        engine.whenReady.then(() => { this.onReady(); });
    }
    onReady() {
    }
    getMapTackIconStyles(type, classType) {
        // Get shape based on class type.
        const classes = [];
        switch (classType) {
            case ConstructibleClassType.WONDER:
                if (MapTackGenerics.isGenericMapTack(type)) {
                    classes.push("round");
                } else {
                    classes.push("square");
                }
                break;
            case ConstructibleClassType.IMPROVEMENT:
                classes.push("diamond");
                break;
            case ConstructibleClassType.BUILDING:
            default:
                classes.push("round");
                break;
        }
        // Get color based on type.
        const yieldType = MapTackUtils.getConstructibleDominantYieldType(type);
        if (yieldType != "YIELD_UNKNOWN") {
            const colorClass = YieldClassNames.get(yieldType);
            classes.push(colorClass);
        } else {
            classes.push("none");
        }
        return classes;
    }
    getMapTackIconBgImage(type) {
        if (MapTackGenerics.isGenericMapTack(type)) {
            return MapTackGenerics.getIconCSS(type);
        } else {
            return UI.getIconCSS(type);
        }
    }
    getMapTackName(type) {
        if (MapTackGenerics.isGenericMapTack(type)) {
            return MapTackGenerics.getName(type);
        } else {
            return GameInfo.Constructibles.lookup(type)?.Name;
        }
    }
    getMapTackTooltip(type) {
        if (MapTackGenerics.isGenericMapTack(type)) {
            return MapTackGenerics.getTooltipString(type);
        } else {
            return GameInfo.Constructibles.lookup(type)?.Tooltip;
        }
    }
    getYieldFragment(yieldDetails, includeDivider = true) {
        const container = document.createElement('fragment');
        const totalYieldStr = this.getTotalYieldString(yieldDetails);
        if (totalYieldStr) {
            const yieldContainer = document.createElement('div');
            yieldContainer.innerHTML = Locale.stylize(`[B]${totalYieldStr}[/B]`);
            container.appendChild(yieldContainer);
        }
        if (includeDivider) {
            // Divider
            const divider = document.createElement("div");
            divider.classList.add("filigree-divider-inner-frame", "w-full");
            container.appendChild(divider);
        }
        // Base yields
        const baseYieldStr = this.getBaseYieldString(yieldDetails["base"]);
        if (baseYieldStr) {
            const yieldContainer = document.createElement('div');
            yieldContainer.innerHTML = Locale.stylize(baseYieldStr);
            container.appendChild(yieldContainer);
        }
        // Bonus yields
        const bonusYieldStr = this.getDetailedYieldString(yieldDetails["bonus"], "LOC_DMT_BONUS_YIELD");
        if (bonusYieldStr) {
            const yieldContainer = document.createElement('div');
            yieldContainer.innerHTML = Locale.stylize(bonusYieldStr);
            container.appendChild(yieldContainer);
        }
        // Adjacency yields
        const adjYieldStr = this.getDetailedYieldString(yieldDetails["adjacencies"], "LOC_DMT_ADJACENCY_YIELD");
        if (adjYieldStr) {
            const yieldContainer = document.createElement('div');
            yieldContainer.innerHTML = Locale.stylize(adjYieldStr);
            container.appendChild(yieldContainer);
        }
        return container;
    }
    getYieldString(yieldDetails, short = false, separator = ' ') {
        if (!yieldDetails || yieldDetails.length == 0) {
            return;
        }
        this.sortYields(yieldDetails);
        let yieldStr;
        if (short) {
            yieldStr = yieldDetails.map(yieldDetail => `+${yieldDetail.amount}[icon:${yieldDetail.type}]`).join(separator);
        } else {
            yieldStr = yieldDetails.map(yieldDetail => {
                const itemDef = GameInfo.Yields.lookup(yieldDetail.type);
                return Locale.compose("LOC_UI_POS_YIELD", yieldDetail.amount, itemDef.Name);
            }).join(separator);
        }
        return Locale.compose(yieldStr);
    }
    getTotalYieldString(yieldDetails, short = false) {
        const totalYieldDetails = this.getTotalYields(yieldDetails);
        if (!totalYieldDetails || totalYieldDetails.length == 0) {
            return;
        }
        if (short) {
            return this.getYieldString(totalYieldDetails, true, "[N]");
        } else {
            return Locale.compose("LOC_DMT_TOTAL_YIELD", this.getYieldString(totalYieldDetails));
        }
    }
    getBaseYieldString(baseYieldDetails) {
        if (!baseYieldDetails || baseYieldDetails.length == 0) {
            return;
        }
        return Locale.compose("LOC_UI_PRODUCTION_BASE_YIELD", this.getYieldString(baseYieldDetails));
    }
    getDetailedYieldString(yieldDetails, sumTitle) {
        // Adjacency Bonus: +6 Food + 6 Production
        //      - +2 Food from adjacent XXX (xxx, xxx)
        //      - +2 Food from adjacent YYY (yyy, yyy)
        //      ...
        if (!yieldDetails || yieldDetails.length == 0) {
            return;
        }
        // Sort adjacencies by type.
        this.sortYields(yieldDetails);

        const detailedStrings = [];
        const sumMap = new Map();
        for (const yieldDetail of yieldDetails) {
            // Populate sum.
            const currentSum = sumMap.get(yieldDetail.type) || 0;
            sumMap.set(yieldDetail.type, currentSum + yieldDetail.amount);
            // Add sub adjacency strings
            detailedStrings.push(`[LI] ${Locale.compose(yieldDetail.text)}`);
        }
        // Add summary
        const sumYieldDetails = Array.from(sumMap, ([type, amount]) => ({type, amount}));
        const sumString = Locale.compose(sumTitle, this.getYieldString(sumYieldDetails));
        return Locale.compose(`${sumString}[N][BLIST]${detailedStrings.join("")}[/LIST]`);
    }
    getEffectStrings(type) {
        if (MapTackGenerics.isGenericMapTack(type)) {
            const adjacencies = [];
            const adjObjs = MapTackGenerics.getAdjacencyObjs(type);
            for (const adjObj of adjObjs) {
                const yieldChangeDef = GameInfo.Adjacency_YieldChanges.lookup(adjObj.id);
                if (yieldChangeDef) {
                    const s = parseConstructibleAdjacency(yieldChangeDef);
                    if (s) {
                        adjacencies.push(s);
                    }
                }
            }
            return {
                baseYield: null,
                adjacencies,
                effects: []
            };
        } else {
            // Use the game ones.
            return getConstructibleEffectStrings(type);
        }
    }
    sortYields(yieldDetails) {
        yieldDetails.sort((a, b) => YieldTypes.indexOf(a.type) - YieldTypes.indexOf(b.type));
    }
    getTotalYields(yieldDetails) {
        const totalMap = new Map();
        const subYieldDetails = Object.values(yieldDetails).flat();
        if (!subYieldDetails || subYieldDetails.length == 0) {
            return [];
        }
        for (const subYieldDetail of subYieldDetails) {
            const currentTotal = totalMap.get(subYieldDetail.type) || 0;
            totalMap.set(subYieldDetail.type, currentTotal + subYieldDetail.amount);
        }
        const totalYieldDetails = Array.from(totalMap, ([type, amount]) => ({type, amount}));
        this.sortYields(totalYieldDetails);
        return totalYieldDetails;
    }
}

const MapTackUIUtils = MapTackUIUtilsSingleton.getInstance();
export { MapTackUIUtils as default };