// scripts/generate-media-list.ts
// Ejecutar con: bun run scripts/generate-media-list.ts
// Genera src/media-list.ts con los .webm de /public/media (recursivo)
// Clasifica cada video según su aspect ratio (4:3 / 16:9 / otro) usando ffprobe

import { readdirSync, statSync, writeFileSync } from "fs";
import { join, relative } from "path";
import { execSync } from "child_process";

const mediaDir = join(process.cwd(), "public", "media");

function walk(dir: string): string[] {
    let results: string[] = [];
    for (const entry of readdirSync(dir)) {
        const fullPath = join(dir, entry);
        if (statSync(fullPath).isDirectory()) {
            results = results.concat(walk(fullPath));
        } else if (entry.endsWith(".webm")) {
            results.push(fullPath);
        }
    }
    return results;
}

function getAspect(file: string): "4:3" | "16:9" | "other" {
    try {
        const output = execSync(
            `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "${file}"`
        )
            .toString()
            .trim();

        const [width, height] = output.split(",").map(Number);
        const ratio = width / height;

        if (Math.abs(ratio - 4 / 3) < 0.05) return "4:3";
        if (Math.abs(ratio - 16 / 9) < 0.05) return "16:9";
        return "other";
    } catch {
        return "other";
    }
}

const files = walk(mediaDir);

const entries = files.map((f) => {
    const relPath = relative(mediaDir, f).split("\\").join("/");
    const encodedPath = relPath.split("/").map(encodeURIComponent).join("/");
    return {
        src: "/media/" + encodedPath,
        aspect: getAspect(f),
    };
});

const output = `export interface MediaEntry {
  src: string;
  aspect: "4:3" | "16:9" | "other";
}

export const mediaList: MediaEntry[] = ${JSON.stringify(entries, null, 2)};
`;

writeFileSync(join(process.cwd(), "src", "media-list.ts"), output);

const counts = {
    "4:3": entries.filter((e) => e.aspect === "4:3").length,
    "16:9": entries.filter((e) => e.aspect === "16:9").length,
    other: entries.filter((e) => e.aspect === "other").length,
};

console.log(
    `Generated media-list.ts with ${entries.length} files (4:3: ${counts["4:3"]}, 16:9: ${counts["16:9"]}, other: ${counts.other})`
);