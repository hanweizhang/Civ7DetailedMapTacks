import { O as OVERLAY_PRIORITY } from '/base-standard/ui/utilities/utilities-overlay.chunk.js';
import { InterfaceMode, InterfaceModeChangedEventName } from '/core/ui/interface-modes/interface-modes.js';
import MapTackUtils from '../map-tack-core/dmt-map-tack-utils.js';

const PRIMARY_COLOR = UI.Player.getPrimaryColorValueAsHex(GameContext.localPlayerID);
const SECONDARY_COLOR = UI.Player.getSecondaryColorValueAsHex(GameContext.localPlayerID);
const BORDER_OVERLAY_STYLE = {
    style: "CultureBorder_CityState_Open",
    primaryColor: PRIMARY_COLOR,
    secondaryColor: SECONDARY_COLOR
};
class MapTackCityRadiusManagerSingleton {
    /**
     * Singleton accessor
     */
    static getInstance() {
        if (!MapTackCityRadiusManagerSingleton.singletonInstance) {
            MapTackCityRadiusManagerSingleton.singletonInstance = new MapTackCityRadiusManagerSingleton();
        }
        return MapTackCityRadiusManagerSingleton.singletonInstance;
    }
    constructor() {
        // Border overlay
        this.borderOverlayGroup = WorldUI.createOverlayGroup("CityCenterBorderOverlayGroup", OVERLAY_PRIORITY.CULTURE_BORDER);
        // Plot overlay
        this.plotOverlayGroup = WorldUI.createOverlayGroup("CityCenterPlotOverlayGroup", OVERLAY_PRIORITY.PLOT_HIGHLIGHT);
        this.plotOverlay = this.plotOverlayGroup.addPlotOverlay();

        this.allPlotIndices = new Set();

        engine.whenReady.then(() => { this.onReady(); });
    }
    onReady() {
        window.addEventListener(InterfaceModeChangedEventName, this.onInterfaceModeChanged.bind(this));
        engine.on("CityCenterMapTackUpdated", this.onCityCenterMapTackUpdated.bind(this));
    }
    onInterfaceModeChanged() {
        if (InterfaceMode.getCurrent() == "DMT_INTERFACEMODE_MAP_TACK_CHOOSER" || InterfaceMode.getCurrent() == "DMT_INTERFACEMODE_PLACE_MAP_TACKS") {
            this.showOverlay();
        } else {
            this.hideOverlay();
        }
    }
    onPlotOwnershipChanged(data) {
        const plotIndex = GameplayMap.getIndexFromLocation(data.location);
        if (this.allPlotIndices.has(plotIndex)) {
            this.updateCityCenterRadiusData();
        }
    }
    onCityCenterMapTackUpdated() {
        this.updateCityCenterRadiusData();
    }
    updateCityCenterRadiusData() {
        this.borderOverlayGroup.clearAll();
        this.plotOverlayGroup.clearAll();
        // Populate city center radius overlays with the current city center plots.
        const cityCenterPlots = MapTackUtils.getCityCenterMapTackPlots() || [];
        const plotCountMap = new Map();
        const borderPlotIndicesList = [];
        for (const cityCenterPlot of cityCenterPlots) {
            const cityPlotIndices = GameplayMap.getPlotIndicesInRadius(cityCenterPlot.x, cityCenterPlot.y, 3);
            borderPlotIndicesList.push(cityPlotIndices);
            // Count how oftern each plot is used.
            for (const plotIndex of cityPlotIndices) {
                const count = plotCountMap.get(plotIndex) || 0;
                plotCountMap.set(plotIndex, count + 1);
            }
        }
        // Populate different plot overlays.
        const occupiedPlotIndices = [];
        const availablePlotIndices = [];
        const overlapPlotIndices = [];
        for (const [plotIndex, count] of plotCountMap) {
            const plotCoords = GameplayMap.getLocationFromIndex(plotIndex);
            const ownerId = GameplayMap.getOwner(plotCoords.x, plotCoords.y);
            if (ownerId == PlayerIds.NO_PLAYER || !Players.get(ownerId).isAlive) {
                if (count == 1) {
                    availablePlotIndices.push(plotIndex);
                } else {
                    overlapPlotIndices.push(plotIndex);
                }
            } else {
                occupiedPlotIndices.push(plotIndex);
            }
        }
        // Update overlays.
        for (const borderPlotIndices of borderPlotIndicesList) {
            const borderOverlay = this.borderOverlayGroup.addBorderOverlay(BORDER_OVERLAY_STYLE);
            borderOverlay.setPlotGroups(borderPlotIndices, 0);
        }
        this.plotOverlay.addPlots(occupiedPlotIndices, { fillColor: 0x66000000 });
        this.plotOverlay.addPlots(availablePlotIndices, { fillColor: this.addAlphaToHex(PRIMARY_COLOR, 0.2) });
        this.plotOverlay.addPlots(overlapPlotIndices, { fillColor: this.addAlphaToHex(SECONDARY_COLOR, 0.4) });
        this.allPlotIndices = new Set([...occupiedPlotIndices, ...availablePlotIndices, ...overlapPlotIndices]);
    }
    showOverlay() {
        this.borderOverlayGroup.setVisible(true);
        this.plotOverlayGroup.setVisible(true);
    }
    hideOverlay() {
        this.borderOverlayGroup.setVisible(false);
        this.plotOverlayGroup.setVisible(false);
    }
    addAlphaToHex(hexNum, alpha) {
        const alphaHex = Math.round(alpha * 255).toString(16).padStart(2, "0");
        // Convert the hex number to a hex string (RRGGBB)
        const hexRGB = (hexNum & 0xFFFFFF).toString(16).padStart(6, "0");  // Ensures 6 digits
        // Prepend alpha value to the hex color and return as a number
        return parseInt(alphaHex + hexRGB, 16);
    }
}
const MapTackCityRadiusManager = MapTackCityRadiusManagerSingleton.getInstance();
export { MapTackCityRadiusManager as default };
