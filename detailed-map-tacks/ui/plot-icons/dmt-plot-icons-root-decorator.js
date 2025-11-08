
import MapTackIconsManager, { MapTackIconRootUpdateEventName } from './dmt-map-tack-icons-manager.js';
import { MAP_TACK_ELEMENT_NAME } from './dmt-map-tack-icons.js';
import { L as LensManager } from '/core/ui/lenses/lens-manager.chunk.js';

// Reuse plot-icons-root since it's already attached to the root-game.html.
class DMT_PlotIconsRootDecorator {

    constructor(component) {
        this.component = component;
        this.componentRoot = component.Root;
        this.updateMapTackListener = this.onUpdateMapTack.bind(this);
    }

    beforeAttach() {
    }

    afterAttach() {
        this.componentRoot.addEventListener(MapTackIconRootUpdateEventName, this.updateMapTackListener);
        MapTackIconsManager.rootAttached(this.componentRoot);
    }

    beforeDetach() {
        this.componentRoot.removeEventListener(MapTackIconRootUpdateEventName, this.updateMapTackListener);
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
}
Controls.decorate('plot-icons-root', (component) => new DMT_PlotIconsRootDecorator(component));
