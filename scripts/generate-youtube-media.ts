import { writeFileSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

const url = process.argv[2];

if (!url) {
    console.error("Please provide a YouTube channel or playlist URL.");
    console.error("Example: bun run scripts/generate-youtube-media.ts https://www.youtube.com/@mtv");
    process.exit(1);
}

console.log(`Fetching videos from: ${url} ...`);
console.log("This might take a moment depending on the channel size.");

try {
    // Run yt-dlp to get a flat JSON playlist. MaxBuffer is increased for very large channels.
    const output = execSync(`yt-dlp --flat-playlist -J "${url}"`, { maxBuffer: 1024 * 1024 * 50 }).toString();
    const data = JSON.parse(output);

    const entries = data.entries || [];
    
    if (entries.length === 0) {
        console.log("No videos found.");
        process.exit(0);
    }

    const mediaList = entries.map((entry: any) => ({
        src: entry.url || (entry.id ? `https://www.youtube.com/watch?v=${entry.id}` : ""),
        aspect: "16:9", // Most YouTube videos are 16:9, and react-player handles 4:3 perfectly fine anyway
        title: entry.title
    }));

    // Filter out invalid entries
    const validMediaList = mediaList.filter((m: any) => m.src && !m.src.endsWith("undefined"));

    const fileContent = `export interface MediaEntry {
  src: string;
  aspect: "4:3" | "16:9" | "other";
  title?: string;
}

export const mediaList: MediaEntry[] = ${JSON.stringify(validMediaList, null, 2)};
`;

    const outPath = join(process.cwd(), "src", "media-list.ts");
    writeFileSync(outPath, fileContent);

    console.log(`Successfully generated src/media-list.ts with ${validMediaList.length} YouTube videos!`);
} catch (error) {
    console.error("Error fetching or parsing data from YouTube:");
    console.error((error as any).message);
}
