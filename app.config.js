// ICON_MODE picks which app icon config the prebuild uses, so both run from this one file.
//
//   layers (default)  the new iconSmallLayers / iconSmall2xLayers / iconLayers keys, alongside
//                     the flat keys they take precedence over
//   flat              only the flat icon / iconSmall / iconSmall2x keys, i.e. what a config
//                     written for 0.1.6 looks like
const ART = "./assets/tv";

const layersFor = (size) => ({
    front: `${ART}/front-${size}.png`,
    middle: `${ART}/middle-${size}.png`,
    back: `${ART}/back-${size}.png`,
});

// 0.1.6 requires all three flat keys and ignores the layer keys, so the layers config supplies
// both. That also exercises the documented precedence: layers win for a scale that has both.
const flatIcons = {
    icon: `${ART}/flat-1280x768.png`,
    iconSmall: `${ART}/flat-400x240.png`,
    iconSmall2x: `${ART}/flat-800x480.png`,
};

const layerIcons = {
    ...flatIcons,
    iconLayers: layersFor("1280x768"),
    iconSmallLayers: layersFor("400x240"),
    iconSmall2xLayers: layersFor("800x480"),
};

const flat = process.env.ICON_MODE === "flat";

// The two modes differ only in bundle id and display name, so both can sit on one tvOS home
// screen at once for `npm run show`. `name` stays fixed so the Xcode project name does not
// change between modes.
module.exports = {
    expo: {
        name: "Config TV Icon Layers Repro",
        slug: "config-tv-icon-layers-repro",
        version: "1.0.0",
        platforms: ["ios"],
        ios: {
            bundleIdentifier: flat ? "dev.repro.iconflat" : "dev.repro.iconlayers",
            infoPlist: {
                CFBundleDisplayName: flat ? "Flat Icon" : "Layered Icon",
            },
        },
        plugins: [
            [
                "@react-native-tvos/config-tv",
                {
                    isTV: true,
                    appleTVImages: {
                        ...(flat ? flatIcons : layerIcons),
                        topShelf: `${ART}/top-shelf-1920x720.png`,
                        topShelf2x: `${ART}/top-shelf-3840x1440.png`,
                        topShelfWide: `${ART}/top-shelf-wide-2320x720.png`,
                        topShelfWide2x: `${ART}/top-shelf-wide-4640x1440.png`,
                    },
                },
            ],
        ],
    },
};
