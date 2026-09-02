// Reads what ./repro.sh produced under out/<mode>/ and writes out/result.json, which is the
// only thing the report and the tests look at.
//   node tools/collect-result.mjs <config-tv-spec> <mode> [<mode>...]
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import path from "node:path";

const OUT = path.join(import.meta.dirname, "..", "out");
const ICON_NAMES = ["App Icon - Small", "App Icon - Large"];
const LAYER_NAMES = ["Front", "Middle", "Back"];

const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));

/**
 * The files each layer of one image stack references, read from the generated Contents.json.
 * A layer the stack does not declare is left out rather than reported as an error, since a two
 * layer icon is valid.
 */
function layerFiles(catalog, iconName) {
    const stack = path.join(catalog, "TVAppIcon.brandassets", `${iconName}.imagestack`);
    const declared = readJson(path.join(stack, "Contents.json")).layers ?? [];
    const files = {};
    for (const name of LAYER_NAMES) {
        if (!declared.some((layer) => layer.filename === `${name}.imagestacklayer`)) {
            continue;
        }
        const content = path.join(stack, `${name}.imagestacklayer`, "Content.imageset");
        files[name] = (readJson(path.join(content, "Contents.json")).images ?? []).map(
            (image) => `${image.scale}:${image.filename}`
        );
    }
    return files;
}

/**
 * The compiled renditions of one image stack, keyed by scale then layer. assetutil names them
 * "App Icon - Small/Front/Content" and emits one entry per scale. `source` is the PNG the
 * rendition came from and `opaque` is actool's own flag, which is part of the digest.
 */
function layerRenditions(assets, iconName) {
    const renditions = {};
    for (const entry of assets) {
        if (entry.AssetType !== "Image" || typeof entry.Name !== "string") {
            continue;
        }
        const layer = LAYER_NAMES.find((name) => entry.Name === `${iconName}/${name}/Content`);
        if (!layer) {
            continue;
        }
        const scale = `${entry.Scale ?? 1}x`;
        renditions[scale] ??= {};
        renditions[scale][layer] = {
            digest: entry.SHA1Digest,
            source: entry.RenditionName,
            opaque: entry.Opaque,
        };
    }
    return renditions;
}

/** Every diagnostic actool reported, grouped by the section it printed them under. */
function actoolDiagnostics(log) {
    const sections = {};
    let current = null;
    for (const line of log.split("\n")) {
        const header = line.match(/^\/\* com\.apple\.actool\.(\S+) \*\/$/);
        if (header) {
            current = header[1];
            continue;
        }
        // compilation-results just lists the files that were written
        if (!current || current === "compilation-results" || !line.trim()) {
            continue;
        }
        (sections[current] ??= []).push(line.trim());
    }
    return sections;
}

/** Flattens the partial Info.plist into dotted key paths, so a test can name one key. */
function plistKeys(plist) {
    const keys = [];
    const walk = (node, prefix) => {
        for (const [key, value] of Object.entries(node)) {
            const full = prefix ? `${prefix}.${key}` : key;
            keys.push(full);
            if (value && typeof value === "object" && !Array.isArray(value)) {
                walk(value, full);
            }
        }
    };
    walk(plist, "");
    return keys;
}

const [spec, ...modes] = process.argv.slice(2);
const require = createRequire(import.meta.url);

/**
 * Whether the installed plugin knows about per-layer artwork at all. The PR branch carries the
 * same version number as the published release, and `build/` is gitignored output that reflects
 * whichever branch was compiled last, so neither the spec nor the version tells you which code
 * is installed. Reading the built file does.
 */
function pluginHasLayerSupport() {
    const built = require.resolve(
        "@react-native-tvos/config-tv/build/withTVAppleIconImages.js"
    );
    return readFileSync(built, "utf8").includes("iconSmallLayers");
}

const result = {
    configTvSpec: spec,
    configTvVersion: require("@react-native-tvos/config-tv/package.json").version,
    pluginHasLayerSupport: pluginHasLayerSupport(),
    modes: {},
};

for (const mode of modes) {
    const dir = path.join(OUT, mode);
    const assets = readJson(path.join(dir, "assets.json"));
    const icons = {};
    for (const name of ICON_NAMES) {
        icons[name] = {
            files: layerFiles(path.join(dir, "Images.xcassets"), name),
            renditions: layerRenditions(assets, name),
        };
    }
    result.modes[mode] = {
        icons,
        actool: actoolDiagnostics(readFileSync(path.join(dir, "actool.log"), "utf8")),
        plistKeys: plistKeys(readJson(path.join(dir, "partial-info.json"))),
    };
}

console.log(JSON.stringify(result, null, 2));
