
export const YieldTypes = [
    "YIELD_UNKNOWN",
    "YIELD_FOOD",
    "YIELD_PRODUCTION",
    "YIELD_GOLD",
    "YIELD_SCIENCE",
    "YIELD_CULTURE",
    "YIELD_HAPPINESS",
    "YIELD_DIPLOMACY"
];
export const DirectionNames = new Map([
    [DirectionTypes.DIRECTION_NORTHEAST, "LOC_WORLD_DIRECTION_NORTHEAST"], // 0
    [DirectionTypes.DIRECTION_EAST, "LOC_WORLD_DIRECTION_EAST"], // 1
    [DirectionTypes.DIRECTION_SOUTHEAST, "LOC_WORLD_DIRECTION_SOUTHEAST"], // 2
    [DirectionTypes.DIRECTION_SOUTHWEST, "LOC_WORLD_DIRECTION_SOUTHWEST"], // 3
    [DirectionTypes.DIRECTION_WEST, "LOC_WORLD_DIRECTION_WEST"], // 4
    [DirectionTypes.DIRECTION_NORTHWEST, "LOC_WORLD_DIRECTION_NORTHWEST"], // 5
]);
export const ConstructibleClassType = Object.freeze({
    WONDER: "WONDER",
    BUILDING: "BUILDING",
    IMPROVEMENT: "IMPROVEMENT"
});
export const QuarterType = {
    NO_QUARTER: 0,
    NORMAL_QUARTER: 1,
    GENERIC_UNIQUE_QUARTER: 2,
    // More to be added in populateQuarterTypes
};
export const ExcludedItems = new Set();

/**
 * Whether the given device type (defaults to the active one) drives gamepad focus navigation.
 * Hybrid covers handhelds such as the Steam Deck, which the game pairs with Controller.
 */
export function isGamepadDevice(deviceType = Input.getActiveDeviceType()) {
    return deviceType == InputDeviceType.Controller || deviceType == InputDeviceType.Hybrid;
}

function populateQuarterTypes() {
    let index = Object.keys(QuarterType).length;
    for (const itemRef of GameInfo.UniqueQuarters) {
        QuarterType[itemRef.UniqueQuarterType] = index;
        index++;
    }
}
function populateExcludedItems() {
    // Exclude dummy entries that won't even show up in Civilopedia.
    for (const e of GameInfo.CivilopediaPageExcludes) {
        ExcludedItems.add(e.PageID);
    }
}
engine.whenReady.then(() => {
    populateQuarterTypes();
    populateExcludedItems();
});