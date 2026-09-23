import { localizeDocument } from "@/utils/i18n";
import { render } from "preact";
import { attachSharedThemeStylesheet } from "@/utils/sharedThemeStylesheet";
import App from "./App";
import "./style.css";

attachSharedThemeStylesheet();
localizeDocument(document);

render(<App />, document.getElementById("root")!);
