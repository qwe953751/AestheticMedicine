import React from "react";
import ReactDOM from "react-dom/client";
import { canDisplaySite } from "./site-access";

if (import.meta.env.DEV || canDisplaySite(window.location, window.self === window.top)) {
  Promise.all([import("./App"), import("./styles.css")]).then(([{ default: App }]) => {
    ReactDOM.createRoot(document.getElementById("root")!).render(
      <React.StrictMode><App /></React.StrictMode>,
    );
  });
} else {
  document.title = "";
  document.body.replaceChildren();
}
