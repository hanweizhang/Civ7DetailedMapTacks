
import MapTackStore from './dmt-map-tack-store.js';
import MapTackUtils from './dmt-map-tack-utils.js';
import MapTackValidator from './dmt-map-tack-validator.js';
import MapTackYield from './dmt-map-tack-yield.js';

class MapTackChangeProcessorSingleton {
    /**
     * Singleton accessor
     */
    static getInstance() {
        if (!MapTackChangeProcessorSingleton.singletonInstance) {
            MapTackChangeProcessorSingleton.singletonInstance = new MapTackChangeProcessorSingleton();
        }
        return MapTackChangeProcessorSingleton.singletonInstance;
    }
    constructor() {
        engine.whenReady.then(() => { this.onReady(); });
    }
    onReady() {
        engine.on("AddMapTackRequest", this.onAddMapTackRequest, this);
        engine.on("RemoveMapTackRequest", this.onRemoveMapTackRequest, this);
        engine.on("MapTackLoadedFromStore", this.onMapTackLoadedFromStore, this);
        // Game update events
        engine.on("ConstructibleAddedToMap", this.onConstructibleAdded, this);
        engine.on("ConstructibleRemovedFromMap", this.onConstructibleRemoved, this);
        engine.on("PlotVisibilityChanged", this.onPlotVisibilityChanged, this);
        engine.on('LocalPlayerTurnBegin', this.onLocalPlayerTurnBegin, this);
    }
    onAddMapTackRequest(mapTackData) {
        MapTackStore.addMapTack(mapTackData);
        this.onPlotDetailsUpdated(mapTackData.x, mapTackData.y);
        if (MapTackUtils.isCityCenter(mapTackData.type)) {
            engine.trigger("CityCenterMapTackUpdated");
        }
    }
    onRemoveMapTackRequest(mapTackData) {
        MapTackStore.removeMapTack(mapTackData);
        this.onPlotDetailsUpdated(mapTackData.x, mapTackData.y);
        if (MapTackUtils.isCityCenter(mapTackData.type)) {
            engine.trigger("CityCenterMapTackUpdated");
        }
    }
    onConstructibleAdded(data) {
        const mapTackData = {
            x: data.location.x,
            y: data.location.y,
            type: GameInfo.Constructibles.lookup(data.constructibleType)?.ConstructibleType
        };
        MapTackStore.removeMapTack(mapTackData);
        this.onPlotDetailsUpdated(data.location.x, data.location.y);
        if (MapTackUtils.isCityCenter(mapTackData.type)) {
            engine.trigger("CityCenterMapTackUpdated");
        }
    }
    onConstructibleRemoved(data) {
        this.onPlotDetailsUpdated(data.location.x, data.location.y);
    }
    onPlotVisibilityChanged(data) {
        this.onPlotDetailsUpdated(data.location.x, data.location.y);
    }
    onPlotDetailsUpdated(x, y) {
        // Check for updates near the changed plot.
        const plotsUpdated = this.updateAdjacentMapTacks(x, y, true);
        // Make sure the changed plot is added.
        plotsUpdated.add(this.getMapTackKey(x, y));
        const mapTackStructList = MapTackStore.getCachedMapTackStructs(plotsUpdated);
        this.triggerMapTackUIUpdate(mapTackStructList);
    }
    onLocalPlayerTurnBegin() {
        const plotsUpdated = this.updateAllMapTacks();
        const mapTackStructList = MapTackStore.getCachedMapTackStructs(plotsUpdated);
        this.triggerMapTackUIUpdate(mapTackStructList);
    }
    onMapTackLoadedFromStore() {
        const mapTackStructList = MapTackStore.getCachedMapTackStructs();
        this.triggerMapTackUIUpdate(mapTackStructList);
        if (mapTackStructList.some(struct => struct?.mapTackList.some(mapTack => MapTackUtils.isCityCenter(mapTack.type)))) {
            engine.trigger("CityCenterMapTackUpdated");
        }
    }
    triggerMapTackUIUpdate(mapTackStructList) {
        engine.trigger("MapTackUIUpdated", mapTackStructList);
    }
    updateAllMapTacks() {
        MapTackUtils.togglePlotDetailsCache(true);
        const plotsUpdated = this.updateMapTacks(MapTackStore.getCachedMapTackStructs());
        MapTackUtils.togglePlotDetailsCache(false);
        return plotsUpdated;
    }
    updateAdjacentMapTacks(x, y, includeSelf) {
        MapTackUtils.togglePlotDetailsCache(true);
        const plotsUpdated = this.updateMapTacks(MapTackUtils.getAdjacentMapTackStructs(x, y, includeSelf));
        MapTackUtils.togglePlotDetailsCache(false);
        return plotsUpdated;
    }
    updateMapTacks(mapTackStructs) {
        const plotsUpdated = new Set();
        const additionalPlotCenterToUpdate = new Set();
        for (const { x, y, mapTackList } of mapTackStructs) {
            const newMapTackList = [];
            for (const mapTack of mapTackList) {
                const newMapTack = {
                    x: mapTack.x,
                    y: mapTack.y,
                    type: mapTack.type,
                    classType: mapTack.classType,
                    validStatus: MapTackValidator.isValid(mapTack.x, mapTack.y, mapTack.type, []),
                    yieldDetails: MapTackYield.getYieldDetails(mapTack.x, mapTack.y, mapTack.type)
                };
                newMapTackList.push(newMapTack);
                if (mapTack.validStatus.isValid != newMapTack.validStatus.isValid) {
                    // If the valid status of a plot has changed, queue it as a center to cascade the update.
                    additionalPlotCenterToUpdate.add(this.getMapTackKey(mapTack.x, mapTack.y));
                }
            }
            if (JSON.stringify(newMapTackList) != JSON.stringify(mapTackList)) {
                MapTackStore.updateMapTacks(x, y, newMapTackList);
                plotsUpdated.add(this.getMapTackKey(x, y));
            }
        }
        if (additionalPlotCenterToUpdate.size > 0) {
            for (const plotCenterKey of additionalPlotCenterToUpdate) {
                const [plotCenterX, plotCenterY] = plotCenterKey.split('-').map(Number);
                const subUpdates = this.updateMapTacks(MapTackUtils.getAdjacentMapTackStructs(plotCenterX, plotCenterY, false));
                subUpdates.forEach(plot => plotsUpdated.add(plot));
            }
        }
        return plotsUpdated;
    }
    getMapTackKey(x, y) {
        return `${x}-${y}`;
    }
}

const MapTackChangeProcessor = MapTackChangeProcessorSingleton.getInstance();
export { MapTackChangeProcessor as default };