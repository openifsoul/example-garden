import type { GardenPhase, Plant } from "./simulation.js";
import type { SpriteKey } from "./sprite-keys.js";

/** Presentation follows completed host actions, never predicts a successful harvest. */
export function plantSprite(
  plant: Pick<Plant, "watered" | "harvested">,
  phase: GardenPhase,
  growth: number,
): SpriteKey {
  if (plant.harvested) return "plant-harvested";
  if (!plant.watered) return "plant-sprout";
  if (phase === "watering") return "plant-young";
  if (growth < 0.35) return "plant-flowering";
  if (growth < 1) return "plant-green";
  return "plant-ripe";
}

/** Known demo identities change appearance only; arbitrary hosts keep the neutral gardener. */
export function gardenerSprite(character: {
  id: string;
  name: string;
}): SpriteKey {
  const known = ["mira", "rook", "pip"];
  const id = character.id.toLowerCase(),
    name = character.name.toLowerCase();
  const identity = known.includes(id) ? id : known.includes(name) ? name : null;
  return identity ? (`${identity}-gardener` as SpriteKey) : "gardener";
}
