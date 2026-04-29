import { render } from "preact";
import { attachSharedThemeStylesheet } from "@/utils/sharedThemeStylesheet";
import App from "./App";
import "./style.css";

attachSharedThemeStylesheet();

render(<App />, document.getElementById("root")!);
