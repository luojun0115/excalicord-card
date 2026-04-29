import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";

import "../excalidraw-app/sentry";

import ExcalidrawApp from "./App";
import ExcalicordLanding from "./excalicord/ExcalicordLanding";

window.__EXCALIDRAW_SHA__ = import.meta.env.VITE_APP_GIT_SHA;
const rootElement = document.getElementById("root")!;
const root = createRoot(rootElement);
registerSW();
const isExcalicord =
  window.location.pathname === "/excalicord" ||
  window.location.pathname === "/excalicord/";
root.render(
  <StrictMode>
    {isExcalicord ? <ExcalicordLanding /> : <ExcalidrawApp />}
  </StrictMode>,
);
