import { useEffect, useRef, useState } from "react";
import { SkipBack, SkipForward, Volume2, VolumeX, ChevronUp, Maximize, Minimize } from "lucide-react";
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

    const blockCount = Math.min(50, length - 1);
    const playedRecently = history.slice(-blockCount);

    const available = [];
    for (let i = 0; i < length; i++) {
        if (!playedRecently.includes(i)) {
            available.push(i);
        }
    }

    const officialAvailable = available.filter(idx => {
        const title = mediaList[idx].title?.toLowerCase() || "";
        return title.includes("oficial") || title.includes("official");
    });

    const poolToPickFrom = officialAvailable.length > 0 ? officialAvailable : available;

    const artistGroups: Record<string, number[]> = {};
    for (const idx of poolToPickFrom) {
        const artist = mediaList[idx].artist || "Unknown";
        if (!artistGroups[artist]) artistGroups[artist] = [];
        artistGroups[artist].push(idx);
    }

    let availableArtists = Object.keys(artistGroups);

    if (history.length > 0) {
        const lastPlayedIdx = history[history.length - 1];
        const lastArtist = mediaList[lastPlayedIdx].artist || "Unknown";
        if (availableArtists.length > 1 && availableArtists.includes(lastArtist)) {
            availableArtists = availableArtists.filter(a => a !== lastArtist);
        }
    }

    const selectedArtist = availableArtists[Math.floor(Math.random() * availableArtists.length)];

    const artistVideos = artistGroups[selectedArtist];
    let nextIdx = artistVideos[Math.floor(Math.random() * artistVideos.length)];

    return nextIdx;
}

function getTitle(entry: MediaEntry) {
    if (entry.title) return entry.title;
    const src = entry.src;

    try {
        const url = new URL(src);
        const v = url.searchParams.get("v");
        if (v) return `YouTube Video (${v})`;
        const path = url.pathname.replace("/", "");
        if (path) return `YouTube Video (${path})`;
    } catch {

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

        const id = setInterval(load, 900000);
        return () => clearInterval(id);
    }, []);

    return temp;
}

