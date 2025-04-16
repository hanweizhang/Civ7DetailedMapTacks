
import MapTackUtils from './dmt-map-tack-utils.js';
import { ConstructibleClassType, DirectionNames, QuarterType } from './dmt-map-tack-constants.js';
import MapTackModifier from './dmt-map-tack-modifier.js';
import MapTackGenerics from './dmt-map-tack-generics.js';

class MapTackYieldSingleton {
    /**
     * Singleton accessor
     */
    static getInstance() {
        if (!MapTackYieldSingleton.singletonInstance) {
            MapTackYieldSingleton.singletonInstance = new MapTackYieldSingleton();
        }
        return MapTackYieldSingleton.singletonInstance;
    }
    constructor() {
        // Adjacencies - BUILDING_PALACE => [{id: QuarterCulture, requiresActivation: false}, {id: QuarterScience, requiresActivation: false}]
        this.constructibleAdjacencies = {};

        engine.whenReady.then(() => { this.onReady(); });
    }
    onReady() {
        this.cacheAdjacencies();
    }
    cacheAdjacencies() {
        this.constructibleAdjacencies = {};
        // Constructible_Adjacencies
        for (const e of GameInfo.Constructible_Adjacencies) {
            const current = this.constructibleAdjacencies[e.ConstructibleType] || [];
            current.push({
                id: e.YieldChangeId,
                requiresActivation: e.RequiresActivation
            });
            this.constructibleAdjacencies[e.ConstructibleType] = current;
        }
        // Generic map tack adjacencies
        const genericItems = MapTackGenerics.getGenericMapTacks();
        for (const genericItem of genericItems) {
            this.constructibleAdjacencies[genericItem.type] = MapTackGenerics.getAdjacencyObjs(genericItem.type);
        }
    }
    /**
     * Get yield details of the given constructible type at given plot.
     * @param {int} x x-coordinate of the plot
     * @param {int} y y-coordinate of the plot
     * @param {String} type type of the map tack
     * @returns an object with these fields:
     *      base: Base yields of the constructible. An array of objects containing
     *          type: Yield type
     *          amount: Yield change amount
     *      bonus: Self bonuses from modifiers. An array of objects containing
     *          type: Yield type
     *          amount: Yield change amount
     *          text: string for the yield
     *      adjacencies: Array of adjacency bonuses, each bonus with fields:
     *          type: Yield type
     *          amount: Yield change amount
     *          text: string for the yield
     */
    getYieldDetails(x, y, type) {
        // Special handling for generic unique quarter.
        if (MapTackGenerics.isGenericUniqueQuarter(type)) {
            const uniqueQuarterBuildings = MapTackUtils.getPlayerUniqueQuarterBuildings();
            if (uniqueQuarterBuildings.length > 0) {
                // Delegate yields to unique quarter buildings.
                const yieldDetails = uniqueQuarterBuildings.map(buildingType => this.getYieldDetails(x, y, buildingType));
                const base = yieldDetails.flatMap(sub => sub.base);
                const bonus = yieldDetails.flatMap(sub => sub.bonus);
                const adjacencies = yieldDetails.flatMap(sub => sub.adjacencies);
                return { base, bonus, adjacencies };
            }
        }

        const base = MapTackUtils.getConstructibleYieldChanges(type);
        const bonus = this.getBonusYields(x, y, type);
        const adjacencies = this.getAdjacencyYields(x, y, type);
        return { base, bonus, adjacencies };
    }
    getBonusYields(x, y, type) {
        const bonusYields = [];
        const plotDetails = MapTackUtils.getRealizedPlotDetails(x, y);

        // Plot yields.
        const plotYields = MapTackModifier.getPlotYields(type, { plotDetails, constructible: type });
        for (const plotYield of plotYields) {
            const type = plotYield.type;
            const amount = plotYield.amount;
            const yieldName = GameInfo.Yields.lookup(type)?.Name;
            const name = plotYield.name || "LOC_GLOBAL_YIELDS_OTHER";
            const text = `${Locale.compose("LOC_DMT_YIELD_FROM", amount, yieldName, name)}`;
            bonusYields.push({ type, amount, text });
        }

        return bonusYields;
    }
    getAdjacencyYields(x, y, type) {
        const adjacencyYields = [];
        const adjacencies = [...(this.constructibleAdjacencies[type] || []), ...this.getWildcardAdjacency(x, y, type)];
        let adjacentPlotDetails;
        for (const adjacency of adjacencies) {
            if (adjacency.requiresActivation) {
                if (!MapTackModifier.isAdjacencyUnlocked(adjacency.id)) {
                    continue;
                }
            }
            // Get adjacent plot details if it has not been fetched.
            if (!adjacentPlotDetails) {
                adjacentPlotDetails = MapTackUtils.getAdjacentPlotDetails(x, y);
            }
            const adjacencyDef = GameInfo.Adjacency_YieldChanges.lookup(adjacency.id);
            // Calculate adjacency yields.
            adjacencyYields.push(...this.calculateAdjacencyYields(adjacencyDef, adjacentPlotDetails));
        }
        return adjacencyYields;
    }
    /**
     * @returns an array of wildcard adjacencies that can apply to the given constructible type
     */
    getWildcardAdjacency(x, y, type) {
        // Wonder and improvement don't seem to be applicable for wildcard adjacencies.
        if (MapTackUtils.getConstructibleClassType(type) != ConstructibleClassType.BUILDING) {
            return [];
        }
        const adjacencies = [];
        for (const e of GameInfo.Constructible_WildcardAdjacencies) {
            if (e.ConstructibleClass && e.ConstructibleClass != MapTackUtils.getConstructibleClassType(type)) {
                continue;
            }
            if (e.ConstructibleTag && !MapTackUtils.hasTag(type, e.ConstructibleTag)) {
                continue;
            }
            if (e.CurrentAgeConstructiblesOnly && !MapTackUtils.isCurrentAge(type)) {
                continue;
            }
            // TODO: HasBiome, HasNavigableRiver, etc.
            // If reach this point, then the adjacency is eligible to be applied.
            adjacencies.push({
                id: e.YieldChangeId,
                requiresActivation: e.RequiresActivation
            });
        }
        return adjacencies;
    }
    /**
     * @returns an array of object containing the adjacency yields for the given adjacency type, with fields:
     *      type: Yield type
     *      amount: Yield change amount
     *      text: string for the yield
     */
    calculateAdjacencyYields(adjacencyDef, adjacentPlotDetails) {
        const adjacencyYields = [];
        if (!adjacencyDef) {
            return [];
        }
        if (adjacencyDef.AdjacentBiome) {
            const yields = this.getAdjacentBiomeYields(adjacencyDef, adjacentPlotDetails);
            if (yields) { adjacencyYields.push(yields); }
        }
        if (adjacencyDef.AdjacentTerrain) {
            const yields = this.getAdjacentTerrainYields(adjacencyDef, adjacentPlotDetails);
            if (yields) { adjacencyYields.push(yields); }
        }
        if (adjacencyDef.AdjacentFeature) {
            const yields = this.getAdjacentFeatureYields(adjacencyDef, adjacentPlotDetails);
            if (yields) { adjacencyYields.push(yields); }
        }
        if (adjacencyDef.AdjacentFeatureClass) {
            const yields = this.getAdjacentFeatureClassYields(adjacencyDef, adjacentPlotDetails);
            if (yields) { adjacencyYields.push(yields); }
        }
        if (adjacencyDef.AdjacentLake) {
            const yields = this.getAdjacentLakeYields(adjacencyDef, adjacentPlotDetails);
            if (yields) { adjacencyYields.push(yields); }
        }
        if (adjacencyDef.AdjacentNaturalWonder) {
            const yields = this.getAdjacentNaturalWonderYields(adjacencyDef, adjacentPlotDetails);
            if (yields) { adjacencyYields.push(yields); }
        }
        if (adjacencyDef.AdjacentRiver) {
            const yields = this.getAdjacentRiverYields(adjacencyDef, adjacentPlotDetails);
            if (yields) { adjacencyYields.push(yields); }
        }
        if (adjacencyDef.AdjacentNavigableRiver) {
            const yields = this.getAdjacentNavigableRiverYields(adjacencyDef, adjacentPlotDetails);
            if (yields) { adjacencyYields.push(yields); }
        }
        if (adjacencyDef.AdjacentResource) {
            const yields = this.getAdjacentResourceYields(adjacencyDef, adjacentPlotDetails);
            if (yields) { adjacencyYields.push(yields); }
        }
        if (adjacencyDef.AdjacentSeaResource) { // Untested
            const yields = this.getAdjacentSeaResourceYields(adjacencyDef, adjacentPlotDetails);
            if (yields) { adjacencyYields.push(yields); }
        }
        if (adjacencyDef.AdjacentResourceClass != "NO_RESOURCECLASS") { // Untested
            const yields = this.getAdjacentResourceClassYields(adjacencyDef, adjacentPlotDetails);
            if (yields) { adjacencyYields.push(yields); }
        }
        if (adjacencyDef.AdjacentConstructible) {
            const yields = this.getAdjacentConstructibleYields(adjacencyDef, adjacentPlotDetails);
            if (yields) { adjacencyYields.push(yields); }
        }
        if (adjacencyDef.AdjacentConstructibleTag) {
            const yields = this.getAdjacentConstructibleTagYields(adjacencyDef, adjacentPlotDetails);
            if (yields) { adjacencyYields.push(yields); }
        }
        if (adjacencyDef.AdjacentDistrict) {
            const yields = this.getAdjacentDistrictYields(adjacencyDef, adjacentPlotDetails);
            if (yields) { adjacencyYields.push(yields); }
        }
        if (adjacencyDef.AdjacentQuarter) {
            const yields = this.getAdjacentQuarterYields(adjacencyDef, adjacentPlotDetails);
            if (yields) { adjacencyYields.push(yields); }
        }
        if (adjacencyDef.AdjacentUniqueQuarter) {
            const yields = this.getAdjacentUniqueQuarterYields(adjacencyDef, adjacentPlotDetails);
            if (yields) { adjacencyYields.push(yields); }
        }
        if (adjacencyDef.AdjacentUniqueQuarterType) {
            const yields = this.getAdjacentUniqueQuarterTypeYields(adjacencyDef, adjacentPlotDetails);
            if (yields) { adjacencyYields.push(yields); }
        }
        // Flat amount.
        const flatAmountYield = MapTackModifier.getFlatAmountYield(adjacencyDef.ID);
        if (flatAmountYield) {
            const type = adjacencyDef.YieldType;
            const amount = flatAmountYield.amount;
            const yieldName = GameInfo.Yields.lookup(type)?.Name;
            const name = flatAmountYield.name || "LOC_GLOBAL_YIELDS_OTHER";
            const text = `${Locale.compose("LOC_DMT_YIELD_FROM", amount, yieldName, name)}`;
            adjacencyYields.push({ type, amount, text });
        }
        return adjacencyYields;
    }
    /**
     * START - Helper methods for checking different types of adjacencies, for each method:
     * @returns an object with these fields:
     *      type: Yield type
     *      amount: Yield change amount
     *      text: string for the yield
     */
    getAdjacentYieldsHelper(adjacencyDef, adjacentPlotDetails, filterFunction, name, textStr = "LOC_DMT_YIELD_FROM_ADJACENT") {
        // Get matching adjacent records
        const matchingRecords = adjacentPlotDetails.map(plotDetails => {
            const filterValue = filterFunction(plotDetails);
            let count = 0;
            if (filterValue === true) {
                count = 1;
            } else if (typeof filterValue === "number") {
                count = filterValue;
            }
            if (count > 0) {
                return { count, direction: plotDetails.direction };
            }
            return;
        }).filter(value => value);
        if (matchingRecords.length > 0) {
            // Construct adjacency text
            const type = adjacencyDef.YieldType;
            const amount = matchingRecords.reduce((sum, record) => sum + record.count, 0) * adjacencyDef.YieldChange;
            const yieldName = GameInfo.Yields.lookup(type)?.Name;
            const directionText = matchingRecords.map(record => Locale.compose(DirectionNames.get(record.direction))).join(", ");
            const text = `${Locale.compose(textStr, amount, yieldName, name)} (${directionText})`;
            return { type, amount, text };
        }
        return;
    }
    // Plot related
    getAdjacentBiomeYields(adjacencyDef, adjacentPlotDetails) {
        const filterFunction = e => e?.details?.biome == adjacencyDef.AdjacentBiome;
        const name = GameInfo.Biomes.lookup(adjacencyDef.AdjacentBiome)?.Name;
        return this.getAdjacentYieldsHelper(adjacencyDef, adjacentPlotDetails, filterFunction, name);
    }
    getAdjacentTerrainYields(adjacencyDef, adjacentPlotDetails) {
        const filterFunction = e => e?.details?.terrain == adjacencyDef.AdjacentTerrain;
        const name = GameInfo.Terrains.lookup(adjacencyDef.AdjacentTerrain)?.Name;
        return this.getAdjacentYieldsHelper(adjacencyDef, adjacentPlotDetails, filterFunction, name);
    }
    getAdjacentFeatureYields(adjacencyDef, adjacentPlotDetails) {
        const filterFunction = e => e?.details?.feature == adjacencyDef.AdjacentFeature;
        const name = GameInfo.Features.lookup(adjacencyDef.AdjacentFeature)?.Name;
        return this.getAdjacentYieldsHelper(adjacencyDef, adjacentPlotDetails, filterFunction, name);
    }
    getAdjacentFeatureClassYields(adjacencyDef, adjacentPlotDetails) {
        const filterFunction = e => MapTackUtils.getFeatureClassType(e?.details?.feature) == adjacencyDef.AdjacentFeatureClass;
        const name = GameInfo.FeatureClasses.lookup(adjacencyDef.AdjacentFeatureClass)?.Name;
        return this.getAdjacentYieldsHelper(adjacencyDef, adjacentPlotDetails, filterFunction, name);
    }
    getAdjacentLakeYields(adjacencyDef, adjacentPlotDetails) {
        const filterFunction = e => e?.details?.isLake;
        const name = "LOC_DMT_LAKE_NAME";
        return this.getAdjacentYieldsHelper(adjacencyDef, adjacentPlotDetails, filterFunction, name);
    }
    getAdjacentNaturalWonderYields(adjacencyDef, adjacentPlotDetails) {
        const filterFunction = e => e?.details?.isNaturalWonder;
        const name = "LOC_DMT_NATURAL_WONDER_NAME";
        return this.getAdjacentYieldsHelper(adjacencyDef, adjacentPlotDetails, filterFunction, name);
    }
    getAdjacentRiverYields(adjacencyDef, adjacentPlotDetails) {
        const filterFunction = e => e?.details?.isRiver;
        const name = "LOC_RIVER_NAME";
        return this.getAdjacentYieldsHelper(adjacencyDef, adjacentPlotDetails, filterFunction, name);
    }
    getAdjacentNavigableRiverYields(adjacencyDef, adjacentPlotDetails) {
        // Look up by terrain instead of calling GameMap API for now.
        const filterFunction = e => e?.details?.terrain == "TERRAIN_NAVIGABLE_RIVER";
        const name = "LOC_TERRAIN_NAVIGABLE_RIVER_NAME";
        return this.getAdjacentYieldsHelper(adjacencyDef, adjacentPlotDetails, filterFunction, name);
    }
    getAdjacentResourceYields(adjacencyDef, adjacentPlotDetails) {
        const filterFunction = e => e?.details?.resource != null;
        const name = "LOC_UI_MINI_MAP_RESOURCE";
        return this.getAdjacentYieldsHelper(adjacencyDef, adjacentPlotDetails, filterFunction, name);
    }
    getAdjacentSeaResourceYields(adjacencyDef, adjacentPlotDetails) {
        const filterFunction = e => e?.details?.resource != null;
        const name = "LOC_UI_MINI_MAP_RESOURCE";
        return this.getAdjacentYieldsHelper(adjacencyDef, adjacentPlotDetails, filterFunction, name);
    }
    getAdjacentResourceClassYields(adjacencyDef, adjacentPlotDetails) {
        const filterFunction = e => {
            const resource = e?.details?.resource;
            if (resource) {
                return GameInfo.Resources.lookup(resource)?.ResourceClassType == adjacencyDef.AdjacentResourceClass;
            }
            return false;
        };
        const name = GameInfo.ResourceClasses.lookup(adjacencyDef.AdjacentResourceClass)?.Name;
        return this.getAdjacentYieldsHelper(adjacencyDef, adjacentPlotDetails, filterFunction, name);
    }
    // Buildings related
    getAdjacentConstructibleYields(adjacencyDef, adjacentPlotDetails) {
        const filterFunction = e => e?.details?.constructibles?.includes(adjacencyDef.AdjacentConstructible);
        const name = GameInfo.Constructibles.lookup(adjacencyDef.AdjacentConstructible)?.Name;
        return this.getAdjacentYieldsHelper(adjacencyDef, adjacentPlotDetails, filterFunction, name);
    }
    getAdjacentConstructibleTagYields(adjacencyDef, adjacentPlotDetails) {
        const filterFunction = e => {
            const constructibles = e?.details?.constructibles || [];
            let matchingCount = 0;
            for (const c of constructibles) {
                if (MapTackUtils.hasTag(c, adjacencyDef.AdjacentConstructibleTag)) {
                    matchingCount++;
                }
            }
            return matchingCount;
        };
        const name = Locale.compose("LOC_TAG_CONSTRUCTIBLE_" + adjacencyDef.AdjacentConstructibleTag);
        return this.getAdjacentYieldsHelper(adjacencyDef, adjacentPlotDetails, filterFunction, name, "LOC_DMT_YIELD_FROM_ADJACENT_CONSTRUCTIBLE_TAG");
    }
    getAdjacentDistrictYields(adjacencyDef, adjacentPlotDetails) {
        const filterFunction = e => e?.details?.district == adjacencyDef.AdjacentDistrict;
        const name = GameInfo.Districts.lookup(adjacencyDef.AdjacentDistrict)?.Name;
        return this.getAdjacentYieldsHelper(adjacencyDef, adjacentPlotDetails, filterFunction, name);
    }
    getAdjacentQuarterYields(adjacencyDef, adjacentPlotDetails) {
        const filterFunction = e => e?.details?.quarterType != QuarterType.NO_QUARTER;
        const name = "LOC_DMT_QUARTER_NAME";
        return this.getAdjacentYieldsHelper(adjacencyDef, adjacentPlotDetails, filterFunction, name);
    }
    getAdjacentUniqueQuarterYields(adjacencyDef, adjacentPlotDetails) {
        const filterFunction = e => {
            const quarterType = e?.details?.quarterType;
            if (quarterType != null && quarterType != QuarterType.NO_QUARTER && quarterType != QuarterType.NORMAL_QUARTER) {
                return true;
            }
            return false;
        };
        const name = "LOC_UI_PRODUCTION_UNIQUE_QUARTER";
        return this.getAdjacentYieldsHelper(adjacencyDef, adjacentPlotDetails, filterFunction, name);
    }
    getAdjacentUniqueQuarterTypeYields(adjacencyDef, adjacentPlotDetails) {
        const filterFunction = e => e?.details?.quarterType == QuarterType[adjacencyDef.AdjacentUniqueQuarterType];
        const name = GameInfo.UniqueQuarters.lookup(adjacencyDef.AdjacentUniqueQuarterType)?.Name;
        return this.getAdjacentYieldsHelper(adjacencyDef, adjacentPlotDetails, filterFunction, name);
    }
    /**
     * END - Helper methods for checking different types of adjacencies
     */
}

const MapTackYield = MapTackYieldSingleton.getInstance();
export { MapTackYield as default };
