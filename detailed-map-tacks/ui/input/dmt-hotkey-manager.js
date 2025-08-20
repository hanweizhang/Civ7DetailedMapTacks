import HotkeyManager from '/core/ui/input/hotkey-manager.chunk.js';

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
                    HotkeyManager.sendHotkeyEvent(name);
                    return false;
                case "toggle-map-tack-layer":
                    HotkeyManager.sendLayerHotkeyEvent(name);
                    return false;
            }
        }
        return prevHandleInput.apply(this, args);
    };
});
