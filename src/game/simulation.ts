/** Original synthetic host. All mechanics remain independent of IfSoul/Pixi. */
export type Point = { x: number; y: number };
export type GardenPhase = "watering" | "growing" | "harvesting" | "complete";
export type GardenTask =
  "walking" | "filling" | "watering" | "feeding" | "picking" | "resting";
export interface Plant extends Point {
  id: number;
  watered: boolean;
  harvested: boolean;
  fed: boolean;
}
export interface GardenEvent {
  id: string;
  summary: string;
  kind: "progress" | "outcome";
  actor: "agent";
  observer: "user";
  recipient: "unknown";
}
export const WELL = { x: 105, y: 270 };
export class GardenSimulation {
  readonly plants: Plant[] = Array.from({ length: 8 }, (_, id) => ({
    id,
    x: 270 + (id % 4) * 95,
    y: 205 + Math.floor(id / 4) * 115,
    watered: false,
    harvested: false,
    fed: false,
  }));
  readonly companion: Point = { x: 105, y: 390 };
  phase: GardenPhase = "watering";
  task: GardenTask = "walking";
  elapsed = 0;
  water = 0;
  fruit = 0;
  compost = 3;
  bonusFruit = 0;
  private order = this.plants.map((p) => p.id);
  private target: Point = WELL;
  private remaining = 0;
  private destination: "well" | "plant" = "well";
  private growUntil = 0;
  private events: GardenEvent[] = [];
  private visited = new Set<GardenPhase>();
  /** Only bounded batch priorities are accepted; a new phase needs a fresh choice. */
  setPriority(choiceId: string): boolean {
    if (
      !["near-first", "far-first"].includes(choiceId) ||
      this.visited.has(this.phase) ||
      !["watering", "harvesting"].includes(this.phase)
    )
      return false;
    this.visited.add(this.phase);
    this.order = this.plants.map((p) => p.id);
    if (choiceId === "far-first") this.order.reverse();
    if (this.phase === "harvesting") this.walkToPlant();
    return true;
  }
  get progress(): string {
    return `${this.plants.filter((p) => p.watered).length}/8 watered · ${this.water}/4 water · ${this.compost}/3 compost · ${this.fruit + this.bonusFruit} fruit collected`;
  }
  get growth(): number {
    if (this.phase === "watering") return 0;
    if (this.phase !== "growing") return 1;
    return Math.max(0, Math.min(1, 1 - (this.growUntil - this.elapsed) / 25));
  }
  get needsDecision(): boolean {
    return (
      ["watering", "harvesting"].includes(this.phase) &&
      !this.visited.has(this.phase)
    );
  }
  drainEvents(): GardenEvent[] {
    return this.events.splice(0);
  }
  private walkToPlant(): void {
    const plant = this.order
      .map((id) => this.plants[id])
      .find((p) => (this.phase === "watering" ? !p.watered : !p.harvested));
    if (!plant) return;
    // Approach via the open paths rather than walking through the planting bed.
    this.target = { x: plant.x, y: plant.y + 38 };
    this.destination = "plant";
    this.task = "walking";
  }
  step(seconds: number): void {
    if (
      !Number.isFinite(seconds) ||
      seconds <= 0 ||
      this.phase === "complete" ||
      this.needsDecision
    )
      return;
    // Small fixed slices preserve arrival/service ordering even after a slow frame.
    for (let left = seconds; left > 0; left -= 0.05)
      this.tick(Math.min(left, 0.05));
  }
  private tick(dt: number): void {
    if (this.phase === "complete" || this.needsDecision) return;
    this.elapsed += dt;
    if (this.phase === "growing") {
      if (this.elapsed >= this.growUntil) {
        this.phase = "harvesting";
        this.task = "resting";
      }
      return;
    }
    if (this.task === "walking") {
      const dx = this.target.x - this.companion.x,
        dy = this.target.y - this.companion.y;
      const distance = Math.hypot(dx, dy),
        stride = 57 * dt;
      if (distance > stride) {
        this.companion.x += (dx / distance) * stride;
        this.companion.y += (dy / distance) * stride;
        return;
      }
      Object.assign(this.companion, this.target);
      this.task =
        this.destination === "well"
          ? "filling"
          : this.phase === "watering"
            ? "watering"
            : "picking";
      this.remaining =
        this.task === "filling" ? 5 : this.task === "watering" ? 5 : 4;
      return;
    }
    this.remaining -= dt;
    if (this.remaining > 0) return;
    if (this.task === "filling") {
      this.water = 4;
      this.events.push({
        id: `garden-water-${this.plants.filter((p) => p.watered).length}`,
        kind: "progress",
        actor: "agent",
        observer: "user",
        recipient: "unknown",
        summary: "The companion filled four portions of water at the well.",
      });
      this.walkToPlant();
      return;
    }
    const plant = this.order
      .map((id) => this.plants[id])
      .find((p) => (this.phase === "watering" ? !p.watered : !p.harvested));
    if (!plant) return;
    if (this.task === "watering" && this.compost > 0) {
      this.task = "feeding";
      this.remaining = 3;
      return;
    }
    if (this.task === "watering" || this.task === "feeding") {
      if (this.task === "feeding") {
        plant.fed = true;
        this.compost--;
        this.events.push({
          id: `garden-fed-${plant.id}`,
          kind: "progress",
          actor: "agent",
          observer: "user",
          recipient: "unknown",
          summary: `The companion used one portion of compost on bed ${plant.id + 1}. This bed will yield an extra fruit.`,
        });
      }
      plant.watered = true;
      this.water--;
      this.events.push({
        id: `garden-watered-${plant.id}`,
        kind: "progress",
        actor: "agent",
        observer: "user",
        recipient: "unknown",
        summary: `The companion watered plant ${plant.id + 1}.`,
      });
      if (this.plants.every((p) => p.watered)) {
        this.phase = "growing";
        this.task = "resting";
        this.growUntil = this.elapsed + 25;
      } else if (!this.water) {
        this.target = WELL;
        this.destination = "well";
        this.task = "walking";
      } else this.walkToPlant();
    } else if (this.task === "picking") {
      plant.harvested = true;
      this.fruit++;
      if (plant.fed) this.bonusFruit++;
      this.events.push({
        id: `garden-picked-${plant.id}`,
        kind: "progress",
        actor: "agent",
        observer: "user",
        recipient: "unknown",
        summary: `The companion harvested bed ${plant.id + 1}: ${plant.fed ? "two fruits from the composted soil" : "one fruit"}.`,
      });
      if (this.fruit === this.plants.length) {
        this.phase = "complete";
        this.task = "resting";
        this.events.push({
          id: "garden-complete",
          kind: "outcome",
          actor: "agent",
          observer: "user",
          recipient: "unknown",
          summary: `Garden complete: all eight beds watered and harvested. ${this.fruit + this.bonusFruit} fruits collected, including ${this.bonusFruit} extra from three portions of compost.`,
        });
      } else this.walkToPlant();
    }
  }
}
