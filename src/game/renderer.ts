// Pixi's interpreted shader/uniform adapters preserve the server's strict CSP.
import "pixi.js/unsafe-eval";
import { Application, Container, Rectangle, Sprite, Texture } from "pixi.js";
import grassURL from "./assets/grass-tile.webp";
import earthURL from "./assets/earth-tile.webp";
import atlasURL from "./assets/orchard-atlas.webp";
import { SPRITE_KEYS, type SpriteKey } from "./sprite-keys.js";
import { createTerrain } from "./terrain.js";
import { createSpeechBubble } from "./speech-bubble.js";
import { GardenSimulation, WELL } from "./simulation.js";
import { plantSprite, gardenerSprite } from "./visual-state.js";

/** A view-only atlas. Host mechanics, decisions and reported outcomes stay in simulation. */
export async function createGardenView(
  host: HTMLElement,
  simulation: GardenSimulation,
  name: string,
  characterId = ""
) {
  const app = new Application();
  const canvas = document.createElement("canvas");
  let bubble: ReturnType<typeof createSpeechBubble> | undefined;
  let atlas: Texture | undefined;
  const frames: Texture[] = [];
  const terrainTextures: Texture[] = [];
  const release = () => {
    bubble?.destroy();
    if (app.renderer) app.destroy({ removeView: true }, { children: true });
    else {
      app.stage.destroy({ children: true });
      const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
      canvas.remove();
    }
    for (const texture of frames) texture.destroy(false);
    atlas?.destroy(true);
    for (const texture of terrainTextures) texture.destroy(true);
  };
  try {
    const image = new Image();
    image.src = atlasURL;
    await image.decode();
    atlas = Texture.from(image, true);
    const textures = Object.fromEntries(
      SPRITE_KEYS.map((key, index) => {
        const texture = new Texture({
          source: atlas!.source,
          frame: new Rectangle(
            (index % 4) * 256,
            Math.floor(index / 4) * 256,
            256,
            256
          ),
        });
        frames.push(texture);
        return [key, texture];
      })
    ) as Record<SpriteKey, Texture>;
    await app.init({
      canvas,
      width: 720,
      height: 480,
      backgroundColor: 0xe8edda,
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
      "Hand-painted orchard. Plant growth, water and harvest progress are also described in the status below."
    );
    host.appendChild(app.canvas);
    const loadTerrain = async (url: string) => {
      const image = new Image();
      image.src = url;
      await image.decode();
      return image;
    };
    const images = await Promise.all([
      loadTerrain(grassURL),
      loadTerrain(earthURL),
    ]);
    const terrain = createTerrain(images[0], images[1], simulation.plants);
    const ownTexture = (source: HTMLCanvasElement) => {
      const texture = Texture.from(source, true);
      terrainTextures.push(texture);
      return texture;
    };
    const ground = new Container();
    ground.addChild(new Sprite(ownTexture(terrain.ground)));
    const world = new Container({ sortableChildren: true });
    app.stage.addChild(ground, world);
    const sprite = (
      key: SpriteKey,
      x: number,
      y: number,
      size: number,
      parent: Container = world
    ) => {
      const object = new Sprite(textures[key]);
      object.anchor.set(0.5, 236 / 256);
      object.position.set(x, y);
      object.width = object.height = size;
      object.zIndex = y;
      parent.addChild(object);
      return object;
    };
    // A layered hedge line, with flowering shrubs breaking up the repeated silhouette.
    for (let i = 0; i < 11; i++) {
      const x = 24 + i * 68;
      sprite(
        i % 3 === 1 ? "bush-flowering" : "bush-round",
        x,
        69 + (i % 2) * 5,
        104
      );
    }
    for (const [x, y, size] of [
      [27, 172, 85],
      [32, 350, 83],
      [698, 255, 79],
      [696, 390, 90],
    ])
      sprite("bush-flowering", x, y, size);
    sprite("cottage", 610, 154, 146);
    sprite("tool-shed", 397, 143, 92);
    sprite("potting-bench", 491, 151, 82);
    const sack = sprite("compost-sack", 440, 157, 34);
    // The host interaction point is in front of the well, not under its artwork.
    sprite("well", WELL.x, WELL.y - 20, 126);
    const plantViews = simulation.plants.map((plant, i) => {
      const artwork = terrain.beds[i];
      const bed = new Sprite(ownTexture(artwork.canvas));
      bed.position.set(artwork.x, artwork.y);
      bed.alpha = 0.45;
      ground.addChild(bed);
      const crop = sprite("plant-sprout", plant.x, plant.y + 12, 84);
      return { crop, bed };
    });
    const basket = sprite("basket-empty", 638, 407, 70);
    const companion = new Container();
    const actor = sprite(
      gardenerSprite({ id: characterId, name }),
      0,
      10,
      70,
      companion
    );
    const can = sprite("watering-can", 20, 3, 29, companion);
    can.scale.x = -Math.abs(can.scale.x);
    world.addChild(companion);
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    bubble = createSpeechBubble(host, name);
    let destroyed = false;
    return {
      say(speech: string) {
        if (!destroyed) bubble?.say(speech);
      },
      pauseSpeech() {
        bubble?.pause();
      },
      resumeSpeech() {
        bubble?.resume();
      },
      render() {
        if (destroyed) return;
        const { x, y } = simulation.companion;
        companion.position.set(x, y);
        bubble?.place(x / 720, (y - 56) / 480);
        companion.zIndex = y + 10;
        const moving = simulation.task === "walking" && !reducedMotion;
        actor.rotation = moving ? Math.sin(simulation.elapsed * 8) * 0.025 : 0;
        can.visible =
          simulation.phase === "watering" && simulation.task !== "feeding";
        sack.visible = simulation.compost > 0;
        can.rotation =
          simulation.task === "watering"
            ? reducedMotion
              ? -0.35
              : -0.35 + Math.sin(simulation.elapsed * 5) * 0.08
            : 0;
        const count = simulation.fruit + simulation.bonusFruit;
        basket.texture = textures[count > 0 ? "basket-full" : "basket-empty"];
        for (const [i, view] of plantViews.entries()) {
          const plant = simulation.plants[i];
          view.crop.texture =
            textures[plantSprite(plant, simulation.phase, simulation.growth)];
          view.bed.visible = plant.watered;
          view.bed.tint = plant.watered
            ? plant.fed
              ? 0xb3a28b
              : 0xb9b5a7
            : 0xffffff;
        }
        app.render();
      },
      destroy() {
        if (destroyed) return;
        destroyed = true;
        release();
      },
    };
  } catch (error) {
    release();
    throw error;
  }
}
