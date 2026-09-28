import Panel from '/core/ui/panel-support.js';
import { Navigation } from '/core/ui/input/navigation-support.js';
import { FocusManager } from '/core/ui-next/services/focus-manager.js';
import PlotCursor from '/core/ui/input/plot-cursor.js';
import { InterfaceMode, InterfaceModeChangedEventName } from '/core/ui/interface-modes/interface-modes.js';
import { MustGetElement } from '/core/ui/utilities/utilities-dom.js';
import MapTackUIUtils from '../map-tack-core/dmt-map-tack-ui-utils.js';
import MapTackUtils from '../map-tack-core/dmt-map-tack-utils.js';
import { ConstructibleClassType, ExcludedItems, isGamepadDevice, YieldTypes } from '../map-tack-core/dmt-map-tack-constants.js';
import TraitModifier from '../map-tack-core/modifier/dmt-trait-modifier.js';
import MapTackGenerics from '../map-tack-core/dmt-map-tack-generics.js';
import MapTackStore from '../map-tack-core/dmt-map-tack-store.js';
// Cache constructible icons for faster panel load.
Loading.runWhenFinished(() => {
    for (const c of GameInfo.Constructibles) {
        const url = UI.getIconURL(c.ConstructibleType, c.ConstructibleClass);
        Controls.preloadImage(url, 'dmt-map-tack-chooser');
    }
});
class MapTackChooser extends Panel {
    constructor(root) {
        super(root);

        this.uniqueBuildingDefs = [];
        this.uniqueImprovementDefs = [];
        this.agelessBuildingDefs = [];
        this.excludedConstructibles = new Set();
        this.processDummyItems();
        this.processUniqueConstructibles();
        this.processCityCenterBuildings();
        this.processAgelessBuildings();

        this.currentAge = GameInfo.Ages.lookup(Game.age).AgeType;

        // Settings items (TBD)
        this.showYield = false;

        // UI related
        this.interfaceModeChangedListener = this.onInterfaceModeChanged.bind(this);
        this.requestClose = this.onRequestClose.bind(this);
        this.animateInType = this.animateOutType = 5 /* AnchorType.RelativeToLeft */;
        this.enableOpenSound = true;
        this.enableCloseSound = true;
        this.lastFocusedMapTack = null;
        this.engineInputListener = this.onEngineInput.bind(this);
    }
    onInitialize() {
        super.onInitialize();
        this.render();
    }
    render() {
        this.panel = MustGetElement(".map-tack-chooser-panel", this.Root);
        this.sectionList = MustGetElement(".map-tack-chooser-section-list", this.Root);

        // Add items to documentFragment first for better performance.
        const fragment = document.createDocumentFragment();
        this.populateItems(fragment);
        this.sectionList.append(fragment);
    }
    setHidden(hidden) {
        this.panel.classList.toggle("animate-in-left", !hidden);
        this.Root.classList.toggle("hidden", hidden);
    }
    onAttach() {
        super.onAttach();
        window.addEventListener(InterfaceModeChangedEventName, this.interfaceModeChangedListener);
        this.panel.addEventListener('subsystem-frame-close', this.requestClose);
        window.addEventListener('engine-input', this.engineInputListener, true);
        engine.on("input-source-changed", this.onActiveDeviceTypeChanged, this);
    }
    onDetach() {
        window.removeEventListener(InterfaceModeChangedEventName, this.interfaceModeChangedListener);
        this.panel.removeEventListener('subsystem-frame-close', this.requestClose);
        window.removeEventListener('engine-input', this.engineInputListener, true);
        engine.off("input-source-changed", this.onActiveDeviceTypeChanged, this);
        super.onDetach();
    }
    onInterfaceModeChanged() {
        if (InterfaceMode.getCurrent() == "DMT_INTERFACEMODE_MAP_TACK_CHOOSER") {
            this.setHidden(false);
            if (isGamepadDevice()) {
                requestAnimationFrame(() => this.focusMapTackChooser());
            }
        } else {
            const currentFocus = FocusManager.get().currentFocus();
            if (currentFocus instanceof HTMLElement && this.Root.contains(currentFocus)) {
                FocusManager.get().clearFocus(currentFocus);
            }
            this.clearGamepadFocusVisual();
            this.setHidden(true);
        }
    }
    onActiveDeviceTypeChanged(deviceType) {
        if (isGamepadDevice(deviceType)
                && InterfaceMode.getCurrent() == "DMT_INTERFACEMODE_MAP_TACK_CHOOSER") {
            requestAnimationFrame(() => this.focusMapTackChooser());
        }
    }
    onReceiveFocus() {
        super.onReceiveFocus();
        this.focusMapTackChooser();
    }
    focusMapTackChooser() {
        if (!isGamepadDevice()
                || InterfaceMode.getCurrent() != "DMT_INTERFACEMODE_MAP_TACK_CHOOSER") {
            return;
        }
        const currentFocus = FocusManager.get().currentFocus();
        if (currentFocus instanceof HTMLElement && this.Root.contains(currentFocus)) {
            this.setGamepadFocus(currentFocus);
            return;
        }
        if (this.lastFocusedMapTack instanceof HTMLElement
                && this.lastFocusedMapTack.isConnected
                && Navigation.isFocusable(this.lastFocusedMapTack)) {
            this.setGamepadFocus(this.lastFocusedMapTack);
            return;
        }
        const firstFocusable = Navigation.getFirstFocusableElement(this.Root, {
            isDisableFocusAllowed: true,
            direction: InputNavigationAction.NONE,
        });
        if (firstFocusable) {
            this.setGamepadFocus(firstFocusable);
        }
    }
    getMapTackButtons() {
        return Array.from(this.Root.querySelectorAll('.map-tack-icon-wrapper'))
            .filter(element => element instanceof HTMLElement && element.isConnected);
    }
    clearGamepadFocusVisual() {
        for (const element of this.getMapTackButtons()) {
            element.classList.remove('dmt-gamepad-focus');
        }
    }
    setGamepadFocus(element) {
        if (!(element instanceof HTMLElement)) {
            return;
        }
        this.clearGamepadFocusVisual();
        element.classList.add('dmt-gamepad-focus');
        this.lastFocusedMapTack = element;
        FocusManager.get().setFocus(element);
        if (typeof element.scrollIntoView == 'function') {
            try {
                element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
            } catch (_error) {
                element.scrollIntoView();
            }
        }
    }
    moveGamepadFocus(direction) {
        const buttons = this.getMapTackButtons();
        if (buttons.length == 0) {
            return;
        }

        const focused = FocusManager.get().currentFocus();
        let current = focused instanceof HTMLElement && buttons.includes(focused)
            ? focused
            : this.lastFocusedMapTack;
        if (!(current instanceof HTMLElement) || !buttons.includes(current)) {
            this.setGamepadFocus(buttons[0]);
            return;
        }

        const currentRect = current.getBoundingClientRect();
        const currentX = currentRect.left + currentRect.width / 2;
        const currentY = currentRect.top + currentRect.height / 2;
        let best = null;
        let bestScore = Infinity;

        for (const candidate of buttons) {
            if (candidate == current) {
                continue;
            }
            const rect = candidate.getBoundingClientRect();
            const dx = rect.left + rect.width / 2 - currentX;
            const dy = rect.top + rect.height / 2 - currentY;

            let primary = 0;
            let secondary = 0;
            if (direction == 'left' && dx < -1) {
                primary = -dx;
                secondary = Math.abs(dy);
            } else if (direction == 'right' && dx > 1) {
                primary = dx;
                secondary = Math.abs(dy);
            } else if (direction == 'up' && dy < -1) {
                primary = -dy;
                secondary = Math.abs(dx);
            } else if (direction == 'down' && dy > 1) {
                primary = dy;
                secondary = Math.abs(dx);
            } else {
                continue;
            }

            const score = primary + secondary * 4;
            if (score < bestScore) {
                bestScore = score;
                best = candidate;
            }
        }

        if (best) {
            this.setGamepadFocus(best);
        }
    }
    removeMapTackAtCursor() {
        const plot = PlotCursor.plotCursorCoords;
        if (!plot) {
            return false;
        }
        const mapTacks = MapTackStore.retrieveMapTacks(plot.x, plot.y);
        if (mapTacks.length == 0) {
            return false;
        }

        const preferredType = this.lastFocusedMapTack?.getAttribute('data-map-tack-type');
        const target = mapTacks.find(mapTack => mapTack.type == preferredType)
            || mapTacks[mapTacks.length - 1];
        engine.trigger('RemoveMapTackRequest', target);
        return true;
    }
    onEngineInput(inputEvent) {
        if (inputEvent?.detail?.status != InputActionStatuses.FINISH) {
            return;
        }

        const mode = InterfaceMode.getCurrent();
        const isChooser = mode == 'DMT_INTERFACEMODE_MAP_TACK_CHOOSER';
        const isPlacement = mode == 'DMT_INTERFACEMODE_PLACE_MAP_TACKS';
        if (!isChooser && !isPlacement) {
            return;
        }

        const name = inputEvent.detail.name;
        if (isChooser) {
            const directionByAction = {
                'nav-up': 'up',
                'toggle-diplo': 'up',
                'nav-down': 'down',
                'toggle-quest': 'down',
                'nav-left': 'left',
                'toggle-chat': 'left',
                'nav-right': 'right',
                'navigate-yields': 'right',
            };
            const direction = directionByAction[name];
            if (direction) {
                this.moveGamepadFocus(direction);
                inputEvent.preventDefault();
                inputEvent.stopPropagation();
                return;
            }
        }

        if (name == 'notification' || name == 'swap-plot-selection' || name == 'shell-action-1') {
            this.removeMapTackAtCursor();
            inputEvent.preventDefault();
            inputEvent.stopPropagation();
        }
    }
    onRequestClose() {
        super.close();
        InterfaceMode.switchToDefault();
    }
    processDummyItems() {
        for (const item of ExcludedItems) {
            this.excludedConstructibles.add(item);
        }
    }
    processUniqueConstructibles() {
        // Unique buildings
        this.uniqueBuildingDefs = MapTackUtils.getPlayerUniqueBuildings();
        for (const e of GameInfo.Buildings) {
            if (e.TraitType && e.TraitType != "TRAIT_LEADER_MINOR_CIV") {
                this.excludedConstructibles.add(e.ConstructibleType);
            }
        }
        // Unique improvements
        for (const e of GameInfo.Improvements) {
            if (e.TraitType) {
                if (TraitModifier.isTraitActive(e.TraitType)) {
                    this.uniqueImprovementDefs.push(GameInfo.Constructibles.lookup(e.ConstructibleType));
                }
                if (e.TraitType != "TRAIT_LEADER_MINOR_CIV") {
                    this.excludedConstructibles.add(e.ConstructibleType);
                }
            }
        }
    }
    processCityCenterBuildings() {
        for (const e of GameInfo.Constructibles) {
            if (e.ConstructibleClass == ConstructibleClassType.BUILDING) {
                const type = e.ConstructibleType;
                if (MapTackUtils.isCityCenter(type)) {
                    this.excludedConstructibles.add(type);
                }
            }
        }
    }
    processAgelessBuildings() {
        for (const e of GameInfo.Constructibles) {
            if (e.ConstructibleClass == ConstructibleClassType.BUILDING) {
                const type = e.ConstructibleType;
                if (MapTackUtils.isAgeless(type) && !this.excludedConstructibles.has(type)) {
                    // Ageless non-unique items.
                    this.agelessBuildingDefs.push(e);
                }
            }
        }
    }
    sortItems(itemDefs) {
        return itemDefs.sort((a, b) => {
            if (a.ConstructibleClass == ConstructibleClassType.BUILDING && b.ConstructibleClass == ConstructibleClassType.BUILDING) {
                // Put unique buildings at the end
                const aIsUnique = this.uniqueBuildingDefs.some(def => def.ConstructibleType == a.ConstructibleType);
                const bIsUnique = this.uniqueBuildingDefs.some(def => def.ConstructibleType == b.ConstructibleType);
                if (aIsUnique && !bIsUnique) return 1;
                if (!aIsUnique && bIsUnique) return -1;
                // Sort by yield type for buildings.
                const aYieldType = MapTackUtils.getConstructibleDominantYieldType(a.ConstructibleType);
                const bYieldType = MapTackUtils.getConstructibleDominantYieldType(b.ConstructibleType);
                const yieldTypeDiff = YieldTypes.indexOf(aYieldType) - YieldTypes.indexOf(bYieldType);
                if (yieldTypeDiff != 0) {
                    return yieldTypeDiff;
                }
            }
            // Sort by cost by default.
            return a.Cost - b.Cost;
        });
    }
    populateItems(container) {
        // Clear all sections first.
        container.innerHTML = "";
        // Special tacks
        const genericSection = this.createSection("LOC_DMT_SPECIAL_SECTION", this.getGenericsItems());
        container.appendChild(genericSection);
        this.attachDivider(container);
        // Buildings
        const buildingSection = this.createSection("LOC_CONSTRUCTIBLE_CLASS_NAME_BUILDING", this.getBuildingItems());
        container.appendChild(buildingSection);
        this.attachDivider(container);
        // Wonders
        const wonderSection = this.createSection("LOC_CONSTRUCTIBLE_CLASS_NAME_WONDER", this.getWonderItems());
        container.appendChild(wonderSection);
        this.attachDivider(container);
        // Improvements
        const improvementSection = this.createSection("LOC_CONSTRUCTIBLE_CLASS_NAME_IMPROVEMENT", this.getImprovementItems(), true);
        container.appendChild(improvementSection);
    }
    getGenericsItems() {
        const generics = MapTackGenerics.getGenericMapTacks();
        return [generics];
    }
    getBuildingItems() {
        const agelessItems = [...this.agelessBuildingDefs, ...this.uniqueBuildingDefs];
        const buildingDefs = this.getConstructiblesByClassType(ConstructibleClassType.BUILDING);
        // Filter by AGELESS tag as BUILDING_IRONWORKS has itemDef.Age as MODERN.
        const filteredBuildings = buildingDefs.filter(itemDef => !MapTackUtils.isAgeless(itemDef.ConstructibleType));
        return [agelessItems, filteredBuildings];
    }
    getWonderItems() {
        const wonderdingDefs = this.getConstructiblesByClassType(ConstructibleClassType.WONDER);
        return [wonderdingDefs];
    }
    getImprovementItems() {
        const improvementDefs = this.getConstructiblesByClassType(ConstructibleClassType.IMPROVEMENT);
        // Filter out common improvements.
        const filteredImprovements = improvementDefs.filter(def => !MapTackUtils.isCommonImprovement(def.ConstructibleType));
        return [[...this.sortItems(this.uniqueImprovementDefs), ...this.sortItems(filteredImprovements)]]; // Combining into one row with uniques in front.
    }
    getConstructiblesByClassType(classType) {
        const filteredItemDefs = [];
        for (const itemDef of GameInfo.Constructibles) {
            if (classType == itemDef.ConstructibleClass
                    && !this.excludedConstructibles.has(itemDef.ConstructibleType)
                    && !itemDef.ExistingDistrictOnly // Filter out walls.
                    && !(itemDef.Age != null && itemDef.Age != this.currentAge) // Filter out items that don't belong to this age.
                    && !itemDef.Discovery
                    && !itemDef.Archaeology) {
                filteredItemDefs.push(itemDef);
            }
        }
        return filteredItemDefs;
    }
    createSection(titleText, itemLists = [], sorted = false) {
        const sectionContainer = document.createElement("div");
        sectionContainer.classList.add("map-tack-chooser-section", "mb-1");
        // Title
        const title = document.createElement("fxs-header");
        title.setAttribute("title", titleText);
        title.setAttribute("filigree-style", "h4");
        title.classList.add("text-secondary", "uppercase", "font-title-sm");
        sectionContainer.appendChild(title);
        // Items
        for (const items of itemLists) {
            const itemContainer = document.createElement("div");
            itemContainer.classList.add("map-tack-item-container");
            const sortedItems = sorted ? items : this.sortItems(items);
            for (const itemDef of sortedItems) {
                let item;
                if (itemDef.ConstructibleType) {
                    // This is a database item
                    item = this.createItem(itemDef);
                } else if (MapTackGenerics.isGenericMapTack(itemDef.type)) {
                    // This is a generic item
                    item = this.createGenericItem(itemDef);
                }
                if (item != null) {
                    itemContainer.appendChild(item);
                }
            }
            sectionContainer.appendChild(itemContainer);
        }
        return sectionContainer;
    }
    createItem(itemDef) {
        const tooltip = this.createItemTooltip(itemDef.ConstructibleType, itemDef.Name, itemDef.Cost, itemDef.Tooltip);
        return this.createItemUI(itemDef.ConstructibleType, itemDef.ConstructibleClass, tooltip);
    }
    createGenericItem(genericObject) {
        const type = genericObject.type;
        const tooltip = this.createItemTooltip(type, genericObject.name, 0, MapTackGenerics.getTooltipString(type));
        return this.createItemUI(type, genericObject.classType, tooltip);
    }
    createItemTooltip(type, name, cost = 0, subTooltip = null) {
        const container = document.createElement('fxs-tooltip');
        // Header
        const header = document.createElement('div');
        header.className = 'font-title text-secondary text-center uppercase tracking-100';
        header.setAttribute('data-l10n-id', name);
        container.appendChild(header);
        // Production cost
        if (cost > 0) {
            const productionCost = document.createElement('div');
            productionCost.innerHTML = Locale.stylize('LOC_UI_PRODUCTION_COST', cost);
            container.appendChild(productionCost);
        }
        // Description
        if (subTooltip) {
            const desc = document.createElement('div');
            desc.classList.add("mt-1");
            desc.innerHTML = Locale.stylize(subTooltip);
            container.appendChild(desc);
        }
        // Base yield and bonus
        const { baseYield, adjacencies, effects } = MapTackUIUtils.getEffectStrings(type);
        const effectStrings = baseYield ? [baseYield, ...adjacencies, ...effects] : [...adjacencies, ...effects];
        const effectStr = Locale.stylize(effectStrings.map(s => Locale.compose(s)).join('[N]'));
        if (effectStr) {
            this.attachDivider(container);
            const effectContainer = document.createElement('div');
            effectContainer.innerHTML = effectStr;
            container.appendChild(effectContainer);
        }
        return container.innerHTML;
    }
    createItemUI(type, classType, tooltip) {
        const iconWrapper = document.createElement("fxs-activatable");
        iconWrapper.setAttribute("tabindex", "-1");
        iconWrapper.setAttribute("data-map-tack-type", type);
        const iconStyles = MapTackUIUtils.getMapTackIconStyles(type, classType);
        iconWrapper.classList.add("m-1\\.5", "size-12", "map-tack-icon-wrapper", ...iconStyles);
        iconWrapper.setAttribute("data-tooltip-content", tooltip);
        iconWrapper.setAttribute("data-audio-press-ref", "data-audio-select-press");
        iconWrapper.addEventListener('action-activate', () => {
            this.lastFocusedMapTack = iconWrapper;
            this.mapTackClickListener(type);
        });
        const icon = document.createElement('fxs-icon');
        icon.classList.add("size-12");
        icon.style.backgroundImage = MapTackUIUtils.getMapTackIconBgImage(type);
        iconWrapper.appendChild(icon);
        return iconWrapper;
    }
    attachDivider(container) {
        const divider = document.createElement("div");
        divider.classList.add("filigree-divider-inner-frame", "w-full");
        container.appendChild(divider);
    }
    mapTackClickListener(clickedType) {
        InterfaceMode.switchTo("DMT_INTERFACEMODE_PLACE_MAP_TACKS", { type: clickedType });
    }
}
Controls.define('dmt-map-tack-chooser', {
    createInstance: MapTackChooser,
    description: 'Map tack chooser screen.',
    styles: ['fs://game/detailed-map-tacks/ui/map-tack-chooser/dmt-map-tack-chooser.css'],
    content: ['fs://game/detailed-map-tacks/ui/map-tack-chooser/dmt-map-tack-chooser.html'],
    classNames: ['map-tack-chooser'],
    attributes: []
});
