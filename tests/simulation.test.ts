import assert from "node:assert/strict";
import test from "node:test";
import { GardenSimulation } from "../src/game/simulation";

test("both priorities complete an honest garden visit in 2–4 minutes", () => {
  for (const priority of ["near-first", "far-first"]) {
    const host = new GardenSimulation();
    const events = [];
    let decisions = 0;
    for (let i = 0; i < 3000 && host.phase !== "complete"; i++) {
      if (host.needsDecision) {
        assert.equal(host.setPriority(priority), true);
        decisions++;
      }
      host.step(0.1);
      events.push(...host.drainEvents());
      assert.ok(host.water >= 0 && host.water <= 4);
      assert.equal(host.fruit, host.plants.filter((p) => p.harvested).length);
    }
    assert.equal(host.phase, "complete");
    assert.equal(decisions, 2);
    assert.equal(host.fruit, 8);
    assert.ok(host.plants.every((p) => p.watered && p.harvested));
    assert.equal(
      events.filter((e) => e.id.startsWith("garden-water-")).length,
      2,
    );
    assert.equal(events.filter((e) => e.kind === "outcome").length, 1);
    assert.ok(
      host.elapsed >= 120 && host.elapsed <= 240,
      `${priority}: ${host.elapsed}s`,
    );
    assert.equal(events.at(-1)?.id, "garden-complete");
    host.step(10);
    assert.deepEqual(host.drainEvents(), []);
  }
});
test("unknown and duplicate proposals cannot bypass host phase boundaries", () => {
  const host = new GardenSimulation();
  host.step(60);
  assert.equal(host.elapsed, 0);
  assert.equal(host.setPriority("teleport-and-harvest"), false);
  assert.equal(host.needsDecision, true);
  assert.equal(host.setPriority("near-first"), true);
  assert.equal(host.setPriority("far-first"), false);
  host.step(Number.NaN);
  host.step(-1);
  assert.equal(host.elapsed, 0);
  host.step(1);
  assert.equal(host.fruit, 0);
  assert.deepEqual(host.drainEvents(), []);
});

test("companion distributes only three compost portions in its chosen order and harvests the bonus", () => {
  for (const priority of ["near-first", "far-first"]) {
    const host = new GardenSimulation();
    const events = [];
    for (let i = 0; i < 2400 && host.phase !== "complete"; i++) {
      if (host.needsDecision) host.setPriority(priority);
      host.step(0.1);
      events.push(...host.drainEvents());
      assert.ok(host.compost >= 0 && host.compost <= 3);
      assert.ok(host.growth >= 0 && host.growth <= 1);
    }
    assert.equal(host.phase, "complete");
    assert.deepEqual(
      host.plants.filter((p) => p.fed).map((p) => p.id),
      priority === "near-first" ? [0, 1, 2] : [5, 6, 7],
    );
    assert.equal(host.compost, 0);
    assert.equal(host.bonusFruit, 3);
    assert.equal(host.fruit + host.bonusFruit, 11);
    assert.equal(
      events.filter((e) => e.id.startsWith("garden-fed-")).length,
      3,
    );
    assert.match(events.at(-1)!.summary, /11 fruits collected/);
    host.step(10);
    assert.equal(host.fruit + host.bonusFruit, 11);
    assert.deepEqual(host.drainEvents(), []);
  }
});

test("actual garden actions belong to the companion while the player observes", () => {
  const host = new GardenSimulation();
  const events = [];
  for (let i = 0; i < 3000 && host.phase !== "complete"; i++) {
    if (host.needsDecision) host.setPriority("near-first");
    host.step(0.1);
    events.push(...host.drainEvents());
  }
  assert.ok(
    events.some((event) => event.summary.includes("companion watered")),
  );
  assert.ok(
    events.some((event) => event.summary.includes("companion harvested")),
  );
  for (const event of events) {
    assert.equal(event.actor, "agent");
    assert.equal(event.observer, "user");
    assert.equal(event.recipient, "unknown");
  }
});
