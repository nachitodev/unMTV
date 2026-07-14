import { useRef, useState } from "react";
import type { MediaEntry } from "../types";
import { getNextUnplayedIndex } from "../utils";

interface UseQueueResult {
    index: number;
    current: MediaEntry;
    history: number[];
    historyIndex: number;
    upcomingQueue: number[];
    displayQueue: number[];
    handleNext: () => void;
    handlePrev: () => void;
}

export function useQueue(
    mediaList: MediaEntry[],
    playerRef: React.RefObject<HTMLVideoElement | null>,
    setPlaying: (v: boolean) => void,
    setTransitionVideo: (v: string | null) => void
): UseQueueResult {
    // Compute the first pick + full initial queue in a SINGLE pass so
    // playedSetRef is seeded with all planned videos from the start.
    // The `null` guard ensures this runs exactly once.
    const initRef = useRef<{ firstIndex: number; queue: number[]; playedSet: Set<number> } | null>(null);
    if (!initRef.current) {
        const firstPick = getNextUnplayedIndex(mediaList.length, null, mediaList, new Set());
        const queue: number[] = [];
        let simPlayed = firstPick.newPlayedSet;
        let lastIdx: number | null = firstPick.index;
        while (queue.length < 8) {
            const { index: next, newPlayedSet } = getNextUnplayedIndex(
                mediaList.length, lastIdx, mediaList, simPlayed
            );
            queue.push(next);
            simPlayed = newPlayedSet;
            lastIdx = next;
        }
        initRef.current = { firstIndex: firstPick.index, queue, playedSet: simPlayed };
    }
    const { firstIndex, queue: initialQueue, playedSet: initialPlayedSet } = initRef.current;

    // playedSet covers firstVideo + all 8 queued videos → advanceQueue never re-picks them
    const playedSetRef = useRef<Set<number>>(initialPlayedSet);
    const lastPlayedIdxRef = useRef<number | null>(firstIndex);

    const [history, setHistory] = useState<number[]>([firstIndex]);
    const [historyIndex, setHistoryIndex] = useState(0);
    const [upcomingQueue, setUpcomingQueue] = useState<number[]>(initialQueue);

    const index = history[historyIndex];
    const current = mediaList[index];

    function advanceQueue() {
        setUpcomingQueue(q => {
            const newQ = q.slice(1);
            const contextIdx = newQ.length > 0 ? newQ[newQ.length - 1] : lastPlayedIdxRef.current;
            const { index: next, newPlayedSet } = getNextUnplayedIndex(
                mediaList.length, contextIdx, mediaList, playedSetRef.current
            );
            playedSetRef.current = newPlayedSet;
            console.debug(
                `[Queue] advanceQueue → queue=${[...newQ, next].map(i => mediaList[i]?.title).join(" | ")}`
            );
            return [...newQ, next];
        });
    }

    function pickTransitionClip(from: MediaEntry | undefined, to: MediaEntry | undefined): string | null {
        const fromEnzo = from?.artist === "enzocerobulto";
        const toEnzo = to?.artist === "enzocerobulto";
        const n = Math.random() > 0.5 ? "1" : "2";
        if (!fromEnzo && toEnzo) return `/transitions/MTV to OTG - ${n}.mp4`;
        if (fromEnzo && !toEnzo) return `/transitions/OTG to MTV - ${n}.mp4`;
        return null;
    }

    function handleNext() {
        if (mediaList.length <= 1) {
            if (playerRef.current) {
                playerRef.current.currentTime = 0;
                setPlaying(true);
            }
            return;
        }

        const nextIdx = historyIndex < history.length - 1
            ? history[historyIndex + 1]
            : upcomingQueue[0];

        const clip = pickTransitionClip(current, mediaList[nextIdx]);
        if (clip) setTransitionVideo(clip);

        if (historyIndex < history.length - 1) {
            setHistoryIndex(prev => prev + 1);
        } else {
            const next = upcomingQueue[0];
            lastPlayedIdxRef.current = next;
            setHistory(prev => [...prev, next]);
            setHistoryIndex(prev => prev + 1);
            advanceQueue();
        }
    }

    function handlePrev() {
        if (historyIndex > 0) {
            const clip = pickTransitionClip(current, mediaList[history[historyIndex - 1]]);
            if (clip) setTransitionVideo(clip);
            setHistoryIndex(prev => prev - 1);
        } else {
            if (playerRef.current) {
                playerRef.current.currentTime = 0;
                setPlaying(true);
            }
        }
    }

    // displayQueue reflects true upcoming from current position (respects going back)
    const historyAhead = history.slice(historyIndex + 1);
    const displayQueue = [...historyAhead, ...upcomingQueue].slice(0, 8);

    return { index, current, history, historyIndex, upcomingQueue, displayQueue, handleNext, handlePrev };
}
