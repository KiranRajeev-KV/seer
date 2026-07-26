import { cp, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const sourceDirectory = fileURLToPath(new URL('../src/data/', import.meta.url));
const outputDirectory = fileURLToPath(new URL('../dist/data/', import.meta.url));
const widgetSourceDirectory = fileURLToPath(new URL('../src/widgets/out/', import.meta.url));
const widgetOutputDirectory = fileURLToPath(new URL('../dist/widgets/out/', import.meta.url));
const widgetBundleAliases = [
  ['dataset-profile', 'next-dataset-profile'],
  ['analysis-plan', 'next-analysis-plan'],
  ['analysis-results', 'next-analysis-results'],
];

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });
await cp(sourceDirectory, outputDirectory, { recursive: true });

// NitroStack registers a `next-<route>` component ID but its CLI emits
// `<route>.html`. Keep both names so the production resource handler can
// resolve every bundled widget.
for (const [route, componentId] of widgetBundleAliases) {
  await cp(
    join(widgetSourceDirectory, `${route}.html`),
    join(widgetSourceDirectory, `${componentId}.html`),
  );
}

await rm(widgetOutputDirectory, { recursive: true, force: true });
await mkdir(widgetOutputDirectory, { recursive: true });
await cp(widgetSourceDirectory, widgetOutputDirectory, { recursive: true });
