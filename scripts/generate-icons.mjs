/**
 * Renders the PWA icon set from public/icons/icon-source.png.
 * Run after replacing the source: `node scripts/generate-icons.mjs`
 *
 * icon-source.png is a 1024x1024 master (the logo mark on its black
 * background) with the mark already sitting well inside the maskable-icon
 * safe zone (content within the central 80%), so every size below is a
 * plain resize of the same source — no separate maskable composite needed.
 */
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const iconsDir = join(root, "public", "icons");
const source = await readFile(join(iconsDir, "icon-source.png"));

const targets = [
  { file: "icon-192.png", size: 192 },
  { file: "icon-512.png", size: 512 },
  { file: "icon-maskable-512.png", size: 512 },
  { file: "apple-touch-icon.png", size: 180 },
];

for (const { file, size } of targets) {
  const buffer = await sharp(source).resize(size, size).png().toBuffer();
  await writeFile(join(iconsDir, file), buffer);
  console.log(`✔ ${file} (${size}×${size})`);
}
