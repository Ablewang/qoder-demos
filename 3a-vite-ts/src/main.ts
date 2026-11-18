// Entry point: loads styles and boots the game.
import "./styles/ui.css";
import { showFatal } from "./app/diagnostics";
import { boot } from "./app/boot";

boot().catch((i) => showFatal((i && i.stack) || i));
