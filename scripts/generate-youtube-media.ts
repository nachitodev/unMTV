import { writeFileSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

const input = process.argv[2];

if (!input) {
    console.error("Please provide a YouTube channel URL or a .txt file with URLs.");
    console.error("Example: bun run scripts/generate-youtube-media.ts https://www.youtube.com/@mtv");
    console.error("Example: bun run scripts/generate-youtube-media.ts scripts/artists.txt");
    process.exit(1);
}

let urls: string[] = [];

if (input.endsWith(".txt")) {
    const filePath = join(process.cwd(), input);
    if (!existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        process.exit(1);
    }
    const content = readFileSync(filePath, "utf-8");
    urls = content.split("\n").map(line => line.trim()).filter(line => line.startsWith("http"));
    console.log(`Found ${urls.length} URLs in ${input}.`);
} else {
    urls = [input];
}

let allValidMediaList: any[] = [];

for (const url of urls) {
    let fetchUrl = url;

    if (fetchUrl.includes("youtube.com") && !fetchUrl.includes("/videos") && !fetchUrl.includes("/playlist") && !fetchUrl.includes("/watch")) {
        if (fetchUrl.endsWith("/")) fetchUrl = fetchUrl.slice(0, -1);
        fetchUrl += "/videos";
    }

    console.log(`\nFetching videos from: ${fetchUrl} ...`);
    try {

        const output = execSync(`yt-dlp --flat-playlist -J "${fetchUrl}"`, { maxBuffer: 1024 * 1024 * 100 }).toString();
        const data = JSON.parse(output);

        const entries = data.entries || [];

        if (entries.length === 0) {
            console.log(`No videos found for ${url}.`);
            continue;
        }

        const mediaList = entries.map((entry: any) => {

            const thumbnails = entry.thumbnails || [];
            const thumb = thumbnails.length > 0 ? thumbnails[thumbnails.length - 1].url : `https://i.ytimg.com/vi/${entry.id}/hqdefault.jpg`;

            return {
                src: entry.url || (entry.id ? `https://www.youtube.com/watch?v=${entry.id}` : ""),
                title: entry.title,
                duration: entry.duration || 0,
                thumbnail: thumb,
                artist: data.channel || data.uploader || ""
            };
        });

        const validMediaList = mediaList.filter((m: any) => {
            if (!m.src || m.src.endsWith("undefined")) return false;

            if (m.duration > 1200) {
                return false;
            }

            if (m.title) {
                const lower = m.title.toLowerCase();

                if (lower.includes("visual")) {
                    return false;
                }
            }
            return true;
        });
        allValidMediaList = allValidMediaList.concat(validMediaList);

        console.log(`Found ${validMediaList.length} videos from ${url}.`);
    } catch (error) {
        console.error(`Error fetching or parsing data from ${url}:`);
        console.error((error as any).message);
    }
}

if (allValidMediaList.length === 0) {
    console.log("\nNo valid videos were found across all provided URLs. Exiting.");
    process.exit(0);
}

const uniqueVideos = new Map<string, any>();

for (const video of allValidMediaList) {
    if (!video.title) {
        uniqueVideos.set(video.src, video);
        continue;
    }

    let baseTitle = video.title.replace(/\([^)]+\)/g, '').replace(/\[[^\]]+\]/g, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
    if (!baseTitle) baseTitle = video.src;

    if (!uniqueVideos.has(baseTitle)) {
        uniqueVideos.set(baseTitle, video);
    } else {
        const existing = uniqueVideos.get(baseTitle);
        const existingTitle = existing.title.toLowerCase();
        const newTitle = video.title.toLowerCase();

        const existingIsOfficial = existingTitle.includes("oficial") || existingTitle.includes("official");
        const newIsOfficial = newTitle.includes("oficial") || newTitle.includes("official");

        if (newIsOfficial && !existingIsOfficial) {
            uniqueVideos.set(baseTitle, video);
        }
    }
}

allValidMediaList = Array.from(uniqueVideos.values());

const fileContent = `export interface MediaEntry {
  src: string;
  title?: string;
  duration?: number;
  thumbnail?: string;
  artist?: string;
}

export const mediaList: MediaEntry[] = ${JSON.stringify(allValidMediaList, null, 2)};
`;

const outPath = join(process.cwd(), "src", "media-list.ts");
writeFileSync(outPath, fileContent);

console.log(`\nSuccessfully generated src/media-list.ts with a total of ${allValidMediaList.length} YouTube videos!`);
