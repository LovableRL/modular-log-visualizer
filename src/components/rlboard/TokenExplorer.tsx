import type { RLBoardRecord } from "@/lib/rlboard/schema";
import { TokenPager } from "./TokenPager";

/**
 * TokenExplorer — composite that pairs the global minimap (inside TokenPager)
 * with a paged drill-down + per-page curves. This is the default "give me one
 * thing that explains a rollout" module, and the layout used by the
 * Playground's right pane.
 */
export function TokenExplorer({ record }: { record: RLBoardRecord }) {
  return <TokenPager record={record} />;
}
