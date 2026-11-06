import type { BridgeRequest, BridgeResponse } from "@ifsoul/adapter-sdk";
/** Original game-owned synthetic dialogue; no model or factual recall. */
export function exampleScenarioResponse(
  request: BridgeRequest,
): BridgeResponse {
  return {
    choiceId: request.fallbackChoiceId,
    source: "scenario",
    speech:
      request.language === "ru"
        ? "Давай немного позаботимся об этих растениях."
        : "Let’s give these little plants some care.",
  };
}
