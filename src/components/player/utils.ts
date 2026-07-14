import type { MediaEntry } from "./types";

/**
 * Picks the next video index that hasn't been played yet in this cycle.
 * Uses a fair Fisher-Yates shuffle, with a soft rule to avoid repeating
 * the same artist back-to-back when possible.
 */
export function getNextUnplayedIndex(
    length: number,
    lastPlayedIdx: number | null,
    mediaList: MediaEntry[],
    playedSet: Set<number>
): { index: number; newPlayedSet: Set<number> } {
    if (length <= 1) return { index: 0, newPlayedSet: new Set([0]) };

    const currentPlayed = playedSet.size >= length ? new Set<number>() : new Set(playedSet);

    const candidates: number[] = [];
    for (let i = 0; i < length; i++) {
        if (!currentPlayed.has(i)) candidates.push(i);
    }

    // Fisher-Yates shuffle
    for (let i = candidates.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    // Soft rule: prefer not repeating the same artist back-to-back
    let nextIdx = candidates[0];
    if (lastPlayedIdx !== null && candidates.length > 1) {
        const lastArtist = mediaList[lastPlayedIdx]?.artist || "Unknown";
        const diffArtist = candidates.find(
            idx => (mediaList[idx]?.artist || "Unknown") !== lastArtist
        );
        if (diffArtist !== undefined) nextIdx = diffArtist;
    }

    currentPlayed.add(nextIdx);
    console.debug(
        `[Queue] picked idx=${nextIdx} "${mediaList[nextIdx]?.title}" | played=${currentPlayed.size}/${length}`
    );
    return { index: nextIdx, newPlayedSet: currentPlayed };
}

export function getTitle(entry: MediaEntry): string {
    if (entry.title) return entry.title;
    try {
        const url = new URL(entry.src);
        const v = url.searchParams.get("v");
        if (v) return `YouTube Video (${v})`;
        const path = url.pathname.replace("/", "");
        if (path) return `YouTube Video (${path})`;
    } catch { /* ignore */ }
    return "YouTube Video";
}

export function formatDuration(seconds?: number): string {
    if (!seconds || seconds <= 0) return "--:--";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/** Pick a random transition clip path given two directions. */
export function pickTransition(from: "otg" | "mtv", to: "otg" | "mtv"): string | null {
    if (from === to) return null;
    const key = from === "mtv" ? "MTV to OTG" : "OTG to MTV";
    const n = Math.random() > 0.5 ? "1" : "2";
    return `/transitions/${key} - ${n}.mp4`;
}
