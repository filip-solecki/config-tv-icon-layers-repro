// Derives the three checks from out/result.json. Both the report ./repro.sh prints and the
// tests read them from here, so "distinct" means one thing in this repo.
import {existsSync, readFileSync} from "node:fs";
import path from "node:path";

const RESULT = path.join(import.meta.dirname, "..", "out", "result.json");
const ICON_NAMES = ["App Icon - Small", "App Icon - Large"];
const LAYER_NAMES = ["Front", "Middle", "Back"];

// actool composites the large icon for the App Store under the "marketing" idiom, where it
// forces an alpha channel onto every layer except Back. One source image therefore still
// produces two different digests there, so the flat check only compares the small icon, whose
// "tv" renditions follow the source. Measured, not assumed: see the README.
export const IDENTICAL_DIGEST_ICONS = ["App Icon - Small"];

export function loadResult() {
    if (!existsSync(RESULT)) {
        console.error("out/result.json is missing. Run ./repro.sh first.");
        process.exit(1);
    }
    return JSON.parse(readFileSync(RESULT, "utf8"));
}

/** How many different values a layer -> value map holds, alongside the map itself. */
const spread = (byLayer) => ({
    layers: Object.keys(byLayer),
    values: byLayer,
    unique: new Set(Object.values(byLayer)).size,
});

/**
 * Check 1: one row per app icon, mapping each layer to the files it references in the
 * generated catalog.
 */
export function layerArtwork(result, mode) {
    return ICON_NAMES.map((icon) => {
        const files = result.modes[mode].icons[icon].files;
        return {
            icon,
            ...spread(
                Object.fromEntries(
                    Object.entries(files).map(([layer, paths]) => [layer, paths.join(" ")])
                )
            ),
        };
    });
}

/**
 * Checks 2 and 3: one row per app icon and scale, mapping each layer to the `field` of its
 * compiled rendition. `unique` is 3 when every layer got its own and 1 when one was repeated.
 */
export function layerRenditions(result, mode, field, icons = ICON_NAMES) {
    return icons.flatMap((icon) =>
        Object.entries(result.modes[mode].icons[icon].renditions).map(([scale, byLayer]) => ({
            icon,
            scale,
            ...spread(
                Object.fromEntries(
                    Object.entries(byLayer).map(([layer, rendition]) => [layer, rendition[field]])
                )
            ),
        }))
    );
}

/** True when a row really has all three layers, so a spread of 3 or 1 means something. */
export const isComplete = (row) => row.layers.length === LAYER_NAMES.length;

export const allDistinct = (rows) =>
    rows.length > 0 && rows.every((row) => isComplete(row) && row.unique === 3);

export const allIdentical = (rows) =>
    rows.length > 0 && rows.every((row) => isComplete(row) && row.unique === 1);

/** Every diagnostic actool printed, across every mode. Empty means it compiled clean. */
export function actoolDiagnostics(result) {
    return Object.entries(result.modes).flatMap(([mode, data]) =>
        Object.entries(data.actool).flatMap(([section, lines]) =>
            lines.map((line) => `${mode}: ${section}: ${line}`)
        )
    );
}

export const REQUIRED_PLIST_KEYS = [
    "CFBundleIcons.CFBundlePrimaryIcon",
    "TVTopShelfImage.TVTopShelfPrimaryImage",
    "TVTopShelfImage.TVTopShelfPrimaryImageWide",
];

export const missingPlistKeys = (result, mode) =>
    REQUIRED_PLIST_KEYS.filter((key) => !result.modes[mode].plistKeys.includes(key));

export const describeRow = (row) =>
    `${row.icon}${row.scale ? ` ${row.scale}` : ""}: ` +
    Object.entries(row.values)
        .map(([layer, value]) => `${layer}=${value}`)
        .join(", ");
