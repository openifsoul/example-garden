import type { GameMountOptions, MountedGame } from "@ifsoul/adapter-sdk";
import { GardenSimulation } from "./simulation.js";
import { createGardenView } from "./renderer.js";

export async function mount(
  container: HTMLElement,
  options: GameMountOptions
): Promise<MountedGame> {
  const simulation = new GardenSimulation();
  const root = document.createElement("section");
  root.className = "soul-garden";
  root.style.cssText =
    "padding:0;background:transparent;color:var(--foreground)";
  root.setAttribute("aria-label", "Little orchard companion garden");
  const scene = document.createElement("div");
  const status = document.createElement("p");
  status.setAttribute("role", "status");
  const speech = document.createElement("p");
  speech.setAttribute("aria-live", "polite");
  const hint = document.createElement("p");
  hint.textContent =
    "Just watch. Your companion manages water, shares three portions of compost and harvests the orchard.";
  hint.style.cssText =
    "font-size:13px;color:var(--muted-foreground);margin:8px 0";
  status.style.cssText =
    "font-size:12px;margin:12px 0 6px;font-variant-numeric:tabular-nums";
  speech.style.cssText =
    "min-height:48px;padding:12px;border:1px solid var(--border);border-radius:var(--radius,8px);margin:8px 0";
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Pause garden";
  button.style.cssText =
    "min-height:44px;padding:8px 16px;border:1px solid var(--border);background:var(--background);color:var(--foreground);border-radius:var(--radius,8px);cursor:pointer";
  for (const child of [scene, hint, status, button]) root.appendChild(child);
  container.appendChild(root);
  let destroyed = false,
    paused = false,
    pending = false,
    frame = 0,
    lastTime = 0;
  let deferred: (() => void) | undefined;
  let view: Awaited<ReturnType<typeof createGardenView>> | undefined;
  let requestNumber = 0;
  const idPrefix = `garden-${options.character.id}-${Math.random()
    .toString(36)
    .slice(2)}`;
  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    cancelAnimationFrame(frame);
    options.signal.removeEventListener("abort", destroy);
    button.removeEventListener("click", toggle);
    view?.destroy();
    root.remove();
    deferred = undefined;
  };
  const pause = () => {
    if (!destroyed) {
      paused = true;
      view?.pauseSpeech();
      button.textContent = "Resume garden";
      status.textContent = `Paused · ${simulation.progress}`;
    }
  };
  const resume = () => {
    if (!destroyed) {
      paused = false;
      view?.resumeSpeech();
      lastTime = 0;
      button.textContent = "Pause garden";
      const apply = deferred;
      deferred = undefined;
      apply?.();
    }
  };
  const toggle = () => (paused ? resume() : pause());
  const game = {
    pause,
    resume,
    destroy,
    say(text: string) {
      view?.say(text);
    },
  };
  button.addEventListener("click", toggle);
  options.signal.addEventListener("abort", destroy, { once: true });
  if (options.signal.aborted) {
    destroy();
    return game;
  }
  try {
    const created = await createGardenView(
      scene,
      simulation,
      options.character.name,
      options.character.id
    );
    if (destroyed) {
      created.destroy();
      return game;
    }
    view = created;
  } catch {
    if (destroyed) return game;
    status.textContent =
      "The garden renderer could not start. Try reopening this game with WebGL enabled.";
    button.disabled = true;
    speech.textContent = "No garden actions have been completed.";
    return game;
  }
  const requestDecision = () => {
    if (pending || destroyed || paused || !simulation.needsDecision) return;
    pending = true;
    const phase = simulation.phase;
    const requestId = `${idPrefix}-${++requestNumber}`;
    const context =
      phase === "watering"
        ? `${options.character.name} is in a synthetic garden with eight thirsty plants. Choose the order for the whole watering batch. Only three portions of compost are available; the first three beds in your chosen order will each yield an extra fruit. The host handles two well trips, feeding and all movement.`
        : "All eight plants are watered and the fruit is now ripe. Choose the order for collecting the whole harvest; the host handles all movement and picking.";
    speech.textContent = "Choosing a garden priority…";
    // The bounded SDK bridge owns the request deadline. A shorter host timer
    // would discard valid slower replies before that configured budget.
    const fallback = {
      choiceId: "near-first",
      speech: "I will start with the nearest bed.",
      source: "fallback" as const,
    };
    void Promise.resolve()
      .then(() =>
        options.bridge.decide({
          requestId,
          context,
          choices: [
            { id: "near-first", label: "Near bed first" },
            { id: "far-first", label: "Far bed first" },
          ],
          fallbackChoiceId: "near-first",
        })
      )
      .catch(() => fallback)
      .then((decision) => {
        const apply = () => {
          if (destroyed || simulation.phase !== phase) return;
          const valid =
            decision != null &&
            ["near-first", "far-first"].includes(decision.choiceId) &&
            typeof decision.speech === "string";
          simulation.setPriority(valid ? decision.choiceId : "near-first");
          speech.textContent = `${options.character.name}: ${
            valid && decision.speech.trim()
              ? decision.speech.slice(0, 280)
              : fallback.speech
          }${
            !valid || decision.source === "fallback" ? " (Host fallback)" : ""
          }`;
          view?.say(valid ? decision.speech : fallback.speech);
          pending = false;
        };
        if (destroyed) return;
        if (paused) deferred = apply;
        else apply();
      });
  };
  const tick = (time: number) => {
    if (destroyed) return;
    const dt = lastTime ? Math.min((time - lastTime) / 1000, 0.1) : 0;
    lastTime = time;
    if (!paused) {
      requestDecision();
      simulation.step(dt);
      for (const event of simulation.drainEvents()) {
        try {
          options.bridge.report({ ...event, id: `${idPrefix}-${event.id}` });
        } catch {
          /* A report sink cannot undo observed host mechanics. */
        }
      }
      const activity =
        simulation.phase === "complete"
          ? "Harvest complete"
          : pending
          ? "Choosing priorities"
          : simulation.phase === "growing"
          ? `Fruit ripening ${Math.round(simulation.growth * 100)}%`
          : `${simulation.task[0].toUpperCase()}${simulation.task.slice(1)}`;
      const nextStatus = `${activity} · ${simulation.progress}`;
      if (status.textContent !== nextStatus) status.textContent = nextStatus;
      if (simulation.phase === "complete") {
        button.disabled = true;
        speech.textContent = `${
          options.character.name
        } finished the garden visit. ${
          simulation.fruit + simulation.bonusFruit
        } fruits are in the basket, with ${
          simulation.bonusFruit
        } extra from compost.`;
      }
      view?.render();
    }
    if (simulation.phase !== "complete") frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return game;
}
