
import MapTackGenerics from './dmt-map-tack-generics.js';
import MapTackStore from './dmt-map-tack-store.js';
import { DirectionNames, ConstructibleClassType, QuarterType } from './dmt-map-tack-constants.js';
import TraitModifier from './modifier/dmt-trait-modifier.js';

class MapTackUtilsSingleton {
    /**
     * Singleton accessor
     */
    static getInstance() {
        if (!MapTackUtilsSingleton.singletonInstance) {
            MapTackUtilsSingleton.singletonInstance = new MapTackUtilsSingleton();
        }
        return MapTackUtilsSingleton.singletonInstance;
    }
    constructor() {
        // Plot details cache related.
        this.cachedPlotDetails = {};
        this.usePlotDetailsCache = false;
        // Yield changes - BUILDING_PALACE => [{type: YIELD_FOOD, amount: 5}, {type: YIELD_HAPPINESS, amount: 5}, {type: YIELD_PRODUCTION, amount: 5}]
        this.constructibleYieldChanges = {};
        // Type tags - BUILDING_PALACE => [GREATWORK, AGELESS, PERSISTENT]
        this.constructibleTypeTags = {};
        // Free improvements - {
        //      BiomeType: new Map() => {biomeType: [{improvementType, priority, traitType}, ...]},
        //      TerrainType: new Map() => {terrainType: [{improvementType, priority, traitType}, ...]},
        //      FeatureType: new Map() => {featureType: [{improvementType, priority, traitType}, ...]},
        //      ResourceType: new Map() => {resourceType: [{improvementType, priority, traitType}, ...]},
        //      RiverType: new Map() => {riverType: [{improvementType, priority, traitType}, ...]},
        // }
        this.freeImprovementMap = {
            BiomeType: new Map(),
            TerrainType: new Map(),
            FeatureType: new Map(),
            ResourceType: new Map(),
            RiverType: new Map()
        };
        this.commonImprovements = new Set();

        this.currentAge = GameInfo.Ages.lookup(Game.age).AgeType;

        engine.whenReady.then(() => { this.onReady(); });
    }
    onReady() {
        this.cacheTypeTags();
        this.cacheYieldChanges();
        this.cacheFreeImprovements();
    }
    cacheTypeTags() {
        this.constructibleTypeTags = {};
        for (const e of GameInfo.TypeTags) {
            if (GameInfo.Constructibles.lookup(e.Type)) {
                // Only cache for constructibles
                const current = this.constructibleTypeTags[e.Type] || [];
                current.push(e.Tag);
                this.constructibleTypeTags[e.Type] = current;
            }
        }
        // Generic map tack tags
        const genericItems = MapTackGenerics.getGenericMapTacks();
        for (const genericItem of genericItems) {
            this.constructibleTypeTags[genericItem.type] = genericItem.tags;
        }
    }
    cacheYieldChanges() {
        this.constructibleYieldChanges = {};
        for (const e of GameInfo.Constructible_YieldChanges) {
            // Skip city hall
            if (e.ConstructibleType == "BUILDING_CITY_HALL") {
                continue;
            }
            const current = this.constructibleYieldChanges[e.ConstructibleType] || [];
            current.push({
                type: e.YieldType,
                amount: e.YieldChange
            });
            this.constructibleYieldChanges[e.ConstructibleType] = current;
        }
    }
    cacheFreeImprovements() {
        this.freeImprovementMap = {
            BiomeType: new Map(),
            TerrainType: new Map(),
            FeatureType: new Map(),
            ResourceType: new Map(),
            RiverType: new Map()
        };
        this.commonImprovements = new Set();
        for (const e of GameInfo.District_FreeConstructibles) {
            for (const key of Object.keys(this.freeImprovementMap)) {
                const type = e[key];
                if (type) {
                    if (!this.freeImprovementMap[key].has(type)) {
                        this.freeImprovementMap[key].set(type, []);
                    }
                    const traitType = GameInfo.Improvements.lookup(e.ConstructibleType)?.TraitType;
                    this.freeImprovementMap[key].get(type).push({
                        improvementType: e.ConstructibleType,
                        priority: e.Priority,
                        traitType: traitType
                    });
                    if (!traitType) {
                        this.commonImprovements.add(e.ConstructibleType);
                    }
                }
            }
        }
    }
    hasTag(constructibleType, tag) {
        const tags = this.constructibleTypeTags[constructibleType];
        return tags && tags.includes(tag);
    }
    isSlotless(type) {
        // Walls, for example.
        return this.hasTag(type, "IGNORE_DISTRICT_PLACEMENT_CAP");
    }
    isFullTile(type) {
        // Full tile buildings check.
        if (this.hasTag(type, "FULL_TILE")) {
            return true;
        }
        // Wonders check.
        return this.getConstructibleClassType(type) == ConstructibleClassType.WONDER;
    }
    isAgeless(type) {
        return this.hasTag(type, "AGELESS");
    }
    isCurrentAge(type) {
        const itemRef = GameInfo.Constructibles.lookup(type);
        return itemRef?.Age == GameInfo.Ages.lookup(Game.age).AgeType;
    }
    isObsolete(type) {
        const itemRef = GameInfo.Constructibles.lookup(type);
        return itemRef?.Age && itemRef.Age != GameInfo.Ages.lookup(Game.age).AgeType;
    }
    isCityCenter(type) {
        return GameInfo.Buildings.lookup(type)?.CityCenterPriority > 0;
    }
    canBeBuiltOver(type) {
        const classType = this.getConstructibleClassType(type);
        if (classType == ConstructibleClassType.WONDER) {
            return false;
        } else if (classType == ConstructibleClassType.IMPROVEMENT) {
            return true;
        } else {
            return !this.isAgeless(type) && this.isObsolete(type);
        }
    }
    hasConstructible(constructible) {
        // Check map tacks.
        const allValidMapTacks = this.getAllValidMapTacks();
        for (const mapTack of allValidMapTacks) {
            if (mapTack.type == constructible) {
                return true;
            }
        }
        // Check existing constructibles.
        const playerConstructibles = Players.get(GameContext.localPlayerID)?.Constructibles?.getConstructibles() || [];
        for (const playerConstructible of playerConstructibles) {
            const constructDef = GameInfo.Constructibles.lookup(playerConstructible.type);
            if (constructDef.ConstructibleType == constructible) {
                return true;
            }
        }
        return false;
    }
    getAdjacentPlots(x, y) {
        const plots = [];
        for (const direction of DirectionNames.keys()) {
            const plot = GameplayMap.getAdjacentPlotLocation({x, y}, direction);
            plots.push({ direction: direction, plot: plot });
        }
        return plots;
    }
    getAdjacentPlotDetails(x, y) {
        const plotDetails = [];
        for (const direction of DirectionNames.keys()) {
            const adjPlot = GameplayMap.getAdjacentPlotLocation({x, y}, direction);
            plotDetails.push({
                direction: direction,
                details: this.getRealizedPlotDetails(adjPlot.x, adjPlot.y)
            });
        }
        return plotDetails;
    }
    getAdjacentConstructibles(x, y) {
        return this.getAdjacentPlotDetails(x, y).map(plotDetail => ({
            direction: plotDetail.direction,
            constructibles: plotDetail.details.constructibles
        }));
    }
    getAdjacentMapTackStructs(x, y, includeSelf = true) {
        const mapTacks = [];
        if (includeSelf) {
            mapTacks.push({
                x: x,
                y: y,
                mapTackList: MapTackStore.retrieveMapTacks(x, y)
            });
        }
        for (const direction of DirectionNames.keys()) {
            const adjPlot = GameplayMap.getAdjacentPlotLocation({x, y}, direction);
            mapTacks.push({
                x: adjPlot.x,
                y: adjPlot.y,
                mapTackList: MapTackStore.retrieveMapTacks(adjPlot.x, adjPlot.y)
            });
        }
        return mapTacks;
    }
    getValidMapTacks(x, y) {
        return MapTackStore.retrieveMapTacks(x, y)
            .filter(m => m.validStatus?.isValid);
    }
    getAllValidMapTacks() {
        return MapTackStore.getCachedMapTackStructs()
            .map(s => s.mapTackList)
            .flat()
            .filter(m => m.validStatus?.isValid);
    }
    getMapTackTypePlots(mapTackType) {
        return MapTackStore.getCachedMapTackStructs()
            .filter(s => s.mapTackList?.some(m => {
                return m.type == mapTackType || MapTackGenerics.getMatchingConstructibles(m.type).includes(mapTackType);
            }))
            .map(s => ({ x: s.x, y: s.y }));
    }
    getCityCenterMapTackPlots() {
        return MapTackStore.getCachedMapTackStructs()
            .filter(s => s.mapTackList?.some(m => this.isCityCenter(m.type)))
            .map(s => ({ x: s.x, y: s.y }));
    }
    togglePlotDetailsCache(useCache) {
        this.usePlotDetailsCache = useCache;
        this.cachedPlotDetails = {};
    }
    getCacheKey(x, y) {
        return `${x}-${y}`;
    }
    /**
     * @param {int} x
     * @param {int} y
     * @returns an object with these fields:
     *      biome: Biome on this plot. e.g. Grassland, Desert.
     *      terrain: Terrain of this plot.
     *      feature: Feature of this plot.
     *      resource: Resource on this plot.
     *      constructibles: Constructibles on this plot, including both map tacks and already placed constructibles.
     *      district: DistrictType of this plot. DISTRICT_CITY_CENTER, DISTRICT_URBAN, DISTRICT_WONDER, DISTRICT_RURAL, DISTRICT_WILDERNESS.
     *      isLake: Is this plot a lake or not.
     *      isNaturalWonder: Is this plot a natural wonder or not.
     *      isRiver: Does this plot have a river or not.
     *      quarterType: QuarterType of this plot.
     */
    getRealizedPlotDetails(x, y) {
        // Try reading from cache.
        if (this.usePlotDetailsCache) {
            const cacheKey = this.getCacheKey(x, y);
            const plotDetails = this.cachedPlotDetails[cacheKey];
            if (plotDetails) {
                return plotDetails;
            }
        }

        const details = {};
        // Only take valid map tacks into consideration.
        const validMapTacks = this.getValidMapTacks(x, y);

        const isPlotVisible = GameplayMap.getRevealedState(GameContext.localPlayerID, x, y) != RevealedStates.HIDDEN;
        if (isPlotVisible) {
            // Biome
            const biomeIndex = GameplayMap.getBiomeType(x, y);
            const biomeDef = GameInfo.Biomes.lookup(biomeIndex);
            details["biome"] = biomeDef?.BiomeType;
            // Terrain
            const terrainIndex = GameplayMap.getTerrainType(x, y);
            const terrainDef = GameInfo.Terrains.lookup(terrainIndex);
            details["terrain"] = terrainDef?.TerrainType;
            // Feature
            const featureIndex = GameplayMap.getFeatureType(x, y);
            if (featureIndex != FeatureTypes.NO_FEATURE) {
                const featureDef = GameInfo.Features.lookup(featureIndex);
                details["feature"] = featureDef?.FeatureType;
            }
            // Resource
            const resourceIndex = GameplayMap.getResourceType(x, y);
            if (resourceIndex != ResourceTypes.NO_RESOURCE) {
                const resourceDef = GameInfo.Resources.lookup(resourceIndex);
                details["resource"] = resourceDef?.ResourceType;
            }
            // Constructibles
            details["constructibles"] = [];
            const canOverrideImprovement = validMapTacks.some(m =>
                (m.classType == ConstructibleClassType.BUILDING || m.classType == ConstructibleClassType.WONDER));
            const buildingSet = new Set();
            const improvementSet = new Set();
            // Get already placed constructibles on this plot.
            const constructibles = this.getConstructiblesAtPlot(x, y);
            for (const constructible of constructibles) {
                if (constructible.classType == ConstructibleClassType.WONDER) {
                    // If there's already a wonder, this plot will only have this constructible
                    details["constructibles"].push(constructible.type);
                } else if (constructible.classType == ConstructibleClassType.BUILDING) {
                    buildingSet.add(constructible.type);
                } else if (constructible.classType == ConstructibleClassType.IMPROVEMENT) {
                    if (!canOverrideImprovement) {
                        // Only add improvement if map tack will not override improvement.
                        improvementSet.add(constructible.type);
                    }
                }
            }
            // If no wonders are being added yet, add buildings and improvements.
            if (details["constructibles"].length == 0) {
                // If already has placed buildings or map tack will override improvements, populate buildings from map tack.
                if (buildingSet.size > 0 || canOverrideImprovement) {
                    for (const mapTack of validMapTacks) {
                        if (mapTack.classType == ConstructibleClassType.BUILDING || mapTack.classType == ConstructibleClassType.WONDER) {
                            // Generic unique quarter special case.
                            if (MapTackGenerics.isGenericUniqueQuarter(mapTack.type)) {
                                const uniqueQuarterBuildings = MapTackUtils.getPlayerUniqueQuarterBuildings();
                                if (uniqueQuarterBuildings.length > 0) {
                                    for (const uniqueQuarterBuilding of uniqueQuarterBuildings) {
                                        buildingSet.add(uniqueQuarterBuilding);
                                    }
                                    continue;
                                }
                            }
                            buildingSet.add(mapTack.type);
                        }
                    }
                    details["constructibles"].push(...buildingSet);
                } else {
                    // All improvements only.
                    for (const mapTack of validMapTacks) {
                        if (mapTack.classType == ConstructibleClassType.IMPROVEMENT) {
                            improvementSet.add(mapTack.type);
                        }
                    }
                    details["constructibles"].push(...improvementSet);
                }
            }
        } else {
            // Plot not visible, only add map tacks.
            details["constructibles"] = validMapTacks.map(m => m.type);
        }
        // District
        details["district"] = this.getRealizedDistrictType(x, y, validMapTacks);
        // Other misc
        details["isLake"] = GameplayMap.isLake(x, y);
        details["isNaturalWonder"] = GameplayMap.isNaturalWonder(x, y);
        details["isRiver"] = GameplayMap.isRiver(x, y);
        details["quarterType"] = this.getQuarterType(details["constructibles"]);

        if (this.usePlotDetailsCache) {
            const cacheKey = this.getCacheKey(x, y);
            this.cachedPlotDetails[cacheKey] = details;
        }

        return details;
    }
    getRealizedDistrictType(x, y, validMapTacks = null) {
        if (validMapTacks == null) {
            validMapTacks = this.getValidMapTacks(x, y);
        }
        let hasBuilding = false;
        let hasImprovement = false;
        // Check for existing district.
        const district = Districts.getAtLocation({x, y});
        if (district) {
            switch (district.type) {
                case DistrictTypes.CITY_CENTER:
                case DistrictTypes.WONDER:
                case DistrictTypes.URBAN:
                    // If district is city center or is wonder or is already urban, return it directly.
                    return GameInfo.Districts.lookup(district.type)?.DistrictType;
                case DistrictTypes.RURAL:
                    hasImprovement = true;
                    break;
            }
        }
        // Check for map tacks.
        for (const mapTack of validMapTacks) {
            if (this.isCityCenter(mapTack.type)) {
                return "DISTRICT_CITY_CENTER";
            }
            switch (mapTack.classType) {
                case ConstructibleClassType.WONDER:
                    return "DISTRICT_WONDER";
                case ConstructibleClassType.BUILDING:
                    hasBuilding = true;
                    break;
                case ConstructibleClassType.IMPROVEMENT:
                    hasImprovement = true;
                    break;
            }
        }
        if (hasBuilding) {
            return "DISTRICT_URBAN";
        } else if (hasImprovement) {
            return "DISTRICT_RURAL";
        } else {
            return "DISTRICT_WILDERNESS";
        }
    }
    /**
     * @param {string} type constructible type
     * @returns class type of given constructible type.
     */
    getConstructibleClassType(type) {
        if (MapTackGenerics.isGenericMapTack(type)) {
            return MapTackGenerics.getClassType(type);
        } else {
            return GameInfo.Constructibles.lookup(type)?.ConstructibleClass;
        }
    }
    /**
     * @param {string} type feature type
     * @returns class type of given feature type.
     */
    getFeatureClassType(type) {
        if (type) {
            const featureDef = GameInfo.Features.lookup(type);
            if (featureDef) {
                return featureDef.FeatureClassType;
            }
        }
        return;
    }
    /**
     * @param {int} x
     * @param {int} y
     * @returns an array of objects with these fields:
     *      type: Constructible type
     *      classType: Constructible class type
     */
    getConstructiblesAtPlot(x, y) {
        const constructibles = [];
        const constructibleComponentIds = MapConstructibles.getHiddenFilteredConstructibles(x, y);
        for (const componentId of constructibleComponentIds) {
            const instance = Constructibles.getByComponentID(componentId);
            if (instance) {
                const constructibleDef = GameInfo.Constructibles.lookup(instance.type);
                if (constructibleDef) {
                    constructibles.push({
                        type: constructibleDef.ConstructibleType,
                        classType: constructibleDef.ConstructibleClass
                    });
                }
            }
        }
        return constructibles;
    }
    isAdjacentToLake(x, y) {
        const adjacentPlots = this.getAdjacentPlots(x, y);
        for (const { plot } of adjacentPlots) {
            if (GameplayMap.isLake(plot.x, plot.y)) {
                return true;
            }
        }
        return false;
    }
    isAdjacentToDistrict(x, y, districtType) {
        const adjacentPlots = this.getAdjacentPlots(x, y);
        for (const { plot } of adjacentPlots) {
            const realizedDistrictType = this.getRealizedDistrictType(plot.x, plot.y);
            if (districtType == realizedDistrictType) {
                return true;
            } else if (districtType == "DISTRICT_URBAN" && realizedDistrictType == "DISTRICT_CITY_CENTER") {
                // Special check for wonder's urban requirement. City center is considered as valid urban.
                return true;
            }
        }
        return false;
    }
    isAdjacentToConstructible(x, y, constructibleType) {
        const adjConstructibles = this.getAdjacentConstructibles(x, y);
        for (const { constructibles } of adjConstructibles) {
            if (constructibles?.includes(constructibleType)) {
                return true;
            }
        }
        return false;
    }
    isAdjacentToTerrain(x, y, terrainType) {
        const adjacentPlots = this.getAdjacentPlots(x, y);
        for (const { plot } of adjacentPlots) {
            const adjTerrainIndex = GameplayMap.getTerrainType(plot.x, plot.y);
            const adjTerrainDef = GameInfo.Terrains.lookup(adjTerrainIndex);
            if (terrainType == adjTerrainDef?.TerrainType) {
                return true;
            }
        }
        return false;
    }
    isAdjacentToBiome(x, y, biomeType) {
        const adjacentPlots = this.getAdjacentPlots(x, y);
        for (const { plot } of adjacentPlots) {
            const adjBiomeIndex = GameplayMap.getBiomeType(plot.x, plot.y);
            const adjBiomeDef = GameInfo.Biomes.lookup(adjBiomeIndex);
            if (biomeType == adjBiomeDef?.BiomeType) {
                return true;
            }
        }
        return false;
    }
    isLandAdjacentCoast(x, y) {
        // Coast check
        const terrainIndex = GameplayMap.getTerrainType(x, y);
        if ("TERRAIN_COAST" != GameInfo.Terrains.lookup(terrainIndex)?.TerrainType) {
            return false;
        }
        // Adjacent land check
        return GameplayMap.isAdjacentToLand(x, y);
    }
    isAppealing(x, y) {
        let adjacentAppeal = 0;
        const adjacentPlots = this.getAdjacentPlots(x, y);
        for (const { plot } of adjacentPlots) {
            const adjTerrainIndex = GameplayMap.getTerrainType(plot.x, plot.y);
            adjacentAppeal += GameInfo.Terrains.lookup(adjTerrainIndex)?.Appeal ?? 0;
            const adjFeatureIndex = GameplayMap.getFeatureType(plot.x, plot.y);
            adjacentAppeal += GameInfo.Features.lookup(adjFeatureIndex)?.Appeal ?? 0;
        }
        return adjacentAppeal >= 3;
    }
    getQuarterType(constructibles) {
        if (constructibles) {
            const validConstructibles = constructibles.filter(c => {
                // Only need to consider non-obsolete buildings for quarter type calculation.
                return this.getConstructibleClassType(c) == ConstructibleClassType.BUILDING && !this.canBeBuiltOver(c);
            });
            const hasGenericUniqueQuarter = validConstructibles.some(c => MapTackGenerics.isGenericUniqueQuarter(c));
            if (validConstructibles.length >= 2) {
                // Unique quarter check
                for (const uniqueQuarterDef of GameInfo.UniqueQuarters) {
                    const uniqueQuarterConstructibles = [uniqueQuarterDef.BuildingType1, uniqueQuarterDef.BuildingType2];
                    // Sort both arrays
                    validConstructibles.sort();
                    uniqueQuarterConstructibles.sort();
                    if (JSON.stringify(validConstructibles) == JSON.stringify(uniqueQuarterConstructibles)) {
                        return QuarterType[uniqueQuarterDef.UniqueQuarterType];
                    }
                }
                return hasGenericUniqueQuarter ? this.getPlayerUniqueQuarterType() : QuarterType.NORMAL_QUARTER;
            } else if (hasGenericUniqueQuarter) {
                return this.getPlayerUniqueQuarterType();
            } else if (validConstructibles.some(c => this.hasTag(c, "FULL_TILE"))) {
                return QuarterType.NORMAL_QUARTER;
            }
        }
        return QuarterType.NO_QUARTER;
    }
    getPlayerUniqueQuarterBuildings() {
        for (const uniqueQuarterDef of GameInfo.UniqueQuarters) {
            if (TraitModifier.isTraitActive(uniqueQuarterDef.TraitType)) {
                return [uniqueQuarterDef.BuildingType1, uniqueQuarterDef.BuildingType2];
            }
        }
        return [];
    }
    getPlayerUniqueQuarterType() {
        for (const uniqueQuarterDef of GameInfo.UniqueQuarters) {
            if (TraitModifier.isTraitActive(uniqueQuarterDef.TraitType)) {
                return uniqueQuarterDef.UniqueQuarterType;
            }
        }
        // GENERIC_UNIQUE_QUARTER by default.
        return QuarterType.GENERIC_UNIQUE_QUARTER;
    }
    getConstructibleYieldChanges(type) {
        return this.constructibleYieldChanges[type] || [];
    }
    getConstructibleDominantYieldType(type) {
        const yields = this.constructibleYieldChanges[type];
        if (yields) {
            let maxAmount = -Infinity;
            let maxType = "YIELD_UNKNOWN";
            let hasDuplicateMax = false;
            for (const { type, amount } of yields) {
                if (amount > maxAmount) {
                    maxAmount = amount;
                    maxType = type;
                    hasDuplicateMax = false;
                } else if (amount === maxAmount) {
                    hasDuplicateMax = true;
                }
            }
            if (!hasDuplicateMax) {
                return maxType;
            }
        }
        return "YIELD_UNKNOWN";
    }
    isCommonImprovement(improvementType) {
        return this.commonImprovements.has(improvementType);
    }
    getFreeImprovementAtPlot(x, y, plotDetails = null) {
        if (!plotDetails) {
            plotDetails = this.getRealizedPlotDetails(x, y);
        }
        const formattedPlotDetails = {
            BiomeType: plotDetails.biome,
            TerrainType: plotDetails.terrain,
            FeatureType: plotDetails.feature,
            ResourceType: plotDetails.resource,
            RiverType: this.getRiverTypeName(x, y)
        };
        const candidates = new Set();
        for (const key of Object.keys(this.freeImprovementMap)) {
            const type = formattedPlotDetails[key];
            if (!type) {
                continue;
            }
            const matchedRecords = this.freeImprovementMap[key].get(type);
            if (!matchedRecords) {
                continue;
            }
            for (const matchedRecord of matchedRecords) {
                if (matchedRecord.traitType && !TraitModifier.isTraitActive(matchedRecord.traitType)) {
                    continue;
                }
                candidates.add(matchedRecord);
            }
        }
        // Find best candidate having the highest priority.
        let best = null;
        for (const candidate of candidates) {
            if (!best || candidate.priority < best.priority) { // Lower priority the better
                best = candidate;
            }
        }
        return best?.improvementType.replace(/_RESOURCE$/, ''); // Return without "_RESOURCE" suffix
    }
    getRiverTypeName(x, y) {
        const riverType = GameplayMap.getRiverType(x, y);
        switch (riverType) {
            case RiverTypes.NO_RIVER:
                return "NO_RIVER";
            case RiverTypes.RIVER_MINOR:
                return "RIVER_MINOR";
            case RiverTypes.RIVER_NAVIGABLE:
                return "RIVER_NAVIGABLE";
        }
        return;
    }
}

const MapTackUtils = MapTackUtilsSingleton.getInstance();
export { MapTackUtils as default };
