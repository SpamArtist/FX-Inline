import React from "react";
import ReactDOM from "react-dom/client";
import { attachSharedThemeStylesheet } from "@/utils/sharedThemeStylesheet";
import App from "./App";
import "./style.css";

attachSharedThemeStylesheet();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
