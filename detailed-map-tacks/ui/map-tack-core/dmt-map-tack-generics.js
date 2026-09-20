import { ConstructibleClassType, ExcludedItems } from "./dmt-map-tack-constants.js";
import TraitModifier from "./modifier/dmt-trait-modifier.js";

const CLASS_WIDE_FULFILLMENT = new Map([
    ["DMT_BUILDING", "BUILDING"],
    ["DMT_WONDER", "WONDER"],
    ["DMT_IMPROVEMENT", "IMPROVEMENT"],
]);
const YIELD_TAG_TYPES = new Map([
    ["FOOD", "YIELD_FOOD"],
    ["PRODUCTION", "YIELD_PRODUCTION"],
    ["GOLD", "YIELD_GOLD"],
    ["SCIENCE", "YIELD_SCIENCE"],
    ["CULTURE", "YIELD_CULTURE"],
    ["HAPPINESS", "YIELD_HAPPINESS"],
    ["DIPLOMACY", "YIELD_DIPLOMACY"],
]);

function isUniqueConstructible(constructibleType) {
    for (const e of GameInfo.TypeTags) {
        if (e.Type == constructibleType && e.Tag == "UNIQUE") {
            return true;
        }
    }
    return false;
}

class MapTackGenericsSingleton {
    /**
     * Singleton accessor
     */
    static getInstance() {
        if (!MapTackGenericsSingleton.singletonInstance) {
            MapTackGenericsSingleton.singletonInstance = new MapTackGenericsSingleton();
        }
        return MapTackGenericsSingleton.singletonInstance;
    }
    constructor() {
        // Stores generic map tacks map. < Type, GenericMapTackObject >
        // GenericMapTackObject contains the following fields:
        //      type: Type
        //      icon: Icon CSS url
        //      name: LOC string for name
        //      classType: ConstructibleClassType
        //      tags: Array of tags
        //      adjacencyIds: Array of adjacency yield change Ids
        this.genericMapTacks = new Map(); // Use map to preserve order
        this.populateGenericBuildings();

        this.matchingCache = {};
        this.fulfillingCache = {};
        this.yieldPayingCache = {};
        this.exampleFallbackCache = {};
        this.terrainCache = {};

        engine.whenReady.then(() => { this.onReady(); });
    }
    onReady() {
        this.cacheData();
    }
    populateGenericBuildings() {
        // Generic buildings for each yield type.
        this.genericMapTacks.set("DMT_BUILDING_FOOD", {
            type: "DMT_BUILDING_FOOD",
            icon: `url("fs://game/detailed-map-tacks/texture/dmt-building-food.png")`,
            name: "LOC_DMT_BUILDING_FOOD",
            classType: ConstructibleClassType.BUILDING,
            tags: ["AGELESS", "FOOD"],
            adjacencyIds: ["CoastFood", "RiverFood", "WonderFood"]
        });
        this.genericMapTacks.set("DMT_BUILDING_PRODUCTION", {
            type: "DMT_BUILDING_PRODUCTION",
            icon: `url("fs://game/detailed-map-tacks/texture/dmt-building-production.png")`,
            name: "LOC_DMT_BUILDING_PRODUCTION",
            classType: ConstructibleClassType.BUILDING,
            tags: ["AGELESS", "PRODUCTION"],
            adjacencyIds: ["ResourceProduction", "WonderProduction"]
        });
        this.genericMapTacks.set("DMT_BUILDING_GOLD", {
            type: "DMT_BUILDING_GOLD",
            icon: `url("fs://game/detailed-map-tacks/texture/dmt-building-gold.png")`,
            name: "LOC_DMT_BUILDING_GOLD",
            classType: ConstructibleClassType.BUILDING,
            tags: ["AGELESS", "GOLD"],
            adjacencyIds: ["CoastGold", "RiverGold", "WonderGold"]
        });
        this.genericMapTacks.set("DMT_BUILDING_SCIENCE", {
            type: "DMT_BUILDING_SCIENCE",
            icon: `url("fs://game/detailed-map-tacks/texture/dmt-building-science.png")`,
            name: "LOC_DMT_BUILDING_SCIENCE",
            classType: ConstructibleClassType.BUILDING,
            tags: ["AGELESS", "SCIENCE"],
            adjacencyIds: ["ResourceScience", "WonderScience"]
        });
        this.genericMapTacks.set("DMT_BUILDING_CULTURE", {
            type: "DMT_BUILDING_CULTURE",
            icon: `url("fs://game/detailed-map-tacks/texture/dmt-building-culture.png")`,
            name: "LOC_DMT_BUILDING_CULTURE",
            classType: ConstructibleClassType.BUILDING,
            tags: ["AGELESS", "CULTURE"],
            adjacencyIds: ["MountainCulture", "NaturalWonderCulture", "WonderCulture"]
        });
        this.genericMapTacks.set("DMT_BUILDING_HAPPINESS", {
            type: "DMT_BUILDING_HAPPINESS",
            icon: `url("fs://game/detailed-map-tacks/texture/dmt-building-happiness.png")`,
            name: "LOC_DMT_BUILDING_HAPPINESS",
            classType: ConstructibleClassType.BUILDING,
            tags: ["AGELESS", "HAPPINESS"],
            adjacencyIds: ["MountainHappiness", "NaturalWonderHappiness", "WonderHappiness"]
        });
        this.genericMapTacks.set("DMT_BUILDING_DIPLOMACY", {
            type: "DMT_BUILDING_DIPLOMACY",
            icon: `url("fs://game/detailed-map-tacks/texture/dmt-building-diplomacy.png")`,
            name: "LOC_DMT_BUILDING_DIPLOMACY",
            classType: ConstructibleClassType.BUILDING,
            tags: ["AGELESS", "DIPLOMACY"],
            adjacencyIds: []
        });
        this.genericMapTacks.set("BUILDING_CITY_HALL", { // Reuse city hall type to be able to apply its yields
            type: "BUILDING_CITY_HALL",
            icon: `url(fs://game/city_centerpin.png)`,
            name: "LOC_DISTRICT_CITY_CENTER_NAME",
            classType: ConstructibleClassType.BUILDING,
            tags: ["AGELESS"],
            adjacencyIds: []
        });
        this.genericMapTacks.set("DMT_BUILDING_UNIQUE_QUARTER", {
            type: "DMT_BUILDING_UNIQUE_QUARTER",
            icon: `url(fs://game/city_uniquequarter.png)`,
            name: "LOC_UI_PRODUCTION_UNIQUE_QUARTER",
            classType: ConstructibleClassType.BUILDING,
            tags: ["AGELESS", "FULL_TILE"],
            adjacencyIds: []
        });
        this.genericMapTacks.set("DMT_BUILDING", {
            type: "DMT_BUILDING",
            icon: `url(fs://game/city_buildingslist.png)`,
            name: "LOC_CONSTRUCTIBLE_CLASS_NAME_BUILDING",
            classType: ConstructibleClassType.BUILDING,
            tags: ["AGELESS"],
            adjacencyIds: []
        });
        this.genericMapTacks.set("DMT_WONDER", {
            type: "DMT_WONDER",
            icon: `url(fs://game/city_wonderslist.png)`,
            name: "LOC_CONSTRUCTIBLE_CLASS_NAME_WONDER",
            classType: ConstructibleClassType.WONDER,
            tags: [],
            adjacencyIds: []
        });
        this.genericMapTacks.set("DMT_IMPROVEMENT", {
            type: "DMT_IMPROVEMENT",
            icon: `url(fs://game/city_improvementslist.png)`,
            name: "LOC_CONSTRUCTIBLE_CLASS_NAME_IMPROVEMENT",
            classType: ConstructibleClassType.IMPROVEMENT,
            tags: [],
            adjacencyIds: []
        });
    }
    cacheData() {
        const constructibleAdjacencies = {};
        for (const e of GameInfo.Constructible_Adjacencies) {
            const current = constructibleAdjacencies[e.ConstructibleType] || [];
            current.push(e.YieldChangeId);
            constructibleAdjacencies[e.ConstructibleType] = current;
        }
        for (const [type, genericMapTack] of this.genericMapTacks) {
            // Cache matching buildings.
            if (genericMapTack.classType == ConstructibleClassType.BUILDING && genericMapTack.adjacencyIds.length > 0) {
                for (const e of GameInfo.Constructibles) {
                    // Only check current age buildings.
                    if (e.Age == GameInfo.Ages.lookup(Game.age).AgeType && !ExcludedItems.has(e.ConstructibleType)) {
                        const adjIds = constructibleAdjacencies[e.ConstructibleType] || [];
                        const isMatching = genericMapTack.adjacencyIds.every(id => adjIds.includes(id));
                        if (isMatching) {
                            const current = this.matchingCache[type] || [];
                            current.push(e.ConstructibleType);
                            this.matchingCache[type] = current;
                        }
                    }
                }
            }
        }
    }
    isGenericMapTack(type) {
        return this.genericMapTacks.has(type);
    }
    isGenericUniqueQuarter(type) {
        return type == "DMT_BUILDING_UNIQUE_QUARTER";
    }
    isGenericImprovement(type) {
        return type == "DMT_IMPROVEMENT";
    }
    getGenericMapTacks() {
        return [...this.genericMapTacks.values()];
    }
    getGenericMapTack(type) {
        return this.genericMapTacks.get(type);
    }
    getIconCSS(type) {
        return this.genericMapTacks.get(type)?.icon;
    }
    getName(type) {
        return this.genericMapTacks.get(type)?.name;
    }
    getClassType(type) {
        return this.genericMapTacks.get(type)?.classType;
    }
    getAdjacencyObjs(type) {
        const adjIds = this.genericMapTacks.get(type)?.adjacencyIds || [];
        return adjIds.map(id => ({ id, requiresActivation: false }));
    }
    getMatchingConstructibles(type) {
        // Special handling for generic unique quarter.
        if (MapTackGenerics.isGenericUniqueQuarter(type)) {
            for (const uniqueQuarterDef of GameInfo.UniqueQuarters) {
                if (TraitModifier.isTraitActive(uniqueQuarterDef.TraitType)) {
                    return [uniqueQuarterDef.BuildingType1, uniqueQuarterDef.BuildingType2];
                }
            }
        }
        const cached = this.matchingCache[type];
        if (cached && cached.length > 0) {
            return cached;
        }
        if (!this.exampleFallbackCache[type]) {
            this.exampleFallbackCache[type] = this.yieldPayingConstructibles(type).filter(t => !isUniqueConstructible(t));
        }
        return this.exampleFallbackCache[type];
    }

