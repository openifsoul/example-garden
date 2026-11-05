// Pixi's interpreted shader/uniform adapters preserve the server's strict CSP.
import "pixi.js/unsafe-eval";
import { Application, Container, Graphics, Text } from "pixi.js";
import { GardenSimulation, WELL } from "./simulation.js";

/** Pixi holds only the view; the serializable host owns every state transition. */
export async function createGardenView(
  host: HTMLElement,
  simulation: GardenSimulation,
  name: string,
) {
  const app = new Application();
  const canvas = document.createElement("canvas");
  try {
    await app.init({
      canvas,
      width: 720,
      height: 480,
      backgroundColor: 0xe9eedf,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoStart: false,
      preference: "webgl",
    });
    app.canvas.style.cssText =
      "display:block;width:100%;height:auto;aspect-ratio:3/2;border-radius:12px";
    app.canvas.setAttribute(
      "aria-label",
      "Garden scene. Companion progress is also described in the status below.",
    );
    host.appendChild(app.canvas);
    const landscape = new Graphics();
    landscape.roundRect(18, 18, 684, 444, 22).fill(0xd5e1bf);
    landscape.roundRect(48, 365, 620, 61, 22).fill(0xece2c8);
    landscape.roundRect(71, 235, 66, 160, 18).fill(0xece2c8);
    for (const y of [243, 358])
      landscape.roundRect(115, y, 520, 31, 12).fill(0xece2c8);
    // Fences, flowers and soft shadows are original vector artwork.
    for (let x = 38; x < 690; x += 28)
      landscape.roundRect(x, 42, 9, 39, 3).fill(0xc1a47d);
    landscape.rect(35, 51, 650, 6).fill(0xb69a74);
    for (let i = 0; i < 25; i++) {
      const x = 45 + ((i * 113) % 630),
        y = 105 + ((i * 47) % 70);
      landscape.circle(x, y, 3).fill(i % 2 ? 0xf3dca0 : 0xf8f1dc);
    }
    landscape
      .ellipse(WELL.x, WELL.y + 18, 38, 13)
      .fill({ color: 0x4b5841, alpha: 0.12 });
    landscape.roundRect(WELL.x - 28, WELL.y - 10, 56, 34, 10).fill(0x929b99);
    landscape.ellipse(WELL.x, WELL.y - 9, 28, 12).fill(0x667c83);
    landscape.ellipse(WELL.x, WELL.y - 9, 20, 7).fill(0x8cc2ce);
    landscape.rect(WELL.x - 31, WELL.y - 64, 6, 57).fill(0xa37e55);
    landscape.rect(WELL.x + 25, WELL.y - 64, 6, 57).fill(0xa37e55);
    landscape
      .poly([
        WELL.x - 42,
        WELL.y - 62,
        WELL.x,
        WELL.y - 88,
        WELL.x + 42,
        WELL.y - 62,
      ])
      .fill(0xb77b5e);
    app.stage.addChild(landscape);
    const label = (text: string, x: number, y: number, size = 13) => {
      const object = new Text({
        text,
        style: {
          fontFamily: "IBM Plex Sans, system-ui, sans-serif",
          fontSize: size,
          fill: 0x3e4936,
          fontWeight: "600",
        },
      });
      object.position.set(x, y);
      app.stage.addChild(object);
      return object;
    };
    label("THE LITTLE ORCHARD", 47, 105, 17);
    label("WELL", 86, 310, 11);
    const plantViews = simulation.plants.map((plant) => {
      const group = new Container();
      group.position.set(plant.x, plant.y);
      const soil = new Graphics().roundRect(-32, -9, 64, 44, 11).fill(0xb19470);
      const wet = new Graphics().roundRect(-28, -5, 56, 36, 9).fill(0x88715b);
      const leaves = new Graphics()
        .moveTo(0, 10)
        .lineTo(0, -24)
        .stroke({ width: 4, color: 0x4d7350 })
        .ellipse(-10, -12, 13, 7)
        .fill(0x769a58)
        .ellipse(10, -21, 13, 7)
        .fill(0x5e874c);
      const fruit = new Graphics()
        .circle(-9, -27, 8)
        .fill(0xd9835c)
        .circle(10, -30, 9)
        .fill(0xe8a060);
      group.addChild(soil, wet, leaves, fruit);
      app.stage.addChild(group);
      return { group, wet, fruit };
    });
    const companion = new Container();
    companion.addChild(
      new Graphics()
        .ellipse(0, 12, 16, 6)
        .fill({ color: 0x354736, alpha: 0.18 })
        .roundRect(-11, -13, 22, 29, 7)
        .fill(0x5c8194)
        .circle(0, -24, 13)
        .fill(0xf1d3ad)
        .ellipse(0, -33, 19, 6)
        .fill(0xd6b46c)
        .roundRect(-12, -45, 24, 14, 5)
        .fill(0xe8ca83)
        .circle(-4, -25, 1.5)
        .fill(0x41463b)
        .circle(4, -25, 1.5)
        .fill(0x41463b),
    );
    const can = new Graphics()
      .roundRect(13, -2, 14, 13, 3)
      .fill(0x9bbcc4)
      .moveTo(25, 1)
      .lineTo(34, -5)
      .stroke({ color: 0x789ea9, width: 4 });
    companion.addChild(can);
    app.stage.addChild(companion);
    const nameLabel = label(name.slice(0, 24), 0, 0, 12);
    return {
      render() {
        companion.position.set(simulation.companion.x, simulation.companion.y);
        nameLabel.position.set(
          simulation.companion.x - nameLabel.width / 2,
          simulation.companion.y + 21,
        );
        can.visible = simulation.phase === "watering";
        for (const [i, view] of plantViews.entries()) {
          view.wet.visible = simulation.plants[i].watered;
          view.fruit.visible =
            ["harvesting", "complete"].includes(simulation.phase) &&
            !simulation.plants[i].harvested;
        }
        app.render();
      },
      destroy() {
        app.destroy({ removeView: true }, { children: true });
      },
    };
  } catch (error) {
    if (app.renderer) app.destroy({ removeView: true }, { children: true });
    else {
      app.stage.destroy({ children: true });
      // Initialization may fail before Pixi exposes its internally created renderer.
      // The canvas is task-owned, so explicitly release any partial GL context.
      const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
      canvas.remove();
    }
    throw error;
  }
}
