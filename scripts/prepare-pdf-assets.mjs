import { cp, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const target = fileURLToPath(new URL("../public/pdfjs/", import.meta.url));
await mkdir(target, { recursive: true });
for (const folder of ["cmaps", "standard_fonts", "wasm"])
  await cp(
    fileURLToPath(
      new URL(`../node_modules/pdfjs-dist/${folder}/`, import.meta.url),
    ),
    `${target}/${folder}`,
    { recursive: true },
  );
