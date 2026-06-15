import { useEffect, useRef, useState } from "react";
import { SkipBack, SkipForward, Volume2, VolumeX, ChevronUp } from "lucide-react";
import ReactPlayer from "react-player";

interface MediaEntry {
    src: string;
    title?: string;
    duration?: number;
    thumbnail?: string;
    artist?: string;
}

interface PlayerProps {
    mediaList: MediaEntry[];
}

function getNextUnplayedIndex(length: number, history: number[], mediaList: MediaEntry[]) {
    if (length <= 1) return 0;

    const playedInCurrentCycleCount = history.length % length;
    const playedInCurrentCycle = playedInCurrentCycleCount === 0
        ? []
        : history.slice(-playedInCurrentCycleCount);

    const available = [];
    for (let i = 0; i < length; i++) {
        if (!playedInCurrentCycle.includes(i)) {
            available.push(i);
        }
    }

    // Prioritize "Video Oficial" or "Official Video"
    const officialAvailable = available.filter(idx => {
        const title = mediaList[idx].title?.toLowerCase() || "";
        return title.includes("oficial") || title.includes("official");
    });

    // If there are official videos left in the cycle, only pick from those!
    const poolToPickFrom = officialAvailable.length > 0 ? officialAvailable : available;

    let nextIdx = poolToPickFrom[Math.floor(Math.random() * poolToPickFrom.length)];

    // Prevent back-to-back repeats when starting a new cycle
    if (playedInCurrentCycleCount === 0 && nextIdx === history[history.length - 1]) {
        const idxInPool = poolToPickFrom.indexOf(nextIdx);
        nextIdx = poolToPickFrom[(idxInPool + 1) % poolToPickFrom.length];
    }

    return nextIdx;
}

function getTitle(entry: MediaEntry) {
    if (entry.title) return entry.title;
    const src = entry.src;
    // For YouTube, src might be a URL. Try to extract a video ID or provide a fallback
    // Since YouTube URLs don't have human readable filenames, ideally you'd add a 'title' to MediaEntry
    // But as a fallback, we can try to extract the video ID or just show a generic string
    try {
        const url = new URL(src);
        const v = url.searchParams.get("v");
        if (v) return `YouTube Video (${v})`;
        const path = url.pathname.replace("/", "");
        if (path) return `YouTube Video (${path})`;
    } catch {
        // Not a valid URL, maybe it's just an ID
    }
    return "YouTube Video";
}

function formatDuration(seconds?: number): string {
    if (!seconds || seconds <= 0) return "--:--";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function useClock() {
    const [time, setTime] = useState(() => new Date());

    useEffect(() => {
        const id = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(id);
    }, []);

    return time.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    });
}

