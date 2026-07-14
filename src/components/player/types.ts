export interface MediaEntry {
    src: string;
    title?: string;
    duration?: number;
    thumbnail?: string;
    artist?: string;
}

export interface PlayerProps {
    mediaList: MediaEntry[];
}
