import type { Point } from "./simulation.js";

const WIDTH = 720,
  HEIGHT = 480;
const routes = [
  [
    { x: 105, y: 405 },
    { x: 103, y: 345 },
    { x: 107, y: 284 },
    { x: 105, y: 253 },
  ],
  [
    { x: 105, y: 256 },
    { x: 215, y: 253 },
    { x: 320, y: 260 },
    { x: 425, y: 254 },
    { x: 530, y: 259 },
    { x: 637, y: 256 },
  ],
  [
    { x: 104, y: 368 },
    { x: 215, y: 371 },
    { x: 320, y: 365 },
    { x: 425, y: 371 },
    { x: 530, y: 365 },
    { x: 637, y: 368 },
  ],
];
const smooth = (v: number) => {
  const t = Math.max(0, Math.min(1, v));
  return t * t * (3 - 2 * t);
};
const hash = (x: number, y: number) => {
  const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return value - Math.floor(value);
};
function noise(x: number, y: number, scale: number) {
  x /= scale;
  y /= scale;
  const ix = Math.floor(x),
    iy = Math.floor(y),
    tx = smooth(x - ix),
    ty = smooth(y - iy);
  const top = hash(ix, iy) * (1 - tx) + hash(ix + 1, iy) * tx;
  const bottom = hash(ix, iy + 1) * (1 - tx) + hash(ix + 1, iy + 1) * tx;
  return top * (1 - ty) + bottom * ty - 0.5;
}
function edge(x: number, y: number) {
  return noise(x, y, 19) * 7 + noise(x, y, 6) * 4 + noise(x, y, 1.8) * 1.5;
}
function bedDistance(x: number, y: number, plant: Point) {
  return (Math.hypot((x - plant.x) / 38, (y - plant.y - 16) / 27) - 1) * 27;
}
function segmentDistance(x: number, y: number, a: Point, b: Point) {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const t = Math.max(
    0,
    Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy))
  );
  return Math.hypot(x - a.x - dx * t, y - a.y - dy * t);
}
function surface(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw Error("Terrain composition unavailable");
  return { canvas, context };
}

/** Raster composition happens once. A single union avoids seams at path/bed joins. */
export function createTerrain(
  grass: HTMLImageElement,
  earth: HTMLImageElement,
  plants: readonly Point[]
) {
  function soil(
    x: number,
    y: number,
    width: number,
    height: number,
    distance: (x: number, y: number) => number
  ) {
    const layer = surface(width, height),
      mask = surface(width, height);
    const pixels = mask.context.createImageData(width, height);
    for (let row = 0; row < height; row++) {
      for (let column = 0; column < width; column++) {
        const worldX = x + column,
          worldY = y + row;
        const d = distance(worldX, worldY) + edge(worldX, worldY);
        const offset = (row * width + column) * 4;
        pixels.data[offset] =
          pixels.data[offset + 1] =
          pixels.data[offset + 2] =
            255;
        pixels.data[offset + 3] = Math.round(smooth((3 - d) / 6) * 255);
      }
    }
    mask.context.putImageData(pixels, 0, 0);
    const pattern = layer.context.createPattern(earth, "repeat");
    if (!pattern) throw Error("Terrain texture unavailable");
    pattern.setTransform(new DOMMatrix().translate(-x, -y).scale(0.5));
    layer.context.fillStyle = pattern;
    layer.context.fillRect(0, 0, width, height);
    layer.context.globalCompositeOperation = "destination-in";
    layer.context.drawImage(mask.canvas, 0, 0);
    return layer.canvas;
  }
  const ground = surface(WIDTH, HEIGHT);
  const grassPattern = ground.context.createPattern(grass, "repeat");
  if (!grassPattern) throw Error("Terrain texture unavailable");
  grassPattern.setTransform(new DOMMatrix().scale(0.5));
  ground.context.fillStyle = grassPattern;
  ground.context.fillRect(0, 0, WIDTH, HEIGHT);
  const segments = routes.flatMap((route, i) =>
    route
      .slice(1)
      .map((b, j) => ({ a: route[j], b, radius: i === 0 ? 22 : 17 }))
  );
  ground.context.drawImage(
    soil(0, 0, WIDTH, HEIGHT, (x, y) => {
      let d = Infinity;
      for (const segment of segments)
        d = Math.min(
          d,
          segmentDistance(x, y, segment.a, segment.b) - segment.radius
        );
      for (const plant of plants) d = Math.min(d, bedDistance(x, y, plant));
      return d;
    }),
    0,
    0
  );
  const beds = plants.map((plant) => {
    const x = plant.x - 46,
      y = plant.y - 20;
    return {
      x,
      y,
      canvas: soil(x, y, 92, 76, (x, y) => bedDistance(x, y, plant)),
    };
  });
  return { ground: ground.canvas, beds };
}
