import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const sourceDirectory = fileURLToPath(new URL('../src/data/', import.meta.url));
const outputDirectory = fileURLToPath(new URL('../dist/data/', import.meta.url));

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });
await cp(sourceDirectory, outputDirectory, { recursive: true });
