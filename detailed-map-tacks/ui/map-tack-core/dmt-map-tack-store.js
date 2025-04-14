
import { Catalog } from '/core/ui/utilities/utility-serialize.js';

/**
 * Data definition
 *
 * mapTackList: list of mapTackData
 *
 * mapTackData:
 *
 * x: x coordinate of the plot.
 * y: y coordinate of the plot.
 * type: type of the MapTack constructible, e.g. "BUILDING_MONUMENT".
 * classType: class type of constructible, e.g. "WONDER", "BUILDING", "IMPROVEMENT".
 * validStatus: contains the validation check result of the map tack. Non-null, empty object {} okay.
 * yieldDetails: contains the yield details of the map tack. Non-null, empty object {} okay.
 *
 */

const ID_MAP_TACK = "MAP_TACK";
const ID_MAP_TACK_SETTING = "MAP_TACK_SETTING";
class MapTackStoreSingleton {
    /**
     * Singleton accessor
     */
    static getInstance() {
        if (!MapTackStoreSingleton.singletonInstance) {
            MapTackStoreSingleton.singletonInstance = new MapTackStoreSingleton();
        }
        return MapTackStoreSingleton.singletonInstance;
    }
    constructor() {
        /**
         * Catalog structure:
         *     id = MAP_TACK
         *         x-y = [{ type: BUILDING_MONUMENT, ...}, {...}]
         *     id = SETTING
         *         key = boolean
         */
        this.catalog = new Catalog("DMT");
        this.cacheMap = {};

        engine.whenReady.then(() => { this.onReady(); });
    }
    onReady() {
        // engine.on("GameStarted", this.onGameLoaded, this);
        // Loading.runWhenLoaded(this.onGameLoaded.bind(this));
        window.addEventListener("user-interface-loaded-and-ready", this.onGameLoaded.bind(this)); // This has 1s delay.
    }
    onGameLoaded() {
        this.populateCacheFromStore();
    }
    addMapTack(mapTackData) {
        const key = this.getMapTackKey(mapTackData.x, mapTackData.y);
        const mapTackList = this.cacheMap[key] || [];
        mapTackList.push(mapTackData);
        // Write to cache
        this.cacheMap[key] = mapTackList;
        // Write to store
        const mapTackObj = this.catalog.getObject(ID_MAP_TACK);
        mapTackObj.write(key, JSON.stringify(mapTackList));

        return mapTackList;
    }
    removeMapTack(mapTackData) {
        const index = this.getIndexOfMapTack(mapTackData);
        if (index != -1) {
            const key = this.getMapTackKey(mapTackData.x, mapTackData.y);
            this.cacheMap[key].splice(index, 1);
            const mapTackList = this.cacheMap[key];
            const mapTackObj = this.catalog.getObject(ID_MAP_TACK);
            if (mapTackList.length > 0) {
                // Update store.
                mapTackObj.write(key, JSON.stringify(mapTackList));
                return mapTackList;
            } else {
                // Nothing left in this plot. Delete the key.
                delete this.cacheMap[key];
                // Remove from store. Since there's no remove method, do it by directly editing childrenIDs field.
                mapTackObj.write(key, null);
                mapTackObj.childrenIDs.delete(key);
            }
        }
        return;
    }
    updateMapTacks(x, y, mapTackList) {
        const key = this.getMapTackKey(x, y);
        const mapTackObj = this.catalog.getObject(ID_MAP_TACK);
        if (mapTackList && mapTackList.length > 0) {
            // Write to cache
            this.cacheMap[key] = mapTackList;
            // Write to store
            mapTackObj.write(key, JSON.stringify(mapTackList));
        } else {
            // Nothing left in this plot. Delete the key.
            delete this.cacheMap[key];
            // Remove from store. Since there's no remove method, do it by directly editing childrenIDs field.
            mapTackObj.write(key, null);
            mapTackObj.childrenIDs.delete(key);
        }
    }
    /**
     * Retrieve map tacks for a given plot. Empty array if no existing map tack.
     * @param {int} x x-coordinate of the plot under check
     * @param {int} y y-coordinate of the plot under check
     * @param {boolean} fromStore should read from store or not
     * @returns map tacks for a given plot. Empty array if no existing map tack.
     */
    retrieveMapTacks(x, y, fromStore = false) {
        const key = this.getMapTackKey(x, y);
        let mapTackList;
        if (fromStore) {
            const mapTackObj = this.catalog.getObject(ID_MAP_TACK);
            mapTackList = JSON.parse(mapTackObj.read(key));
        } else {
            mapTackList = this.cacheMap[key];
        }
        return mapTackList || [];
    }
    /**
     * Get the index of the given map tack in its plot.
     * @param {*} mapTackData The map tack under check.
     * @param {boolean} fromStore should read from store or not
     * @returns the index of the given map tack in its plot. -1 if not found.
     */
    getIndexOfMapTack(mapTackData, fromStore = false) {
        const key = this.getMapTackKey(mapTackData.x, mapTackData.y);
        let mapTackList;
        if (fromStore) {
            const mapTackObj = this.catalog.getObject(ID_MAP_TACK);
            mapTackList = JSON.parse(mapTackObj.read(key));
        } else {
            mapTackList = this.cacheMap[key];
        }
        if (mapTackList && mapTackList.length > 0) {
            return mapTackList.findIndex(item => item.type == mapTackData.type);
        }
        return -1;
    }
    populateCacheFromStore() {
        this.cacheMap = {};
        const mapTackObj = this.catalog.getObject(ID_MAP_TACK);
        for (const key of mapTackObj.getKeys()) {
            const mapTackList = JSON.parse(mapTackObj.read(key));
            if (mapTackList && mapTackList.length > 0) {
                // Update cache.
                this.cacheMap[key] = mapTackList;
            }
        }
        engine.trigger("MapTackLoadedFromStore");
    }
    getCachedMapTackStructs(plotKeys = Object.keys(this.cacheMap)) {
        const mapTackStructList = [];
        for (const plotKey of plotKeys) {
            const [x, y] = plotKey.split('-').map(Number);
            const mapTackList = this.cacheMap[plotKey];
            mapTackStructList.push({ x, y, mapTackList });
        }
        return mapTackStructList;
    }
    getMapTackKey(x, y) {
        return `${x}-${y}`;
    }
    getSetting(key) {
        const settingObj = this.catalog.getObject(ID_MAP_TACK_SETTING);
        return settingObj.read(key);
    }
    updateSetting(key, value) {
        const settingObj = this.catalog.getObject(ID_MAP_TACK_SETTING);
        settingObj.write(key, value);
    }
}

const MapTackStore = MapTackStoreSingleton.getInstance();
export { MapTackStore as default };
