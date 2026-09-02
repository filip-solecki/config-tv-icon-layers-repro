// Prints what ./repro.sh measured and exits non-zero when a check fails.
//   node tools/report.mjs
import {
    actoolDiagnostics,
    allDistinct,
    allIdentical,
    IDENTICAL_DIGEST_ICONS,
    layerArtwork,
    layerRenditions,
    layerSupportMatchesOutcome,
    loadResult,
    missingPlistKeys,
} from "./checks.mjs";

const result = loadResult();

for (const mode of Object.keys(result.modes)) {
    console.log(`  --- ${mode} config ---`);
    for (const row of layerArtwork(result, mode)) {
        console.log(`  ${row.icon}`);
        for (const [layer, files] of Object.entries(row.values)) {
            console.log(`    ${layer.padEnd(7)}${files}`);
        }
        for (const digests of layerRenditions(result, mode, "digest", [row.icon])) {
            const shown = Object.entries(digests.values)
                .map(([layer, digest]) => `${layer[0]}:${digest.slice(0, 8)}`)
                .join("  ");
            const verdict =
                digests.unique === digests.layers.length
                    ? "all differ"
                    : digests.unique === 1
                      ? "ALL IDENTICAL"
                      : `only ${digests.unique} of ${digests.layers.length} differ`;
            console.log(`    ${digests.scale} digests  ${shown}  (${verdict})`);
        }
    }
}

const diagnostics = actoolDiagnostics(result);
console.log();
console.log(`  actool diagnostics: ${diagnostics.length === 0 ? "none" : diagnostics.join("; ")}`);
console.log(`  partial plist keys: ${result.modes.layers.plistKeys.sort().join(" ")}`);
console.log(
    `  installed plugin:   ${result.configTvVersion} from ${result.configTvSpec}, ` +
        `layer support ${result.pluginHasLayerSupport ? "present" : "absent"}`
);
console.log();

let failures = 0;
const report = (ok, number, title, detail) => {
    console.log(`  ${ok ? "[ OK]" : "[BUG]"}  ${number}  ${title.padEnd(42)}${detail}`);
    if (!ok) {
        failures++;
    }
};

const compiledLayers = layerRenditions(result, "layers", "digest");
report(
    layerSupportMatchesOutcome(result),
    0,
    "the installed plugin matches the outcome",
    `build ${result.pluginHasLayerSupport ? "has" : "has no"} layer support and the layers ` +
        `${allDistinct(compiledLayers) ? "differ" : "are repeated"}`
);

const artwork = layerArtwork(result, "layers");
report(
    allDistinct(artwork),
    1,
    "each layer gets its own artwork",
    allDistinct(artwork) ? "Front, Middle and Back all differ" : "the layer keys had no effect"
);

const compiled = layerRenditions(result, "layers", "digest");
const missing = missingPlistKeys(result, "layers");
report(
    allDistinct(compiled) && diagnostics.length === 0 && missing.length === 0,
    2,
    "the compiled catalog keeps them distinct",
    diagnostics.length > 0
        ? "actool reported a diagnostic"
        : missing.length > 0
          ? `partial plist lost ${missing.join(" ")}`
          : allDistinct(compiled)
            ? "3 renditions per stack, actool clean"
            : "one rendition repeated per stack"
);

const flatSources = layerRenditions(result, "flat", "source");
const flatDigests = layerRenditions(result, "flat", "digest", IDENTICAL_DIGEST_ICONS);
report(
    allIdentical(flatSources) && allIdentical(flatDigests),
    3,
    "a flat config still behaves like 0.1.6",
    allIdentical(flatSources) && allIdentical(flatDigests)
        ? "one image in all three layers"
        : "flat behaviour changed"
);

console.log();
console.log("  Assert on it: npm test        (reads out/result.json)");
console.log("  Look at it:   open 'out/layers/Images.xcassets/TVAppIcon.brandassets'");
console.log("  Plist:        plutil -p out/layers/partial-info.plist");
console.log();

if (failures > 0) {
    console.log(`==> ${failures} check(s) fail with ${result.configTvSpec}`);
    process.exit(1);
}
console.log(`==> all checks pass with ${result.configTvSpec}`);
