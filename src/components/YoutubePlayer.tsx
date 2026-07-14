import React, { useEffect, useRef, useState } from "react";
import ReactPlayer from "react-player";

import type { PlayerProps } from "./player/types";
import { useQueue } from "./player/hooks/useQueue";
import { useClock } from "./player/hooks/useClock";
import { useTemperature } from "./player/hooks/useTemperature";
import { useFullscreen } from "./player/hooks/useFullscreen";
import { TransitionVideo } from "./player/TransitionVideo";
import { NowPlayingBumper, ClockOverlay, MuteBanner } from "./player/PlayerOverlays";
import { PlayerControls } from "./player/PlayerControls";
import { PlaylistDrawer } from "./player/PlaylistDrawer";

export default function YoutubePlayer({ mediaList }: PlayerProps) {
    const playerRef = useRef<HTMLVideoElement>(null);

    const [isMuted, setIsMuted] = useState(true);
    const [volume, setVolume] = useState(1);
    const [playing, setPlaying] = useState(true);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [transitionVideo, setTransitionVideo] = useState<string | null>(null);
    const [showPlaylist, setShowPlaylist] = useState(false);
    const playlistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const { containerRef, isFullscreen, toggleFullscreen } = useFullscreen();
    const time = useClock();
    const temp = useTemperature();

    const { index, current, displayQueue, handleNext, handlePrev } = useQueue(
        mediaList,
        playerRef,
        setPlaying,
        setTransitionVideo
    );

    // Reset playback state when video changes
    useEffect(() => {
        setCurrentTime(0);
        setDuration(0);
        setPlaying(true);
    }, [index]);

    // Spacebar to play/pause
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.code === "Space") { e.preventDefault(); setPlaying(p => !p); }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    if (!current) return null;

    const activeDuration = duration || current.duration || 0;
    const showUpNext = activeDuration > 10 && (activeDuration - currentTime <= 5) && mediaList.length > 1;
    const showNowPlaying = currentTime <= 5 && activeDuration > 0 && !showUpNext;
    const showMidBumper = activeDuration > 45 && currentTime >= 45 && currentTime < 55;

    const isEnzo = current.artist === "enzocerobulto";
    const currentLogo = isEnzo ? "/OTG-Logo.svg" : "/MTV-Logo.svg";

    function handleGlobalClick() {
        setIsMuted(false);
        setPlaying(true);
    }

    function handleVolumeChange(val: number) {
        setVolume(val);
        setIsMuted(val === 0);
    }

    return (
        <div
            ref={containerRef}
            className="fixed inset-0 bg-black overflow-hidden flex items-center justify-center cursor-pointer"
            onClick={handleGlobalClick}
            onWheel={e => {
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
            {/* Video */}
            <div className="w-full h-full pointer-events-none">
                <ReactPlayer
                    key={current.src}
                    ref={playerRef}
                    src={current.src}
                    playing={playing}
                    muted={isMuted}
                    volume={volume}
                    controls={false}
                    width="100%"
                    height="100%"
                    playsInline
                    style={{ pointerEvents: "none" } as React.CSSProperties}
                    config={{
                        youtube: {
                            iv_load_policy: 3,
                            cc_load_policy: 0,
                            disablekb: 1,
                            fs: 0,
                            rel: 0,
                        },
                    }}
                    onTimeUpdate={(e: React.SyntheticEvent<HTMLVideoElement>) =>
                        setCurrentTime(e.currentTarget.currentTime)
                    }
                    onDurationChange={(e: React.SyntheticEvent<HTMLVideoElement>) =>
                        setDuration(e.currentTarget.duration)
                    }
                    onEnded={handleNext}
                    onError={() => { console.error("Video error:", current.src); handleNext(); }}
                />
            </div>

            {/* Channel logo / transition clip */}
            <img
                src={currentLogo}
                alt={isEnzo ? "OTG" : "MTV"}
                className={`absolute top-4 right-4 sm:top-16 sm:right-24 w-14 sm:w-24 pointer-events-none z-20 transition-all duration-500 ${transitionVideo ? "opacity-0" : "opacity-90"}`}
            />
            {transitionVideo && (
                <TransitionVideo
                    src={transitionVideo}
                    onEnded={() => setTransitionVideo(null)}
                    onClick={() => setTransitionVideo(null)}
                />
            )}

            <ClockOverlay time={time} temp={temp} />
            {isMuted && <MuteBanner />}

            <NowPlayingBumper
                current={current}
                nextEntry={mediaList[displayQueue[0]]}
                showUpNext={showUpNext}
                showNowPlaying={showNowPlaying}
                showMidBumper={showMidBumper}
            />

            <PlayerControls
                isMuted={isMuted}
                volume={volume}
                isFullscreen={isFullscreen}
                onPrev={() => { handleGlobalClick(); handlePrev(); }}
                onNext={() => { handleGlobalClick(); handleNext(); }}
                onMuteToggle={() => setIsMuted(m => !m)}
                onVolumeChange={handleVolumeChange}
                onFullscreenToggle={toggleFullscreen}
            />

            <PlaylistDrawer
                visible={showPlaylist}
                displayQueue={displayQueue}
                mediaList={mediaList}
            />
        </div>
    );
}
