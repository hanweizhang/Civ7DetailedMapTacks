import MapTackUtils from '../../map-tack-core/dmt-map-tack-utils.js';
import LensManager, { LensActivationEventName } from '/core/ui/lenses/lens-manager.js';
import BuildingPlacementManager from '/base-standard/ui/building-placement/building-placement-manager.js';

class MapTackLensLayer {
    constructor() {
    }
    onGameLoaded() {
        LensManager.enableLayer("dmt-map-tack-layer"); // Enable map tack layer by default.
    }
    initLayer() {
        window.addEventListener("user-interface-loaded-and-ready", this.onGameLoaded.bind(this));
        window.addEventListener(LensActivationEventName, this.onActiveLensChanged.bind(this));
        this.mapTackModelGroup = WorldUI.createModelGroup("MapTackModelGroup");
    }
    applyLayer() {
        window.dispatchEvent(new Event("ui-show-map-tack-icons"));
    }
    removeLayer() {
        window.dispatchEvent(new Event("ui-hide-map-tack-icons"));
    }
    onActiveLensChanged(event) {
        if (event.detail?.activeLens == "fxs-building-placement-lens") {
            this.highlightMapTackPlot(BuildingPlacementManager?.currentConstructible?.ConstructibleType);
        } else {
            this.clearHiglights();
        }
    }
    highlightMapTackPlot(mapTackType) {
        this.clearHiglights();
        if (mapTackType) {
            const plotCoords = MapTackUtils.getMapTackPlots(mapTackType) || [];
            for (const plotCoord of plotCoords) {
                this.mapTackModelGroup?.addVFXAtPlot("VFX_3dUI_Tut_SelectThis_01", plotCoord, { x: 0, y: 0, z: 0 });
            }
        }
    }
    clearHiglights() {
        this.mapTackModelGroup?.clear();
    }
}
LensManager.registerLensLayer("dmt-map-tack-layer", new MapTackLensLayer());