import { useEffect, useRef } from "react";

interface TransitionVideoProps {
    src: string;
    onEnded: () => void;
    onClick: () => void;
}

export function TransitionVideo({ src, onEnded, onClick }: TransitionVideoProps) {
    const ref = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        const video = ref.current;
        if (!video) return;
        video.src = src;
        const playPromise = video.play();
        return () => {
            // Catch the AbortError that fires when React unmounts mid-play()
            playPromise?.catch(() => {});
            video.pause();
            video.removeAttribute("src");
            video.load();
        };
    }, [src]);

    return (
        <video
            ref={ref}
            playsInline
            className="absolute top-4 right-4 sm:top-16 sm:right-24 w-14 sm:w-24 object-cover z-20"
            onEnded={onEnded}
            onClick={e => { e.stopPropagation(); onClick(); }}
        />
    );
}
