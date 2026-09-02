// Regenerates the placeholder art. The PNGs are committed, so you never need to run this —
// it is here so the art is not a mystery blob.
//   npm run art
import {mkdir} from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

const OUT = path.join(import.meta.dirname, "..", "assets", "tv");

const ICON_SIZES = [
    [400, 240],
    [800, 480],
    [1280, 768],
];

const TOP_SHELF_SIZES = [
    ["top-shelf", 1920, 720],
    ["top-shelf", 3840, 1440],
    ["top-shelf-wide", 2320, 720],
    ["top-shelf-wide", 4640, 1440],
];

const FONT = "Helvetica Neue, Helvetica, Arial";

const text = (width, height, label, color) => {
    const size = Math.round(height * 0.26);
    const sub = Math.round(height * 0.09);
    return (
        `<text x="50%" y="52%" fill="${color}" font-family="${FONT}" font-weight="bold" ` +
        `font-size="${size}" text-anchor="middle">${label}</text>` +
        `<text x="50%" y="74%" fill="${color}" opacity="0.75" font-family="${FONT}" ` +
        `font-size="${sub}" text-anchor="middle">${width}x${height}</text>`
    );
};

const svg = (width, height, body) =>
    Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${body}</svg>`
    );

// The front and middle layers of a real tvOS icon are transparent apart from their artwork, and
// only the back layer is opaque. The placeholders follow that so the shapes stay honest.
const LAYERS = {
    front: (w, h) =>
        svg(
            w,
            h,
            `<rect x="${w * 0.12}" y="${h * 0.18}" width="${w * 0.76}" height="${h * 0.64}" ` +
                `rx="${h * 0.12}" fill="#ff8a1f"/>` +
                text(w, h, "FRONT", "#20140a")
        ),
    middle: (w, h) =>
        svg(
            w,
            h,
            `<rect x="0" y="${h * 0.2}" width="${w}" height="${h * 0.62}" fill="#8b3fd1"/>` +
                text(w, h, "MIDDLE", "#ffffff")
        ),
    back: (w, h) =>
        svg(w, h, `<rect width="${w}" height="${h}" fill="#0f4c5c"/>` + text(w, h, "BACK", "#ffffff")),
    // What every layer gets when a config passes one flat image per scale.
    flat: (w, h) =>
        svg(w, h, `<rect width="${w}" height="${h}" fill="#b3213b"/>` + text(w, h, "FLAT", "#ffffff")),
};

const write = (buffer, name) =>
    sharp(buffer).png({compressionLevel: 9, effort: 10}).toFile(path.join(OUT, `${name}.png`));

await mkdir(OUT, {recursive: true});

let count = 0;
for (const [name, draw] of Object.entries(LAYERS)) {
    for (const [width, height] of ICON_SIZES) {
        await write(draw(width, height), `${name}-${width}x${height}`);
        count++;
    }
}

for (const [name, width, height] of TOP_SHELF_SIZES) {
    const body =
        `<rect width="${width}" height="${height}" fill="#2b3440"/>` +
        text(width, height, "TOP SHELF", "#ffffff");
    await write(svg(width, height, body), `${name}-${width}x${height}`);
    count++;
}

console.log(`${count} files -> assets/tv`);
