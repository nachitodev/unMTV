import { useEffect, useRef, useState } from "react";
import { SkipBack, SkipForward } from "lucide-react";
import ReactPlayer from "react-player";

interface MediaEntry {
    src: string;
    aspect: "4:3" | "16:9" | "other";
    title?: string;
}

interface PlayerProps {
    mediaList: MediaEntry[];
}

function getNextUnplayedIndex(length: number, history: number[]) {
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
    
    let nextIdx = available[Math.floor(Math.random() * available.length)];
    
    // Prevent back-to-back repeats when starting a new cycle
    if (playedInCurrentCycleCount === 0 && nextIdx === history[history.length - 1]) {
        const idxInAvailable = available.indexOf(nextIdx);
        nextIdx = available[(idxInAvailable + 1) % available.length];
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
                    if (Date.now() - data.time < 3600000) {
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
    }, []);

    return temp;
}

export default function YoutubePlayer({ mediaList }: PlayerProps) {
    const playerRef = useRef<HTMLVideoElement>(null);
    
    const [history, setHistory] = useState<number[]>(() => [Math.floor(Math.random() * mediaList.length)]);
    const [historyIndex, setHistoryIndex] = useState(0);

    const index = history[historyIndex];
    const current = mediaList[index];
    const isFourThree = current?.aspect === "4:3";

    const time = useClock();
    const temp = useTemperature();
    const [isMuted, setIsMuted] = useState(true);
    const [playing, setPlaying] = useState(true);

    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [nextPreload, setNextPreload] = useState<number>(0);

    useEffect(() => {
        if (historyIndex === history.length - 1) {
            setNextPreload(getNextUnplayedIndex(mediaList.length, history));
        }
    }, [historyIndex, history, mediaList.length]);

    const nextIndex = historyIndex < history.length - 1 ? history[historyIndex + 1] : nextPreload;
    const nextVideo = mediaList.length > 1 ? mediaList[nextIndex] : current;

    function handleNext() {
        if (mediaList.length <= 1) {
            if (playerRef.current) {
                playerRef.current.currentTime = 0;
                setPlaying(true);
            }
            return;
        }

        if (historyIndex < history.length - 1) {
            setHistoryIndex(prev => prev + 1);
        } else {
            setHistory(prev => [...prev, nextPreload]);
            setHistoryIndex(prev => prev + 1);
        }
    }

    function handlePrev() {
        if (historyIndex > 0) {
            setHistoryIndex(prev => prev - 1);
        } else {
            if (playerRef.current) {
                playerRef.current.currentTime = 0;
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

    if (!current) return null;

    return (
        <div
            className="fixed inset-0 bg-black overflow-hidden flex items-center justify-center cursor-pointer"
            onClick={handleGlobalClick}
        >
            {isFourThree && (
                <>
                    <div
                        className="absolute inset-y-0 left-0 w-[16.66%] bg-cover bg-center z-10"
                        style={{ backgroundImage: "url(/border.png)" }}
                    />
                    <div
                        className="absolute inset-y-0 right-0 w-[16.66%] bg-cover bg-center z-10"
                        style={{ backgroundImage: "url(/border.png)" }}
                    />
                </>
            )}

            <div className="w-full h-full pointer-events-none">
                <ReactPlayer
                    ref={playerRef}
                    src={current.src}
                    playing={playing}
                    autoPlay
                    muted={isMuted}
                    width="100%"
                    height="100%"
                    style={{ pointerEvents: 'none', objectFit: 'contain' }}
                    config={{
                        youtube: {
                            controls: 0,
                            modestbranding: 1,
                            rel: 0,
                            showinfo: 0,
                            iv_load_policy: 3,
                            disablekb: 1,
                            fs: 0,
                            playsinline: 1
                        } as any
                    }}
                    onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                    onDurationChange={(e) => setDuration(e.currentTarget.duration)}
                    onEnded={handleEnded}
                    onError={handleError}
                />
            </div>

            <img
                src="/MTV-Logo.svg"
                alt="MTV"
                className="absolute top-16 right-24 w-24 pointer-events-none opacity-90 z-20"
            />

            <div
                className="absolute bottom-16 left-24 pointer-events-none text-white text-3xl font-black tracking-tighter leading-tight flex items-center gap-3 opacity-90 z-20"
                style={{
                    fontFamily: "'Impact', 'Arial Black', sans-serif",
                    textShadow: "3px 3px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000"
                }}
            >
                <span>{time}</span>
                {temp !== null && (
                    <span>{temp.toFixed(1)}°</span>
                )}
            </div>

            {isMuted && (
                <div className="absolute top-8 right-8 bg-[#ec1c5e] text-white font-black text-sm px-4 py-2 pointer-events-none animate-pulse z-20"
                    style={{ fontFamily: "'Arial Black', sans-serif" }}>
                    CLICK ANYWHERE TO UNMUTE
                </div>
            )}

            {/* MTV Bumper Overlay */}
            <div className={`absolute bottom-24 right-24 transition-all duration-700 pointer-events-none z-30 ${showNowPlaying || showUpNext ? "translate-x-0 opacity-100" : "translate-x-[150%] opacity-0"}`}>
                <div className="flex items-center gap-3 bg-black/80 p-3 border-l-4 border-[#5bc6e8] shadow-xl backdrop-blur-md rounded-r-lg max-w-[350px]">
                    <div className="flex flex-col flex-1 overflow-hidden pr-2">
                        <span className="text-[#ec1c5e] font-black text-[10px] tracking-widest uppercase mb-1" style={{ fontFamily: "'Arial Black', sans-serif" }}>
                            {showUpNext ? "UP NEXT" : "NOW PLAYING"}
                        </span>
                        <span className="text-white font-bold text-sm leading-tight truncate">
                            {getTitle(showUpNext ? nextVideo : current)}
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
        </div>
    );
}
