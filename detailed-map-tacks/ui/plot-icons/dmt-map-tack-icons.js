// Modified from plot-icons.js. Not using as is because we want to show map tacks on hidden plots too.
import { InterfaceMode } from '/core/ui/interface-modes/interface-modes.js';
import MapTackIconsManager from './dmt-map-tack-icons-manager.js';
import MapTackUIUtils from '../map-tack-core/dmt-map-tack-ui-utils.js';
import MapTackUtils from '../map-tack-core/dmt-map-tack-utils.js';
import { OVERLAY_PRIORITY } from '/base-standard/ui/utilities/utilities-overlay.js';

class MapTackIcons extends Component {
    constructor() {
        super(...arguments);
        this.worldAnchorHandle = null;
        this.location = { x: -1, y: -1 };
        this.showOverlayTimeout = null;
    }
    get mapTackList() {
        const mapTackListAttribute = this.Root.getAttribute("map-tack-list");
        if (mapTackListAttribute) {
            return JSON.parse(mapTackListAttribute);
        }
        else {
            return [];
        }
    }
    onAttach() {
        super.onAttach();

        this.mapTackContainer = document.createElement("div");
        this.mapTackContainer.classList.add("map-tack-icon-container");
        this.Root.appendChild(this.mapTackContainer);

        this.location = {
            x: parseInt(this.Root.getAttribute('x') ?? '-1'),
            y: parseInt(this.Root.getAttribute('y') ?? '-1'),
        };
        if (MapTackIconsManager) {
            MapTackIconsManager.addStackForTracking(this);
        }
    }
    onDetach() {
        if (MapTackIconsManager) {
            MapTackIconsManager.removeStackForTracking(this);
        }
        this.destroyWorldAnchor();
        super.onDetach();
    }
    makeWorldAnchor(location, numOfIcons) {
        if (this.worldAnchorHandle !== null) {
            this.destroyWorldAnchor();
        }
        if (numOfIcons > 0) {
            this.worldAnchorHandle = WorldAnchors.RegisterFixedWorldAnchor(location, { x: 0, y: 0, z: 20 });
            if (this.worldAnchorHandle !== null && this.worldAnchorHandle >= 0) {
                this.Root.setAttribute('data-bind-style-transform2d', `{{FixedWorldAnchors.offsetTransforms[${this.worldAnchorHandle}].value}}`);
                this.Root.setAttribute('data-bind-style-opacity', `{{FixedWorldAnchors.visibleValues[${this.worldAnchorHandle}]}}`);
            }
        }
    }
    destroyWorldAnchor() {
        if (this.worldAnchorHandle !== null) {
            this.Root.removeAttribute('data-bind-style-transform2d');
            this.Root.removeAttribute('data-bind-style-opacity');
            WorldAnchors.UnregisterFixedWorldAnchor(this.worldAnchorHandle);
            this.worldAnchorHandle = null;
        }
    }
    updateData() {
        this.mapTackContainer.innerHTML = "";
        const mapTackList = this.mapTackList;
        for (let mapTackData of mapTackList) {
            const item = this.createItem(mapTackData);
            this.mapTackContainer.appendChild(item);
        }
        this.makeWorldAnchor(this.location, mapTackList.length);
    }
    createItem(mapTackData) {
        const iconContainer = document.createElement("div");
        iconContainer.classList.add("mx-0\\.5");

        const iconWrapper = document.createElement("fxs-activatable");
        const iconStyles = MapTackUIUtils.getMapTackIconStyles(mapTackData.type, mapTackData.classType);
        iconWrapper.classList.add("size-10", "map-tack-icon-wrapper", ...iconStyles);
        iconWrapper.setAttribute("data-tooltip-content", this.createItemTooltip(mapTackData.type));
        iconWrapper.setAttribute("data-audio-press-ref", "data-audio-select-press");
        iconWrapper.addEventListener("action-activate", () => this.mapTackClickListener(mapTackData));
        if (MapTackUtils.isCityCenter(mapTackData.type)) {
            this.clearBorderOverlayGroup = WorldUI.createOverlayGroup("ClearCityCenterBorderOverlayGroup", OVERLAY_PRIORITY.CULTURE_BORDER);
            iconWrapper.addEventListener("mouseenter", () => this.mouseEnterListener());
            iconWrapper.addEventListener("mouseleave", () => this.mouseLeaveListener());
        }
        // Icon
        const icon = document.createElement("fxs-icon");
        icon.classList.add("size-10");
        icon.style.backgroundImage = MapTackUIUtils.getMapTackIconBgImage(mapTackData.type);
        iconWrapper.appendChild(icon);
        // Invalid status
        const validStatus = mapTackData.validStatus;
        if (validStatus && !validStatus.isValid) {
            const invalidIcon = document.createElement("fxs-activatable");
            invalidIcon.classList.add("map-tack-icon-warn", "size-5", "pointer-events-none");
            invalidIcon.setAttribute("data-tooltip-content", this.createInvalidTooltip(validStatus.reasons));
            iconWrapper.appendChild(invalidIcon);
        }
        iconContainer.appendChild(iconWrapper);
        // Yields
        const yieldDetails = mapTackData.yieldDetails;
        const totalYieldStr = MapTackUIUtils.getTotalYieldString(yieldDetails, true);
        if (totalYieldStr) {
            const yields = document.createElement("fxs-activatable");
            yields.classList.add("map-tack-icon-yields", "pointer-events-none");
            yields.setAttribute("data-tooltip-content", this.createYieldTooltip(mapTackData));
            yields.innerHTML = Locale.stylize(totalYieldStr);
            iconContainer.appendChild(yields);
        }

        return iconContainer;
    }
    createItemTooltip(type) {
        const name = MapTackUIUtils.getMapTackName(type);
        const tooltip = MapTackUIUtils.getMapTackTooltip(type);
        const container = document.createElement('fxs-tooltip');
        // Header
        const header = document.createElement('div');
        header.className = 'font-title text-secondary text-center uppercase tracking-100';
        header.setAttribute('data-l10n-id', name);
        container.appendChild(header);
        // Description
        if (tooltip) {
            const desc = document.createElement('div');
            desc.classList.add("mt-1");
            desc.innerHTML = Locale.stylize(tooltip);
            container.appendChild(desc);
        }
        return container.innerHTML;
    }
    createInvalidTooltip(invalidReasons) {
        if (!invalidReasons) {
            return "";
        }
        const invalidStr = invalidReasons.map(r => `[LI] ${Locale.compose(r)}`).join("");
        return Locale.stylize(`[BLIST]${invalidStr}[/LIST]`);
    }
    createYieldTooltip(mapTackData) {
        return MapTackUIUtils.getYieldFragment(mapTackData.yieldDetails).innerHTML;
    }
    mouseEnterListener() {
        clearTimeout(this.showOverlayTimeout);
        this.showOverlayTimeout = setTimeout(() => {
            if (this.clearBorderOverlayGroup) {
                this.clearBorderOverlayGroup.clearAll();
                const cityPlotIndices = GameplayMap.getPlotIndicesInRadius(this.location.x, this.location.y, 3);
                const clearBorderOverlay = this.clearBorderOverlayGroup?.addBorderOverlay({
                    style: "CommanderRadius",
                    primaryColor: Color.convertToLinear([255, 255, 255, 255])
                });
                clearBorderOverlay.setPlotGroups(cityPlotIndices, 0);
            }
        }, Configuration.getUser().tooltipDelay);
    }
    mouseLeaveListener() {
        clearTimeout(this.showOverlayTimeout);
        this.clearBorderOverlayGroup?.clearAll();
    }
    mapTackClickListener(mapTackData) {
        if (InterfaceMode.getCurrent() == "DMT_INTERFACEMODE_MAP_TACK_CHOOSER") {
            // If the chooser is open, delete the tack.
            engine.trigger("RemoveMapTackRequest", mapTackData);
        } else {
            // TODO: Come up with a better quicker deletion solution.
        }
    }
    onAttributeChanged(name, _oldValue, _newValue) {
        switch (name) {
            case "map-tack-list":
                this.updateData();
                break;
        }
    }
}
export const MAP_TACK_ELEMENT_NAME = "dmt-map-tack-icons";
Controls.define(MAP_TACK_ELEMENT_NAME, {
    createInstance: MapTackIcons,
    description: 'MapTack Icons',
    styles: ['fs://game/detailed-map-tacks/ui/plot-icons/dmt-map-tack-icons.css'],
    classNames: ['allowCameraMovement'],
    attributes: [{
        name: "map-tack-list",
        description: "List of map tack objects to display."
    }]
});
export { MapTackIcons as default };

