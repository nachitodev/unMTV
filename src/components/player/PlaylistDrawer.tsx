import { ChevronUp } from "lucide-react";
import type { MediaEntry } from "./types";
import { formatDuration } from "./utils";

interface PlaylistDrawerProps {
    visible: boolean;
    displayQueue: number[];
    mediaList: MediaEntry[];
}

function QueueCard({ entry, isNext }: { entry: MediaEntry; isNext: boolean }) {
    const videoId = entry.src.includes("v=") ? entry.src.split("v=")[1]?.split("&")[0] : "";
    const thumbUrl = entry.thumbnail || (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : "");

    return (
        <div className="group min-w-0">
            <div className="relative rounded-lg overflow-hidden mb-2">
                <img
                    src={thumbUrl}
                    alt={entry.title || "Video"}
                    className="w-full aspect-video object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                />
                <div className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] font-mono px-1.5 py-0.5 rounded">
                    {formatDuration(entry.duration)}
                </div>
                {isNext && (
                    <div className="absolute top-1 left-1 bg-[#ec1c5e] text-white text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider">
                        SIGUIENTE
                    </div>
                )}
            </div>
            <p className="text-white text-xs font-semibold leading-tight truncate">{entry.title || "Unknown"}</p>
            <p className="text-white/40 text-[10px] mt-0.5 truncate">{entry.artist || "Unknown Artist"}</p>
        </div>
    );
}

export function PlaylistDrawer({ visible, displayQueue, mediaList }: PlaylistDrawerProps) {
    return (
        <div
            className={`absolute bottom-0 left-0 right-0 z-50 transition-all duration-500 ease-out ${
                visible ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"
            }`}
            onClick={e => e.stopPropagation()}
        >
            <div className="flex justify-center mb-2">
                <ChevronUp className="w-6 h-6 text-white/50 animate-bounce" />
            </div>
            <div className="bg-gradient-to-t from-black via-black/95 to-transparent pt-10 pb-4 sm:pb-6 px-3 sm:px-8">
                <div className="flex items-center gap-2 mb-3 sm:mb-4 ml-1 sm:ml-2">
                    <span
                        className="text-[#ec1c5e] font-black text-xs tracking-[0.3em] uppercase"
                        style={{ fontFamily: "'Anton', sans-serif" }}
                    >
                        SIGUIENTE
                    </span>
                    <div className="flex-1 h-px bg-white/10" />
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-4 md:grid-cols-8 gap-2 sm:gap-3">
                    {displayQueue.map((qIdx, i) => {
                        const entry = mediaList[qIdx];
                        if (!entry) return null;
                        return (
                            <QueueCard key={`${qIdx}-${i}`} entry={entry} isNext={i === 0} />
                        );
                    })}
                </div>

                <div className="mt-6 sm:mt-8 pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-white/50 text-xs font-medium">
                        Creado con ❤️ por{" "}
                        <a
                            href="https://instagram.com/nachitofm"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#ec1c5e] font-bold"
                        >
                            @nachitofm
                        </a>
                    </div>
                    <div className="flex items-center gap-4">
                        <a href="https://github.com/nachitodev" target="_blank" rel="noopener noreferrer" className="text-white/50 hover:text-white transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
                                <path d="M9 18c-4.51 2-5-2-7-2" />
                            </svg>
                        </a>
                        <a href="https://instagram.com/nachitofm" target="_blank" rel="noopener noreferrer" className="text-white/50 hover:text-white transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
                                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                                <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
                            </svg>
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
}
