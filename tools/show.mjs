// Builds both app icon modes for the Apple TV simulator and installs them side by side, so the
// icons can be looked at instead of only measured.
//
//   ./repro.sh --config-tv-version file:../config-tv/packages/config-tv
//   npm run show
//
// It reuses whatever config-tv ./repro.sh installed, so what you see is the same plugin build
// the checks ran against. Needs Xcode with a tvOS simulator runtime and CocoaPods.
import {execFileSync, spawnSync} from "node:child_process";
import {existsSync, rmSync} from "node:fs";
import path from "node:path";

import {loadResult} from "./checks.mjs";

const ROOT = path.join(import.meta.dirname, "..");
const PROJECT = "ConfigTVIconLayersRepro";
const DERIVED = path.join(ROOT, "out", "derived");
const APP = path.join(DERIVED, "Build", "Products", "Release-appletvsimulator", `${PROJECT}.app`);
const BUNDLE_IDS = {layers: "dev.repro.iconlayers", flat: "dev.repro.iconflat"};

const run = (command, args, options = {}) => {
    const result = spawnSync(command, args, {cwd: ROOT, stdio: "inherit", ...options});
    if (result.status !== 0) {
        console.error(`\n${command} ${args.join(" ")} failed`);
        process.exit(1);
    }
};

const simctl = (args) =>
    execFileSync("xcrun", ["simctl", ...args], {encoding: "utf8", maxBuffer: 1 << 26});

/** A booted tvOS simulator if there is one, otherwise the first available one, booted. */
function tvSimulator() {
    const runtimes = JSON.parse(simctl(["list", "-j", "devices", "available"])).devices;
    const devices = Object.entries(runtimes)
        .filter(([runtime]) => runtime.includes("tvOS"))
        .flatMap(([, list]) => list);
    if (devices.length === 0) {
        console.error("No Apple TV simulator is available. Install a tvOS runtime in Xcode.");
        process.exit(1);
    }
    const device = devices.find((d) => d.state === "Booted") ?? devices[0];
    if (device.state !== "Booted") {
        console.log(`==> booting ${device.name}`);
        simctl(["boot", device.udid]);
        simctl(["bootstatus", device.udid]);
    }
    return device;
}

const spec = loadResult().configTvSpec;
console.log(`==> config-tv in node_modules: ${spec}`);
console.log("    (whatever ./repro.sh installed last — rerun it to change this)");

const device = tvSimulator();
console.log(`==> Apple TV simulator: ${device.name} ${device.udid}`);

for (const mode of ["layers", "flat"]) {
    console.log(`\n==> building the ${mode} app icon`);
    // The brand assets are regenerated, not merged, so drop the previous mode's copy first.
    rmSync(path.join(ROOT, "ios", PROJECT, "Images.xcassets", "TVAppIcon.brandassets"), {
        recursive: true,
        force: true,
    });
    run("npx", ["expo", "prebuild", "--platform", "ios"], {
        env: {...process.env, ICON_MODE: mode, EXPO_TV: "1"},
    });
    // ios/ is kept between the two modes on purpose, so the second build is incremental.
    run("xcodebuild", [
        "-workspace",
        `ios/${PROJECT}.xcworkspace`,
        "-scheme",
        PROJECT,
        "-configuration",
        "Release",
        "-sdk",
        "appletvsimulator",
        "-derivedDataPath",
        DERIVED,
        "-destination",
        "generic/platform=tvOS Simulator",
        "CODE_SIGNING_ALLOWED=NO",
    ]);
    if (!existsSync(APP)) {
        console.error(`Expected an app at ${APP}`);
        process.exit(1);
    }
    console.log(`==> installing ${BUNDLE_IDS[mode]}`);
    simctl(["install", device.udid, APP]);
}

console.log(`
==> both icons are installed on ${device.name}

  Open the simulator and look at the top row of the home screen:

    Layered Icon   FRONT over BACK, three separate layers
    Flat Icon      one FLAT image in all three layers

  Move focus onto each icon to see tvOS shift the layers apart. The flat one cannot shift,
  because every layer holds the same picture.

  open -a Simulator
  xcrun simctl launch ${device.udid} ${BUNDLE_IDS.layers}
`);
