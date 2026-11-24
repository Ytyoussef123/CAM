// Copies the one-file build to the repository root, where GitHub Pages serves it
// (https://ytyoussef123.github.io/CAM/inspection-console.html).
import { copyFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const from = fileURLToPath(new URL('../dist/index.html', import.meta.url));
const to = fileURLToPath(new URL('../../inspection-console.html', import.meta.url));
copyFileSync(from, to);
console.log(`inspection-console.html written (${(statSync(to).size / 1024).toFixed(0)} KB)`);
