// Taken from utilities-core-textprovider.chunk.js
function getConstructibleEffectStrings(constructible, city = null) {
  let baseYield;
  const baseYieldStrings = [];
  GameInfo.Constructible_YieldChanges.forEach((element) => {
    if (element.ConstructibleType == constructible) {
      const s = parseConstructibleYield(element);
      if (s) {
        baseYieldStrings.push(s);
      }
    }
  });
  if (baseYieldStrings.length > 0) {
    baseYield = Locale.compose("LOC_UI_PRODUCTION_BASE_YIELD", baseYieldStrings.join(" "));
  }
  const adjacencies = [];
  const adjacenciesChangeDef = [];
  for (const element of GameInfo.Constructible_Adjacencies) {
    if (element.ConstructibleType == constructible) {
      const yieldChangeDef = GameInfo.Adjacency_YieldChanges.find((o) => o.ID == element.YieldChangeId);
      if (yieldChangeDef) {
        if (element.RequiresActivation) {
          if (!city) {
            continue;
          }
          if (!city.Constructibles) {
            continue;
          }
          if (!city.Constructibles.isAdjacencyUnlocked(yieldChangeDef.ID)) {
            continue;
          }
        }
        adjacenciesChangeDef.push(yieldChangeDef);
      }
    }
  }
  for (const yieldDefinition of GameInfo.Yields) {
    const perTypeChangeMap = /* @__PURE__ */ new Map();
    for (const changeDefinition of adjacenciesChangeDef) {
      if (changeDefinition.YieldType == yieldDefinition.YieldType) {
        const entries = perTypeChangeMap.get(changeDefinition.YieldChange);
        if (entries) {
          entries.push(changeDefinition);
        } else {
          const newArray = [changeDefinition];
          perTypeChangeMap.set(changeDefinition.YieldChange, newArray);
        }
      }
    }
    for (const [value, definitions] of perTypeChangeMap) {
      adjacencies.push(Locale.compose("LOC_UI_ADJACENCY_INFO_GENERIC", value, yieldDefinition.YieldType));
      const listOfItems = `[BLIST]${definitions.map((changeDefinition) => `[LI] ${parseConstructibleAdjacencyNameOnly(changeDefinition)}`).join("")}[/BLIST]`;
      adjacencies.push(listOfItems);
    }
  }
  const effects = [];
  GameInfo.ConstructibleModifiers.forEach((element) => {
    if (element.ConstructibleType == constructible) {
      const s = getModifierTextByContext(element.ModifierId, "Description");
      if (s) {
        effects.push(s);
      }
    }
  });
  const buildingDef = GameInfo.Buildings.lookup(constructible);
  if (buildingDef) {
    if (buildingDef.Movable) {
      adjacencies.push(Locale.compose("LOC_UI_CONSTRUCTIBLE_MOVABLE_DESC"));
    }
  }
  return {
    baseYield,
    adjacencies,
    effects
  };
}
function parseConstructibleYield(def) {
  const yieldInfo = GameInfo.Yields.lookup(def.YieldType);
  if (!yieldInfo) {
    return "[ERR] Invalid YieldType";
  }
  const result = Locale.compose("LOC_UI_POS_YIELD", def.YieldChange, yieldInfo.Name);
  return result;
}
function parseConstructibleAdjacency(def) {
  const amount = def.YieldChange;
  const yieldName = GameInfo.Yields.lookup(def.YieldType).Name;
  let result = "";
  if (amount == 0) {
    return result;
  }
  if (def.AdjacentTerrain) {
    const terrainName = GameInfo.Terrains.lookup(def.AdjacentTerrain)?.Name;
    if (terrainName) {
      result = Locale.compose("LOC_UI_ADJACENCY_INFO_TERRAIN", amount, yieldName, terrainName);
    }
  } else if (def.AdjacentBiome) {
    const biomeName = GameInfo.Biomes.lookup(def.AdjacentBiome)?.Name;
    if (biomeName) {
      result = Locale.compose("LOC_UI_ADJACENCY_INFO_BIOME", amount, yieldName, biomeName);
    }
  } else if (def.AdjacentFeature) {
    const featureName = GameInfo.Features.lookup(def.AdjacentFeature)?.Name;
    if (featureName) {
      result = Locale.compose("LOC_UI_ADJACENCY_INFO_FEATURE", amount, yieldName, featureName);
    }
  } else if (def.AdjacentFeatureClass) {
    const featureClassAdj = GameInfo.FeatureClasses.lookup(def.AdjacentFeatureClass)?.Adjective;
    if (featureClassAdj) {
      result = Locale.compose("LOC_UI_ADJACENCY_INFO_FEATURE", amount, yieldName, featureClassAdj);
    }
  } else if (def.AdjacentDistrict) {
    if (def.AdjacentDistrict == "DISTRICT_WONDER") {
      result = Locale.compose("LOC_UI_ADJACENCY_INFO_WONDERS", amount, yieldName);
    } else {
      const districtName = GameInfo.Districts.lookup(def.AdjacentDistrict)?.Name;
      if (districtName) {
        result = Locale.compose("LOC_UI_ADJACENCY_INFO_DISTRICT", amount, yieldName, districtName);
      }
    }
  } else if (def.AdjacentConstructible) {
    const objectName = GameInfo.Constructibles.lookup(def.AdjacentConstructible)?.Name;
    if (objectName) {
      result = Locale.compose("LOC_UI_ADJACENCY_INFO_OBJECT", amount, yieldName, objectName);
    }
  } else if (def.AdjacentConstructibleTag) {
    result = Locale.compose(
      "LOC_UI_ADJACENCY_INFO_CONSTRUCTIBLE_TAG",
      amount,
      yieldName,
      "LOC_TAG_CONSTRUCTIBLE_" + def.AdjacentConstructibleTag
    );
  } else if (def.AdjacentNavigableRiver) {
    result = Locale.compose("LOC_UI_ADJACENCY_INFO_OBJECT", amount, yieldName, "LOC_NAVIGABLE_RIVER_NAME");
  } else if (def.AdjacentNaturalWonder) {
    result = Locale.compose("LOC_UI_ADJACENCY_INFO_NATURAL_WONDER", amount, yieldName);
  } else if (def.AdjacentUniqueQuarter) {
    if (def.AdjacentUniqueQuarterType) {
      const quarterName = GameInfo.UniqueQuarters.lookup(def.AdjacentUniqueQuarterType)?.Name;
      if (quarterName) {
        result = Locale.compose("LOC_UI_ADJACENCY_INFO_OBJECT", amount, yieldName, quarterName);
      }
    } else {
      result = Locale.compose("LOC_UI_ADJACENCY_INFO_UNIQUE_QUARTERS", amount, yieldName);
    }
  } else if (def.AdjacentQuarter) {
    result = Locale.compose("LOC_UI_ADJACENCY_INFO_QUARTERS", amount, yieldName);
  } else if (def.AdjacentResource) {
    result = Locale.compose("LOC_UI_ADJACENCY_INFO_RESOURCES", amount, yieldName);
  } else if (def.AdjacentRiver) {
    result = Locale.compose("LOC_UI_ADJACENCY_INFO_RIVERS", amount, yieldName);
  } else if (def.AdjacentLake) {
    result = Locale.compose("LOC_UI_ADJACENCY_INFO_LAKE", amount, yieldName);
  } else {
    console.warn(
      `utilities-core-textprovider: parseConstructibleAdjacency: Failed to display a non-zero adjacency bonus with id ${def.ID}!`
    );
  }
  return result;
}
function parseConstructibleAdjacencyNameOnly(def) {
  const amount = def.YieldChange;
  let result = "";
  if (amount == 0) {
    return result;
  }
  if (def.AdjacentTerrain) {
    const terrainName = GameInfo.Terrains.lookup(def.AdjacentTerrain)?.Name;
    if (terrainName) {
      result = Locale.compose("LOC_UI_ADJACENCY_INFO_TERRAIN_SHORT", terrainName);
    }
  } else if (def.AdjacentBiome) {
    const biomeName = GameInfo.Biomes.lookup(def.AdjacentBiome)?.Name;
    if (biomeName) {
      result = Locale.compose("LOC_UI_ADJACENCY_INFO_BIOME_SHORT", biomeName);
    }
  } else if (def.AdjacentFeature) {
    const featureName = GameInfo.Features.lookup(def.AdjacentFeature)?.Name;
    if (featureName) {
      result = featureName;
    }
  } else if (def.AdjacentFeatureClass) {
    const featureClassAdj = GameInfo.FeatureClasses.lookup(def.AdjacentFeatureClass)?.Adjective;
    if (featureClassAdj) {
      result = Locale.compose("LOC_UI_ADJACENCY_INFO_FEATURE_SHORT", featureClassAdj);
    }
  } else if (def.AdjacentDistrict) {
    if (def.AdjacentDistrict == "DISTRICT_WONDER") {
      result = "LOC_DISTRICT_WONDER_NAME";
    } else if (def.AdjacentDistrict == "DISTRICT_RURAL") {
      result = "LOC_CONSTRUCTIBLE_CLASS_NAME_IMPROVEMENT";
    } else {
      const districtName = GameInfo.Districts.lookup(def.AdjacentDistrict)?.Name;
      if (districtName) {
        result = Locale.compose("LOC_UI_ADJACENCY_INFO_DISTRICT_SHORT", districtName);
      }
    }
  } else if (def.AdjacentConstructible) {
    const objectName = GameInfo.Constructibles.lookup(def.AdjacentConstructible)?.Name;
    if (objectName) {
      result = objectName;
    }
  } else if (def.AdjacentConstructibleTag) {
    result = Locale.compose(
      "LOC_UI_ADJACENCY_INFO_CONSTRUCTIBLE_SHORT",
      "LOC_TAG_CONSTRUCTIBLE_" + def.AdjacentConstructibleTag
    );
  } else if (def.AdjacentNavigableRiver) {
    result = "LOC_NAVIGABLE_RIVER_NAME";
  } else if (def.AdjacentNaturalWonder) {
    result = "LOC_PLOT_TOOLTIP_NATURAL_WONDER";
  } else if (def.AdjacentUniqueQuarter) {
    if (def.AdjacentUniqueQuarterType) {
      const quarterName = GameInfo.UniqueQuarters.lookup(def.AdjacentUniqueQuarterType)?.Name;
      if (quarterName) {
        result = quarterName;
      }
    } else {
      result = "LOC_PLOT_TOOLTIP_UNIQUE_QUARTER";
    }
  } else if (def.AdjacentQuarter) {
    result = "LOC_PLOT_TOOLTIP_QUARTER";
  } else if (def.AdjacentResource) {
    result = "LOC_PLOT_TOOLTIP_RESOURCE";
  } else if (def.AdjacentRiver) {
    result = "LOC_PLOT_TOOLTIP_RIVER";
  } else if (def.AdjacentLake) {
    result = "LOC_PLOT_TOOLTIP_LAKE";
  } else {
    console.warn(
      `utilities-core-textprovider: parseConstructibleAdjacencyNameOnly: Failed to display a non-zero adjacency bonus with id ${def.ID}!`
    );
  }
  return Locale.compose(result);
}
function getModifierTextByContext(modifierId, context) {
  const modifierStringInfo = GameInfo.ModifierStrings.find((o) => o.ModifierId == modifierId && o.Context == context);
  return modifierStringInfo ? modifierStringInfo.Text : "";
}
export { getConstructibleEffectStrings as d, parseConstructibleAdjacency as p};
