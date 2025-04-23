
import { Audio } from '/core/ui/audio-base/audio-support.js';
import ChoosePlotInterfaceMode from '/base-standard/ui/interface-modes/interface-mode-choose-plot.js';
import { InterfaceMode } from '/core/ui/interface-modes/interface-modes.js';
import { MustGetElement } from '/core/ui/utilities/utilities-dom.js';
import { PlotCursorUpdatedEventName } from '/core/ui/input/plot-cursor.js';
import LensManager from '/core/ui/lenses/lens-manager.js';
import MapTackUtils from '../map-tack-core/dmt-map-tack-utils.js';
import MapTackValidator from '../map-tack-core/dmt-map-tack-validator.js';
import MapTackYield from '../map-tack-core/dmt-map-tack-yield.js';
import { OVERLAY_PRIORITY } from '/base-standard/ui/utilities/utilities-overlay.js';
import MapTackUIUtils from '../map-tack-core/dmt-map-tack-ui-utils.js';
import MapTackGenerics from '../map-tack-core/dmt-map-tack-generics.js';
import MapTackStore from '../map-tack-core/dmt-map-tack-store.js';
import ViewManager from '/core/ui/views/view-manager.js';

const YIELD_SPRITE_X_PADDING = 11;
const YIELD_SPRITE_Y_OFFSET = -25;
const CLEAR_BORDER_OVERLAY_STYLE = {
    style: "CommanderRadius",
    primaryColor: Color.convertToLinear([255, 255, 255, 255])
};
const SETTING_PREVIEW_RADIUS = "PreviewRadius";
/**
 * Handler for DMT_INTERFACEMODE_PLACE_MAP_TACKS.
 */
