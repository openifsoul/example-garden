import assert from "node:assert/strict";
import test from "node:test";
import { GardenSimulation } from "../src/game/simulation";
import { plantSprite } from "../src/game/visual-state";

test("all six crop sprites follow an autonomous visit without inventing a harvest", () => {
  const host = new GardenSimulation();
  const seen = new Set<string>();
  for (let i = 0; i < 2400 && host.phase !== "complete"; i++) {
    if (host.needsDecision) host.setPriority("near-first");
    host.step(0.1);
    for (const plant of host.plants) {
      const key = plantSprite(plant, host.phase, host.growth);
      seen.add(key);
      assert.equal(key === "plant-harvested", plant.harvested);
      if (!plant.watered) assert.equal(key, "plant-sprout");
      if (key === "plant-ripe") assert.equal(host.growth, 1);
    }
  }
  assert.equal(host.phase, "complete");
  assert.deepEqual(
    [...seen].sort(),
    [
      "plant-sprout",
      "plant-young",
      "plant-flowering",
      "plant-green",
      "plant-ripe",
      "plant-harvested",
    ].sort(),
  );
  assert.equal(host.fruit + host.bonusFruit, 11);
});

test("visual state cannot mark a watered or ripe plant as already harvested", () => {
  const plant = { watered: true, harvested: false };
  assert.equal(plantSprite(plant, "watering", 0), "plant-young");
  assert.equal(plantSprite(plant, "growing", 0.2), "plant-flowering");
  assert.equal(plantSprite(plant, "growing", 0.6), "plant-green");
  assert.equal(plantSprite(plant, "harvesting", 1), "plant-ripe");
  assert.equal(plantSprite(plant, "complete", 1), "plant-ripe");
  assert.deepEqual(plant, { watered: true, harvested: false });
});

test("the garden uses each companion's body while unknown characters keep neutral art", async () => {
  const { gardenerSprite } = await import("../src/game/visual-state");
  for (const id of ["mira", "rook", "pip"])
    assert.equal(gardenerSprite({ id, name: "Visitor" }), `${id}-gardener`);
  assert.equal(
    gardenerSprite({ id: "example-companion", name: "Mira" }),
    "mira-gardener",
  );
  assert.equal(gardenerSprite({ id: "custom", name: "Visitor" }), "gardener");
});
