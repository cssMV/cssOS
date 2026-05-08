/**
 * CSSOS Phase 2 Module 1 — Live Activity TS bridge.
 *
 * Thin wrapper around the native `CssosLiveActivity` Capacitor plugin
 * (mobile/ios/App/App/CssosLiveActivity.swift). Live Activities are an
 * iOS 16.1+ feature; on web / Android / older iOS this module degrades
 * to no-ops so callers never have to feature-detect themselves.
 *
 * Stage strings match the cinema MV pipeline:
 *   "cover" | "lyrics" | "music" | "video" | "compose"
 */

export type CinemaStage = "cover" | "lyrics" | "music" | "video" | "compose";

export interface CinemaContentState {
  stage: CinemaStage;
  pct: number;     // 0..100
  etaSecs: number; // remaining seconds, best-effort
}

export interface StartLiveActivityArgs {
  personName: string;
  runId: string;
}

export interface StartLiveActivityResult {
  activityId: string;
  pushToken: string;
}

interface CapacitorLike {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  Plugins?: Record<string, unknown>;
}
interface NativePlugin {
  start(args: StartLiveActivityArgs): Promise<StartLiveActivityResult>;
  update(args: { activityId: string } & CinemaContentState): Promise<void>;
  end(args: { activityId: string }): Promise<void>;
}

function getPlugin(): NativePlugin | null {
  try {
    const cap = (globalThis as unknown as { Capacitor?: CapacitorLike }).Capacitor;
    if (!cap || typeof cap.isNativePlatform !== "function") return null;
    if (!cap.isNativePlatform()) return null;
    if (cap.getPlatform && cap.getPlatform() !== "ios") return null;
    const plugin = (cap.Plugins || {})["CssosLiveActivity"] as NativePlugin | undefined;
    return plugin || null;
  } catch {
    return null;
  }
}

/** Returns true when the current runtime can host a Live Activity. */
export function isLiveActivitySupported(): boolean {
  return getPlugin() !== null;
}

export async function startCinemaActivity(
  args: StartLiveActivityArgs,
): Promise<StartLiveActivityResult | null> {
  const p = getPlugin();
  if (!p) return null;
  try {
    return await p.start(args);
  } catch (err) {
    console.warn("[live-activity] start failed:", err);
    return null;
  }
}

export async function updateCinemaActivity(
  activityId: string,
  state: CinemaContentState,
): Promise<void> {
  const p = getPlugin();
  if (!p || !activityId) return;
  try {
    await p.update({ activityId, ...state });
  } catch (err) {
    console.warn("[live-activity] update failed:", err);
  }
}

export async function endCinemaActivity(activityId: string): Promise<void> {
  const p = getPlugin();
  if (!p || !activityId) return;
  try {
    await p.end({ activityId });
  } catch (err) {
    console.warn("[live-activity] end failed:", err);
  }
}
