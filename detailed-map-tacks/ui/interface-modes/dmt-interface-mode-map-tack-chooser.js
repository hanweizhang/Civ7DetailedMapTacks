import { InterfaceMode } from '/core/ui/interface-modes/interface-modes.js';
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
            return true;
        }
        if (inputEvent.isCancelInput() || inputEvent.detail.name == 'sys-menu') {
            InterfaceMode.switchToDefault();
            inputEvent.stopPropagation();
            inputEvent.preventDefault();
            return false;
        }
        // Block mouse-left in plot click to exit.
        if (inputEvent.detail.name == 'mousebutton-left' || inputEvent.detail.name == 'accept') {
            inputEvent.stopPropagation();
            inputEvent.preventDefault();
            return false;
        }
        return true;
    }
}
InterfaceMode.addHandler('DMT_INTERFACEMODE_MAP_TACK_CHOOSER', new MapTackChooserInterfaceMode());