function useTemperature() {
    const [temp, setTemp] = useState<number | null>(null);

    useEffect(() => {
        async function load() {
            try {
                const cachedW = localStorage.getItem("mtv_weather");
                if (cachedW) {
                    const data = JSON.parse(cachedW);
                    if (Date.now() - data.time < 900000) {
                        setTemp(data.temp);
                        return;
                    }
                }

                let lat = -34.6037;
                let lon = -58.3816;
                const cachedGeo = localStorage.getItem("mtv_geo");

                if (cachedGeo) {
                    const geo = JSON.parse(cachedGeo);
                    lat = geo.lat;
                    lon = geo.lon;
                } else {
                    try {
                        const geoRes = await fetch("https://ipapi.co/json/");
                        if (geoRes.ok) {
                            const geo = await geoRes.json();
                            if (geo.latitude && geo.longitude) {
                                lat = geo.latitude;
                                lon = geo.longitude;
                                localStorage.setItem("mtv_geo", JSON.stringify({ lat, lon }));
                            }
                        }
                    } catch (e) { }
                }

                const weatherRes = await fetch(
                    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m`
                );
                if (weatherRes.ok) {
                    const weather = await weatherRes.json();
                    const t = weather.current.temperature_2m;
                    setTemp(t);
                    localStorage.setItem("mtv_weather", JSON.stringify({ temp: t, time: Date.now() }));
                } else if (cachedW) {
                    setTemp(JSON.parse(cachedW).temp);
                }
            } catch {
                const cachedW = localStorage.getItem("mtv_weather");
                if (cachedW) {
                    setTemp(JSON.parse(cachedW).temp);
                } else {
                    setTemp(null);
                }
            }
        }

        load();

        // Refresh weather automatically every 15 minutes
        const id = setInterval(load, 900000);
        return () => clearInterval(id);
    }, []);

    return temp;
}

export default function YoutubePlayer({ mediaList }: PlayerProps) {
    const playerRef = useRef<any>(null);

    const [history, setHistory] = useState<number[]>(() => {
        // Pick the first video to play
        const firstIdx = getNextUnplayedIndex(mediaList.length, [], mediaList);
        return [firstIdx];
    });
    const [historyIndex, setHistoryIndex] = useState(0);

    const index = history[historyIndex];
    const current = mediaList[index];

    const time = useClock();
    const temp = useTemperature();
    const [isMuted, setIsMuted] = useState(true);
    const [volume, setVolume] = useState(1);
    const [playing, setPlaying] = useState(true);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'Space') {
                e.preventDefault();
                setPlaying(prev => !prev);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    // upcomingQueue is the single source of truth for what plays next.
    // It is initialized once and slides forward like a conveyor belt.
    const [upcomingQueue, setUpcomingQueue] = useState<number[]>(() => {
        const firstIdx = getNextUnplayedIndex(mediaList.length, [], mediaList);
        const queue: number[] = [firstIdx];
        let simHistory = [firstIdx];
        while (queue.length < 8) {
            const next = getNextUnplayedIndex(mediaList.length, simHistory, mediaList);
            queue.push(next);
            simHistory = [...simHistory, next];
        }
        return queue;
    });

    // Slides the queue forward by 1 and appends a fresh pick at the tail.
    function advanceQueue() {
        setUpcomingQueue(q => {
            const newQ = q.slice(1);
            const simHistory = [...newQ];
            const next = getNextUnplayedIndex(mediaList.length, simHistory, mediaList);
            return [...newQ, next];
        });
    }

    const [showPlaylist, setShowPlaylist] = useState(false);
    const playlistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    function handleNext() {
        if (mediaList.length <= 1) {
            if (playerRef.current) {
                playerRef.current.seekTo(0);
                setPlaying(true);
            }
            return;
        }

        if (historyIndex < history.length - 1) {
            // Going forward in existing back-history — don't touch the queue
            setHistoryIndex(prev => prev + 1);
        } else {
            // Playing fresh: use upcomingQueue[0] as the next song
            const next = upcomingQueue[0];
            setHistory(prev => [...prev, next]);
            setHistoryIndex(prev => prev + 1);
            advanceQueue();
        }
    }

    function handlePrev() {
        if (historyIndex > 0) {
            setHistoryIndex(prev => prev - 1);
        } else {
            if (playerRef.current) {
                playerRef.current.seekTo(0);
                setPlaying(true);
            }
        }
    }

    function handleEnded() {
        handleNext();
    }

    function handleError(e: any) {
        console.error("Video error on:", current?.src, e);
        handleNext();
    }

    useEffect(() => {
        setCurrentTime(0);
        setDuration(0);
        setPlaying(true);
    }, [index]);

    function handleGlobalClick() {
        setIsMuted(false);
        setPlaying(true);
    }

    const showUpNext = duration > 10 && (duration - currentTime <= 5) && mediaList.length > 1;
    const showNowPlaying = currentTime <= 5 && duration > 0 && !showUpNext;
    const showMidBumper = duration > 45 && currentTime >= 45 && currentTime < 55;

    if (!current) return null;

    return (
        <div
            className="fixed inset-0 bg-black overflow-hidden flex items-center justify-center cursor-pointer"
            onClick={handleGlobalClick}
            onWheel={(e) => {
                if (e.deltaY > 0) {
                    setShowPlaylist(true);
                    if (playlistTimeoutRef.current) clearTimeout(playlistTimeoutRef.current);
                    playlistTimeoutRef.current = setTimeout(() => setShowPlaylist(false), 5000);
                } else if (e.deltaY < 0) {
                    setShowPlaylist(false);
                    if (playlistTimeoutRef.current) clearTimeout(playlistTimeoutRef.current);
                }
            }}
        >
            <div className="w-full h-full pointer-events-none">
                <ReactPlayer
                    ref={playerRef}
                    src={`${current.src}${current.src.includes('?') ? '&' : '?'}cc_load_policy=0`}
                    playing={playing}
                    autoPlay
                    muted={isMuted}
                    volume={volume}
                    width="100%"
                    height="100%"
                    style={{ pointerEvents: 'none', objectFit: 'contain' }}
                    config={{
                        youtube: {
                            playerVars: {
                                controls: 0,
                                modestbranding: 1,
                                rel: 0,
                                showinfo: 0,
                                iv_load_policy: 3,
                                cc_load_policy: 0,
                                disablekb: 1,
                                fs: 0,
                                playsinline: 1,
                                vq: 'hd1080'
                            }
                        } as any
                    }}
                    onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                    onDurationChange={(e) => setDuration(e.currentTarget.duration)}
                    onEnded={handleEnded}
                    onError={handleError}
                    onReady={() => {
                        const internalPlayer = playerRef.current?.getInternalPlayer() as any;
                        if (internalPlayer?.unloadModule) {
                            internalPlayer.unloadModule('captions');
                            internalPlayer.unloadModule('cc');
                        }
                    }}
                />
            </div>

            <img
                src="/MTV-Logo.svg"
                alt="MTV"
                className="absolute top-16 right-24 w-24 pointer-events-none opacity-90 z-20"
            />

            <div
                className="absolute bottom-16 left-32 pointer-events-none text-white text-3xl font-black tracking-tighter leading-tight flex items-center gap-3 opacity-90 z-20"
                style={{
                    fontFamily: "'Anton', sans-serif",
                    textShadow: "3px 3px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000"
                }}
            >
                <span className="w-16">{time}</span>
                {temp !== null && (
                    <span>{temp.toFixed(1)}°</span>
                )}
            </div>

            {isMuted && (
                <div className="absolute top-8 right-8 bg-[#ec1c5e] text-white font-black text-sm px-4 py-2 pointer-events-none animate-pulse z-20"
                    style={{ fontFamily: "'Anton', sans-serif" }}>
                    CLICK ANYWHERE TO UNMUTE
                </div>
            )}

            {/* MTV Bumper Overlay */}
            <div className={`absolute bottom-24 right-24 transition-all duration-700 pointer-events-none z-30 ${showNowPlaying || showUpNext ? "translate-x-0 opacity-100" : "translate-x-[150%] opacity-0"}`}>
                <div className="flex items-center gap-3 bg-black/80 p-3 border-l-4 border-[#5bc6e8] shadow-xl backdrop-blur-md rounded-r-lg max-w-[350px]">
                    <div className="flex flex-col flex-1 overflow-hidden pl-2">
                        <span className="text-[#ec1c5e] font-black text-[10px] tracking-widest uppercase mb-1" style={{ fontFamily: "'Anton', sans-serif" }}>
                            {showUpNext ? "UP NEXT" : "NOW PLAYING"}
                        </span>
                        <span className="text-white font-bold text-sm leading-tight truncate">
                            {getTitle(showUpNext ? (mediaList[upcomingQueue[0]] ?? current) : current)}
                        </span>
                        <span className="text-white/60 text-xs truncate">
                            {(showUpNext ? (mediaList[upcomingQueue[0]] ?? current).artist : current.artist) || 'Unknown Artist'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Mid Bumper Overlay (45s mark) */}
            <div className={`absolute top-24 left-24 transition-all duration-700 pointer-events-none z-30 ${showMidBumper ? "translate-x-0 opacity-100" : "-translate-x-[150%] opacity-0"}`}>
                <div className="flex items-center gap-3 bg-black/80 p-3 border-l-4 border-[#ec1c5e] shadow-xl backdrop-blur-md rounded-r-lg max-w-[350px]">
                    <div className="flex flex-col flex-1 overflow-hidden pl-2 pr-4">
                        <span className="text-[#5bc6e8] font-black text-[10px] tracking-widest uppercase mb-1" style={{ fontFamily: "'Anton', sans-serif" }}>
                            NOW PLAYING
                        </span>
                        <span className="text-white font-bold text-sm leading-tight truncate">
                            {getTitle(current)}
                        </span>
                        <span className="text-white/60 text-xs truncate">
                            {current.artist || 'Unknown Artist'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Left Hover Area - Rewind */}
            <div
                className="absolute left-0 top-0 bottom-0 w-32 flex items-center justify-start px-4 opacity-0 hover:opacity-100 transition-opacity bg-gradient-to-r from-black/60 to-transparent cursor-pointer z-40"
                onClick={(e) => {
                    e.stopPropagation();
                    handleGlobalClick();
                    handlePrev();
                }}
            >
                <SkipBack className="w-12 h-12 text-white drop-shadow-lg" />
            </div>

            {/* Right Hover Area - Skip */}
            <div
                className="absolute right-0 top-0 bottom-0 w-32 flex items-center justify-end px-4 opacity-0 hover:opacity-100 transition-opacity bg-gradient-to-l from-black/60 to-transparent cursor-pointer z-40"
                onClick={(e) => {
                    e.stopPropagation();
                    handleGlobalClick();
                    handleNext();
                }}
            >
                <SkipForward className="w-12 h-12 text-white drop-shadow-lg" />
            </div>

            {/* Volume Control */}
            <div
                className="absolute bottom-10 right-10 z-50 flex items-center gap-3 bg-black/40 p-3 rounded-full backdrop-blur-md opacity-30 hover:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
            >
                <div onClick={() => setIsMuted(!isMuted)} className="cursor-pointer text-white drop-shadow-md hover:text-[#ec1c5e] transition-colors">
                    {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                </div>
                <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={isMuted ? 0 : volume}
                    onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setVolume(val);
                        if (val > 0) setIsMuted(false);
                        else setIsMuted(true);
                    }}
                    className="w-24 accent-[#ec1c5e] cursor-pointer"
                />
            </div>

            {/* Playlist Viewer */}
            <div
                className={`absolute bottom-0 left-0 right-0 z-50 transition-all duration-500 ease-out ${showPlaylist ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Scroll hint arrow */}
                <div className="flex justify-center mb-2">
                    <ChevronUp className="w-6 h-6 text-white/50 animate-bounce" />
                </div>
                <div className="bg-gradient-to-t from-black via-black/95 to-transparent pt-10 pb-6 px-8">
                    <div className="flex items-center gap-2 mb-4 ml-2">
                        <span className="text-[#ec1c5e] font-black text-xs tracking-[0.3em] uppercase" style={{ fontFamily: "'Anton', sans-serif" }}>UP NEXT</span>
                        <div className="flex-1 h-px bg-white/10" />
                    </div>
                    <div className="grid grid-cols-8 gap-3">
                        {upcomingQueue.map((qIdx, i) => {
                            const entry = mediaList[qIdx];
                            if (!entry) return null;
                            const videoId = entry.src.includes('v=') ? entry.src.split('v=')[1]?.split('&')[0] : '';
                            const thumbUrl = entry.thumbnail || (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : '');
                            return (
                                <div key={`${qIdx}-${i}`} className="group min-w-0">
                                    <div className="relative rounded-lg overflow-hidden mb-2">
                                        <img
                                            src={thumbUrl}
                                            alt={entry.title || 'Video'}
                                            className="w-full aspect-video object-cover group-hover:scale-105 transition-transform duration-300"
                                            loading="lazy"
                                        />
                                        <div className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] font-mono px-1.5 py-0.5 rounded">
                                            {formatDuration(entry.duration)}
                                        </div>
                                        {i === 0 && (
                                            <div className="absolute top-1 left-1 bg-[#ec1c5e] text-white text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider">
                                                Next
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-white text-xs font-semibold leading-tight truncate">{entry.title || 'Unknown'}</p>
                                    <p className="text-white/40 text-[10px] mt-0.5 truncate">{entry.artist || 'Unknown Artist'}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
