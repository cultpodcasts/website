import * as sass from "sass";
import { join } from "node:path";

const railSassPath = join(process.cwd(), "src", "app", "episode-rail", "episode-rail.component.sass");
const posterSassPath = join(process.cwd(), "src", "app", "episode-poster", "episode-poster.component.sass");

function compile(path: string): string {
	return sass.compile(path, { style: "expanded" }).css;
}

/** Real rail and poster Sass, flattened so a light-DOM harness can measure boxes. */
export function compileRailLayoutCss(): string {
	const rail = compile(railSassPath).replaceAll(":host", ".rail-layout-host");
	const poster = compile(posterSassPath)
		.replaceAll(":host-context(.browse-grid)", ".browse-grid")
		.replaceAll(":host-context(.cdk-global-scrollblock)", ".cdk-global-scrollblock")
		.replaceAll(":host", ".episode-poster");
	return `
.rail-layout-root {
  margin: 0;
  background: #0b0b0b;
  color: #fff;
}
${rail}
${poster}
`;
}

function tile(kind: "square" | "wide", label: string, imageWidth: number, imageHeight: number): string {
	const narrow = kind === "square" ? " rail-poster--square" : "";
	const aspect = kind === "square" ? "episode-poster--square" : "episode-poster--wide";
	return `<div class="rail-poster${narrow}">
  <div class="episode-poster ${aspect}">
    <a class="episode-poster__art">
      <img alt="" width="${imageWidth}" height="${imageHeight}" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" />
    </a>
    <div class="episode-poster__meta"><span class="episode-poster__episode">${label}</span></div>
  </div>
</div>`;
}

export function buildRailLayoutDocument(): string {
	return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Rail layout harness</title>
  <style>${compileRailLayoutCss()}</style>
</head>
<body class="rail-layout-root">
  <div class="rail-layout-host">
    <section class="rail">
      <div class="rail__scroller">
        <div class="rail__track">
          ${tile("square", "Square cover", 400, 1600)}
          ${tile("wide", "Wide still", 1600, 900)}
        </div>
      </div>
    </section>
  </div>
</body>
</html>`;
}
