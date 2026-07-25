import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const sourceDirectory = fileURLToPath(new URL('../src/data/', import.meta.url));
const outputDirectory = fileURLToPath(new URL('../dist/data/', import.meta.url));
const widgetSourceDirectory = fileURLToPath(new URL('../src/widgets/out/', import.meta.url));
const widgetOutputDirectory = fileURLToPath(new URL('../dist/widgets/out/', import.meta.url));

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });
await cp(sourceDirectory, outputDirectory, { recursive: true });

await rm(widgetOutputDirectory, { recursive: true, force: true });
await mkdir(widgetOutputDirectory, { recursive: true });
await cp(widgetSourceDirectory, widgetOutputDirectory, { recursive: true });
