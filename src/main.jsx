import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "leaflet/dist/leaflet.css";
import App from "./App.jsx";
 
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);


// تسجيل Service Worker
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js")
      .then(() => console.log("SW registered"))
      .catch(err => console.log("SW error:", err));
  });
}

