#!/usr/bin/env bash
# Checks whether @react-native-tvos/config-tv can give each layer of an Apple TV app icon its
# own artwork, instead of repeating one image across all three.
#
#   ./repro.sh
#   ./repro.sh --config-tv-version file:../config-tv/packages/config-tv
#   ./repro.sh --config-tv-version 0.1.7                  # verify a published release
#
# Runs `expo prebuild` twice from the same app.config.js: once with the layer keys and once with
# only the flat keys, compiles both catalogs with actool, and writes out/result.json.
#
# Exit code 0 means per-layer artwork works and a flat config is unaffected.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

PACKAGE="@react-native-tvos/config-tv"
SPEC="$PACKAGE@0.1.6"
MODES=(layers flat)

while [[ $# -gt 0 ]]; do
    case "$1" in
        --config-tv-version)
            SPEC="$2"
            [[ "$SPEC" == *:* ]] || SPEC="$PACKAGE@$SPEC"
            shift 2
            ;;
        *)
            echo "Usage: ./repro.sh [--config-tv-version <spec>]" >&2
            exit 2
            ;;
    esac
done

need() { command -v "$1" >/dev/null || { echo "Missing required tool: $1" >&2; exit 2; }; }
need actool
need assetutil
need plutil
need node

echo "==> config-tv spec: $SPEC"
[[ -d node_modules ]] || npm install

# --install-links copies a file: spec instead of symlinking it, so node resolves the package's
# own dependencies. A file: spec also runs the package's prepare script, which needs dev
# dependencies the copy does not get, so fall back to an already-built source checkout.
if ! npm install --silent --no-save --install-links "$SPEC" >/dev/null 2>&1; then
    echo "    prepare script failed, retrying with --ignore-scripts"
    npm install --silent --no-save --install-links --ignore-scripts "$SPEC" >/dev/null
fi
node -e "require.resolve('$PACKAGE')" || {
    echo "    $PACKAGE resolved to nothing. Build the source checkout, then rerun." >&2
    exit 2
}
# A file: spec keeps whatever version its package.json says, so the version number alone does
# not tell you which code is installed. The checks below do.
echo "    installed: $(node -e "console.log(require('$PACKAGE/package.json').version)")"

for MODE in "${MODES[@]}"; do
    echo "==> prebuild with the $MODE app icon config"
    rm -rf ios "out/$MODE"
    mkdir -p "out/$MODE/compiled"
    ICON_MODE="$MODE" EXPO_TV=1 npx expo prebuild --platform ios --no-install \
        >"out/$MODE/prebuild.log" 2>&1 || { tail -30 "out/$MODE/prebuild.log"; exit 1; }

    PROJECT="$(basename "$(ls -d ios/*.xcodeproj)" .xcodeproj)"
    cp -R "ios/$PROJECT/Images.xcassets" "out/$MODE/Images.xcassets"

    # The invocation an Apple TV build uses for its asset catalog
    actool "out/$MODE/Images.xcassets" --compile "out/$MODE/compiled" \
        --output-format human-readable-text --notices --warnings \
        --app-icon TVAppIcon --include-all-app-icons \
        --compress-pngs --enable-on-demand-resources YES --target-device tv \
        --minimum-deployment-target 15.1 --platform appletvos \
        --output-partial-info-plist "out/$MODE/partial-info.plist" --development-region en \
        --generate-swift-asset-symbol-extensions NO >"out/$MODE/actool.log" 2>&1 \
        || { cat "out/$MODE/actool.log"; exit 1; }

    assetutil --info "out/$MODE/compiled/Assets.car" >"out/$MODE/assets.json"
    plutil -convert json -o "out/$MODE/partial-info.json" "out/$MODE/partial-info.plist"
done
rm -rf ios

node tools/collect-result.mjs "$SPEC" "${MODES[@]}" >out/result.json

echo
node tools/report.mjs
