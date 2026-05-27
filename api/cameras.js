// api/cameras.js — Vercel Serverless Function
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");

  const query = `[out:json][timeout:60];(node["highway"="speed_camera"](47.3,5.8,55.1,15.0);node["enforcement"="maxspeed"](47.3,5.8,55.1,15.0););out body;`;

  try {
    const response = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(query)}`,
    });

    const json = await response.json();
    const cameras = (json.elements || []).map(e => ({
      id: e.id,
      lat: e.lat,
      lng: e.lon,
      maxspeed: e.tags?.maxspeed || e.tags?.["maxspeed:advisory"] || "",
    }));

    // cache 7 أيام
    res.setHeader("Cache-Control", "public, max-age=604800, stale-while-revalidate=86400");
    res.json({ cameras, count: cameras.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}