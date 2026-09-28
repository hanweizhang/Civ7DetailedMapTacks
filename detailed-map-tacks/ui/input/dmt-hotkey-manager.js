import HotkeyManager from '/core/ui/input/hotkey-manager.js';
import { InputHandlerState } from '/core/ui/input/input-support.js';
import { InterfaceMode } from '/core/ui/interface-modes/interface-modes.js';
import { isGamepadDevice } from '../map-tack-core/dmt-map-tack-constants.js';

const MAP_TACK_INTERFACE_MODES = ["DMT_INTERFACEMODE_MAP_TACK_CHOOSER", "DMT_INTERFACEMODE_PLACE_MAP_TACKS"];
const L3_TAP_MAX_MS = 350;
let l3PressedAt = 0;

function onControllerShortcutInput(inputEvent) {
    if (inputEvent?.detail?.name != "toggle-tooltip") {
        return;
    }
    // toggle-tooltip can also be bound on keyboard/mouse, so only claim it from a gamepad.
    // Checked before the press is recorded so non-gamepad input never arms the tap timer.
    if (!isGamepadDevice()) {
        return;
    }

    const status = inputEvent.detail.status;
    if (status == InputActionStatuses.START) {
        l3PressedAt = Date.now();
        return;
    }
    if (status != InputActionStatuses.FINISH || l3PressedAt == 0) {
        return;
    }

    const heldMs = Date.now() - l3PressedAt;
    l3PressedAt = 0;

    // Preserve the native hold-L3 tooltip behavior. Only a quick click is DMT.
    if (heldMs > L3_TAP_MAX_MS) {
        return;
    }

    if (MAP_TACK_INTERFACE_MODES.includes(InterfaceMode.getCurrent())) {
        InterfaceMode.switchToDefault();
    } else {
        HotkeyManager.sendHotkeyEvent("open-map-tack-panel");
    }

    inputEvent.preventDefault();
    inputEvent.stopPropagation();
}

// Capture phase lets DMT consume a quick L3 release before the native tooltip
// handler sees it, while a long press is allowed through unchanged.
window.addEventListener("engine-input", onControllerShortcutInput, true);

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
