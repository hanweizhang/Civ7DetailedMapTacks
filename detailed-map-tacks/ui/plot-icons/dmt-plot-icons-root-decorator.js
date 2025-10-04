
import MapTackIconsManager, { MapTackIconRootUpdateEventName } from './dmt-map-tack-icons-manager.js';
import { MAP_TACK_ELEMENT_NAME } from './dmt-map-tack-icons.js';
import { L as LensManager } from '/core/ui/lenses/lens-manager.chunk.js';

// Reuse plot-icons-root since it's already attached to the root-game.html.
class DMT_PlotIconsRootDecorator {

    constructor(component) {
        this.component = component;
        this.componentRoot = component.Root;
        this.updateMapTackListener = this.onUpdateMapTack.bind(this);
        this.globalHidden = false;
        this.globalHideListener = this.onGlobalHide.bind(this);
        this.globalShowListener = this.onGlobalShow.bind(this);
    }

    beforeAttach() {
    }

    afterAttach() {
        this.componentRoot.addEventListener(MapTackIconRootUpdateEventName, this.updateMapTackListener);
        window.addEventListener("ui-hide-map-tack-icons", this.globalHideListener);
        window.addEventListener("ui-show-map-tack-icons", this.globalShowListener);
        MapTackIconsManager.rootAttached(this.componentRoot);
    }

    beforeDetach() {
        this.componentRoot.removeEventListener(MapTackIconRootUpdateEventName, this.updateMapTackListener);
        window.removeEventListener("ui-hide-map-tack-icons", this.globalHideListener);
        window.removeEventListener("ui-show-map-tack-icons", this.globalShowListener);
    }

    afterDetach() {
    }
    // Create the MapTack icon on the desired root
    updateIcon(mapTackStruct, isLayerEnabled) {
        const mapTackIcon = MapTackIconsManager.getMapTackIcon(mapTackStruct.x, mapTackStruct.y);
        let mapTackIconRoot = mapTackIcon?.Root;
        if (mapTackIconRoot == undefined) {
            mapTackIconRoot = document.createElement(MAP_TACK_ELEMENT_NAME);
            mapTackIconRoot.setAttribute('x', mapTackStruct.x.toFixed(0));
            mapTackIconRoot.setAttribute('y', mapTackStruct.y.toFixed(0));
            this.componentRoot.appendChild(mapTackIconRoot);
        }
        mapTackIconRoot.setAttribute('map-tack-list', JSON.stringify(mapTackStruct.mapTackList));
        mapTackIconRoot.style.display = !isLayerEnabled ? 'none' : '';
    }
    removeIcon(mapTackStruct) {
        const mapTackIcon = MapTackIconsManager.getMapTackIcon(mapTackStruct.x, mapTackStruct.y);
        const mapTackIconRoot = mapTackIcon?.Root;
        if (mapTackIconRoot) {
            mapTackIconRoot.parentElement?.removeChild(mapTackIconRoot);
        }
    }
    onUpdateMapTack(event) {
        const mapTackStructList = event.detail.mapTackStructList;
        const isLayerEnabled = LensManager.isLayerEnabled("dmt-map-tack-layer");
        for (const mapTackStruct of mapTackStructList) {
            if (mapTackStruct.mapTackList && mapTackStruct.mapTackList.length > 0) {
                // Have map tacks on this plot, update.
                this.updateIcon(mapTackStruct, isLayerEnabled);
            } else {
                // No map tack on this plot, remove.
                this.removeIcon(mapTackStruct);
            }
        }
    }
    onGlobalHide() {
        const mapTackIconRoots = this.componentRoot.querySelectorAll(MAP_TACK_ELEMENT_NAME);
        mapTackIconRoots.forEach((mapTackIconRoot) => {
            mapTackIconRoot.style.display = 'none';
        });
        this.globalHidden = true;
    }
    onGlobalShow() {
        const mapTackIconRoots = this.componentRoot.querySelectorAll(MAP_TACK_ELEMENT_NAME);
        mapTackIconRoots.forEach((mapTackIconRoot) => {
            mapTackIconRoot.style.display = '';
        });
        this.globalHidden = false;
    }
}
Controls.decorate('plot-icons-root', (component) => new DMT_PlotIconsRootDecorator(component));