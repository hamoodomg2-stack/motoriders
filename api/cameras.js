// api/cameras.js
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  // تحقق من الكاش في Vercel KV أو أرجع مباشرة
  const query = encodeURIComponent(
    `[out:json][timeout:60];(node["highway"="speed_camera"](47.3,5.8,55.1,15.0);node["enforcement"="maxspeed"](47.3,5.8,55.1,15.0););out body;`
  );

  try {
    const response = await fetch(
      `https://overpass-api.de/api/interpreter?data=${query}`,
      {
        headers: {
          "User-Agent": "MotoRiders/1.0",
          "Accept": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Overpass HTTP ${response.status}`);
    }

    const text = await response.text();
    const json = JSON.parse(text);

    const cameras = (json.elements || []).map(e => ({
      id: e.id,
      lat: e.lat,
      lng: e.lon,
      maxspeed: e.tags?.maxspeed || e.tags?.["maxspeed:advisory"] || "",
    }));

    res.setHeader("Cache-Control", "public, max-age=604800");
    return res.json({ cameras, count: cameras.length });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}