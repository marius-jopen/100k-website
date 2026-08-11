/**
 * Attaches Bunny Stream HLS playback to every `<video data-hls>` on the page.
 *
 * Sources are never set in the markup: Safari and iOS can play the playlist
 * natively, everything else needs hls.js, and hls.js is only downloaded when a
 * video is actually about to be attached. Elements marked `data-hls-defer` wait
 * until the script decides they belong to the current breakpoint — that is how
 * the desktop and phone project backgrounds avoid loading each other's video.
 *
 * Elements marked `data-hls-manual` are never picked up by the automatic sweep;
 * something else owns their lifecycle and calls `attachBunnyHlsTo` /
 * `detachBunnyHls` by hand. The desktop project spotlight uses this so that its
 * two dozen off-screen slides do not each open an HLS player and fight the
 * visible one for bandwidth.
 */
import type HlsType from "hls.js";

type HlsConstructor = typeof HlsType;

type ManagedVideo = HTMLVideoElement & { bunnyHls?: InstanceType<HlsConstructor> };

declare global {
  interface Window {
    attachBunnyHls?: (root?: ParentNode | HTMLVideoElement) => void;
    attachBunnyHlsTo?: (video: HTMLVideoElement) => void;
    detachBunnyHls?: (video: HTMLVideoElement) => void;
    upgradeBunnyHlsQuality?: (video: HTMLVideoElement) => void;
  }
}

const ATTACHED = "bunnyHlsAttached";
const PHONE_BREAKPOINT = 700;
const BANDWIDTH_KEY = "bunnyHlsBandwidth";

// Fresh hls.js instances otherwise start from a pessimistic guess and spend the
// first fragments climbing the ladder. Every player on the page reports what it
// measured, so the next one starts at the quality the connection can actually
// sustain — and sessionStorage carries that across navigations.
const DEFAULT_BANDWIDTH_ESTIMATE = 1_500_000;
const MIN_BANDWIDTH_ESTIMATE = 250_000;
const MAX_BANDWIDTH_ESTIMATE = 60_000_000;

let bandwidthEstimate = readStoredBandwidth();

function readStoredBandwidth(): number {
  try {
    const stored = Number(window.sessionStorage.getItem(BANDWIDTH_KEY));
    if (Number.isFinite(stored) && stored >= MIN_BANDWIDTH_ESTIMATE) {
      return Math.min(stored, MAX_BANDWIDTH_ESTIMATE);
    }
  } catch {
    // Private mode / storage disabled — the default estimate is fine.
  }
  return DEFAULT_BANDWIDTH_ESTIMATE;
}

function rememberBandwidth(estimate: number): void {
  if (!Number.isFinite(estimate) || estimate < MIN_BANDWIDTH_ESTIMATE) return;
  bandwidthEstimate = Math.min(estimate, MAX_BANDWIDTH_ESTIMATE);
  try {
    window.sessionStorage.setItem(BANDWIDTH_KEY, String(Math.round(bandwidthEstimate)));
  } catch {
    // Ignore — the in-memory estimate still helps for this page.
  }
}

let hlsModule: Promise<HlsConstructor> | null = null;

function loadHls(): Promise<HlsConstructor> {
  hlsModule ??= import("hls.js").then((module) => module.default);
  return hlsModule;
}

function canPlayNatively(video: HTMLVideoElement): boolean {
  return Boolean(video.canPlayType("application/vnd.apple.mpegurl"));
}

