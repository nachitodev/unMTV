import "./App.css";
import Player from "./components/YoutubePlayer";
import { mediaList } from "./media-list";

export default function App() {
  return <>
    <Player mediaList={mediaList} />
  </>
}