    yieldPayingConstructibles(type) {
        if (this.yieldPayingCache[type]) {
            return this.yieldPayingCache[type];
        }
        const genericMapTack = this.genericMapTacks.get(type);
        const yieldTag = (genericMapTack?.tags || []).find(tag => YIELD_TAG_TYPES.has(tag));
        const yieldType = yieldTag && YIELD_TAG_TYPES.get(yieldTag);
        const found = [];
        if (yieldType) {
            const age = GameInfo.Ages.lookup(Game.age)?.AgeType;
            const paying = new Set();
            for (const e of GameInfo.Constructible_YieldChanges) {
                if (e.YieldType == yieldType && e.YieldChange > 0) {
                    paying.add(e.ConstructibleType);
                }
            }
            for (const e of GameInfo.Constructibles) {
                if (e.ConstructibleClass == ConstructibleClassType.BUILDING && e.Age == age && paying.has(e.ConstructibleType)) {
                    found.push(e.ConstructibleType);
                }
            }
        }
        this.yieldPayingCache[type] = found;
        return found;
    }

    getFulfillingConstructibles(type) {
        if (this.fulfillingCache[type]) {
            return this.fulfillingCache[type];
        }
        const genericMapTack = this.genericMapTacks.get(type);
        let found = new Set();
        if (genericMapTack) {
            if (MapTackGenerics.isGenericUniqueQuarter(type)) {
                found = new Set(this.getMatchingConstructibles(type));
            } else {
                const wantedClass = CLASS_WIDE_FULFILLMENT.get(type);
                if (wantedClass) {
                    const age = GameInfo.Ages.lookup(Game.age)?.AgeType;
                    for (const e of GameInfo.Constructibles) {
                        if (e.ConstructibleClass == wantedClass && (!e.Age || e.Age == age)) {
                            found.add(e.ConstructibleType);
                        }
                    }
                } else {
                    found = new Set(this.matchingCache[type] || []);
                    if (found.size == 0) {
                        found = new Set(this.yieldPayingConstructibles(type));
                    }
                }
            }
        }
        this.fulfillingCache[type] = found;
        return found;
    }

    getValidTerrains(type) {
        if (this.terrainCache[type]) {
            return this.terrainCache[type];
        }
        const found = new Set();
        const memberTypes = this.getFulfillingConstructibles(type);
        if (memberTypes.size > 0) {
            for (const e of GameInfo.Constructible_ValidTerrains) {
                if (memberTypes.has(e.ConstructibleType)) {
                    found.add(e.TerrainType);
                }
            }
        }
        this.terrainCache[type] = found;
        return found;
    }
    getTooltipString(type) {
        const matchingItems = this.getMatchingConstructibles(type);
        if (matchingItems.length == 0) {
            return;
        }
        matchingItems.sort((a, b) => GameInfo.Constructibles.lookup(a)?.Cost - GameInfo.Constructibles.lookup(b)?.Cost);
        const matchingItemNames = matchingItems.map(itemType => {
            const name = Locale.compose(GameInfo.Constructibles.lookup(itemType)?.Name);
            const entry = Locale.compose(`[icon:${itemType}] ${name}`);
            return `[LI] ${entry}`;
        });
        return Locale.compose(`[BLIST]${matchingItemNames.join("")}[/LIST]`);
    }
}

const MapTackGenerics = MapTackGenericsSingleton.getInstance();
export { MapTackGenerics as default };