async function attach(video: ManagedVideo): Promise<void> {
  if (video.dataset[ATTACHED] === "true") return;

  const playlist = video.dataset.hls;
  const progressive = video.dataset.mp4;
  if (!playlist && !progressive) return;

  video.dataset[ATTACHED] = "true";

  if (playlist && canPlayNatively(video)) {
    video.src = playlist;
    return;
  }

  if (playlist) {
    try {
      const Hls = await loadHls();

      if (Hls.isSupported()) {
        const hls = new Hls({
          // These clips are short, silent loops used as decoration — keep the
          // buffer small so a page full of them does not saturate the network.
          maxBufferLength: 10,
          maxMaxBufferLength: 30,
          // Keep what has already been downloaded so a looping clip replays
          // from buffer instead of re-fetching every fragment on each pass.
          backBufferLength: 60,
          // Never fetch more pixels than the element can show, but do account
          // for device pixel ratio so retina screens still get a sharp level.
          capLevelToPlayerSize: true,
          // -1 lets ABR choose the opening level from the estimate below, so a
          // fast connection starts on a high rendition instead of climbing.
          startLevel: -1,
          abrEwmaDefaultEstimate: bandwidthEstimate,
          // Slightly more eager than the 0.7 default about stepping up a level.
          abrBandWidthUpFactor: 0.8,
          // What decides how fast a prefetched clip can paint its first frame:
          // pull the playlist and the opening fragment together instead of
          // waiting for the manifest round trip to finish first.
          startFragPrefetch: true,
          // Give up on a stalled fragment quickly and retry — a hung request
          // otherwise holds the frame empty for the full default timeout.
          fragLoadingTimeOut: 8000,
          manifestLoadingTimeOut: 6000,
          manifestLoadingMaxRetry: 3,
        });

        video.bunnyHls = hls;

        hls.on(Hls.Events.FRAG_LOADED, () => rememberBandwidth(hls.bandwidthEstimate));

        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (!data.fatal) return;

          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            hls.startLoad();
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
          } else {
            hls.destroy();
            if (video.bunnyHls === hls) video.bunnyHls = undefined;
            if (progressive) video.src = progressive;
          }
        });

        hls.loadSource(playlist);
        hls.attachMedia(video);
        return;
      }
    } catch {
      // hls.js failed to load — fall through to the progressive rendition.
    }
  }

  if (progressive) video.src = progressive;
}

/**
 * Pulls a clip up to the best rendition the measured bandwidth supports.
 *
 * ABR normally handles this on its own, but these are short loops: once the
 * first fragments are buffered nothing more is fetched, so a clip that opened
 * on a low level while the estimate was still pessimistic would stay there for
 * as long as it is on screen. Setting `currentLevel` re-loads from the current
 * position at the higher rendition.
 */
function upgradeQuality(video: ManagedVideo): void {
  const hls = video.bunnyHls;
  const levels = hls?.levels;
  if (!hls || !levels?.length) return;

  // Respect the cap `capLevelToPlayerSize` derived from the element's size —
  // there is nothing to gain from more pixels than it can show.
  const cap = hls.autoLevelCapping >= 0
    ? Math.min(hls.autoLevelCapping, levels.length - 1)
    : levels.length - 1;

  // Leave headroom so the upgrade does not immediately stall.
  const budget = bandwidthEstimate * 0.8;

  let target = 0;
  for (let level = 0; level <= cap; level += 1) {
    if (levels[level].bitrate <= budget) target = level;
  }

  if (target > hls.currentLevel) hls.currentLevel = target;
}

function detach(video: ManagedVideo): void {
  const hls = video.bunnyHls;
  if (hls) {
    video.bunnyHls = undefined;
    hls.destroy();
  }
  video.removeAttribute("src");
  video.load();
  delete video.dataset[ATTACHED];
}

function isDeferredForOtherBreakpoint(video: HTMLVideoElement): boolean {
  const target = video.dataset.hlsDefer;
  if (!target) return false;
  const isPhone = window.innerWidth <= PHONE_BREAKPOINT;
  return target === "phone" ? !isPhone : isPhone;
}

function shouldAutoAttach(video: HTMLVideoElement): boolean {
  if (video.dataset.hlsManual !== undefined) return false;
  return !isDeferredForOtherBreakpoint(video);
}

function attachAll(root: ParentNode | HTMLVideoElement = document): void {
  const videos =
    root instanceof HTMLVideoElement
      ? [root]
      : Array.from(root.querySelectorAll<HTMLVideoElement>("video[data-hls], video[data-mp4]"));

  for (const video of videos) {
    if (!shouldAutoAttach(video)) continue;
    void attach(video);
  }
}

window.attachBunnyHls = attachAll;
// Bypasses the `data-hls-manual` / breakpoint rules: the caller has decided
// this specific element should stream right now.
window.attachBunnyHlsTo = (video) => void attach(video);
window.detachBunnyHls = (video) => detach(video);
window.upgradeBunnyHlsQuality = (video) => upgradeQuality(video);
attachAll();

// Project pages are injected into #post by the legacy app, and the media
// carousel re-renders figures, so keep watching for new video elements.
new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (node instanceof HTMLVideoElement) {
        if (shouldAutoAttach(node)) void attach(node);
      } else if (node instanceof Element) {
        attachAll(node);
      }
    }
  }
}).observe(document.documentElement, { childList: true, subtree: true });

// A resize across the phone breakpoint brings the other background set into play.
let resizeTimer = 0;
window.addEventListener("resize", () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => attachAll(), 200);
});
