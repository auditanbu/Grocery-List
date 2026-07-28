/**
 * Renders the PWA icon set from public/icons/icon.svg.
 * Run after editing the SVG: `node scripts/generate-icons.mjs`
 */
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const iconsDir = join(root, "public", "icons");
const source = await readFile(join(iconsDir, "icon.svg"));

const targets = [
  { file: "icon-192.png", size: 192 },
  { file: "icon-512.png", size: 512 },
  { file: "apple-touch-icon.png", size: 180 },
];

for (const { file, size } of targets) {
  const buffer = await sharp(source).resize(size, size).png().toBuffer();
  await writeFile(join(iconsDir, file), buffer);
  console.log(`✔ ${file} (${size}×${size})`);
}

// Maskable icons need ~10% safe padding on every edge.
const inner = Math.round(512 * 0.78);
const maskable = await sharp({
  create: {
    width: 512,
    height: 512,
    channels: 4,
    background: "#007aff",
  },
})
  .composite([
    {
      input: await sharp(source).resize(inner, inner).png().toBuffer(),
      gravity: "centre",
    },
  ])
  .png()
  .toBuffer();

await writeFile(join(iconsDir, "icon-maskable-512.png"), maskable);
console.log("✔ icon-maskable-512.png (512×512, maskable)");
