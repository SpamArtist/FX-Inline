import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

const appRoot = document.getElementById("app");
if (!(appRoot instanceof HTMLElement)) {
  throw new Error("Dashboard root element #app not found");
}

createRoot(appRoot).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
