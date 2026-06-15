import "./App.css";
import Player from "./components/YoutubePlayer";
import { mediaList } from "./media-list";
import { Analytics } from "@vercel/analytics/react"

export default function App() {
  return <>
    <Player mediaList={mediaList} />
    <Analytics />
  </>
}