// api/cameras.js
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");

  // مربع حول موقع المستخدم (اختياري) أو منطقة محددة
  const lat  = parseFloat(req.query.lat)  || 51.0;
  const lng  = parseFloat(req.query.lng)  || 10.0;
  const size = parseFloat(req.query.size) || 1.5; // درجة = ~150كم

  const south = (lat - size).toFixed(4);
  const west  = (lng - size).toFixed(4);
  const north = (lat + size).toFixed(4);
  const east  = (lng + size).toFixed(4);

  const query = `[out:json][timeout:30];(node["highway"="speed_camera"](${south},${west},${north},${east});node["enforcement"="maxspeed"](${south},${west},${north},${east}););out body;`;

  try {
    const response = await fetch(
      `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`,
      { headers: { "User-Agent": "MotoRiders/1.0" } }
    );

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const json = await response.json();
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