import ContextManager from '/core/ui/context-manager/context-manager.js';
import FocusManager from '/core/ui/input/focus-manager.js';

export class DMT_PanelMiniMapDecorator {

    constructor(component) {
        this.component = component;
        this.componentRoot = component.Root;
        this.mapTacksPanelState = false;
    }

    beforeAttach() {
        this.mapTackButton = this.createMinimapMapTacksButton();
        this.component.miniMapButtonRow.appendChild(this.mapTackButton);
    }

    afterAttach() {
    }

    beforeDetach() {
    }

    afterDetach() {
    }

    createMinimapMapTacksButton() {
        const miniMapButton = document.createElement("fxs-activatable");
        miniMapButton.classList.add("mini-map__map-tacks-button", "mx-1");
        miniMapButton.setAttribute('data-tooltip-content', Locale.compose("LOC_MAP_TACKS"));
        miniMapButton.addEventListener('action-activate', () => {
            this.openMapTacksPanel();
            FocusManager.clearFocus(miniMapButton);
        });
        const miniMapBG = document.createElement("div");
        miniMapBG.classList.add('mini-map__map-tacks-button__bg', "pointer-events-none");
        miniMapButton.appendChild(miniMapBG);
        const miniMapButtonIcon = document.createElement("div");
        miniMapButtonIcon.classList.add("mini-map__map-tacks-button__icon", "pointer-events-none");
        miniMapButton.appendChild(miniMapButtonIcon);
        miniMapButton.setAttribute('data-audio-group-ref', 'audio-panel-mini-map');
        miniMapButton.setAttribute('data-audio-press-ref', 'data-audio-minimap-panel-open-press');
        return miniMapButton;
    }

    openMapTacksPanel() {
        console.warn("HZ openMapTacksPanel");
        ContextManager.push("dmt-map-tack-chooser", { singleton: true });
    }
}

Controls.loadStyle("fs://game/detailed-map-tacks/ui/mini-map/dmt-panel-mini-map.css");
Controls.decorate('panel-mini-map', (component) => new DMT_PanelMiniMapDecorator(component));