export default function YoutubePlayer({ mediaList }: PlayerProps) {
    const playerRef = useRef<any>(null);

    const [history, setHistory] = useState<number[]>(() => {

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
    const [isFullscreen, setIsFullscreen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            containerRef.current?.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable fullscreen: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
    };

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
    const [transitionVideo, setTransitionVideo] = useState<string | null>(null);

    function handleNext() {
        if (mediaList.length <= 1) {
            if (playerRef.current) {
                playerRef.current.seekTo(0);
                setPlaying(true);
            }
            return;
        }

        const nextIdx = historyIndex < history.length - 1 ? history[historyIndex + 1] : upcomingQueue[0];
        const nextVideoObj = mediaList[nextIdx];
        if (nextVideoObj?.artist === "enzocerobulto" && current?.artist !== "enzocerobulto") {
            setTransitionVideo(Math.random() > 0.5 ? "/transitions/MTV to OTG - 1.mp4" : "/transitions/MTV to OTG - 2.mp4");
        } else if (nextVideoObj?.artist !== "enzocerobulto" && current?.artist === "enzocerobulto") {
            setTransitionVideo(Math.random() > 0.5 ? "/transitions/OTG to MTV - 1.mp4" : "/transitions/OTG to MTV - 2.mp4");
        }

        if (historyIndex < history.length - 1) {

            setHistoryIndex(prev => prev + 1);
        } else {

            const next = upcomingQueue[0];
            setHistory(prev => [...prev, next]);
            setHistoryIndex(prev => prev + 1);
            advanceQueue();
        }
    }

    function handlePrev() {
        if (historyIndex > 0) {
            const prevIdx = history[historyIndex - 1];
            const prevVideoObj = mediaList[prevIdx];
            if (prevVideoObj?.artist === "enzocerobulto" && current?.artist !== "enzocerobulto") {
                setTransitionVideo(Math.random() > 0.5 ? "/transitions/MTV to OTG - 1.mp4" : "/transitions/MTV to OTG - 2.mp4");
            } else if (prevVideoObj?.artist !== "enzocerobulto" && current?.artist === "enzocerobulto") {
                setTransitionVideo(Math.random() > 0.5 ? "/transitions/OTG to MTV - 1.mp4" : "/transitions/OTG to MTV - 2.mp4");
            }
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

    const activeDuration = duration || current.duration || 0;

    const showUpNext = activeDuration > 10 && (activeDuration - currentTime <= 5) && mediaList.length > 1;
    const showNowPlaying = currentTime <= 5 && activeDuration > 0 && !showUpNext;
    const showMidBumper = activeDuration > 45 && currentTime >= 45 && currentTime < 55;

    const isEnzo = current?.artist === "enzocerobulto";
    const currentLogo = isEnzo ? "/OTG-Logo.svg" : "/MTV-Logo.svg";

    if (!current) return null;

    return (
        <div
            ref={containerRef}
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
                    key={current.src}
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
                    {...({ progressInterval: 500 } as any)}
                    onProgress={(e: any) => setCurrentTime(e.playedSeconds)}
                    onDuration={(d: number) => setDuration(d)}
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

            {!transitionVideo ? (
                <img
                    src={currentLogo}
                    alt={isEnzo ? "OTG" : "MTV"}
                    className="absolute top-4 right-4 sm:top-16 sm:right-24 w-14 sm:w-24 pointer-events-none opacity-90 z-20 transition-all duration-500"
                />
            ) : (
                <video
                    src={transitionVideo}
                    autoPlay
                    playsInline
                    className="absolute top-4 right-4 sm:top-16 sm:right-24 w-14 sm:w-24 object-cover z-20"
                    onEnded={() => setTransitionVideo(null)}
                    onClick={(e) => {
                        e.stopPropagation();
                        setTransitionVideo(null);
                    }}
                />
            )}

            <div
                className="absolute bottom-4 left-4 sm:bottom-16 sm:left-32 pointer-events-none text-white text-xl sm:text-3xl font-black tracking-tighter leading-tight flex items-center gap-2 sm:gap-3 opacity-90 z-20"
                style={{
                    fontFamily: "'Anton', sans-serif",
                    textShadow: "3px 3px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000"
                }}
            >
                <span className="w-12 sm:w-16">{time}</span>
                {temp !== null && (
                    <span>{temp.toFixed(1)}°</span>
                )}
            </div>

            {isMuted && (
                <div className="absolute top-4 right-4 sm:top-8 sm:right-8 bg-[#ec1c5e] text-white font-black text-xs sm:text-sm px-3 py-1.5 sm:px-4 sm:py-2 pointer-events-none animate-pulse z-20"
                    style={{ fontFamily: "'Anton', sans-serif" }}>
                    CLICK ANYWHERE TO UNMUTE
                </div>
            )}

            { }
            <div className={`absolute bottom-6 right-4 sm:bottom-24 sm:right-24 transition-all duration-700 pointer-events-none z-30 ${showNowPlaying || showUpNext ? "translate-x-0 opacity-100" : "translate-x-[150%] opacity-0"}`}>
                <div className="flex items-center gap-3 bg-black/80 p-2.5 sm:p-3 border-l-4 border-[#5bc6e8] shadow-xl backdrop-blur-md rounded-r-lg max-w-[260px] sm:max-w-[350px]">
                    <div className="flex flex-col flex-1 overflow-hidden pl-2">
                        <span className="text-[#ec1c5e] font-black text-[9px] sm:text-[10px] tracking-widest uppercase mb-1" style={{ fontFamily: "'Anton', sans-serif" }}>
                            {showUpNext ? "SIGUIENTE" : "SONANDO AHORA"}
                        </span>
                        <span className="text-white font-bold text-xs sm:text-sm leading-tight truncate">
                            {getTitle(showUpNext ? (mediaList[upcomingQueue[0]] ?? current) : current)}
                        </span>
                        <span className="text-white/60 text-[10px] sm:text-xs truncate">
                            {(showUpNext ? (mediaList[upcomingQueue[0]] ?? current).artist : current.artist) || 'Unknown Artist'}
                        </span>
                    </div>
                </div>
            </div>

            { }
            <div className={`absolute top-16 sm:top-24 left-4 sm:left-24 transition-all duration-700 pointer-events-none z-30 ${showMidBumper ? "translate-x-0 opacity-100" : "-translate-x-[150%] opacity-0"}`}>
                <div className="flex items-center gap-3 bg-black/80 p-2.5 sm:p-3 border-l-4 border-[#ec1c5e] shadow-xl backdrop-blur-md rounded-r-lg max-w-[260px] sm:max-w-[350px]">
                    <div className="flex flex-col flex-1 overflow-hidden pl-2 pr-4">
                        <span className="text-[#5bc6e8] font-black text-[9px] sm:text-[10px] tracking-widest uppercase mb-1" style={{ fontFamily: "'Anton', sans-serif" }}>
                            NOW PLAYING
                        </span>
                        <span className="text-white font-bold text-xs sm:text-sm leading-tight truncate">
                            {getTitle(current)}
                        </span>
                        <span className="text-white/60 text-[10px] sm:text-xs truncate">
                            {current.artist || 'Unknown Artist'}
                        </span>
                    </div>
                </div>
            </div>

            { }
            <div
                className="absolute left-0 top-0 bottom-0 w-16 sm:w-32 flex items-center justify-start px-2 sm:px-4 opacity-0 hover:opacity-100 active:opacity-100 transition-opacity bg-gradient-to-r from-black/60 to-transparent cursor-pointer z-40"
                onClick={(e) => {
                    e.stopPropagation();
                    handleGlobalClick();
                    handlePrev();
                }}
            >
                <SkipBack className="w-8 h-8 sm:w-12 sm:h-12 text-white drop-shadow-lg" />
            </div>

            { }
            <div
                className="absolute right-0 top-0 bottom-0 w-16 sm:w-32 flex items-center justify-end px-2 sm:px-4 opacity-0 hover:opacity-100 active:opacity-100 transition-opacity bg-gradient-to-l from-black/60 to-transparent cursor-pointer z-40"
                onClick={(e) => {
                    e.stopPropagation();
                    handleGlobalClick();
                    handleNext();
                }}
            >
                <SkipForward className="w-8 h-8 sm:w-12 sm:h-12 text-white drop-shadow-lg" />
            </div>

            { }
            <div
                className="absolute bottom-4 right-4 sm:bottom-10 sm:right-10 z-50 flex items-center gap-2 sm:gap-3 bg-black/40 p-2 sm:p-3 rounded-full backdrop-blur-md sm:opacity-30 hover:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
            >
                <div onClick={() => setIsMuted(!isMuted)} className="cursor-pointer text-white drop-shadow-md hover:text-[#ec1c5e] transition-colors">
                    {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 sm:w-5 sm:h-5" /> : <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" />}
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
                    className="w-16 sm:w-24 accent-[#ec1c5e] cursor-pointer"
                />
                <div
                    onClick={(e) => {
                        e.stopPropagation();
                        toggleFullscreen();
                    }}
                    className="cursor-pointer text-white drop-shadow-md hover:text-[#ec1c5e] transition-colors ml-1 sm:ml-2"
                >
                    {isFullscreen ? <Minimize className="w-4 h-4 sm:w-5 sm:h-5" /> : <Maximize className="w-4 h-4 sm:w-5 sm:h-5" />}
                </div>
            </div>

            { }
            <div
                className={`absolute bottom-0 left-0 right-0 z-50 transition-all duration-500 ease-out ${showPlaylist ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`}
                onClick={(e) => e.stopPropagation()}
            >
                { }
                <div className="flex justify-center mb-2">
                    <ChevronUp className="w-6 h-6 text-white/50 animate-bounce" />
                </div>
                <div className="bg-gradient-to-t from-black via-black/95 to-transparent pt-10 pb-4 sm:pb-6 px-3 sm:px-8">
                    <div className="flex items-center gap-2 mb-3 sm:mb-4 ml-1 sm:ml-2">
                        <span className="text-[#ec1c5e] font-black text-xs tracking-[0.3em] uppercase" style={{ fontFamily: "'Anton', sans-serif" }}>SIGUIENTE</span>
                        <div className="flex-1 h-px bg-white/10" />
                    </div>
                    <div className="grid grid-cols-4 sm:grid-cols-4 md:grid-cols-8 gap-2 sm:gap-3">
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
                                                SIGUIENTE
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-white text-xs font-semibold leading-tight truncate">{entry.title || 'Unknown'}</p>
                                    <p className="text-white/40 text-[10px] mt-0.5 truncate">{entry.artist || 'Unknown Artist'}</p>
                                </div>
                            );
                        })}
                    </div>

                    { }
                    <div className="mt-6 sm:mt-8 pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="text-white/50 text-xs font-medium">
                            Creado con ❤️ por <a href="https://instagram.com/nachitofm" target="_blank" rel="noopener noreferrer" className="text-[#ec1c5e] font-bold">@nachitofm</a>
                        </div>
                        <div className="flex items-center gap-4">
                            <a href="https://github.com/nachitodev" target="_blank" rel="noopener noreferrer" className="text-white/50 hover:text-white transition-colors cursor-pointer">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" /><path d="M9 18c-4.51 2-5-2-7-2" /></svg>
                            </a>
                            <a href="https://instagram.com/nachitofm" target="_blank" rel="noopener noreferrer" className="text-white/50 hover:text-white transition-colors cursor-pointer">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" x2="17.51" y1="6.5" y2="6.5" /></svg>
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
