import { SkipBack, SkipForward, Volume2, VolumeX, Maximize, Minimize } from "lucide-react";

interface PlayerControlsProps {
    isMuted: boolean;
    volume: number;
    isFullscreen: boolean;
    onPrev: () => void;
    onNext: () => void;
    onMuteToggle: () => void;
    onVolumeChange: (v: number) => void;
    onFullscreenToggle: () => void;
}

export function PlayerControls({
    isMuted,
    volume,
    isFullscreen,
    onPrev,
    onNext,
    onMuteToggle,
    onVolumeChange,
    onFullscreenToggle,
}: PlayerControlsProps) {
    return (
        <>
            {/* Prev */}
            <div
                className="absolute left-0 top-0 bottom-0 w-16 sm:w-32 flex items-center justify-start px-2 sm:px-4 opacity-0 hover:opacity-100 active:opacity-100 transition-opacity bg-gradient-to-r from-black/60 to-transparent cursor-pointer z-40"
                onClick={e => { e.stopPropagation(); onPrev(); }}
            >
                <SkipBack className="w-8 h-8 sm:w-12 sm:h-12 text-white drop-shadow-lg" />
            </div>

            {/* Next */}
            <div
                className="absolute right-0 top-0 bottom-0 w-16 sm:w-32 flex items-center justify-end px-2 sm:px-4 opacity-0 hover:opacity-100 active:opacity-100 transition-opacity bg-gradient-to-l from-black/60 to-transparent cursor-pointer z-40"
                onClick={e => { e.stopPropagation(); onNext(); }}
            >
                <SkipForward className="w-8 h-8 sm:w-12 sm:h-12 text-white drop-shadow-lg" />
            </div>

            {/* Volume + Fullscreen bar */}
            <div
                className="absolute bottom-4 right-4 sm:bottom-10 sm:right-10 z-50 flex items-center gap-2 sm:gap-3 bg-black/40 p-2 sm:p-3 rounded-full backdrop-blur-md sm:opacity-30 hover:opacity-100 transition-opacity"
                onClick={e => e.stopPropagation()}
            >
                <div
                    onClick={onMuteToggle}
                    className="cursor-pointer text-white drop-shadow-md hover:text-[#ec1c5e] transition-colors"
                >
                    {isMuted || volume === 0
                        ? <VolumeX className="w-4 h-4 sm:w-5 sm:h-5" />
                        : <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" />
                    }
                </div>
                <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={isMuted ? 0 : volume}
                    onChange={e => onVolumeChange(parseFloat(e.target.value))}
                    className="w-16 sm:w-24 accent-[#ec1c5e] cursor-pointer"
                />
                <div
                    onClick={e => { e.stopPropagation(); onFullscreenToggle(); }}
                    className="cursor-pointer text-white drop-shadow-md hover:text-[#ec1c5e] transition-colors ml-1 sm:ml-2"
                >
                    {isFullscreen
                        ? <Minimize className="w-4 h-4 sm:w-5 sm:h-5" />
                        : <Maximize className="w-4 h-4 sm:w-5 sm:h-5" />
                    }
                </div>
            </div>
        </>
    );
}