class PlaceMapTacksInterfaceMode extends ChoosePlotInterfaceMode {
    constructor() {
        super(...arguments);
        this.lastHoveredPlot = -1;
        this.previewRadius = MapTackStore.getSetting(SETTING_PREVIEW_RADIUS) ?? 1;
        this.itemType = null;
        this.isCityCenter = false;
        this.isGenericImprovement = false;
        this.borderOverlayGroup = null;
        this.plotOverlayGroup = null;
        this.plotOverlay = null;
        this.yieldSpriteGrid = null;

        this.validStatus = {};
        this.yieldDetails = {};

        this.plotCursorUpdatedListener = this.onPlotCursorUpdated.bind(this);
        this.updateFrameListener = this.onUpdateFrame.bind(this);
    }
    initialize() {
        this.itemType = this.Context.type;
        this.isCityCenter = MapTackUtils.isCityCenter(this.itemType);
        this.isGenericImprovement = MapTackGenerics.isGenericImprovement(this.itemType);
        this.panel = MustGetElement("dmt-panel-place-map-tack");
        this.panel.setAttribute("item-type", this.itemType);
        return true;
    }
    decorate(overlayGroup, _modelGroup) {
        if (this.isCityCenter) {
            this.borderOverlayGroup = WorldUI.createOverlayGroup("MapTackPlacementBorderOverlayGroup", OVERLAY_PRIORITY.CULTURE_BORDER);
        }
        this.plotOverlay = overlayGroup.addPlotOverlay();
        this.yieldSpriteGrid = WorldUI.createSpriteGrid("MapTackPlacementYieldSpriteGroup", true);
        this.yieldSpriteGrid.setVisible(true);
    }
    reset() {
        this.validStatus = {};
        this.yieldDetails = {};
    }
    transitionTo(oldMode, newMode, context) {
        super.transitionTo(oldMode, newMode, context);
        // Lock out automatic cursor changes
        UI.lockCursor(true);
        // Set the building placement cursor
        UI.setCursorByType(UIHTMLCursorTypes.Place);
        this.lastHoveredPlot = -1;
        window.addEventListener(PlotCursorUpdatedEventName, this.plotCursorUpdatedListener);
        engine.on("UpdateFrame", this.updateFrameListener);
        WorldUI.setUnitVisibility(false);
        Input.setActiveContext(InputContext.World);
        // Enable settler lens when placing city center map tack.
        if (this.isCityCenter) {
            LensManager.enableLayer("fxs-appeal-layer");
            LensManager.enableLayer("fxs-settlement-recommendations-layer");
            LensManager.enableLayer("fxs-random-events-layer");
        }
        MapTackUtils.togglePlotDetailsCache(true);
    }
    transitionFrom(oldMode, newMode) {
        MapTackUtils.togglePlotDetailsCache(false);
        this.borderOverlayGroup?.clearAll();
        this.plotOverlay?.clear();
        this.yieldSpriteGrid?.clear();
        this.yieldSpriteGrid?.setVisible(false);
        LensManager.disableLayer("fxs-appeal-layer");
        LensManager.disableLayer("fxs-settlement-recommendations-layer");
        LensManager.disableLayer("fxs-random-events-layer");
        window.removeEventListener(PlotCursorUpdatedEventName, this.plotCursorUpdatedListener);
        engine.off("UpdateFrame", this.updateFrameListener);
        WorldUI.setUnitVisibility(true);
        ViewManager.isWorldInputAllowed = true; // Make sure zoom block is reset.
        UI.lockCursor(false);
        super.transitionFrom(oldMode, newMode);
    }
    onUpdateFrame(_timeDelta) {
        // Hacky solution to intercept and block zooming.
        if (Input.isCtrlDown()) {
            ViewManager.isWorldInputAllowed = false;
        } else {
            ViewManager.isWorldInputAllowed = true;
        }
    }
    onPlotCursorUpdated(event) {
        this.onPlotUpdated(event.detail.plotCoords);
    }
    onPlotUpdated(plot) {
        if (plot) {
            const plotIndex = GameplayMap.getIndexFromLocation(plot);
            if (plotIndex != this.lastHoveredPlot) {
                this.lastHoveredPlot = plotIndex;
                if (this.isGenericImprovement) {
                    const improvementType = MapTackUtils.getFreeImprovementAtPlot(plot.x, plot.y);
                    if (improvementType) {
                        // Use compatible improvement on this plot.
                        this.itemType = improvementType;
                    } else {
                        // Fallback to original generic improvement type
                        this.itemType = this.Context.type;
                    }
                    this.panel.setAttribute("item-type", this.itemType);
                }
                // Valid status
                this.validStatus = MapTackValidator.isValid(plot.x, plot.y, this.itemType);
                if (this.validStatus.preventPlacement) {
                    UI.setCursorByType(UIHTMLCursorTypes.CantPlace);
                    // Skip calculating yields if the map tack cannot be placed.
                    this.yieldDetails = {};
                }
                else {
                    UI.setCursorByType(UIHTMLCursorTypes.Place);
                    // Yields
                    this.yieldDetails = MapTackYield.getYieldDetails(plot.x, plot.y, this.itemType);
                }
                this.updatePlacementDetails();
                // Update city center border overlay if needed.
                if (this.isCityCenter) {
                    this.updateCityCenterBorderOverlay(plot);
                }
                // Update plot overlay
                this.updateHoverPlotOverlay(plot);
            }
        }
    }
    updatePlacementDetails() {
        if (!this.panel) {
            return;
        }
        const placementDetails = {
            validStatus: this.validStatus,
            yieldDetails: this.yieldDetails
        };
        // Following same pattern as tree's unlock-by-depth but using attributes is not ideal for passing large payload.
        this.panel.setAttribute("placement-details", JSON.stringify(placementDetails));
    }
    updateCityCenterBorderOverlay(plot) {
        if (this.borderOverlayGroup) {
            this.borderOverlayGroup.clearAll();
            const cityPlotIndices = GameplayMap.getPlotIndicesInRadius(plot.x, plot.y, 3);
            const borderOverlay = this.borderOverlayGroup.addBorderOverlay(CLEAR_BORDER_OVERLAY_STYLE);
            borderOverlay.setPlotGroups(cityPlotIndices, 0);
        }
    }
    updateHoverPlotOverlay(hoveredPlot) {
        if (this.plotOverlay && this.yieldSpriteGrid) {
            this.plotOverlay.clear();
            this.yieldSpriteGrid.clear();
            if (this.isCityCenter || this.isGenericImprovement) {
                // Don't need to check for city center and generic improvements.
                return;
            }
            let bestValue = 0;
            const bestPlotIndices = [];
            const invalidPlotIndices = [];
            const normalPlotIndices = [];
            const plotIndices = GameplayMap.getPlotIndicesInRadius(hoveredPlot.x, hoveredPlot.y, this.previewRadius);
            for (const plotIndex of plotIndices) {
                const plot = GameplayMap.getLocationFromIndex(plotIndex);
                const isPlotHidden = GameplayMap.getRevealedState(GameContext.localPlayerID, plot.x, plot.y) == RevealedStates.HIDDEN;
                if (isPlotHidden) {
                    continue;
                }
                const validStatus = MapTackValidator.isValid(plot.x, plot.y, this.itemType);
                if (!validStatus.isValid && plotIndex != this.lastHoveredPlot) {
                    // Only show invalid plot if it is being hovered.
                    continue;
                }
                if (validStatus.preventPlacement) {
                    continue;
                }
                const yieldDetails = MapTackYield.getYieldDetails(plot.x, plot.y, this.itemType);
                const totalYields = MapTackUIUtils.getTotalYields(yieldDetails) || [];
                const pillOffsets = this.getXYOffsetForPill(totalYields.length);
                let totalValue = 0;
                for (let i = 0; i < totalYields.length; i++) {
                    const offset = pillOffsets[i];
                    const value = totalYields[i].amount;
                    totalValue += value;
                    this.yieldSpriteGrid.addSprite(plot, this.getYieldPillIcon(totalYields[i].type), { x: offset.x, y: offset.y, z: 5 });
                    this.yieldSpriteGrid.addText(plot, value.toString(), { x: offset.x, y: (offset.y - 3), z: 5 }, { fonts: ["TitleFont"], fontSize: 4, faceCamera: true });
                }
                if (validStatus.isValid) {
                    normalPlotIndices.push(plotIndex);
                    // Update best plot indices
                    if (totalValue > bestValue) {
                        bestPlotIndices.length = 0;
                        bestPlotIndices.push(plotIndex);
                        bestValue = totalValue;
                    } else if (totalValue == bestValue) {
                        bestPlotIndices.push(plotIndex);
                    }
                } else {
                    invalidPlotIndices.push(plotIndex);
                }
            }
            const filteredNormalPlotIndices = normalPlotIndices.filter(index => !bestPlotIndices.includes(index));
            this.plotOverlay.addPlots(filteredNormalPlotIndices, { fillColor: { x: 0.9, y: 0.9, z: 0.1, w: 0.6 } });
            this.plotOverlay.addPlots(invalidPlotIndices, { fillColor: { x: 0.8, y: 0.1, z: 0.1, w: 0.6 } });
            this.plotOverlay.addPlots(bestPlotIndices, { fillColor: { x: 0.1, y: 0.9, z: 0.1, w: 0.6 } });
        }
    }
    updatePreviewRadius(delta) {
        this.previewRadius = Math.max(0, Math.min(this.previewRadius + delta, 5));
        MapTackStore.updateSetting(SETTING_PREVIEW_RADIUS, this.previewRadius);
        // Update UI.
        this.updateHoverPlotOverlay(GameplayMap.getLocationFromIndex(this.lastHoveredPlot));
    }
    getXYOffsetForPill(totalPills) {
        // Modified from building-placement-layer's getXYOffsetForPill function, but only allow 1 row.
        const offsets = [];
        const groupWidth = (totalPills - 1) * YIELD_SPRITE_X_PADDING;
        for (let i = 0; i < totalPills; i++) {
            offsets.push({
                x: (i * YIELD_SPRITE_X_PADDING) - (groupWidth / 2),
                y: YIELD_SPRITE_Y_OFFSET
            });
        }
        return offsets;
    }
    getYieldPillIcon(yieldType) {
        // Modified from building-placement-manager's getYieldPillIcon function.
        let yieldIconPath = "";
        if (yieldType == "YIELD_DIPLOMACY") {
            yieldIconPath = "yield_influence";
        }
        else {
            yieldIconPath = yieldType.toLowerCase();
        }
        yieldIconPath += "_pos-lrg";
        return yieldIconPath;
    }
    selectPlot(plot, _previousPlot) {
        if (this.isPlotProposed) {
            throw new Error("A plot is already being proposed.");
        }
        this.isPlotProposed = true;
        this.proposePlot(plot, () => {
            this.commitPlot(plot);
            Audio.playSound("data-audio-city-production-placement-activate", "city-actions");
            InterfaceMode.switchTo("DMT_INTERFACEMODE_MAP_TACK_CHOOSER");
        }, () => this.isPlotProposed = false);
        return false;
    }
    proposePlot(_plot, accept, reject) {
        if (this.validStatus.preventPlacement) {
            reject();
        }
        else {
            accept();
        }
    }
    commitPlot(plot) {
        const mapTackData = {
            x: plot.x,
            y: plot.y,
            type: this.itemType,
            classType: MapTackUtils.getConstructibleClassType(this.itemType),
            validStatus: this.validStatus,
            yieldDetails: this.yieldDetails
        };
        engine.trigger("AddMapTackRequest", mapTackData);
    }
    handleInput(inputEvent) {
        if (inputEvent.detail.status != InputActionStatuses.FINISH) {
            return true;
        }
        if (inputEvent.isCancelInput() || inputEvent.detail.name == "sys-menu") {
            InterfaceMode.switchTo("DMT_INTERFACEMODE_MAP_TACK_CHOOSER");
            inputEvent.stopPropagation();
            inputEvent.preventDefault();
            return false;
        }
        if (Input.isCtrlDown()) {
            if (inputEvent.detail.name == "mousewheel-down" || inputEvent.detail.name == "mousewheel-up") {
                this.updatePreviewRadius(inputEvent.detail.name == "mousewheel-down" ? -1 : 1);
                inputEvent.stopPropagation();
                inputEvent.preventDefault();
                return false;
            }
        }
        return true;
    }
}
InterfaceMode.addHandler("DMT_INTERFACEMODE_PLACE_MAP_TACKS", new PlaceMapTacksInterfaceMode());