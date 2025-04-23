// eslint.config.js
import js from "@eslint/js";
import globals from "globals";

export default [
    js.configs.recommended,
    {
        rules: {
            "no-unused-vars": [
                "warn",
                {
                    "varsIgnorePattern": "^_",
                    "argsIgnorePattern": "^_",
                }
            ],
            "no-undef": "error",
            "no-console": "warn",
            "semi": ["error", "always"],
            "no-trailing-spaces": "error"
        },
        languageOptions: {
            globals: {
                ...globals.browser,
                Camera: "readonly",
                Color: "readonly",
                Component: "readonly",
                Configuration: "readonly",
                Constructibles: "readonly",
                Controls: "readonly",
                CustomEvent: "readonly",
                Database: "readonly",
                DirectionTypes: "readonly",
                Districts: "readonly",
                DistrictTypes: "readonly",
                Event: "readonly",
                FeatureTypes: "readonly",
                Game: "readonly",
                GameContext: "readonly",
                GameInfo: "readonly",
                GameplayMap: "readonly",
                Input: "readonly",
                InputActionStatuses: "readonly",
                InputContext: "readonly",
                Loading: "readonly",
                Locale: "readonly",
                MapConstructibles: "readonly",
                PlayerIds: "readonly",
                Players: "readonly",
                ProgressionTreeNodeState: "readonly",
                ResourceTypes: "readonly",
                RevealedStates: "readonly",
                RiverTypes: "readonly",
                UI: "readonly",
                UIHTMLCursorTypes: "readonly",
                Units: "readonly",
                WorldAnchors: "readonly",
                WorldUI: "readonly",
                console: "readonly",
                document: "readonly",
                engine: "readonly",
                window: "readonly",
                waitForLayout: "readonly",
            }
        }

    }
];
