import type { MediaEntry } from "./types";
import { getTitle } from "./utils";

interface NowPlayingBumperProps {
    current: MediaEntry;
    nextEntry: MediaEntry | undefined;
    showUpNext: boolean;
    showNowPlaying: boolean;
    showMidBumper: boolean;
}

export function NowPlayingBumper({
    current,
    nextEntry,
    showUpNext,
    showNowPlaying,
    showMidBumper,
}: NowPlayingBumperProps) {
    const displayEntry = showUpNext ? (nextEntry ?? current) : current;

    return (
        <>
            {/* Now Playing / Up Next — bottom-right */}
            <div
                className={`absolute bottom-6 right-4 sm:bottom-24 sm:right-24 transition-all duration-700 pointer-events-none z-30 ${
                    showNowPlaying || showUpNext ? "translate-x-0 opacity-100" : "translate-x-[150%] opacity-0"
                }`}
            >
                <div className="flex items-center gap-3 bg-black/80 p-2.5 sm:p-3 border-l-4 border-[#5bc6e8] shadow-xl backdrop-blur-md rounded-r-lg max-w-[260px] sm:max-w-[350px]">
                    <div className="flex flex-col flex-1 overflow-hidden pl-2">
                        <span
                            className="text-[#ec1c5e] font-black text-[9px] sm:text-[10px] tracking-widest uppercase mb-1"
                            style={{ fontFamily: "'Anton', sans-serif" }}
                        >
                            {showUpNext ? "SIGUIENTE" : "SONANDO AHORA"}
                        </span>
                        <span className="text-white font-bold text-xs sm:text-sm leading-tight truncate">
                            {getTitle(displayEntry)}
                        </span>
                        <span className="text-white/60 text-[10px] sm:text-xs truncate">
                            {displayEntry.artist || "Unknown Artist"}
                        </span>
                    </div>
                </div>
            </div>

            {/* Mid-song bumper — top-left */}
            <div
                className={`absolute top-16 sm:top-24 left-4 sm:left-24 transition-all duration-700 pointer-events-none z-30 ${
                    showMidBumper ? "translate-x-0 opacity-100" : "-translate-x-[150%] opacity-0"
                }`}
            >
                <div className="flex items-center gap-3 bg-black/80 p-2.5 sm:p-3 border-l-4 border-[#ec1c5e] shadow-xl backdrop-blur-md rounded-r-lg max-w-[260px] sm:max-w-[350px]">
                    <div className="flex flex-col flex-1 overflow-hidden pl-2 pr-4">
                        <span
                            className="text-[#5bc6e8] font-black text-[9px] sm:text-[10px] tracking-widest uppercase mb-1"
                            style={{ fontFamily: "'Anton', sans-serif" }}
                        >
                            NOW PLAYING
                        </span>
                        <span className="text-white font-bold text-xs sm:text-sm leading-tight truncate">
                            {getTitle(current)}
                        </span>
                        <span className="text-white/60 text-[10px] sm:text-xs truncate">
                            {current.artist || "Unknown Artist"}
                        </span>
                    </div>
                </div>
            </div>
        </>
    );
}

interface ClockOverlayProps {
    time: string;
    temp: number | null;
}

export function ClockOverlay({ time, temp }: ClockOverlayProps) {
    return (
        <div
            className="absolute bottom-4 left-4 sm:bottom-16 sm:left-32 pointer-events-none text-white text-xl sm:text-3xl font-black tracking-tighter leading-tight flex items-center gap-2 sm:gap-3 opacity-90 z-20"
            style={{
                fontFamily: "'Anton', sans-serif",
                textShadow: "3px 3px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000",
            }}
        >
            <span className="w-12 sm:w-16">{time}</span>
            {temp !== null && <span>{temp.toFixed(1)}°</span>}
        </div>
    );
}

export function MuteBanner() {
    return (
        <div
            className="absolute top-4 right-4 sm:top-8 sm:right-8 bg-[#ec1c5e] text-white font-black text-xs sm:text-sm px-3 py-1.5 sm:px-4 sm:py-2 pointer-events-none animate-pulse z-20"
            style={{ fontFamily: "'Anton', sans-serif" }}
        >
            CLICK ANYWHERE TO UNMUTE
        </div>
    );
}
