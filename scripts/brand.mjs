import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import sharp from "sharp";
import opentype from "opentype.js";
await mkdir("assets/brand", { recursive: true });
await mkdir("public/brand", { recursive: true });
const fontBuffer = await readFile(
  "node_modules/@fontsource/barlow-condensed/files/barlow-condensed-latin-600-normal.woff",
);
const font = opentype.parse(
  fontBuffer.buffer.slice(
    fontBuffer.byteOffset,
    fontBuffer.byteOffset + fontBuffer.byteLength,
  ),
);
const text = (value, x, y, size, color) =>
  font
    .getPath(value, x, y, size)
    .toSVG(2)
    .replace('fill="black"', `fill="${color}"`)
    .replace("<path ", `<path fill="${color}" `);
const svg = (width, height, content) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${content}</svg>`;
const mark = (color, transform = "") =>
  `<path transform="${transform}" fill="${color}" d="M8 8h36v9H17v30h27v9H8zM35 23l21 9-21 9z"/>`;
const colors = {
  dark: "#151919",
  mint: "#c7ddac",
  light: "#f3f5ed",
  sage: "#98a990",
  green: "#1b3125",
};
// Direction A: cue frame. Direction B: two dialogue brackets, an open exchange.
await writeFile(
  "assets/brand/direction-a-cue-frame.svg",
  svg(
    520,
    240,
    `<rect width="520" height="240" fill="${colors.dark}"/>${mark(colors.mint, "translate(32 40) scale(1.7)")}${text("Cuelira", 172, 123, 74, colors.light)}${text("Cue frame / selected", 40, 207, 28, colors.mint)}`,
  ),
);
await writeFile(
  "assets/brand/direction-b-dialogue.svg",
  svg(
    520,
    240,
    `<rect width="520" height="240" fill="${colors.light}"/><path fill="${colors.green}" d="M40 40h62v14H54v58H40zm80 30h14v64H72v-14h48z"/>${text("Cuelira", 172, 123, 74, colors.green)}${text("Open dialogue / alternate", 40, 207, 28, colors.green)}`,
  ),
);
for (const variant of ["dark", "light"]) {
  const ink = variant === "dark" ? colors.light : colors.green;
  const accent = variant === "dark" ? colors.mint : colors.green;
  const icon = svg(64, 64, mark(accent));
  const wordmark = svg(
    380,
    100,
    `${mark(accent, "translate(0 12) scale(1.15)")}${text("Cuelira", 91, 78, 88, ink)}`,
  );
  await writeFile(`assets/brand/icon-${variant}.svg`, icon);
  await writeFile(`assets/brand/wordmark-${variant}.svg`, wordmark);
  await sharp(Buffer.from(icon))
    .resize(512)
    .png()
    .toFile(`assets/brand/icon-${variant}.png`);
  await sharp(Buffer.from(wordmark))
    .resize(1140, 300)
    .png()
    .toFile(`assets/brand/wordmark-${variant}.png`);
}
const desktop = svg(
  512,
  512,
  `<rect width="512" height="512" rx="98" fill="${colors.dark}"/>${mark(colors.mint, "translate(48 48) scale(6.5)")}`,
);
await writeFile("assets/brand/icon.svg", desktop);
await copyFile("assets/brand/icon-dark.svg", "public/brand/icon.svg");
await sharp(Buffer.from(desktop)).png().toFile("assets/brand/icon.png");
const pngs = [];
for (const size of [16, 24, 32, 48, 64, 128, 256]) {
  const data = await sharp(Buffer.from(desktop)).resize(size).png().toBuffer();
  pngs.push({ size, data });
  await writeFile(`assets/brand/icon-${size}.png`, data);
}
// ICO container with PNG payloads, accepted by Windows Vista and later.
const header = Buffer.alloc(6 + pngs.length * 16);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(pngs.length, 4);
let offset = header.length;
pngs.forEach(({ size, data }, i) => {
  const p = 6 + i * 16;
  header[p] = header[p + 1] = size === 256 ? 0 : size;
  header.writeUInt16LE(1, p + 4);
  header.writeUInt16LE(32, p + 6);
  header.writeUInt32LE(data.length, p + 8);
  header.writeUInt32LE(offset, p + 12);
  offset += data.length;
});
await writeFile(
  "assets/brand/icon.ico",
  Buffer.concat([header, ...pngs.map((p) => p.data)]),
);
const social = svg(
  1200,
  630,
  `<rect width="1200" height="630" fill="${colors.dark}"/>${mark(colors.mint, "translate(64 48) scale(1.1)")}${text("Cuelira", 156, 112, 72, colors.light)}${text("Your scene", 68, 293, 112, colors.light)}${text("responds to you.", 68, 402, 112, colors.light)}<rect x="850" y="0" width="350" height="630" fill="${colors.sage}"/>${text("The Last", 883, 180, 74, colors.green)}${text("Message", 883, 252, 74, colors.green)}${text("A live self-tape", 884, 423, 32, colors.green)}${text("rehearsal partner.", 884, 461, 32, colors.green)}${text("Built with Presage SmartSpectra", 70, 555, 30, colors.mint)}`,
);
for (const name of ["social-preview", "github-preview"]) {
  await writeFile(`assets/brand/${name}.svg`, social);
  await sharp(Buffer.from(social)).png().toFile(`assets/brand/${name}.png`);
}
for (const [name, caption] of [
  ["video-intro", "Your scene responds to you."],
  ["video-outro", "github.com/sopskistar/Cuelira"],
]) {
  const art = svg(
    1920,
    1080,
    `<rect width="1920" height="1080" fill="${colors.dark}"/>${mark(colors.mint, "translate(264 390) scale(3.7)")}${text("Cuelira", 580, 600, 260, colors.light)}${text(caption, 580, 700, 58, colors.mint)}`,
  );
  await writeFile(`assets/brand/${name}.svg`, art);
  await sharp(Buffer.from(art)).png().toFile(`assets/brand/${name}.png`);
}
console.log(
  "Original SVG marks, outlined licensed wordmarks, PNG sizes, ICO, social and video artwork generated.",
);
