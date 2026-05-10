// Render de TriCoach app-icon SVG naar PNG-bestanden in public/icons/
// Gebruik: node scripts/build-icons.mjs

import sharp from 'sharp';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const svgPath = resolve(projectRoot, 'public/icons-preview/icon-final-triangle.svg');
const outDir = resolve(projectRoot, 'public/icons');

mkdirSync(outDir, { recursive: true });

const svg = readFileSync(svgPath);

const targets = [
  { size: 192, name: 'icon-192.png' },
  { size: 512, name: 'icon-512.png' },
  { size: 180, name: 'apple-touch-icon.png' }, // iOS Safari/home-screen
];

for (const { size, name } of targets) {
  const out = resolve(outDir, name);
  await sharp(svg, { density: 384 })
    .resize(size, size)
    .png()
    .toFile(out);
  console.log(`✓ ${name} (${size}×${size})`);
}

// Favicon (32x32, ICO is feitelijk PNG met .ico extensie voor moderne browsers)
const faviconOut = resolve(projectRoot, 'src/app/favicon.ico');
await sharp(svg, { density: 384 })
  .resize(32, 32)
  .png()
  .toFile(faviconOut);
console.log(`✓ favicon.ico (32×32)`);
