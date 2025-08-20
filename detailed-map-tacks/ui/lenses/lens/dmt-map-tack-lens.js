
import { L as LensManager } from '/core/ui/lenses/lens-manager.chunk.js';
class MapTackLens {
    constructor() {
        this.activeLayers = new Set([
            'fxs-hexgrid-layer',
            'fxs-resource-layer',
            'fxs-city-borders-layer',
            'fxs-yields-layer',
            'dmt-map-tack-layer'
        ]);
        this.allowedLayers = new Set([
        ]);
    }
}
LensManager.registerLens('dmt-map-tack-lens', new MapTackLens());
