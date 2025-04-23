
import ViewManager, { UISystem } from '/core/ui/views/view-manager.js';
export class MapTackPlacementView {
    constructor() {
        // Attach the template to the body.
        const template = document.createElement("template");
        template.classList.add("map-tack-placement");
        template.innerHTML = `
            <fxs-slot name="top-left" class="top left">
                <dmt-map-tack-chooser></dmt-map-tack-chooser>
                <dmt-panel-place-map-tack></dmt-panel-place-map-tack>
            </fxs-slot>
            <fxs-slot name="top-center" class="top center">
                <div class="relative flex w-screen gradient-top-bar">
                    <panel-yield-banner></panel-yield-banner>
                </div>
            </fxs-slot>
            <fxs-slot name="top-right" class="top right" data-tooltip-alignment="bottom-left"></fxs-slot>
            <fxs-slot name="middle-left" class="middle left"></fxs-slot>
            <fxs-slot name="middle-center" class="middle center"></fxs-slot>
            <fxs-slot name="middle-right" class="middle right" data-tooltip-alignment="bottom-left"></fxs-slot>
            <fxs-slot name="bottom-left" class="bottom left" data-tooltip-alignment="top-right"></fxs-slot>
            <fxs-slot name="bottom-center" class="bottom center" data-tooltip-alignment="top-right"></fxs-slot>
            <fxs-slot name="bottom-right" class="bottom right" data-tooltip-alignment="top-left"></fxs-slot>
        `;
        document.body.appendChild(template);
    }
    getName() { return "MapTackPlacement"; }
    getInputContext() { return InputContext.World; }
    getHarnessTemplate() { return "map-tack-placement"; }
    enterView() {
    }
    exitView() {
    }
    addEnterCallback(_func) {
    }
    addExitCallback(_func) {
    }
    getRules() {
        return [
            { name: "harness", type: UISystem.HUD, visible: "true" },
            { name: "city-banners", type: UISystem.World, visible: "false" },
            { name: "district-health-bars", type: UISystem.World, visible: "false" },
            { name: "plot-icons", type: UISystem.World, visible: "true" },
            { name: "plot-tooltips", type: UISystem.World, visible: "true" },
            { name: "plot-vfx", type: UISystem.World, visible: "true" },
            { name: "unit-flags", type: UISystem.World, visible: "false" },
            { name: "small-narratives", type: UISystem.World, visible: "false" }
        ];
    }
}
ViewManager.addHandler(new MapTackPlacementView());