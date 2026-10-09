import type { FilterDefinition } from "@/lib/camera/types";

export type DirectRenderState = {
  transitionActive: boolean;
  sceneOverlayActive: boolean;
  overlayPending: boolean;
  hudPending: boolean;
  masterOverlayActive: boolean;
  pipeline: FilterDefinition["pipeline"];
};

/**
 * A direct render is safe only when nothing needs to sample the completed
 * frame afterwards. The two feedback/multipass pipelines always keep their
 * framebuffer target so their temporal state and composition semantics stay
 * intact.
 */
export function canRenderDirectToCanvas(state: DirectRenderState): boolean {
  return (
    !state.transitionActive &&
    !state.sceneOverlayActive &&
    !state.overlayPending &&
    !state.hudPending &&
    !state.masterOverlayActive &&
    state.pipeline !== "halation" &&
    state.pipeline !== "kinetic-melt"
  );
}
