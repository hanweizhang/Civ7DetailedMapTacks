import { InputHandlerState } from '/core/ui/input/input-support.js';
import { InterfaceMode } from '/core/ui/interface-modes/interface-modes.js';
import { FocusManager } from '/core/ui-next/services/focus-manager.js';
import LensManager from '/core/ui/lenses/lens-manager.js';
/**
 * Handler for DMT_INTERFACEMODE_MAP_TACK_CHOOSER.
 */
class MapTackChooserInterfaceMode {
    constructor() {
    }
    transitionTo(_oldMode, _newMode, _context) {
        LensManager.setActiveLens("dmt-map-tack-lens");
        WorldUI.setUnitVisibility(false);
        UI.Player.deselectAllUnits();
        UI.Player.deselectAllCities();
    }
    transitionFrom(_oldMode, _newMode) {
        WorldUI.setUnitVisibility(true);
    }
    handleInput(inputEvent) {
        if (inputEvent.detail.status != InputActionStatuses.FINISH) {
            return InputHandlerState.Active;
        }
        if (inputEvent.isCancelInput() || inputEvent.detail.name == 'sys-menu') {
            InterfaceMode.switchToDefault();
            inputEvent.stopPropagation();
            inputEvent.preventDefault();
            return InputHandlerState.Handled;
        }
        // Keep world-map clicks from closing the chooser. Controller/keyboard "accept"
        // must remain active when focus is inside the chooser so fxs-activatable can
        // dispatch its native action-activate event.
        if (inputEvent.detail.name == 'mousebutton-left') {
            inputEvent.stopPropagation();
            inputEvent.preventDefault();
            return InputHandlerState.Handled;
        }
        if (inputEvent.detail.name == 'accept') {
            const currentFocus = FocusManager.get().currentFocus();
            const chooserRoot = document.querySelector('.map-tack-chooser');
            const chooserHasFocus = chooserRoot instanceof HTMLElement
                && currentFocus instanceof HTMLElement
                && chooserRoot.contains(currentFocus);
            if (!chooserHasFocus) {
                inputEvent.stopPropagation();
                inputEvent.preventDefault();
                return InputHandlerState.Handled;
            }
        }
        return InputHandlerState.Active;
    }
}
InterfaceMode.addHandler('DMT_INTERFACEMODE_MAP_TACK_CHOOSER', new MapTackChooserInterfaceMode());
