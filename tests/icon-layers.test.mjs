// Asserts on out/result.json, which ./repro.sh writes. Run the repro first:
//
//   ./repro.sh --config-tv-version file:../config-tv/packages/config-tv
//   npm test
//
// All three green = an Apple TV app icon can have per-layer artwork, and a config that only
// uses the flat keys is untouched.
import assert from "node:assert/strict";
import {describe, it} from "node:test";

import {
    actoolDiagnostics,
    allDistinct,
    allIdentical,
    describeRow,
    IDENTICAL_DIGEST_ICONS,
    isComplete,
    layerArtwork,
    layerRenditions,
    loadResult,
    missingPlistKeys,
    REQUIRED_PLIST_KEYS,
} from "../tools/checks.mjs";

const result = loadResult();

const list = (rows) => rows.map((row) => `  ${describeRow(row)}`).join("\n");

/** Guards against a vacuous pass: an empty or truncated stack must fail, not pass for free. */
function assertEveryLayerPresent(rows, what) {
    assert.ok(rows.length > 0, `No ${what} were found at all, so there is nothing to compare.`);
    for (const row of rows) {
        assert.ok(
            isComplete(row),
            `${row.icon}${row.scale ? ` at ${row.scale}` : ""} has layers ` +
                `[${row.layers.join(", ")}], expected Front, Middle and Back.`
        );
    }
}

console.log(`config-tv under test: ${result.configTvSpec} (version ${result.configTvVersion})\n`);

describe("Apple TV app icon layers", () => {
    it("1. each layer of each app icon gets its own artwork", () => {
        const rows = layerArtwork(result, "layers");
        assertEveryLayerPresent(rows, "generated image stacks");
        assert.ok(
            allDistinct(rows),
            `Every layer must reference its own file, but the generated catalog says:\n` +
                `${list(rows)}\n` +
                `The layer keys in app.config.js were ignored, so the icon is flat.`
        );
    });

    it("2. the compiled catalog keeps the layers distinct", () => {
        // A build that warns is not a fix, so this comes before the digests.
        const diagnostics = actoolDiagnostics(result);
        assert.deepEqual(
            diagnostics,
            [],
            `actool must compile both catalogs with no errors and no warnings, but reported:\n  ` +
                diagnostics.join("\n  ")
        );

        const rows = layerRenditions(result, "layers", "digest");
        assertEveryLayerPresent(rows, "compiled layer renditions");
        assert.ok(
            allDistinct(rows),
            `The digests of the three layers must all differ, but the compiled car holds:\n` +
                `${list(rows)}\n` +
                `Identical digests mean tvOS has nothing to shift apart on focus.`
        );

        const missing = missingPlistKeys(result, "layers");
        assert.deepEqual(
            missing,
            [],
            `The partial Info.plist must still declare ${REQUIRED_PLIST_KEYS.join(", ")}, but ` +
                `${missing.join(", ")} is missing. It holds: ` +
                `${result.modes.layers.plistKeys.join(", ")}.`
        );
    });

    it("3. a config that uses only the flat keys behaves exactly as 0.1.6 did", () => {
        const sources = layerRenditions(result, "flat", "source");
        assertEveryLayerPresent(sources, "compiled layer renditions for the flat config");
        assert.ok(
            allIdentical(sources),
            `0.1.6 puts one image in all three layers, so every layer of a flat config must ` +
                `still compile from the same file. They came from:\n${list(sources)}\n` +
                `That is a behaviour change for a config that never asked for layers.`
        );

        // Only the small icon: actool forces alpha onto the large icon's non-Back layers under
        // the marketing idiom, so one source there yields two digests even on 0.1.6.
        const digests = layerRenditions(result, "flat", "digest", IDENTICAL_DIGEST_ICONS);
        assertEveryLayerPresent(digests, `compiled ${IDENTICAL_DIGEST_ICONS.join(" ")} renditions`);
        assert.ok(
            allIdentical(digests),
            `On 0.1.6 the three layers of ${IDENTICAL_DIGEST_ICONS.join(" ")} compile to one ` +
                `byte-identical rendition. Now:\n${list(digests)}`
        );
    });
});
