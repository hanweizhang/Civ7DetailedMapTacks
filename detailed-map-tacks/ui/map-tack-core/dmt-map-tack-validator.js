
import MapTackStore from './dmt-map-tack-store.js';
import MapTackUtils from './dmt-map-tack-utils.js';
import MapTackGenerics from './dmt-map-tack-generics.js';
import { ConstructibleClassType, DirectionNames } from './dmt-map-tack-constants.js';
import MapTackUIUtils from './dmt-map-tack-ui-utils.js';

const MAX_COUNT_PER_PLOT = 2;
class MapTackValidatorSingleton {
    /**
     * Singleton accessor
     */
    static getInstance() {
        if (!MapTackValidatorSingleton.singletonInstance) {
            MapTackValidatorSingleton.singletonInstance = new MapTackValidatorSingleton();
        }
        return MapTackValidatorSingleton.singletonInstance;
    }
    constructor() {
        // ConstructibleType => [ biomeType, ... ]
        this.invalidAjacentBiomes = {};
        engine.whenReady.then(() => { this.onReady(); });
    }
    onReady() {
        this.cacheData();
    }
    cacheData() {
        this.invalidAjacentBiomes = {};
        for (const e of GameInfo.Constructible_InvalidAdjacentBiomes) {
            const current = this.invalidAjacentBiomes[e.ConstructibleType] || [];
            current.push(e.BiomeType);
            this.invalidAjacentBiomes[e.ConstructibleType] = current;
        }
    }
    /**
     * Check if the given map tack is valid.
     * @param {int} x x-coordinate of the plot
     * @param {int} y y-coordinate of the plot
     * @param {String} type type of the map tack
     * @param {Array} newMapTacks new map tacks to be added.
     * @returns an object with these fields:
     *      isValid: is the map tack valid here.
     *      preventPlacement: should the placement here be prevented.
     *      reasons: an array of strings with reasons if it cannot be placed here.
     */
    isValid(x, y, type, newMapTacks = [type]) {
        this.waterPlacement = false;
        this.mountainPlacement = false;
        const isAdditive = newMapTacks.length > 0;
        let isValid = true;
        let preventPlacement = false;
        const reasons = new Set();

        // Special handling for generic unique quarter.
        if (MapTackGenerics.isGenericUniqueQuarter(type)) {
            const uniqueQuarterBuildings = MapTackUtils.getPlayerUniqueQuarterBuildings();
            if (uniqueQuarterBuildings.length > 0) {
                // Delegate valid check to unique quarter buildings.
                const cascadeNewMapTacks = isAdditive ? uniqueQuarterBuildings : [];
                const validStatuses = uniqueQuarterBuildings.map(buildingType => this.isValid(x, y, buildingType, cascadeNewMapTacks));
                for (const validStatus of validStatuses) {
                    isValid = isValid && validStatus.isValid;
                    preventPlacement = preventPlacement || validStatus.preventPlacement;
                    validStatus.reasons.forEach(reason => reasons.add(reason));
                }
                return { isValid: isValid, preventPlacement: preventPlacement, reasons: [...reasons] };
            }
        }

        if (isAdditive) {
            const mapTackList = MapTackStore.retrieveMapTacks(x, y);
            // START - Conditions that prevent placing map tacks.
            // 1. Max number of map tacks per plot check.
            if (mapTackList.length + newMapTacks.length > MAX_COUNT_PER_PLOT) {
                isValid = isValid && false;
                preventPlacement = preventPlacement || true;
                reasons.add(Locale.compose("LOC_DMT_INVALID_REASON_REACHED_LIMIT"));
            }
            // 2. Max number of map tacks per plot check for full tile constructibles, like wonders and rail stations.
            if (mapTackList.length > 0) {
                const uniqueMapTacksUnderCheck = new Set([type, ...newMapTacks, ...mapTackList.map(mapTack => mapTack.type)]);
                for (const typeUnderCheck of uniqueMapTacksUnderCheck) {
                    if (MapTackUtils.isFullTile(typeUnderCheck)) {
                        isValid = isValid && false;
                        preventPlacement = preventPlacement || true;
                        reasons.add(Locale.compose("LOC_DMT_INVALID_REASON_FULL_TILE"));
                        break;
                    }
                }
            }
            // 3. Same map tack check. Only apply to non-generic map tacks.
            if (!MapTackGenerics.isGenericMapTack(type)) {
                const hasSameType = mapTackList.some(mapTack => mapTack.type == type);
                if (hasSameType) {
                    isValid = isValid && false;
                    preventPlacement = preventPlacement || true;
                    reasons.add(Locale.compose("LOC_DMT_INVALID_REASON_DUPLICATE"));
                }
            }
            // END - Conditions that prevent placing map tacks.
        }

        const plotDetails = MapTackUtils.getRealizedPlotDetails(x, y);
        const classType = MapTackUtils.getConstructibleClassType(type);

        // START - Number of constructibles check.
        const existingConstructibles = plotDetails["constructibles"]
            .filter(c => !MapTackUtils.canBeBuiltOver(c) && !MapTackUtils.isSlotless(c));
        const uniqueTypesUnderCheck = new Set([type, ...newMapTacks, ...existingConstructibles]);
        // 1. Max number of map tacks per plot check.
        if (uniqueTypesUnderCheck.size > MAX_COUNT_PER_PLOT) {
            isValid = isValid && false;
            reasons.add(Locale.compose("LOC_DMT_INVALID_REASON_REACHED_LIMIT"));
        }
        // 2. Max number of map tacks per plot check for full tile constructibles, like wonders and rail stations.
        if (uniqueTypesUnderCheck.size > 1) {
            for (const typeUnderCheck of uniqueTypesUnderCheck) {
                if (MapTackUtils.isFullTile(typeUnderCheck)) {
                    isValid = isValid && false;
                    reasons.add(Locale.compose("LOC_DMT_INVALID_REASON_FULL_TILE"));
                    break;
                }
            }
        }
        // END - Number of constructibles check.

        // START - Common conditions.
        // 1. Biome check.
        if (plotDetails["biome"]) {
            const canPlaceOnBiome = this.canPlaceOnBiome(type, plotDetails["biome"]);
            if (canPlaceOnBiome == false) {
                isValid = isValid && false;
                const name = GameInfo.Biomes.lookup(plotDetails["biome"])?.Name;
                reasons.add(Locale.compose("LOC_DMT_INVALID_REASON_CANNOT_PLACE_ON_X", name));
            }
        }
        // 2. Terrain check.
        if (plotDetails["terrain"]) {
            const canPlaceOnTerrain = this.canPlaceOnTerrain(type, plotDetails["terrain"]);
            if (canPlaceOnTerrain == false) {
                isValid = isValid && false;
                const name = GameInfo.Terrains.lookup(plotDetails["terrain"])?.Name;
                reasons.add(Locale.compose("LOC_DMT_INVALID_REASON_CANNOT_PLACE_ON_X", name));
            }
        }
        // 3. Feature check.
        if (plotDetails["feature"]) {
            const isNaturalWonder = GameplayMap.isNaturalWonder(x, y);
            const canPlaceOnFeature = this.canPlaceOnFeature(type, classType, plotDetails["feature"], isNaturalWonder);
            if (canPlaceOnFeature == false) {
                isValid = isValid && false;
                const name = GameInfo.Features.lookup(plotDetails["feature"])?.Name;
                reasons.add(Locale.compose("LOC_DMT_INVALID_REASON_CANNOT_PLACE_ON_X", name));
            }
        }
        // 4. Resource check.
        if (plotDetails["resource"]) {
            const canPlaceOnResource = this.canPlaceOnResource(type, classType, plotDetails["resource"]);
            if (canPlaceOnResource == false) {
                isValid = isValid && false;
                const name = GameInfo.Resources.lookup(plotDetails["resource"])?.Name;
                reasons.add(Locale.compose("LOC_DMT_INVALID_REASON_CANNOT_PLACE_ON_X", name));
            }
        }
        // 5. Adjacent check.
        const itemDef = GameInfo.Constructibles.lookup(type);
        if (itemDef?.AdjacentRiver && GameplayMap.isAdjacentToRivers(x, y, 1) == false) {
            isValid = isValid && false;
            reasons.add(Locale.compose("LOC_DMT_INVALID_REASON_ADJACENT_X", "LOC_RIVER_NAME"));
        }
        if (itemDef?.AdjacentLake && MapTackUtils.isAdjacentToLake(x, y) == false) {
            isValid = isValid && false;
            reasons.add(Locale.compose("LOC_DMT_INVALID_REASON_ADJACENT_X", "LOC_DMT_LAKE_NAME"));
        }
        if (itemDef?.AdjacentDistrict && MapTackUtils.isAdjacentToDistrict(x, y, itemDef.AdjacentDistrict) == false) {
            isValid = isValid && false;
            const name = GameInfo.Districts.lookup(itemDef.AdjacentDistrict)?.Name;
            reasons.add(Locale.compose("LOC_DMT_INVALID_REASON_ADJACENT_X", name));
        }
        if (itemDef?.AdjacentTerrain && MapTackUtils.isAdjacentToTerrain(x, y, itemDef.AdjacentTerrain) == false) {
            isValid = isValid && false;
            const name = GameInfo.Terrains.lookup(itemDef.AdjacentTerrain)?.Name;
            reasons.add(Locale.compose("LOC_DMT_INVALID_REASON_ADJACENT_X", name));
        }
        // 6. NoFeature check.
        if (itemDef?.NoFeature && plotDetails["feature"]) {
            isValid = isValid && false;
            const name = GameInfo.Features.lookup(plotDetails["feature"])?.Name;
            reasons.add(Locale.compose("LOC_DMT_INVALID_REASON_CANNOT_PLACE_ON_X", name));
        }
        // 7. NoRiver check.
        if (itemDef?.NoRiver && (GameplayMap.isNavigableRiver(x, y) || GameplayMap.isRiver(x, y))) {
            isValid = isValid && false;
            reasons.add(Locale.compose("LOC_DMT_INVALID_REASON_CANNOT_PLACE_ON_X", "LOC_RIVER_NAME"));
        }
        // 8. RequiresAppealPlacement check. (TODO)
        // 9. RequiresDistantLands check. (TODO)
        // 10. RequiresHomeland check. (TODO)
        // 11. RiverPlacement check.
        if (itemDef?.RiverPlacement) {
            this.waterPlacement = true;
            if (this.checkRiverPlacement(x, y, itemDef.RiverPlacement) == false) {
                isValid = isValid && false;
                reasons.add(Locale.compose("LOC_DMT_INVALID_REASON_CANNOT_PLACE_X", MapTackUIUtils.getMapTackName(type)));
            }
        }
        // 12. InvalidAdjacentBiomes check.
        if (this.invalidAjacentBiomes[type]) {
            for (const biome of this.invalidAjacentBiomes[type]) {
                if (MapTackUtils.isAdjacentToBiome(x, y, biome)) {
                    isValid = isValid && false;
                    const name = GameInfo.Biomes.lookup(biome)?.Name;
                    reasons.add(Locale.compose("LOC_DMT_INVALID_REASON_NOT_ADJACENT_X", name));
                }
            }
        }
        // 13. InvalidFeatures check. (TODO)
        // 14. More improvement check.
        if (classType == ConstructibleClassType.IMPROVEMENT) {
            const [result, subReason] = this.canPlaceImprovement(type, x, y, plotDetails);
            if (result == false) {
                isValid = isValid && false;
                const reason = subReason || Locale.compose("LOC_DMT_INVALID_REASON_CANNOT_PLACE_X", MapTackUIUtils.getMapTackName(type));
                reasons.add(reason);
            }
        }
        // 15. More building check.
        if (classType == ConstructibleClassType.BUILDING) {
            const [result, subReason] = this.canPlaceBuilding(type, x, y, plotDetails);
            if (result == false) {
                isValid = isValid && false;
                const reason = subReason || Locale.compose("LOC_DMT_INVALID_REASON_CANNOT_PLACE_X", MapTackUIUtils.getMapTackName(type));
                reasons.add(reason);
            }
        }
        // 16. More wonder check.
        if (classType == ConstructibleClassType.WONDER) {
            const [result, subReason] = this.canPlaceWonder(type, x, y, plotDetails);
            if (result == false) {
                isValid = isValid && false;
                const reason = subReason || Locale.compose("LOC_DMT_INVALID_REASON_CANNOT_PLACE_X", MapTackUIUtils.getMapTackName(type));
                reasons.add(reason);
            }
        }
        // 17. Final additional terrain placement check.
        const terrainType = plotDetails["terrain"];
        if (terrainType) {
            if (!this.waterPlacement && (terrainType == "TERRAIN_COAST" || terrainType == "TERRAIN_NAVIGABLE_RIVER")) {
                isValid = isValid && false;
                const name = GameInfo.Terrains.lookup(terrainType)?.Name;
                reasons.add(Locale.compose("LOC_DMT_INVALID_REASON_CANNOT_PLACE_ON_X", name));
            } else if (!this.mountainPlacement && terrainType == "TERRAIN_MOUNTAIN") {
                isValid = isValid && false;
                const name = GameInfo.Terrains.lookup(terrainType)?.Name;
                reasons.add(Locale.compose("LOC_DMT_INVALID_REASON_CANNOT_PLACE_ON_X", name));
            } else if (terrainType == "TERRAIN_OCEAN") {
                isValid = isValid && false;
                const name = GameInfo.Terrains.lookup(terrainType)?.Name;
                reasons.add(Locale.compose("LOC_DMT_INVALID_REASON_CANNOT_PLACE_ON_X", name));
            }
        }
        // END - Common conditions.

        return { isValid: isValid, preventPlacement: preventPlacement, reasons: [...reasons] };
    }
    canPlaceOnBiome(mapTackType, biomeType) {
        let hasRequirement = false;
        for (const row of GameInfo.Constructible_ValidBiomes) {
            if (row.ConstructibleType == mapTackType) {
                if (row.BiomeType == biomeType) {
                    return true;
                }
                hasRequirement = true;
            }
        }
        if (hasRequirement) {
            return false;
        }
        // return true by default.
        return true;
    }
    canPlaceOnTerrain(mapTackType, terrainType) {
        let hasRequirement = false;
        for (const row of GameInfo.Constructible_ValidTerrains) {
            if (row.ConstructibleType == mapTackType) {
                if (row.TerrainType == terrainType) {
                    if (terrainType == "TERRAIN_COAST" || terrainType == "TERRAIN_NAVIGABLE_RIVER") {
                        this.waterPlacement = true;
                    } else if (terrainType == "TERRAIN_MOUNTAIN") {
                        this.mountainPlacement = true;
                    }
                    return true;
                }
                hasRequirement = true;
            }
        }
        if (hasRequirement) {
            return false;
        }
        // return true by default.
        return true;
    }
    canPlaceOnFeature(mapTackType, mapTackClassType, featureType, isNaturalWonder) {
        // Assume building and wonder cannot be placed on natural wonders.
        if (isNaturalWonder && mapTackClassType != ConstructibleClassType.IMPROVEMENT) {
            return false;
        }
        let hasRequirement = false;
        // Required feature class check.
        for (const row of GameInfo.Constructible_RequiredFeatureClasses) {
            if (row.ConstructibleType == mapTackType) {
                if (row.FeatureClassType == MapTackUtils.getFeatureClassType(featureType)) {
                    return true;
                }
                hasRequirement = true;
            }
        }
        // Required feature check. (TODO)
        // Valid feature check.
        for (const row of GameInfo.Constructible_ValidFeatures) {
            if (row.ConstructibleType == mapTackType) {
                if (row.FeatureType == featureType) {
                    return true;
                }
                hasRequirement = true;
            }
        }
        if (hasRequirement) {
            return false;
        }
        // return true by default.
        return true;
    }
    canPlaceOnResource(mapTackType, mapTackClassType, resourceType) {
        // Assume building and wonder cannot be placed on resources.
        if (mapTackClassType != ConstructibleClassType.IMPROVEMENT) {
            return false;
        }
        const resourceMapTackType = mapTackType + "_RESOURCE";
        let hasRequirement = false;
        for (const row of GameInfo.Constructible_ValidResources) {
            if (row.ConstructibleType == mapTackType || row.ConstructibleType == resourceMapTackType) {
                if (row.ResourceType == resourceType) {
                    return true;
                }
                hasRequirement = true;
            }
        }
        if (hasRequirement) {
            return false;
        }
        // return false by default.
        return false;
    }
    checkRiverPlacement(x, y, riverPlacement) {
        switch (riverPlacement) {
            // OFF_COAST - Coast only, adjacent to land
            // ANCHORED - Coast or navigable river.
            // RIVER - River or navigable river.
            case "OFF_COAST":
                return MapTackUtils.isLandAdjacentCoast(x, y);
            case "ANCHORED":
                return GameplayMap.isNavigableRiver(x, y) || MapTackUtils.isLandAdjacentCoast(x, y);
            case "RIVER":
                return GameplayMap.isNavigableRiver(x, y) || GameplayMap.isRiver(x, y);
        }
        return true;
    }
    canPlaceImprovement(mapTackType, x, y, plotDetails) {
        const itemDef = GameInfo.Improvements.lookup(mapTackType);
        // Common improvements.
        if (itemDef?.CityBuildable == false) {
            const isFree = mapTackType == MapTackUtils.getFreeImprovementAtPlot(x, y, plotDetails);
            if (isFree) {
                const terrainType = plotDetails["terrain"];
                if (terrainType == "TERRAIN_COAST" || terrainType == "TERRAIN_NAVIGABLE_RIVER") {
                    this.waterPlacement = true;
                } else if (terrainType == "TERRAIN_MOUNTAIN") {
                    this.mountainPlacement = true;
                }
            }
            return [isFree];
        } else {
            // City buildable improvements.
            // Require Rural district, but also allow placing on wilderness for easier placements.
            if (plotDetails["district"] != "DISTRICT_RURAL" && plotDetails["district"] != "DISTRICT_WILDERNESS") {
                const name = GameInfo.Districts.lookup(plotDetails["district"])?.Name;
                return [false, Locale.compose("LOC_DMT_INVALID_REASON_CANNOT_PLACE_ON_X", name)];
            }
            // Cannot be placed on natural wonders.
            if (GameplayMap.isNaturalWonder(x, y)) {
                const name = GameInfo.Features.lookup(plotDetails["feature"])?.Name;
                return [false, Locale.compose("LOC_DMT_INVALID_REASON_CANNOT_PLACE_ON_X", name)];
            }
        }
        // SameAdjacentValid check.
        if (itemDef?.SameAdjacentValid === false && MapTackUtils.isAdjacentToConstructible(x, y, mapTackType)) {
            return [false, Locale.compose("LOC_DMT_INVALID_REASON_NOT_ADJACENT_X", MapTackUIUtils.getMapTackName(mapTackType))];
        }
        // BuildOnFrontier check.
        if (itemDef?.BuildOnFrontier && MapTackUtils.isAdjacentToDistrict(x, y, "DISTRICT_URBAN")) {
            return [false, Locale.compose("LOC_DMT_INVALID_REASON_NOT_ADJACENT_X", "LOC_DISTRICT_URBAN_NAME")];
        }
        // BuildInLine check.
        if (itemDef?.BuildInLine) {
            const adjConstructibles = MapTackUtils.getAdjacentConstructibles(x, y);
            const directionWithConstructible = new Set();
            const numOfDirections = DirectionNames.size;
            for (const { direction, constructibles } of adjConstructibles) {
                if (!constructibles.includes(mapTackType)) continue;
                const nextDir = (direction + 1) % numOfDirections;
                const prevDir = (direction - 1 + numOfDirections) % numOfDirections;
                if (directionWithConstructible.has(nextDir) || directionWithConstructible.has(prevDir)) {
                    // Not in line
                    return [false];
                }
                directionWithConstructible.add(direction);
            }
        }
        // MustBeAppealing check.
        if (itemDef?.MustBeAppealing && MapTackUtils.isAppealing(x, y) == false) {
            return [false];
        }
        // return true by default.
        return [true];
    }
    canPlaceBuilding(_mapTackType, _x, _y, _plotDetails) {
        // TODO: Rail station and launch pad cannot be placed on plot with 1 obsolete building.
        // No special check for buildings yet.
        return [true];
    }
    canPlaceWonder(mapTackType, x, y, plotDetails) {
        const itemDef = GameInfo.Wonders.lookup(mapTackType);
        // Special case WONDER_BATTERSEA_POWER_STATION because it has AdjacentToLand by mistake.
        if (itemDef && mapTackType == "WONDER_BATTERSEA_POWER_STATION") {
            itemDef.AdjacentToLand = false;
        }
        if (itemDef?.AdjacentToLand || itemDef?.MustBeLake) {
            this.waterPlacement = true;
        }
        // Cannot be placed on urban district.
        if (plotDetails["district"] == "DISTRICT_URBAN") {
            return [false, Locale.compose("LOC_DMT_INVALID_REASON_CANNOT_PLACE_ON_X", "LOC_DISTRICT_URBAN_NAME")];
        }
        // AdjacentCapital check.
        if (itemDef?.AdjacentCapital && MapTackUtils.isAdjacentToConstructible(x, y, "BUILDING_PALACE") == false) {
            return [false, Locale.compose("LOC_DMT_INVALID_REASON_ADJACENT_X", "LOC_CAPITAL_SELECT_CAPITAL_BUTTON")];
        }
        // AdjacentConstructible check.
        if (itemDef?.AdjacentConstructible && MapTackUtils.isAdjacentToConstructible(x, y, itemDef.AdjacentConstructible) == false) {
            const name = GameInfo.Constructibles.lookup(itemDef.AdjacentConstructible)?.Name;
            return [false, Locale.compose("LOC_DMT_INVALID_REASON_ADJACENT_X", name)];
        }
        // AdjacentResource check. (TODO)
        // AdjacentToLand check.
        if (itemDef?.AdjacentToLand && GameplayMap.isAdjacentToLand(x, y) == false) {
            return [false];
        }
        // AdjacentToMountain check.
        if (itemDef?.AdjacentToMountain && MapTackUtils.isAdjacentToTerrain(x, y, "TERRAIN_MOUNTAIN") == false) {
            return [false, Locale.compose("LOC_DMT_INVALID_REASON_ADJACENT_X", "LOC_TERRAIN_MOUNTAIN_NAME")];
        }
        // BuildOnFrontier check.
        if (itemDef?.BuildOnFrontier && MapTackUtils.isAdjacentToDistrict(x, y, "DISTRICT_URBAN")) {
            return [false, Locale.compose("LOC_DMT_INVALID_REASON_NOT_ADJACENT_X", "LOC_DISTRICT_URBAN_NAME")];
        }
        // MustBeLake check.
        if (itemDef?.MustBeLake && GameplayMap.isLake(x, y) == false) {
            return [false];
        }
        // MustNotBeLake check.
        if (itemDef?.MustNotBeLake && GameplayMap.isLake(x, y) == true) {
            return [false, Locale.compose("LOC_DMT_INVALID_REASON_CANNOT_PLACE_ON_X", "LOC_DMT_LAKE_NAME")];
        }
        return [true];
    }
}

const MapTackValidator = MapTackValidatorSingleton.getInstance();
export { MapTackValidator as default };
