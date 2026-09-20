import HotkeyManager from '/core/ui/input/hotkey-manager.js';
import { InputHandlerState } from '/core/ui/input/input-support.js';
import { InterfaceMode } from '/core/ui/interface-modes/interface-modes.js';

const MAP_TACK_INTERFACE_MODES = ["DMT_INTERFACEMODE_MAP_TACK_CHOOSER", "DMT_INTERFACEMODE_PLACE_MAP_TACKS"];

engine.whenReady.then(() => {
    // Since HotkeyManager is already an instance of a singleton class, can directly override its functions without prototype or instance.
    const prevHandleInput = HotkeyManager.handleInput;

    HotkeyManager.handleInput = function (...args) {
        const [inputEvent] = args;
        const status = inputEvent?.detail?.status;
        if (status == InputActionStatuses.FINISH) {
            const name = inputEvent.detail.name;
            switch (name) {
                case "open-map-tack-panel":
                    if (MAP_TACK_INTERFACE_MODES.includes(InterfaceMode.getCurrent())) {
                        InterfaceMode.switchToDefault();
                    } else {
                        HotkeyManager.sendHotkeyEvent(name);
                    }
                    return InputHandlerState.Handled;
                case "toggle-map-tack-layer":
                    HotkeyManager.sendLayerHotkeyEvent(name);
                    return InputHandlerState.Handled;
            }
        }
        return prevHandleInput.apply(this, args);
    };
});
