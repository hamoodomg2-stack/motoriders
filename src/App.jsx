import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Map, Users, MessageCircle, Shield, User, LogOut, Bike,
  Clock, Navigation, CheckCircle, XCircle, Bell,
  Settings, ChevronRight, Star, Wifi, WifiOff, Eye, EyeOff,
  Lock, Mail, Hash, ArrowRight, Loader, Ban, RefreshCw,
  UserCheck, UserX, Crown, Search, Trophy, Zap, Award, TrendingUp,
  BellOff, BellRing, Camera, Heart, Image, X, Upload
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";

/* ─── SUPABASE — ضع بياناتك هنا ─── */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://hygfxmdsadiityhgifsz.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5Z2Z4bWRzYWRpaXR5aGdpZnN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMzY2MzUsImV4cCI6MjA5NDcxMjYzNX0.7tRlIaDyfgjZR4kJNHdIvfrcIwf-_cr5BQWjF3v7xgg";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ─── Push Notifications ─── */
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY ||
  "BCzxpe1MMf3SffJ2uA2Akc8lTABbWBslnqkCYUCj3vORXp_R1Vt-2zDGtmwx4xyHe1WVak7dSCwqAFC8uwAkfg4";

function urlBase64ToUint8Array(b64) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const base64 = (b64 + pad).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from([...atob(base64)].map(c => c.charCodeAt(0)));
}

async function registerSW() {
  if (!("serviceWorker" in navigator)) return null;
  try { return await navigator.serviceWorker.register("/sw.js", { scope: "/" }); }
  catch { return null; }
}

async function subscribePush(userId) {
  if (!("Notification" in window) || !("PushManager" in window))
    return { ok: false, reason: "غير مدعوم" };
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return { ok: false, reason: "تم رفض الإذن" };
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
    const { endpoint, keys } = sub.toJSON();
    const { error } = await supabase.from("push_subscriptions").upsert(
      { user_id: userId, endpoint, p256dh: keys.p256dh, auth: keys.auth,
        user_agent: navigator.userAgent.slice(0, 200), updated_at: new Date().toISOString() },
      { onConflict: "endpoint" }
    );
    if (error) throw error;
    return { ok: true };
  } catch (e) { return { ok: false, reason: e.message }; }
}

async function unsubscribePush(userId) {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await sub.unsubscribe();
      await supabase.from("push_subscriptions").delete()
        .eq("user_id", userId).eq("endpoint", sub.endpoint);
    }
    return { ok: true };
  } catch (e) { return { ok: false, reason: e.message }; }
}

async function getPushStatus() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return sub ? "subscribed" : "not_subscribed";
  } catch { return "not_subscribed"; }
}

async function sendPushToUser({ userId, title, message, url = "/", tag = "motoriders" }) {
  try {
    await supabase.functions.invoke("send-push", {
      body: { user_id: userId, title, message, url, tag },
    });
  } catch (e) { console.warn("sendPush:", e); }
}

const VALID_INVITE_CODES = ["MOTO2024", "RIDER001", "SPEED99", "BIKER42"];

/* ─── أنواع التحذيرات ─── */
const ALERT_TYPES = [
  { id: "pothole", label: "حفرة خطيرة", icon: "🕳️" },
  { id: "dogs", label: "كلاب ضالة", icon: "🐕" },
  { id: "glass", label: "زجاج مكسور", icon: "💎" },
  { id: "maintenance", label: "أعمال صيانة", icon: "🚧" },
  { id: "rough_road", label: "طريق غير ممهد", icon: "🪨" },
  { id: "accident", label: "حادث", icon: "🚨" },
  { id: "other", label: "أخرى", icon: "⚠️" },
];

/* ─── Gamification ─── */
const XP_REWARDS = {
  per_km: 10,           // كل كيلومتر
  ride_complete: 50,    // إكمال رحلة جماعية
  new_top_speed: 25,    // سجل سرعة جديد
  join_ride: 15,        // الانضمام لرحلة
  first_ride: 100,      // أول رحلة
};

const LEVELS = [
  { min: 0,    max: 199,   name: "مبتدئ",    icon: "🔰", color: "#6b7280" },
  { min: 200,  max: 499,   name: "متحرك",    icon: "🏍️", color: "#3b82f6" },
  { min: 500,  max: 999,   name: "سريع",     icon: "⚡", color: "#8b5cf6" },
  { min: 1000, max: 2499,  name: "محترف",    icon: "🔥", color: "#f97316" },
  { min: 2500, max: 4999,  name: "نخبة",     icon: "💎", color: "#06b6d4" },
  { min: 5000, max: Infinity, name: "أسطورة", icon: "👑", color: "#f59e0b" },
];

const BADGES_DEF = [
  { id: "first_ride",    icon: "🏁", label: "أول رحلة",         desc: "أكملت رحلتك الأولى" },
  { id: "speed_100",     icon: "💨", label: "100 كم/س",          desc: "تجاوزت 100 كم/س" },
  { id: "speed_150",     icon: "🚀", label: "150 كم/س",          desc: "تجاوزت 150 كم/س" },
  { id: "dist_100",      icon: "📍", label: "100 كم",            desc: "قطعت 100 كيلومتر" },
  { id: "dist_500",      icon: "🗺️", label: "500 كم",            desc: "قطعت 500 كيلومتر" },
  { id: "rides_5",       icon: "🔥", label: "5 رحلات",           desc: "شاركت في 5 رحلات" },
  { id: "rides_20",      icon: "🏆", label: "20 رحلة",           desc: "شاركت في 20 رحلة" },
  { id: "early_bird",    icon: "🌅", label: "الطائر المبكر",    desc: "انضممت لرحلة فجرية" },
  { id: "night_rider",   icon: "🌙", label: "فارس الليل",       desc: "ركبت بعد منتصف الليل" },
];

function getLevel(xp) {
  return LEVELS.find(l => xp >= l.min && xp <= l.max) || LEVELS[0];
}

function getLevelProgress(xp) {
  const lvl = getLevel(xp);
  if (lvl.max === Infinity) return 100;
  const range = lvl.max - lvl.min;
  return Math.round(((xp - lvl.min) / range) * 100);
}

async function awardXP(profileId, amount, reason) {
  const { data: p } = await supabase
    .from("profiles")
    .select("xp, badges, top_speed, total_rides")
    .eq("id", profileId)
    .single();
  if (!p) return;

  const newXp = (p.xp || 0) + amount;
  const existingBadges = p.badges || [];
  const newBadges = [...existingBadges];

  // فحص الشارات
  if (!existingBadges.includes("speed_100") && (p.top_speed || 0) >= 100) newBadges.push("speed_100");
  if (!existingBadges.includes("speed_150") && (p.top_speed || 0) >= 150) newBadges.push("speed_150");
  if (!existingBadges.includes("dist_100") && (p.total_distance || 0) >= 100) newBadges.push("dist_100");
  if (!existingBadges.includes("dist_500") && (p.total_distance || 0) >= 500) newBadges.push("dist_500");
  if (!existingBadges.includes("rides_5") && (p.total_rides || 0) >= 5) newBadges.push("rides_5");
  if (!existingBadges.includes("rides_20") && (p.total_rides || 0) >= 20) newBadges.push("rides_20");
  if (!existingBadges.includes("first_ride") && (p.total_rides || 0) >= 1) newBadges.push("first_ride");

  await supabase.from("profiles").update({ xp: newXp, badges: newBadges }).eq("id", profileId);

  // إشعار بالـ XP
  if (reason) {
    await supabase.from("notifications").insert({
      user_id: profileId,
      title: `⭐ +${amount} XP`,
      body: reason,
      type: "xp",
    });
  }
}
function getDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const MOCK_RIDERS = [
  { id: "m1", full_name: "أحمد السريع", bike_type: "Yamaha R1", speed: 120, current_speed: 120, lat: 24.688, lng: 46.722, status: "online" },
  { id: "m2", full_name: "محمد الصقر", bike_type: "Kawasaki Z900", speed: 95, current_speed: 95, lat: 24.695, lng: 46.730, status: "online" },
  { id: "m3", full_name: "خالد البرق", bike_type: "Honda CBR", speed: 0, current_speed: 0, lat: 24.680, lng: 46.715, status: "offline" },
];

/* ─── Leaflet marker icon ─── */
const createRiderIcon = (name, speed, isOnline, avatarUrl, pingEmoji) => {
  const glowColor = isOnline ? "#f97316" : "#6b7280";
  const ringColor = isOnline ? "#f97316" : "#4b5563";
  return L.divIcon({
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;gap:3px;position:relative;">
        ${pingEmoji ? `
        <div style="
          position:absolute;top:-36px;left:50%;transform:translateX(-50%);
          background:rgba(0,0,0,0.85);border:2px solid #f97316;
          border-radius:50%;width:36px;height:36px;
          display:flex;align-items:center;justify-content:center;
          font-size:20px;
          animation:pingPop 0.4s cubic-bezier(0.34,1.56,0.64,1);
          box-shadow:0 0 16px #f9731688;
        ">${pingEmoji}</div>
        <div style="
          position:absolute;top:-2px;left:50%;transform:translateX(-50%);
          width:0;height:0;
          border-left:6px solid transparent;
          border-right:6px solid transparent;
          border-top:8px solid #f97316;
        "></div>
        ` : ""}
        <div style="position:relative;width:50px;height:50px;border-radius:50%;
          background:${isOnline ? "conic-gradient(#f97316,#fb923c,#f97316)" : "conic-gradient(#4b5563,#6b7280,#4b5563)"};
          padding:3px;box-shadow:0 0 ${isOnline ? "16px 3px" : "0px"} ${glowColor}88;">
          <div style="width:100%;height:100%;border-radius:50%;background:#111;
            display:flex;align-items:center;justify-content:center;overflow:hidden;">
            ${avatarUrl
        ? `<img src="${avatarUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`
        : `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24"
                  fill="none" stroke="${glowColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>`
      }
          </div>
          ${isOnline ? `<div style="position:absolute;bottom:1px;right:1px;width:11px;height:11px;
            background:#22c55e;border-radius:50%;border:2px solid #111;"></div>` : ""}
        </div>
        <div style="background:rgba(5,5,5,0.93);border:1px solid ${ringColor}77;border-radius:8px;
          padding:2px 7px;text-align:center;min-width:56px;">
          <div style="color:#fff;font-size:10px;font-weight:700;white-space:nowrap;
            overflow:hidden;text-overflow:ellipsis;max-width:70px;">${name || "—"}</div>
          <div style="color:${isOnline ? "#f97316" : "#6b7280"};font-size:10px;font-weight:600;">${speed} كم/س</div>
        </div>
      </div>
      <style>
        @keyframes pingPop {
          0% { transform:translateX(-50%) scale(0); opacity:0; }
          60% { transform:translateX(-50%) scale(1.3); opacity:1; }
          100% { transform:translateX(-50%) scale(1); opacity:1; }
        }
      </style>`,
    iconSize: [60, pingEmoji ? 130 : 88],
    iconAnchor: [30, pingEmoji ? 130 : 88],
    popupAnchor: [0, -90],
    className: "",
  });
};

/* ─── Safety Alerts Hook ─── */
function useSafetyAlerts(myLoc, profile) {
  const [alerts, setAlerts] = useState([]);
  const [showAddAlert, setShowAddAlert] = useState(false);
  const notifiedRef = useRef(new Set());

  // جلب التحذيرات النشطة
  useEffect(() => {
    const fetchAlerts = async () => {
      const { data } = await supabase
        .from("safety_alerts")
        .select("*")
        .eq("active", true)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false });
      if (data) setAlerts(data);
    };
    fetchAlerts();

    // Realtime
    const ch = supabase.channel("safety-alerts-rt")
      .on("postgres_changes",
        { event: "*", schema: "public", table: "safety_alerts" },
        () => fetchAlerts()
      ).subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  // تنبيه القرب — إذا اقتربت من تحذير بأقل من 200 متر
  useEffect(() => {
    if (!myLoc || !alerts.length) return;
    alerts.forEach(alert => {
      if (!alert.active) return;
      const dist = getDistance(myLoc.lat, myLoc.lng, alert.lat, alert.lng);
      if (dist < 200 && !notifiedRef.current.has(alert.id)) {
        notifiedRef.current.add(alert.id);
        // تنبيه صوتي
        const type = ALERT_TYPES.find(t => t.id === alert.type);
        const msg = new SpeechSynthesisUtterance(
          `انتبه! بعد ${Math.round(dist)} متر ${type?.label || "تحذير"}`
        );
        msg.lang = "ar-SA";
        msg.rate = 0.9;
        window.speechSynthesis?.speak(msg);
        // إشعار مرئي
        if (Notification.permission === "granted") {
          new Notification(`⚠️ ${type?.icon} ${type?.label}`, {
            body: `بعد ${Math.round(dist)} متر — ${alert.description || ""}`,
          });
        }
      }
      // إعادة التنبيه إذا ابتعد ثم اقترب
      if (dist > 500) notifiedRef.current.delete(alert.id);
    });
  }, [myLoc, alerts]);

  const addAlert = async (type, description, lat, lng, reporterName) => {
    const { data } = await supabase.from("safety_alerts").insert({
      reporter_id: profile.id,
      reporter_name: reporterName,
      type, description, lat, lng,
      expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    }).select().single();
    if (data) setAlerts(prev => [data, ...prev]);
  };

  const removeAlert = async (id) => {
    await supabase.from("safety_alerts").update({ active: false }).eq("id", id);
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  return { alerts, addAlert, removeAlert, showAddAlert, setShowAddAlert };
}

/* ─── GPS Hook ─── */
function useGPS(profileId, stealth) {
  const [loc, setLoc] = useState(null);
  const [speed, setSpeed] = useState(0);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);
  const [trail, setTrail] = useState([]); // مسار الجلسة الحالية
  const watchRef = useRef(null);
  const intervalRef = useRef(null);
  const lastRef = useRef(null);
  const locRef = useRef(null);

  const upload = useCallback(async (lat, lng, spd) => {
    if (!profileId || stealth) return;
    await supabase.from("locations").upsert(
      {
        profile_id: profileId,
        lat, lng,
        speed: Math.round(spd * 3.6),
        updated_at: new Date().toISOString()
      },
      { onConflict: "profile_id" }
    );
  }, [profileId, stealth]);

  const distanceRef = useRef(0); // متر مقطوعة في الجلسة
  const sessionTopSpeedRef = useRef(0);

  const start = useCallback(() => {
    if (!navigator.geolocation) { setError("GPS غير مدعوم"); setStatus("error"); return; }
    setStatus("searching");
    distanceRef.current = 0;
    sessionTopSpeedRef.current = 0;
    setTrail([]); // صفّر المسار عند البدء
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng, speed: spd } = pos.coords;
        const kmh = spd ? Math.round(spd * 3.6) : 0;
        setLoc({ lat, lng }); setSpeed(kmh); setStatus("active"); setError(null);
        // احفظ آخر موقع
        try { localStorage.setItem("moto_last_loc", JSON.stringify({ lat, lng })); } catch {}
        // أضف نقطة للمسار (كل 10م على الأقل)
        if (!lastRef.current || getDistance(lastRef.current.lat, lastRef.current.lng, lat, lng) > 10) {
          setTrail(prev => {
            const next = [...prev, [lat, lng]];
            return next.length > 2000 ? next.slice(-2000) : next; // حد أقصى 2000 نقطة
          });
        }
        // حساب المسافة
        if (lastRef.current) {
          const d = getDistance(lastRef.current.lat, lastRef.current.lng, lat, lng);
          if (d < 500) distanceRef.current += d;
        }
        if (kmh > sessionTopSpeedRef.current) sessionTopSpeedRef.current = kmh;
        lastRef.current = { lat, lng, speed: kmh };
      },
      (err) => {
        setStatus("error");
        setError(err.code === 1 ? "يرجى السماح بالوصول للموقع من إعدادات المتصفح" : "تعذّر تحديد موقعك");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 3000 }
    );
    intervalRef.current = setInterval(() => {
      if (lastRef.current) upload(lastRef.current.lat, lastRef.current.lng, lastRef.current.speed / 3.6);
    }, 10000);
  }, [upload]);

  const stop = useCallback(async () => {
    if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
    setStatus("idle");

    // منح XP عن المسافة المقطوعة + السرعة
    if (profileId && distanceRef.current > 100) {
      const km = distanceRef.current / 1000;
      const xpEarned = Math.round(km * XP_REWARDS.per_km);
      const { data: p } = await supabase.from("profiles").select("top_speed").eq("id", profileId).single();
      const isNewRecord = p && sessionTopSpeedRef.current > (p.top_speed || 0);
      const totalXp = xpEarned + (isNewRecord ? XP_REWARDS.new_top_speed : 0);
      if (totalXp > 0) {
        await awardXP(profileId, totalXp,
          isNewRecord
            ? `ركبت ${km.toFixed(1)} كم وسجّلت سرعة قياسية جديدة ${sessionTopSpeedRef.current} كم/س 🚀`
            : `ركبت ${km.toFixed(1)} كم في هذه الجلسة 🏍️`
        );
      }
      // تحديث top_speed إذا كان أعلى
      if (isNewRecord) {
        await supabase.from("profiles").update({ top_speed: sessionTopSpeedRef.current }).eq("id", profileId);
      }
    }

    // احذف الموقع نهائياً عند الإيقاف
    if (profileId) {
      await supabase.from("locations").delete().eq("profile_id", profileId);
    }
  }, [profileId]);

  useEffect(() => () => {
    if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  useEffect(() => {
    const handleUnload = async () => {
      if (profileId) {
        await supabase.from("locations").delete().eq("profile_id", profileId);
      }
    };
    window.addEventListener("beforeunload", handleUnload);
    window.addEventListener("pagehide", handleUnload);
    return () => {
      window.removeEventListener("beforeunload", handleUnload);
      window.removeEventListener("pagehide", handleUnload);
    };
  }, [profileId]);

  return { loc, speed, status, error, start, stop, trail };
}

/* ════════════════════════════════════════
   MAIN APP
════════════════════════════════════════ */
export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState("login");
  const [activeTab, setActiveTab] = useState("map");
  const isAdmin = window.location.pathname === "/admin";

  useEffect(() => {
    // تسجيل Service Worker فور تحميل التطبيق
    registerSW();

    const t = setTimeout(() => setLoading(false), 5000);
    supabase.auth.getSession().then(({ data: { session } }) => {
      clearTimeout(t);
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else { setProfile(null); setLoading(false); }
    });
    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (uid) => {
    try {
      const { data } = await supabase.from("profiles").select("*").eq("id", uid).single();
      setProfile(data);
    } finally { setLoading(false); }
  };

  // جلب الإشعارات
  const fetchNotifications = async (uid) => {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) {
      setNotifications(data);
      setUnreadNotif(data.filter(n => !n.is_read).length);
    }
  };

  const signOut = async () => { await supabase.auth.signOut(); setSession(null); setProfile(null); };

  if (loading) return <Splash />;
  if (isAdmin) return <AdminPanel session={session} onSignOut={signOut} />;
  if (!session) return <AuthScreen mode={authMode} setMode={setAuthMode} />;
  if (!profile || profile.status === "pending") return <PendingScreen profile={profile} onSignOut={signOut} />;

  return <MainApp session={session} profile={profile} activeTab={activeTab} setActiveTab={setActiveTab} onSignOut={signOut} />;
}

/* ─── Splash ─── */
function Splash() {
  return (
    <div className="h-screen bg-gray-950 flex flex-col items-center justify-center gap-5">
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }} className="text-6xl">🏍️</motion.div>
      <motion.p animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.5, repeat: Infinity }}
        className="text-orange-500 font-black text-xl tracking-widest">MOTORIDERS</motion.p>
      <div className="w-40 h-1 bg-gray-800 rounded-full overflow-hidden">
        <motion.div className="h-full bg-orange-500" animate={{ x: ["-100%", "100%"] }} transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }} />
      </div>
    </div>
  );
}

/* ─── Auth Screen ─── */
function AuthScreen({ mode, setMode }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [name, setName] = useState("");
  const [bike, setBike] = useState("");
  const [code, setCode] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const submit = async () => {
    setError(""); setSuccess(""); setLoading(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
        if (error) throw new Error("البريد أو كلمة المرور غير صحيحة");
      } else {
        if (!name || !bike) throw new Error("يرجى تعبئة جميع الحقول");

        const { data: codeData, error: codeError } = await supabase
          .from("invite_codes")
          .select("*")
          .eq("code", code.toUpperCase())
          .eq("is_used", false)
          .gt("expires_at", new Date().toISOString())
          .maybeSingle();

        if (codeError || !codeData) throw new Error("كود الدعوة غير صحيح أو منتهي الصلاحية!");

        const signUpResult = await supabase.auth.signUp({ email, password: pass });
        if (signUpResult.error) throw new Error(signUpResult.error.message);

        if (signUpResult.data.user) {
          await supabase.from("profiles").insert({
            id: signUpResult.data.user.id,
            full_name: name,
            bike_type: bike,
            status: "pending",
            role: "user",
            invite_code_used: code.toUpperCase(),
          });
          await supabase.from("invite_codes")
            .update({ is_used: true, used_by: signUpResult.data.user.id })
            .eq("code", code.toUpperCase());
        }
        setSuccess("تم التسجيل! حسابك قيد المراجعة.");
        setTimeout(() => setMode("login"), 3000);
      }
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-radial from-orange-900/20 via-transparent to-transparent pointer-events-none" />
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm relative z-10">
        <div className="text-center mb-8">
          <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 2, repeat: Infinity }} className="text-5xl mb-3">🏍️</motion.div>
          <h1 className="text-3xl font-black text-white tracking-widest">MOTO<span className="text-orange-500">RIDERS</span></h1>
          <p className="text-gray-500 text-sm mt-1">نظام تتبع الدراجين</p>
        </div>

        <div className="flex bg-gray-900 rounded-2xl p-1 mb-5 border border-gray-800">
          {["login", "register"].map(m => (
            <button key={m} onClick={() => { setMode(m); setError(""); }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${mode === m ? "bg-orange-500 text-white shadow-lg shadow-orange-500/30" : "text-gray-400"}`}>
              {m === "login" ? "تسجيل الدخول" : "حساب جديد"}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          <AnimatePresence>
            {mode === "register" && (
              <motion.div key="reg" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-3 overflow-hidden">
                <Field icon={<User size={15} />} placeholder="الاسم الكامل" value={name} onChange={setName} />
                <Field icon={<Bike size={15} />} placeholder="نوع الدراجة" value={bike} onChange={setBike} />
                <Field icon={<Hash size={15} />} placeholder="كود الدعوة" value={code} onChange={v => setCode(v.toUpperCase())} hint="تواصل مع المسؤول للحصول على الكود" />
              </motion.div>
            )}
          </AnimatePresence>
          <Field icon={<Mail size={15} />} placeholder="البريد الإلكتروني" type="email" value={email} onChange={setEmail} />
          <div className="relative">
            <Field icon={<Lock size={15} />} placeholder="كلمة المرور" type={showPass ? "text" : "password"} value={pass} onChange={setPass} />
            <button onClick={() => setShowPass(!showPass)} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">{showPass ? <EyeOff size={15} /> : <Eye size={15} />}</button>
          </div>

          <AnimatePresence>
            {error && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2 bg-red-900/40 border border-red-700 text-red-400 text-sm p-3 rounded-xl"><XCircle size={15} />{error}</motion.div>}
            {success && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2 bg-green-900/40 border border-green-700 text-green-400 text-sm p-3 rounded-xl"><CheckCircle size={15} />{success}</motion.div>}
          </AnimatePresence>

          <motion.button whileTap={{ scale: 0.97 }} onClick={submit} disabled={loading}
            className="w-full bg-orange-500 hover:bg-orange-400 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-orange-500/40 disabled:opacity-60 text-base">
            {loading ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}><Loader size={20} /></motion.div>
              : <>{mode === "login" ? "دخول" : "تسجيل"}<ArrowRight size={18} /></>}
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}

function Field({ icon, placeholder, type = "text", value, onChange, hint }) {
  return (
    <div>
      <div className="relative">
        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-orange-500">{icon}</div>
        <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          dir="auto" autoComplete={type === "password" ? "current-password" : "on"}
          autoCorrect="off" autoCapitalize="none" spellCheck="false"
          className="w-full bg-gray-900 border border-gray-800 text-white placeholder-gray-600 rounded-2xl py-4 pr-11 pl-4 text-base focus:border-orange-500 focus:outline-none transition-all" />
      </div>
      {hint && <p className="text-xs text-gray-600 mt-1 pr-1">{hint}</p>}
    </div>
  );
}

/* ─── Pending Screen ─── */
function PendingScreen({ profile, onSignOut }) {
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {[1, 2, 3].map(i => (
        <motion.div key={i} className="absolute rounded-full border border-orange-500/20"
          style={{ width: 160 * i, height: 160 * i }}
          animate={{ scale: [1, 1.04, 1], opacity: [0.3, 0.1, 0.3] }}
          transition={{ duration: 3, repeat: Infinity, delay: i * 0.5 }} />
      ))}
      <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="relative z-10 text-center max-w-sm w-full">
        <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 2.5, repeat: Infinity }} className="relative inline-block mb-6">
          <div className="w-28 h-28 bg-gray-900 border-2 border-orange-500/50 rounded-3xl flex items-center justify-center mx-auto shadow-2xl shadow-orange-500/20">
            <Shield size={52} className="text-orange-500" />
          </div>
          <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 1.5, repeat: Infinity }}
            className="absolute -top-2 -right-2 w-7 h-7 bg-yellow-500 rounded-full flex items-center justify-center">
            <Clock size={14} className="text-gray-900" />
          </motion.div>
        </motion.div>
        <h2 className="text-2xl font-black text-white mb-2">حسابك قيد المراجعة</h2>
        <p className="text-gray-400 text-sm leading-relaxed mb-6">
          مرحباً <span className="text-orange-400 font-semibold">{profile?.full_name || "دراج"}</span>!<br />
          سيتم مراجعة حسابك قريباً من المسؤول.
        </p>
        <div className="space-y-2 mb-8">
          {[{ l: "إنشاء الحساب", d: true }, { l: "التحقق من كود الدعوة", d: true }, { l: "موافقة المسؤول", d: false, a: true }, { l: "الوصول للخريطة", d: false }].map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.15 }}
              className={`flex items-center gap-3 p-3 rounded-xl text-right ${s.a ? "bg-orange-500/10 border border-orange-500/30" : "bg-gray-900/50"}`}>
              {s.d ? <CheckCircle size={18} className="text-green-500 shrink-0" />
                : s.a ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}><Loader size={18} className="text-orange-500 shrink-0" /></motion.div>
                  : <div className="w-4 h-4 rounded-full border-2 border-gray-700 shrink-0" />}
              <span className={`text-sm ${s.d ? "text-green-400" : s.a ? "text-orange-400 font-semibold" : "text-gray-600"}`}>{s.l}</span>
            </motion.div>
          ))}
        </div>
        <button onClick={onSignOut} className="flex items-center gap-2 text-gray-600 hover:text-red-400 text-sm mx-auto transition-colors">
          <LogOut size={15} />تسجيل خروج
        </button>
      </motion.div>
    </div>
  );
}

/* ─── Main App ─── */
function MainApp({ session, profile, activeTab, setActiveTab, onSignOut }) {
  const [riders, setRiders] = useState([]);
  const [connected, setConnected] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [stealth, setStealth] = useState(false);
  const [activeRides, setActiveRides] = useState([]);

  // جلب الرحلات النشطة للخريطة
  useEffect(() => {
    const fetchActiveRides = async () => {
      const { data } = await supabase
        .from("rides")
        .select("*")
        .eq("approved", true)
        .neq("status", "completed")
        .not("start_lat", "is", null);
      if (data) {
        // فلترة: أظهر فقط الرحلات التي لم تبدأ بعد أو بدأت منذ أقل من دقيقة
        const now = new Date();
        const filtered = data.filter(ride => {
          if (!ride.start_date || !ride.start_time) return true;
          const rideTime = new Date(`${ride.start_date}T${ride.start_time}`);
          const diffMinutes = (now - rideTime) / 1000 / 60;
          return diffMinutes < 1; // أخفِ بعد دقيقة من الموعد
        });
        setActiveRides(filtered);
      }
    };
    fetchActiveRides();
    // فحص كل دقيقة لإخفاء الرحلات المنتهية
    const interval = setInterval(fetchActiveRides, 60000);
    const ch = supabase.channel("rides-map-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "rides" }, fetchActiveRides)
      .subscribe();
    return () => { supabase.removeChannel(ch); clearInterval(interval); };
  }, []);
  // فحص كل 30 ثانية — إزالة الدراجين غير النشطين
  useEffect(() => {
    const interval = setInterval(() => {
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
      setRiders(prev => prev.filter(r => {
        if (!r.location_updated_at) return false;
        return new Date(r.location_updated_at) > twoMinutesAgo;
      }));
    }, 30000);
    return () => clearInterval(interval);
  }, []);
  const [unread, setUnread] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadNotif, setUnreadNotif] = useState(0);
  const [openDMWith, setOpenDMWith] = useState(null);
  const [mapSelectedRider, setMapSelectedRider] = useState(null);

  const sendPing = async (toRider, pingType) => {
    await supabase.from("quick_pings").insert({
      from_id: profile.id,
      from_name: profile.full_name,
      to_id: toRider.id,
      emoji: pingType.emoji,
      type: pingType.label,
    });
    await sendPushToUser({
      userId: toRider.id,
      title: `${pingType.emoji} ${profile.full_name}`,
      message: pingType.label,
      tag: "ping",
    });
  }; // { id, full_name, bike_type, avatar_url }
  const { loc, speed, status: gpsStatus, error: gpsError, start, stop, trail } = useGPS(profile?.id, stealth);

  // جلب الإشعارات عند التحميل
  useEffect(() => {
    const fetchNotifs = async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (data) {
        setNotifications(data);
        setUnreadNotif(data.filter(n => !n.is_read).length);
      }
    };
    fetchNotifs();
  }, [profile.id]);


  // Realtime إشعارات
  useEffect(() => {
    const ch = supabase.channel("notifications-rt")
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${profile.id}` },
        (payload) => {
          const n = payload.new;
          setNotifications(prev => [n, ...prev]);
          setUnreadNotif(prev => prev + 1);
          // تنبيه صوتي
          const msg = new SpeechSynthesisUtterance(n.title);
          msg.lang = "ar-SA";
          window.speechSynthesis?.speak(msg);
        }
      ).subscribe();
    return () => supabase.removeChannel(ch);
  }, [profile.id]);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from("approved_riders_with_location")
        .select("*")
        .neq("id", profile.id);

      console.log("Riders data:", data, "Error:", error);

      if (data && data.length > 0) {
        setRiders(data.map(r => ({
          ...r,
          current_speed: r.current_speed || 0,
          status: r.lat ? "online" : "offline",
        })));
      }
    };
    load();
  }, [profile.id]);



  useEffect(() => {
    const ch = supabase.channel("rt-locations")
      .on("postgres_changes", { event: "*", schema: "public", table: "locations" }, async ({ eventType, new: n, old: o }) => {
        if (eventType === "DELETE") {
          setRiders(prev => prev.map(r =>
            r.id === (o?.profile_id) ? { ...r, lat: null, lng: null, status: "offline", trail: [] } : r
          ));
          return;
        }
        if (!n?.profile_id || n.profile_id === profile.id) return;

        setRiders(prev => {
          const exists = prev.find(r => r.id === n.profile_id);
          if (exists) {
            // حدّث + أضف نقطة للمسار
            return prev.map(r => {
              if (r.id !== n.profile_id) return r;
              const prevTrail = r.trail || [];
              const lastPt = prevTrail[prevTrail.length - 1];
              const shouldAdd = !lastPt || getDistance(lastPt[0], lastPt[1], n.lat, n.lng) > 10;
              const newTrail = shouldAdd
                ? [...prevTrail, [n.lat, n.lng]].slice(-2000)
                : prevTrail;
              return { ...r, lat: n.lat, lng: n.lng, current_speed: n.speed, status: "online", trail: newTrail };
            });
          } else {
            // دراج جديد
            supabase.from("profiles").select("*").eq("id", n.profile_id).single()
              .then(({ data: p }) => {
                if (p) setRiders(prev2 => [...prev2, {
                  ...p, lat: n.lat, lng: n.lng, current_speed: n.speed,
                  status: "online", trail: [[n.lat, n.lng]]
                }]);
              });
            return prev;
          }
        });
      })
      .subscribe(s => setConnected(s === "SUBSCRIBED"));
    return () => supabase.removeChannel(ch);
  }, [profile.id]);

  // بعد channel locations أضف هذا
  useEffect(() => {
    const ch = supabase.channel("chat-notify")
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          // إذا مش في تاب الدردشة — زد العداد
          if (activeTab !== "chat" && payload.new.sender_id !== profile.id) {
            setUnread(prev => prev + 1);
          }
        }
      ).subscribe();
    return () => supabase.removeChannel(ch);
  }, [activeTab, profile.id]);

  // عند فتح الدردشة — صفّر العداد
  useEffect(() => {
    if (activeTab === "chat") setUnread(0);
  }, [activeTab]);

  const toggleGPS = () => {
    if (tracking) { stop(); setTracking(false); }
    else { start(); setTracking(true); }
  };

  const tabs = [
    { id: "map", icon: Map, label: "الخريطة" },
    { id: "riders", icon: Users, label: "سائقون" },
    { id: "chat", icon: MessageCircle, label: "دردشة" },
    { id: "groups", icon: Shield, label: "مجموعات" },
    { id: "photos", icon: Camera, label: "لقطات" },
    { id: "leaderboard", icon: Trophy, label: "تصنيف" },
    { id: "profile", icon: User, label: "بروفايل" },
  ];

  return (
    <div className="h-screen bg-gray-950 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-gray-950/98 border-b border-gray-800/50 px-4 py-3 flex items-center justify-between shrink-0" style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}>
        <div className="flex items-center gap-1 bg-green-500/15 border border-green-500/20 rounded-full px-2 py-0.5">
            <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.5, repeat: Infinity }}>
              <div className="w-1.5 h-1.5 bg-green-400 rounded-full" />
            </motion.div>
            <span className="text-green-400 text-xs font-bold">{riders.filter(r => r.status === "online").length}</span>
          </div>
        <span className="text-orange-500 font-black text-lg tracking-widest">MOTO<span className="text-white">RIDERS</span></span>
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => setShowNotifications(!showNotifications)}
          className="relative">
          <Bell size={20} className="text-gray-400" />
          {unreadNotif > 0 && (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
              className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-orange-500 rounded-full flex items-center justify-center">
              <span className="text-white text-[9px] font-black">{unreadNotif > 9 ? "9+" : unreadNotif}</span>
            </motion.div>
          )}
        </motion.button>
      </div>

      {/* GPS Error */}
      <AnimatePresence>
        {gpsError && (
          <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
            className="bg-red-900/50 border-b border-red-800 px-4 py-2 text-center shrink-0 overflow-hidden">
            <p className="text-red-300 text-xs">{gpsError}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Notifications Panel */}
      {/* Notifications Panel */}
      {/* Notifications Panel — يدفع المحتوى للأسفل */}
      <AnimatePresence>
        {showNotifications && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
            className="overflow-hidden shrink-0 bg-gray-900 border-b border-gray-700 w-full"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <button onClick={async () => {
                  await supabase.from("notifications").update({ is_read: true }).eq("user_id", profile.id);
                  setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
                  setUnreadNotif(0);
                }} className="text-orange-400 text-xs font-bold">قراءة الكل</button>
                <button onClick={() => setShowNotifications(false)}
                  className="w-6 h-6 bg-gray-800 rounded-full flex items-center justify-center text-gray-400 text-xs">✕</button>
              </div>
              <p className="text-white font-bold text-sm">🔔 الإشعارات</p>
            </div>

            <div className="max-h-56 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="text-center py-6 text-gray-600">
                  <Bell size={24} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">لا توجد إشعارات</p>
                </div>
              ) : notifications.map(n => (
                <motion.div key={n.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`px-4 py-3 border-b border-gray-800/50 ${!n.is_read ? "bg-orange-500/5" : ""}`}>
                  <div className="flex items-start gap-2 flex-row-reverse">
                    {!n.is_read && (
                      <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.5, repeat: Infinity }}
                        className="w-2 h-2 bg-orange-500 rounded-full mt-1.5 shrink-0" />
                    )}
                    <div className="flex-1 text-right">
                      <p className="text-white text-sm font-bold">{n.title}</p>
                      <p className="text-gray-400 text-xs mt-0.5 leading-relaxed">{n.body}</p>
                      <p className="text-gray-600 text-[10px] mt-1">
                        {new Date(n.created_at).toLocaleDateString("ar")}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      <div className="flex-1 overflow-hidden relative min-h-0">
        <AnimatePresence mode="wait">
          {activeTab === "map" && <MapTab key="map" riders={riders} profile={profile} loc={loc} speed={speed} gpsStatus={gpsStatus} tracking={tracking} stealth={stealth} setStealth={setStealth} toggleGPS={toggleGPS} activeRides={activeRides} trail={trail} onRiderDM={(u) => { setOpenDMWith(u); setActiveTab("chat"); }} onRiderProfile={(id) => setMapSelectedRider(id)} />}
          {activeTab === "riders" && <RidersTab key="riders" riders={riders} onDM={(u) => { setOpenDMWith(u); setActiveTab("chat"); }} onPing={sendPing} />}
          {activeTab === "chat" && <ChatTab key="chat" profile={profile} openDMWith={openDMWith} onDMOpened={() => setOpenDMWith(null)} />}
          {activeTab === "leaderboard" && <LeaderboardTab key="leaderboard" profile={profile} onDM={(u) => { setOpenDMWith(u); setActiveTab("chat"); }} onPing={sendPing} />}
          {activeTab === "groups" && <GroupsTab key="groups" profile={profile} />}
          {activeTab === "photos" && <PhotosTab key="photos" profile={profile} onDM={(u) => { setOpenDMWith(u); setActiveTab("chat"); }} onPing={sendPing} />}
          {activeTab === "profile" && <ProfileTab key="profile" profile={profile} speed={speed} gpsStatus={gpsStatus} tracking={tracking} toggleGPS={toggleGPS} onSignOut={onSignOut} />}
        </AnimatePresence>
      </div>

      {/* Bottom Nav */}
      <div className="bg-gray-950/98 border-t border-gray-800/50 shrink-0" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <div className="flex items-center justify-around px-1 pt-1.5 pb-2 max-w-lg mx-auto">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <motion.button key={tab.id} whileTap={{ scale: 0.82 }} onClick={() => setActiveTab(tab.id)}
                className="flex flex-col items-center gap-0.5 py-1 px-2 relative min-w-[44px]">
                {active && <motion.div layoutId="nav-bg" className="absolute inset-0 bg-orange-500/15 rounded-2xl" transition={{ type: "spring", bounce: 0.35 }} />}
                <div className="relative">
                  <Icon size={22} className={`relative z-10 transition-colors ${active ? "text-orange-500" : "text-gray-600"}`} />
                  {tab.id === "chat" && unread > 0 && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                      className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center z-20">
                      <span className="text-white text-[9px] font-black">{unread > 9 ? "9+" : unread}</span>
                    </motion.div>
                  )}
                </div>
                <span className={`text-[10px] relative z-10 font-medium ${active ? "text-orange-500" : "text-gray-600"}`}>{tab.label}</span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Global RiderProfile modal — في آخر الـ DOM */}
      <AnimatePresence>
        {mapSelectedRider && (
          <RiderProfile
            riderId={mapSelectedRider}
            onClose={() => setMapSelectedRider(null)}
            onDM={(u) => { setMapSelectedRider(null); setOpenDMWith(u); setActiveTab("chat"); }}
            onPing={(rider, pingType) => { sendPing(rider, pingType); setMapSelectedRider(null); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Map Tab ─── */
function MapCentre({ loc }) {
  const map = useMap();
  useEffect(() => { if (loc) map.setView([loc.lat, loc.lng], map.getZoom()); }, [loc, map]);
  return null;
}

function RecenterMap({ loc, trigger }) {
  const map = useMap();
  useEffect(() => {
    if (loc && trigger) {
      map.flyTo([loc.lat, loc.lng], 16, { duration: 1.2, easeLinearity: 0.25 });
    }
  }, [trigger]);
  return null;
}

function ZoomListener({ onZoom }) {
  const map = useMap();
  useEffect(() => {
    onZoom(map.getZoom());
    const handler = () => onZoom(map.getZoom());
    map.on("zoomend", handler);
    return () => map.off("zoomend", handler);
  }, [map]);
  return null;
}

function FlyToLocation({ target }) {
  const map = useMap();
  useEffect(() => {
    if (target) {
      map.flyTo([target.lat, target.lng], 16, { duration: 1.5, easeLinearity: 0.2 });
    }
  }, [target]);
  return null;
}

function MapTab({ riders, profile, loc, speed, gpsStatus, tracking, stealth, setStealth, toggleGPS, activeRides = [], trail = [], onRiderDM, onRiderProfile }) {
  // آخر موقع محفوظ
  const getLastLoc = () => {
    try {
      const saved = localStorage.getItem("moto_last_loc");
      if (saved) return JSON.parse(saved);
    } catch {}
    return null;
  };
  const lastLoc = getLastLoc();
  const center = loc ? [loc.lat, loc.lng] : lastLoc ? [lastLoc.lat, lastLoc.lng] : [24.688, 46.722];
  const [sos, setSos] = useState(false);
  const [selected, setSelected] = useState(null);
  const [activePings, setActivePings] = useState({});
  const [myPingMenu, setMyPingMenu] = useState(null);
  const [mapStyle, setMapStyle] = useState("dark");
  const [showStylePicker, setShowStylePicker] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [destination, setDestination] = useState(null); // { lat, lng, name }
  const [flyTarget, setFlyTarget] = useState(null);
  const searchRef = useRef(null);
  const mapRef = useRef(null);
  const { alerts, addAlert, removeAlert, showAddAlert, setShowAddAlert } = useSafetyAlerts(loc, profile);

  // البحث عن مكان باستخدام Nominatim
  const searchPlace = async (q) => {
    if (!q.trim()) { setSearchResults([]); return; }
    setSearchLoading(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5&addressdetails=1`,
        { headers: { "Accept-Language": "ar,en" } }
      );
      const data = await res.json();
      setSearchResults(data.map(r => ({
        id: r.place_id,
        name: r.display_name.split(",").slice(0, 2).join("،"),
        fullName: r.display_name,
        lat: parseFloat(r.lat),
        lng: parseFloat(r.lon),
        type: r.type,
      })));
    } catch { setSearchResults([]); }
    setSearchLoading(false);
  };

  // debounce البحث
  useEffect(() => {
    const t = setTimeout(() => searchPlace(searchQuery), 500);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const MAP_STYLES = {
    dark:      { label: "ليلي",        icon: "🌑", url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", subdomains: "abcd", bg: "#0a0a0a" },
    light:     { label: "نهاري",       icon: "☀️", url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", subdomains: "abcd", bg: "#e8e8e8" },
    satellite: { label: "قمر صناعي",  icon: "🛰️", url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", subdomains: "", bg: "#111" },
  };
  const currentStyle = MAP_STYLES[mapStyle];
  const [recenterTrigger, setRecenterTrigger] = useState(0);
  const [cameras, setCameras] = useState([]);
  const [mapZoom, setMapZoom] = useState(15);
  const cameraWarnedRef = useRef(new Set());

  // جلب الرادارات عبر Vercel API proxy
  useEffect(() => {
    const fetchCameras = async () => {
      try {
        const cached = localStorage.getItem("moto_cameras_de");
        if (cached) {
          const { data, ts } = JSON.parse(cached);
          if (Date.now() - ts < 7 * 24 * 60 * 60 * 1000) { setCameras(data); return; }
        }
      } catch {}
      // انتظر الموقع أو استخدم موقع مخزّن
      const savedLoc = (() => { try { return JSON.parse(localStorage.getItem("moto_last_loc")); } catch { return null; } })();
      const userLat = loc?.lat || savedLoc?.lat || 51.0;
      const userLng = loc?.lng || savedLoc?.lng || 10.0;
      try {
        const res = await fetch(`/api/cameras?lat=${userLat}&lng=${userLng}&size=1.5`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const data = json.cameras || [];
        console.log(`✅ Cameras loaded: ${data.length}`);
        setCameras(data);
        localStorage.setItem("moto_cameras_de", JSON.stringify({ data, ts: Date.now() }));
      } catch (e) {
        console.error("❌ Cameras error:", e.message);
      }
    };
    fetchCameras();
  }, []);

  // تنبيه صوتي عند الاقتراب من رادار < 300م
  useEffect(() => {
    if (!loc || !cameras.length) return;
    cameras.forEach(cam => {
      const dist = getDistance(loc.lat, loc.lng, cam.lat, cam.lng);
      if (dist < 300 && !cameraWarnedRef.current.has(cam.id)) {
        cameraWarnedRef.current.add(cam.id);
        const msg = new SpeechSynthesisUtterance(
          `تحذير رادار بعد ${Math.round(dist)} متر${cam.maxspeed ? `، الحد ${cam.maxspeed}` : ""}`
        );
        msg.lang = "ar-SA"; msg.rate = 0.9;
        window.speechSynthesis?.speak(msg);
      }
      if (dist > 600) cameraWarnedRef.current.delete(cam.id);
    });
  }, [loc, cameras]);

  const PING_TYPES = [
    { id: "horn",  emoji: "📯", label: "زمور" },
    { id: "wave",  emoji: "👋", label: "تحية" },
    { id: "call",  emoji: "🤙", label: "كيفك" },
    { id: "go",    emoji: "⚡", label: "يلا" },
  ];

  // استقبال الـ pings
  useEffect(() => {
    const ch = supabase.channel("pings-rt")
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "quick_pings" },
        (payload) => {
          const ping = payload.new;
          // أظهر الأنيميشن فوق الدراج المُرسَل إليه
          const showOnId = ping.to_id === profile.id ? "me" : ping.to_id;
          // وأيضاً فوق المُرسِل (عند المستقبل يشوفه على الخريطة)
          const targetId = ping.from_id === profile.id ? ping.to_id : ping.from_id;
          const displayId = ping.to_id;

          setActivePings(prev => ({
            ...prev,
            [ping.to_id]: { emoji: ping.emoji, ts: Date.now() },
            [ping.from_id]: { emoji: ping.emoji, ts: Date.now() },
          }));
          setTimeout(() => {
            setActivePings(prev => {
              const next = { ...prev };
              delete next[ping.to_id];
              delete next[ping.from_id];
              return next;
            });
          }, 3000);
        }
      ).subscribe();
    return () => supabase.removeChannel(ch);
  }, [profile.id]);

  const sendPing = async (toRider, pingType) => {
    setMyPingMenu(null);
    // أظهر الأنيميشن محلياً فوراً على الدراج المُرسَل إليه
    setActivePings(prev => ({
      ...prev,
      [toRider.id]: { emoji: pingType.emoji, ts: Date.now() }
    }));
    setTimeout(() => {
      setActivePings(prev => {
        const next = { ...prev };
        delete next[toRider.id];
        return next;
      });
    }, 3000);

    await supabase.from("quick_pings").insert({
      from_id: profile.id,
      from_name: profile.full_name,
      to_id: toRider.id,
      emoji: pingType.emoji,
      type: pingType.id,
    });
    await sendPushToUser({
      userId: toRider.id,
      title: `${pingType.emoji} ${profile.full_name}`,
      message: pingType.label,
      tag: "ping",
    });
  };
  const [alertType, setAlertType] = useState("pothole");
  const [alertDesc, setAlertDesc] = useState("");
  const [addingAlert, setAddingAlert] = useState(false);

  const handleAddAlert = async () => {
    if (!loc) return;
    setAddingAlert(true);
    await addAlert(alertType, alertDesc, loc.lat, loc.lng, profile.full_name);
    setAlertDesc("");
    setShowAddAlert(false);
    setAddingAlert(false);
  };

  // أيقونة التحذير على الخريطة
  const createAlertIcon = (type) => {
    const t = ALERT_TYPES.find(a => a.id === type);
    return L.divIcon({
      html: `<div style="
        background:rgba(239,68,68,0.9);
        border:2px solid #fca5a5;
        border-radius:50%;
        width:36px;height:36px;
        display:flex;align-items:center;justify-content:center;
        font-size:18px;
        box-shadow:0 0 12px rgba(239,68,68,0.6);
      ">${t?.icon || "⚠️"}</div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
      className: "",
    });
  };

  const createCameraIcon = (maxspeed) => L.divIcon({
    html: `<div style="
      background:rgba(220,38,38,0.9);
      border:1.5px solid #fbbf24;
      border-radius:6px;
      width:24px;height:24px;
      display:flex;align-items:center;justify-content:center;
      font-size:13px;
      box-shadow:0 0 6px rgba(220,38,38,0.5);
    ">📷${maxspeed ? `<span style="position:absolute;bottom:-14px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.8);color:#fbbf24;font-size:8px;font-weight:700;padding:1px 3px;border-radius:3px;white-space:nowrap">${maxspeed}</span>` : ""}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    className: "",
  });

  // أيقونة مكان انطلاق الرحلة
  const createRideStartIcon = (rideName) => L.divIcon({
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;gap:3px;">
        <div style="
          background:linear-gradient(135deg,#f97316,#ea580c);
          border:3px solid #fb923c;
          border-radius:50% 50% 50% 0;
          width:44px;height:44px;
          transform:rotate(-45deg);
          box-shadow:0 0 20px #f9731666;
          display:flex;align-items:center;justify-content:center;
        ">
          <span style="transform:rotate(45deg);font-size:20px;">🏍️</span>
        </div>
        <div style="
          background:rgba(5,5,5,0.93);
          border:1px solid #f9731677;
          border-radius:8px;
          padding:2px 8px;
          white-space:nowrap;
          max-width:100px;
          overflow:hidden;
          text-overflow:ellipsis;
        ">
          <div style="color:#f97316;font-size:10px;font-weight:700;">🚩 ${rideName}</div>
        </div>
      </div>`,
    iconSize: [44, 80],
    iconAnchor: [22, 80],
    className: "",
  });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0">

      {/* ══ Search Bar ══ */}
      <div className="absolute top-14 left-3 right-16 z-[1000]">
        <AnimatePresence>
          {showSearch ? (
            <motion.div initial={{ opacity: 0, y: -8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              className="bg-black/70 backdrop-blur-xl border border-white/15 rounded-2xl overflow-hidden shadow-2xl">
              {/* Input */}
              <div className="flex items-center gap-2 px-3 py-2.5">
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => { setShowSearch(false); setSearchQuery(""); setSearchResults([]); }}>
                  <X size={16} className="text-gray-400" />
                </motion.button>
                <input
                  ref={searchRef}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="ابحث عن موقع..." dir="rtl"
                  className="flex-1 bg-transparent text-white placeholder-gray-500 text-sm focus:outline-none text-right" />
                {searchLoading
                  ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}><Loader size={14} className="text-orange-400" /></motion.div>
                  : <Search size={14} className="text-gray-500" />}
              </div>

              {/* النتائج */}
              {searchResults.length > 0 && (
                <div className="border-t border-white/8 max-h-56 overflow-y-auto">
                  {searchResults.map((r, i) => (
                    <motion.button key={r.id} whileTap={{ backgroundColor: "rgba(249,115,22,0.15)" }}
                      onClick={() => {
                        setDestination(r);
                        setFlyTarget({ lat: r.lat, lng: r.lng });
                        setShowSearch(false);
                        setSearchQuery("");
                        setSearchResults([]);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-right transition-all ${i < searchResults.length - 1 ? "border-b border-white/6" : ""}`}>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-semibold truncate">{r.name}</p>
                        <p className="text-gray-500 text-xs truncate">{r.fullName.split(",").slice(2, 4).join("،")}</p>
                      </div>
                      <div className="text-base shrink-0">
                        {r.type === "restaurant" ? "🍽️" : r.type === "fuel" ? "⛽" : r.type === "hospital" ? "🏥" : "📍"}
                      </div>
                    </motion.button>
                  ))}
                </div>
              )}

              {searchQuery && !searchLoading && searchResults.length === 0 && (
                <div className="px-4 py-3 text-gray-500 text-xs text-center border-t border-white/8">
                  لا توجد نتائج لـ "{searchQuery}"
                </div>
              )}
            </motion.div>
          ) : (
            <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => { setShowSearch(true); setTimeout(() => searchRef.current?.focus(), 100); }}
              className="flex items-center gap-2 bg-black/50 backdrop-blur-xl border border-white/15 rounded-2xl px-4 py-2.5 shadow-lg w-full">
              <span className="text-gray-400 text-sm flex-1 text-right">ابحث عن موقع...</span>
              <Search size={15} className="text-gray-500 shrink-0" />
            </motion.button>
          )}
        </AnimatePresence>

        {/* وجهة محددة — بطاقة أسفل البحث */}
        {destination && !showSearch && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className="mt-2 bg-black/60 backdrop-blur-xl border border-blue-500/30 rounded-2xl px-4 py-2.5 flex items-center gap-3">
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => setDestination(null)}
              className="w-6 h-6 bg-white/10 rounded-full flex items-center justify-center shrink-0">
              <X size={12} className="text-gray-300" />
            </motion.button>
            <div className="flex-1 text-right min-w-0">
              <p className="text-blue-300 text-xs font-semibold truncate">📍 {destination.name}</p>
              {loc && (
                <p className="text-gray-500 text-[10px]">
                  {(getDistance(loc.lat, loc.lng, destination.lat, destination.lng) / 1000).toFixed(1)} كم
                </p>
              )}
            </div>
            <motion.button whileTap={{ scale: 0.9 }}
              onClick={() => setFlyTarget({ lat: destination.lat, lng: destination.lng })}
              className="bg-blue-500/80 text-white text-[11px] font-bold px-3 py-1.5 rounded-xl shrink-0">
              اذهب
            </motion.button>
          </motion.div>
        )}
      </div>

      {/* السرعة — مربع صغير شفاف يمين */}
      <div className="absolute top-14 right-3 z-[1000]">
        <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-xl px-3 py-1.5 text-right">
          <div className="flex items-baseline gap-1 justify-end">
            <span className="text-white font-black text-xl leading-none">{speed}</span>
            <span className="text-gray-500 text-[9px]">كم/س</span>
          </div>
          {gpsStatus === "active" && (
            <div className="flex items-center justify-end gap-1 mt-0.5">
              <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity }}>
                <div className="w-1 h-1 bg-orange-400 rounded-full" />
              </motion.div>
              <span className="text-orange-400 text-[8px]">نشط</span>
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════
          RIGHT CONTROLS — صغيرة وشفافة
      ══════════════════════════════════════ */}
      <div className="absolute right-3 z-[1000] flex flex-col gap-2"
        style={{ top: "50%", transform: "translateY(-50%)" }}>

        {/* موقعي */}
        <motion.button whileTap={{ scale: 0.88 }}
          onClick={() => loc && setRecenterTrigger(t => t + 1)}
          className="w-9 h-9 rounded-full flex items-center justify-center bg-black/40 backdrop-blur-xl border border-white/15 shadow-lg active:bg-orange-500/50 transition-all">
          <Navigation size={15} className={tracking ? "text-orange-400" : "text-white/70"} />
        </motion.button>

        {/* GPS toggle */}
        <motion.button whileTap={{ scale: 0.9 }} onClick={toggleGPS}
          className={`w-9 h-9 rounded-full flex items-center justify-center backdrop-blur-xl border shadow-lg transition-all ${
            tracking ? "bg-orange-500/80 border-orange-400/60 shadow-orange-500/30" : "bg-black/40 border-white/15"
          }`}>
          {gpsStatus === "searching"
            ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}><Loader size={13} className="text-orange-400" /></motion.div>
            : <Navigation size={13} className={tracking ? "text-white" : "text-white/60"} style={{ fill: tracking ? "rgba(255,255,255,0.3)" : "none" }} />}
        </motion.button>

        {/* Map Style */}
        <div className="relative">
          <motion.button whileTap={{ scale: 0.9 }}
            onClick={() => setShowStylePicker(!showStylePicker)}
            className="w-9 h-9 rounded-full flex items-center justify-center bg-black/40 backdrop-blur-xl border border-white/15 shadow-lg text-base">
            {currentStyle.icon}
          </motion.button>
          <AnimatePresence>
            {showStylePicker && (
              <>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="fixed inset-0 z-10" onClick={() => setShowStylePicker(false)} />
                <motion.div initial={{ opacity: 0, scale: 0.85, x: 8 }} animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.85, x: 8 }}
                  className="absolute right-11 top-0 z-20 flex flex-col gap-1.5 bg-black/60 backdrop-blur-xl border border-white/15 rounded-2xl p-2 shadow-2xl">
                  {Object.entries(MAP_STYLES).map(([key, style]) => (
                    <motion.button key={key} whileTap={{ scale: 0.93 }}
                      onClick={() => { setMapStyle(key); setShowStylePicker(false); }}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                        mapStyle === key ? "bg-orange-500/80 text-white" : "text-gray-300 hover:bg-white/10"
                      }`}>
                      <span>{style.icon}</span><span>{style.label}</span>
                    </motion.button>
                  ))}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* تحذير */}
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => setShowAddAlert(!showAddAlert)}
          className={`w-9 h-9 rounded-full flex items-center justify-center backdrop-blur-xl border shadow-lg transition-all text-base ${
            showAddAlert ? "bg-red-500/70 border-red-400/50" : "bg-black/40 border-white/15"
          }`}>
          {showAddAlert ? <X size={14} className="text-white" /> : <span>⚠️</span>}
        </motion.button>

        {/* عداد التحذيرات */}
        {alerts.length > 0 && (
          <div className="w-9 h-9 bg-red-500/30 backdrop-blur-xl border border-red-400/30 rounded-full flex flex-col items-center justify-center">
            <span className="text-red-300 font-black text-xs leading-none">{alerts.length}</span>
          </div>
        )}

        {/* عداد الرادارات */}
        {cameras.length > 0 && (
          <div className="w-9 h-9 bg-yellow-500/20 backdrop-blur-xl border border-yellow-400/20 rounded-full flex flex-col items-center justify-center">
            <span className="text-[8px]">📷</span>
            <span className="text-yellow-300 font-black text-[9px] leading-none">
              {cameras.length > 999 ? `${Math.round(cameras.length/1000)}k` : cameras.length}
            </span>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════
          ALERT FORM
      ══════════════════════════════════════ */}
      <AnimatePresence>
        {showAddAlert && (
          <motion.div initial={{ opacity: 0, y: 20, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            className="absolute bottom-24 left-4 right-4 z-[1000]">
            <div className="bg-black/70 backdrop-blur-2xl border border-white/12 rounded-3xl p-4 shadow-2xl">
              <p className="text-white font-bold text-sm text-right mb-3">⚠️ أضف تحذيراً في موقعك</p>
              <div className="grid grid-cols-4 gap-2 mb-3">
                {ALERT_TYPES.map(t => (
                  <motion.button key={t.id} whileTap={{ scale: 0.9 }} onClick={() => setAlertType(t.id)}
                    className={`flex flex-col items-center gap-1 p-2 rounded-2xl border text-xs transition-all ${
                      alertType === t.id ? "bg-red-500/40 border-red-400/50 text-red-200" : "bg-white/5 border-white/10 text-gray-400"
                    }`}>
                    <span className="text-lg">{t.icon}</span>
                    <span className="text-[9px] text-center leading-tight">{t.label}</span>
                  </motion.button>
                ))}
              </div>
              <input value={alertDesc} onChange={e => setAlertDesc(e.target.value)}
                placeholder="وصف إضافي..." dir="rtl"
                className="w-full bg-white/5 border border-white/10 text-white placeholder-gray-500 rounded-2xl px-3 py-2 text-sm mb-3 focus:border-red-400/50 focus:outline-none" />
              <div className="flex gap-2">
                <motion.button whileTap={{ scale: 0.95 }} onClick={() => setShowAddAlert(false)}
                  className="flex-1 bg-white/8 text-gray-300 font-bold py-2.5 rounded-2xl text-sm border border-white/10">
                  إلغاء
                </motion.button>
                <motion.button whileTap={{ scale: 0.95 }} onClick={handleAddAlert} disabled={!loc || addingAlert}
                  className="flex-1 bg-red-500/80 text-white font-bold py-2.5 rounded-2xl text-sm disabled:opacity-40 flex items-center justify-center gap-1">
                  {addingAlert ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}><Loader size={14} /></motion.div> : "📍 نشر"}
                </motion.button>
              </div>
              {!loc && <p className="text-red-400 text-xs text-center mt-2">فعّل GPS أولاً</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════
          SOS — زاوية أسفل يسار، صغير وأنيق
      ══════════════════════════════════════ */}
      <div className="absolute z-[1000]" style={{ bottom: "80px", left: "16px" }}>
        <motion.button whileTap={{ scale: 0.88 }}
          onClick={() => { setSos(true); setTimeout(() => setSos(false), 5000); }}
          animate={sos ? { scale: [1, 1.1, 1] } : {}}
          transition={{ duration: 0.6, repeat: sos ? Infinity : 0 }}
          className={`w-12 h-12 rounded-full font-black text-white text-xs flex flex-col items-center justify-center gap-0 transition-all ${
            sos ? "bg-red-600" : "bg-red-500/80 backdrop-blur-xl border border-red-400/40"
          }`}
          style={{ boxShadow: sos ? "0 0 24px #ef4444aa" : "0 0 12px rgba(239,68,68,0.3)" }}>
          <span className="text-[10px] font-black tracking-wider">{sos ? "📡" : "SOS"}</span>
        </motion.button>
        {sos && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
            className="absolute -top-7 left-1/2 -translate-x-1/2 bg-red-500/80 backdrop-blur rounded-full px-2 py-0.5 whitespace-nowrap">
            <span className="text-white text-[9px] font-bold">جاري الإرسال...</span>
          </motion.div>
        )}
      </div>

      <MapContainer center={center} zoom={15} className="h-full w-full" style={{ background: currentStyle.bg }} zoomControl={false}>
        <TileLayer
          key={mapStyle}
          url={currentStyle.url}
          attribution=""
          subdomains={currentStyle.subdomains || "abc"}
          maxZoom={19}
        />

        {/* مساري الشخصي — خط برتقالي */}
        {trail.length > 1 && !stealth && (
          <Polyline
            positions={trail}
            pathOptions={{
              color: "#f97316",
              weight: 4,
              opacity: 0.85,
              lineCap: "round",
              lineJoin: "round",
            }} />
        )}

        {/* مسارات الدراجين الآخرين — ألوان مختلفة */}
        {riders.filter(r => r.trail && r.trail.length > 1).map((r, i) => {
          const colors = ["#3b82f6", "#22c55e", "#a855f7", "#ec4899", "#14b8a6"];
          return (
            <Polyline
              key={`trail-${r.id}`}
              positions={r.trail}
              pathOptions={{
                color: colors[i % colors.length],
                weight: 3,
                opacity: 0.6,
                lineCap: "round",
                lineJoin: "round",
                dashArray: "6, 4",
              }} />
          );
        })}

        {/* موقعي */}
        {loc && !stealth && (
          <Marker
            key={`me-${activePings["me"]?.ts || 0}`}
            position={[loc.lat, loc.lng]}
            icon={createRiderIcon(profile?.full_name || "أنت", speed, true, profile?.avatar_url, activePings["me"]?.emoji)} />
        )}

        {/* بقية الدراجين */}
        {riders.filter(r => r.lat && r.lng).map(r => (
          <Marker
            key={`${r.id}-${activePings[r.id]?.ts || 0}`}
            position={[r.lat, r.lng]}
            icon={createRiderIcon(r.full_name, r.current_speed || 0, r.status === "online", r.avatar_url, activePings[r.id]?.emoji)}
            eventHandlers={{ click: () => onRiderProfile?.(r.id) }} />
        ))}

        {/* التحذيرات */}
        {alerts.filter(a => a.active).map(a => (
          <Marker key={a.id} position={[a.lat, a.lng]} icon={createAlertIcon(a.type)}
            eventHandlers={{
              click: () => {
                const t = ALERT_TYPES.find(x => x.id === a.type);
                if (window.confirm(`${t?.icon} ${t?.label}\nبواسطة: ${a.reporter_name}\n${a.description || ""}\n\nهل تريد حذف هذا التحذير؟`)) {
                  removeAlert(a.id);
                }
              }
            }} />
        ))}

        {/* مواقع انطلاق الرحلات */}
        {activeRides.filter(r => r.start_lat && r.start_lng).map(ride => (
          <Marker key={`ride-${ride.id}`}
            position={[ride.start_lat, ride.start_lng]}
            icon={createRideStartIcon(ride.name)}
            eventHandlers={{ click: () => alert(`🏍️ ${ride.name}\n📍 ${ride.start_location_name || ""}\n🗓️ ${ride.start_date || ""} ⏰ ${ride.start_time?.slice(0,5) || ""}\n👥 ${ride.member_count} عضو`) }}
          />
        ))}

        {loc && <MapCentre loc={loc} />}
        <RecenterMap loc={loc} trigger={recenterTrigger} />
        <ZoomListener onZoom={setMapZoom} />
        <FlyToLocation target={flyTarget} />

        {/* وجهة البحث */}
        {destination && (
          <Marker
            position={[destination.lat, destination.lng]}
            icon={L.divIcon({
              html: `<div style="
                display:flex;flex-direction:column;align-items:center;gap:3px;
              ">
                <div style="
                  background:rgba(59,130,246,0.95);
                  border:3px solid #fff;
                  border-radius:50%;
                  width:36px;height:36px;
                  display:flex;align-items:center;justify-content:center;
                  font-size:18px;
                  box-shadow:0 0 20px rgba(59,130,246,0.7);
                ">📍</div>
                <div style="
                  background:rgba(0,0,0,0.85);
                  border:1px solid rgba(59,130,246,0.6);
                  border-radius:8px;
                  padding:2px 8px;
                  color:#93c5fd;
                  font-size:10px;
                  font-weight:700;
                  white-space:nowrap;
                  max-width:140px;
                  overflow:hidden;
                  text-overflow:ellipsis;
                ">${destination.name}</div>
              </div>`,
              iconSize: [36, 70],
              iconAnchor: [18, 70],
              className: "",
            })}
          />
        )}

        {/* الرادارات — تظهر عند zoom ≥ 14 فقط وفي نطاق الشاشة */}
        {mapZoom >= 14 && cameras
          .filter(cam => {
            if (!loc) return false;
            const dist = getDistance(loc.lat, loc.lng, cam.lat, cam.lng);
            return dist < 30000; // فقط في نطاق 30 كم
          })
          .slice(0, 100) // حد أقصى 100 رادار على الشاشة
          .map(cam => (
            <Marker key={`cam-${cam.id}`}
              position={[cam.lat, cam.lng]}
              icon={createCameraIcon(cam.maxspeed)} />
          ))
        }
      </MapContainer>
    </motion.div>
  );
}

/* ─── Rider Profile Modal ─── */
function RiderProfile({ riderId, onClose, onDM, onPing }) {
  const [rider, setRider] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data: p } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", riderId)
        .single();
      if (p) setRider(p);

      const { data: ph } = await supabase
        .from("photos")
        .select("*")
        .eq("uploader_id", riderId)
        .order("created_at", { ascending: false })
        .limit(12);
      if (ph) setPhotos(ph);
      setLoading(false);
    };
    fetch();
  }, [riderId]);

  const lvl = rider ? getLevel(rider.xp || 0) : null;
  const prog = rider ? getLevelProgress(rider.xp || 0) : 0;
  const nextLvl = lvl ? LEVELS[LEVELS.indexOf(lvl) + 1] : null;

  const formatDist = (d) => {
    if (!d) return "0";
    return d >= 1000 ? `${(d / 1000).toFixed(1)}k` : d.toFixed(0);
  };

  const formatTime = (mins) => {
    if (!mins) return "0";
    if (mins < 60) return `${mins}د`;
    return `${Math.floor(mins / 60)}س`;
  };

  return createPortal(
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 flex flex-col"
      style={{ zIndex: 9999, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>

      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
        className="mt-auto bg-gray-950 rounded-t-3xl overflow-hidden"
        style={{ maxHeight: "90vh" }}>

        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-700 rounded-full" />
        </div>

        <div className="overflow-y-auto" style={{ maxHeight: "calc(90vh - 24px)" }}>
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                <Loader size={28} className="text-orange-500" />
              </motion.div>
            </div>
          ) : !rider ? (
            <div className="text-center py-16 text-gray-600">
              <p>لم يُعثر على الدراج</p>
            </div>
          ) : (
            <>
              {/* Cover / Avatar */}
              <div className="relative bg-gradient-to-b from-orange-900/30 to-gray-950 px-4 pt-4 pb-5 text-center">
                <motion.button whileTap={{ scale: 0.9 }} onClick={onClose}
                  className="absolute top-3 left-4 w-8 h-8 bg-gray-800/80 rounded-full flex items-center justify-center">
                  <X size={16} className="text-gray-400" />
                </motion.button>

                <div className="w-24 h-24 bg-gray-800 border-4 border-orange-500 rounded-3xl overflow-hidden shadow-xl shadow-orange-500/30 mx-auto mb-3">
                  {rider.avatar_url
                    ? <img src={rider.avatar_url} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-4xl">🏍️</div>}
                </div>

                <h2 className="text-white font-black text-xl">{rider.full_name}</h2>
                <p className="text-orange-400 text-sm mb-2">{rider.bike_type}</p>

                {/* Level badge */}
                {lvl && (
                  <div className="inline-flex items-center gap-1.5 bg-gray-900 border border-gray-700 rounded-full px-3 py-1">
                    <span className="text-base">{lvl.icon}</span>
                    <span className="text-white text-xs font-bold">{lvl.name}</span>
                    <span className="text-gray-500 text-xs">• {(rider.xp || 0).toLocaleString("ar")} XP</span>
                  </div>
                )}

                {/* XP Progress */}
                {lvl && (
                  <div className="mt-3 mx-4">
                    <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <motion.div className="h-full rounded-full"
                        style={{ background: lvl.color || "#f97316" }}
                        initial={{ width: 0 }} animate={{ width: `${prog}%` }}
                        transition={{ duration: 1, ease: "easeOut" }} />
                    </div>
                    {nextLvl && (
                      <p className="text-gray-600 text-[10px] text-left mt-0.5">{nextLvl.name} →</p>
                    )}
                  </div>
                )}

                {/* DM Button */}
                {onDM && rider && (
                  <div className="px-4 mt-3">
                    <motion.button whileTap={{ scale: 0.97 }}
                      onClick={() => { onDM(rider); onClose(); }}
                      className="w-full bg-orange-500 text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-orange-500/30">
                      <MessageCircle size={18} />
                      رسالة خاصة
                    </motion.button>
                  </div>
                )}

                {/* Quick Pings */}
                {onPing && rider && (
                  <div className="px-4 mt-3">
                    <p className="text-gray-500 text-xs text-right mb-2">إشارة سريعة</p>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { emoji: "📯", label: "زمور" },
                        { emoji: "👋", label: "تحية" },
                        { emoji: "🤙", label: "كيفك" },
                        { emoji: "⚡", label: "يلا" },
                      ].map(p => (
                        <motion.button key={p.emoji} whileTap={{ scale: 0.85 }}
                          onClick={() => { onPing(rider, p); onClose(); }}
                          className="bg-gray-900 border border-gray-700 rounded-2xl py-2.5 flex flex-col items-center gap-1 hover:border-orange-500/50 transition-all">
                          <span className="text-2xl">{p.emoji}</span>
                          <span className="text-gray-400 text-[10px]">{p.label}</span>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-4 gap-2 px-4 mb-4">
                {[
                  { icon: "⚡", label: "أعلى سرعة", value: `${rider.top_speed || 0}`, unit: "كم/س" },
                  { icon: "📍", label: "المسافة", value: formatDist(rider.total_distance), unit: "كم" },
                  { icon: "🏍️", label: "الرحلات", value: rider.total_rides || 0, unit: "" },
                  { icon: "⏱️", label: "وقت الركوب", value: formatTime(rider.total_riding_time), unit: "" },
                ].map((s, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className="bg-gray-900 border border-gray-800 rounded-2xl p-2.5 text-center">
                    <div className="text-lg mb-0.5">{s.icon}</div>
                    <p className="text-white font-black text-base leading-none">{s.value}<span className="text-[10px] text-gray-500 ml-0.5">{s.unit}</span></p>
                    <p className="text-gray-600 text-[9px] mt-0.5">{s.label}</p>
                  </motion.div>
                ))}
              </div>

              {/* Badges */}
              {(rider.badges || []).length > 0 && (
                <div className="px-4 mb-4">
                  <p className="text-gray-500 text-xs text-right mb-2">الشارات</p>
                  <div className="flex flex-wrap gap-2 justify-end">
                    {(rider.badges || []).map(b => {
                      const def = BADGES_DEF.find(x => x.id === b);
                      if (!def) return null;
                      return (
                        <div key={b} className="flex items-center gap-1 bg-gray-900 border border-gray-700 rounded-xl px-2.5 py-1.5">
                          <span className="text-sm">{def.icon}</span>
                          <span className="text-gray-300 text-xs">{def.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Photos grid */}
              {photos.length > 0 && (
                <div className="px-4 mb-4">
                  <p className="text-gray-500 text-xs text-right mb-2">لقطاته ({photos.length})</p>
                  <div className="grid grid-cols-3 gap-0.5 rounded-2xl overflow-hidden">
                    {photos.map(photo => (
                      <div key={photo.id} className="aspect-square overflow-hidden bg-gray-900">
                        <img src={photo.url} alt="" className="w-full h-full object-cover" loading="lazy" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="h-6" />
            </>
          )}
        </div>
      </motion.div>
    </motion.div>,
    document.body
  );
}

/* ─── Riders Tab ─── */
function RidersTab({ riders, onDM, onPing }) {
  const [selectedRider, setSelectedRider] = useState(null);

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
      className="absolute inset-0 overflow-y-auto p-4">

      <AnimatePresence>
        {selectedRider && <RiderProfile riderId={selectedRider} onClose={() => setSelectedRider(null)} onDM={onDM} onPing={onPing} />}
      </AnimatePresence>

      <h2 className="text-white font-black text-lg mb-1 text-right">السائقون <span className="text-orange-500">المتصلون</span></h2>
      <p className="text-gray-500 text-xs mb-4 text-right">{riders.filter(r => r.status === "online").length} من {riders.length} متصل</p>
      <div className="space-y-3">
        {riders.map((r, i) => (
          <motion.div key={r.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
            className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex items-center gap-3 cursor-pointer active:opacity-70"
            onClick={() => setSelectedRider(r.id)}>
            <div className="relative shrink-0">
              <div className="w-12 h-12 bg-gray-800 rounded-2xl flex items-center justify-center text-xl overflow-hidden">
                {r.avatar_url ? <img src={r.avatar_url} className="w-full h-full object-cover" /> : "🏍️"}
              </div>
              <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-gray-900 ${r.status === "online" ? "bg-green-500" : "bg-gray-600"}`} />
            </div>
            <div className="flex-1 text-right">
              <p className="text-white font-bold text-sm">{r.full_name}</p>
              <p className="text-gray-500 text-xs">{r.bike_type}</p>
            </div>
            {r.status === "online" && (
              <div className="text-right">
                <p className="text-orange-400 font-black text-xl">{r.current_speed || 0}</p>
                <p className="text-gray-600 text-xs">كم/س</p>
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

/* ─── Leaderboard Tab ─── */
function LeaderboardTab({ profile, onDM, onPing }) {
  const [riders, setRiders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("xp");
  const [myRank, setMyRank] = useState(null);
  const [selectedRider, setSelectedRider] = useState(null);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, bike_type, avatar_url, xp, top_speed, total_distance, total_rides, badges")
        .eq("status", "approved")
        .order("xp", { ascending: false })
        .limit(50);
      if (data) setRiders(data);
      setLoading(false);
    };
    fetch();
    // Realtime
    const ch = supabase.channel("lb-rt")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, fetch)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  const sorted = [...riders].sort((a, b) => {
    if (category === "xp")       return (b.xp || 0) - (a.xp || 0);
    if (category === "speed")    return (b.top_speed || 0) - (a.top_speed || 0);
    if (category === "distance") return (b.total_distance || 0) - (a.total_distance || 0);
    return 0;
  });

  useEffect(() => {
    const idx = sorted.findIndex(r => r.id === profile.id);
    setMyRank(idx >= 0 ? idx + 1 : null);
  }, [sorted, profile.id]);

  const categories = [
    { id: "xp",       label: "XP",      icon: "⭐", unit: "نقطة" },
    { id: "speed",    label: "سرعة",    icon: "⚡", unit: "كم/س" },
    { id: "distance", label: "مسافة",   icon: "📍", unit: "كم" },
  ];

  const getValue = (r) => {
    if (category === "xp")       return (r.xp || 0).toLocaleString("ar");
    if (category === "speed")    return r.top_speed || 0;
    if (category === "distance") return (r.total_distance || 0).toFixed(1);
  };

  const podiumColors = ["#f59e0b", "#9ca3af", "#cd7c2f"];
  const podiumSizes  = ["w-20 h-20", "w-16 h-16", "w-14 h-14"];
  const podiumY      = ["mt-0", "mt-6", "mt-10"];

  const top3 = sorted.slice(0, 3);
  const rest = sorted.slice(3);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="absolute inset-0 overflow-y-auto bg-gray-950">

      <AnimatePresence>
        {selectedRider && <RiderProfile riderId={selectedRider} onClose={() => setSelectedRider(null)} onDM={onDM} onPing={onPing} />}
      </AnimatePresence>

      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-b from-yellow-900/30 to-gray-950 pt-6 pb-4 px-4">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(245,158,11,0.15),_transparent_70%)] pointer-events-none" />
        <h2 className="text-white font-black text-xl text-center mb-1">
          <span className="text-yellow-400">🏆</span> لوحة المتصدرين
        </h2>
        {myRank && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center text-gray-400 text-xs">
            ترتيبك: <span className="text-yellow-400 font-black text-sm">#{myRank}</span>
          </motion.p>
        )}
      </div>

      {/* Category Selector */}
      <div className="flex gap-2 px-4 mb-4">
        {categories.map(c => (
          <motion.button key={c.id} whileTap={{ scale: 0.93 }} onClick={() => setCategory(c.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl text-sm font-bold border transition-all ${category === c.id
              ? "bg-yellow-500/20 border-yellow-500/50 text-yellow-300"
              : "bg-gray-900 border-gray-800 text-gray-500"}`}>
            <span>{c.icon}</span>{c.label}
          </motion.button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
            <Loader size={28} className="text-yellow-500" />
          </motion.div>
        </div>
      ) : (
        <div className="px-4 space-y-3">
          {/* Podium — Top 3 */}
          {top3.length >= 2 && (
            <div className="flex items-end justify-center gap-3 mb-6 pt-2">
              {[top3[1], top3[0], top3[2]].filter(Boolean).map((r, podiumPos) => {
                const realPos = podiumPos === 0 ? 1 : podiumPos === 1 ? 0 : 2;
                const rank = realPos + 1;
                const lvl = getLevel(r.xp || 0);
                const isMe = r.id === profile.id;
                return (
                  <motion.div key={r.id}
                    initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: podiumPos * 0.1 }}
                    className={`flex flex-col items-center ${podiumY[realPos]}`}>
                    {/* Crown for #1 */}
                    {rank === 1 && (
                      <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>
                        <Crown size={20} className="text-yellow-400 mb-1" />
                      </motion.div>
                    )}
                    {/* Avatar */}
                    <div className={`${podiumSizes[realPos]} rounded-3xl overflow-hidden border-4 mb-2 shadow-lg`}
                      style={{ borderColor: podiumColors[realPos], boxShadow: `0 0 20px ${podiumColors[realPos]}55` }}>
                      {r.avatar_url
                        ? <img src={r.avatar_url} className="w-full h-full object-cover" />
                        : <div className="w-full h-full bg-gray-800 flex items-center justify-center text-2xl">🏍️</div>}
                    </div>
                    {/* Rank badge */}
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black mb-1"
                      style={{ background: podiumColors[realPos] }}>
                      {rank}
                    </div>
                    <p className="text-white font-bold text-xs text-center max-w-[72px] truncate">{r.full_name}</p>
                    <p className="font-black text-xs" style={{ color: podiumColors[realPos] }}>
                      {getValue(r)} {categories.find(c => c.id === category)?.unit}
                    </p>
                    <p className="text-gray-600 text-[9px]">{lvl.icon} {lvl.name}</p>
                    {isMe && <span className="text-[9px] bg-orange-500/30 text-orange-400 px-1.5 py-0.5 rounded-full mt-0.5">أنت</span>}
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Rest of the list */}
          {rest.map((r, i) => {
            const rank = i + 4;
            const lvl = getLevel(r.xp || 0);
            const isMe = r.id === profile.id;
            const badges = (r.badges || []).slice(0, 3);
            return (
              <motion.div key={r.id}
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => setSelectedRider(r.id)}
                className={`flex items-center gap-3 p-3 rounded-2xl border transition-all cursor-pointer active:opacity-70 ${isMe
                  ? "bg-orange-500/10 border-orange-500/40"
                  : "bg-gray-900 border-gray-800"}`}>
                {/* Rank */}
                <div className="w-8 text-center shrink-0">
                  <span className="text-gray-500 font-black text-sm">#{rank}</span>
                </div>
                {/* Avatar */}
                <div className="w-10 h-10 rounded-2xl overflow-hidden border border-gray-700 shrink-0">
                  {r.avatar_url
                    ? <img src={r.avatar_url} className="w-full h-full object-cover" />
                    : <div className="w-full h-full bg-gray-800 flex items-center justify-center">🏍️</div>}
                </div>
                {/* Info */}
                <div className="flex-1 text-right min-w-0">
                  <div className="flex items-center justify-end gap-1.5 mb-0.5">
                    {isMe && <span className="text-[9px] bg-orange-500/30 text-orange-400 px-1.5 py-0.5 rounded-full">أنت</span>}
                    <p className="text-white font-bold text-sm truncate">{r.full_name}</p>
                  </div>
                  <div className="flex items-center justify-end gap-1">
                    <span className="text-gray-600 text-[10px]">{lvl.icon} {lvl.name}</span>
                    {badges.map(b => {
                      const def = BADGES_DEF.find(x => x.id === b);
                      return def ? <span key={b} title={def.label} className="text-xs">{def.icon}</span> : null;
                    })}
                  </div>
                </div>
                {/* Value */}
                <div className="text-right shrink-0">
                  <p className="text-yellow-400 font-black text-base leading-none">{getValue(r)}</p>
                  <p className="text-gray-600 text-[10px]">{categories.find(c => c.id === category)?.unit}</p>
                </div>
              </motion.div>
            );
          })}

          {sorted.length === 0 && (
            <div className="text-center py-16 text-gray-600">
              <Trophy size={40} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm">لا يوجد بيانات بعد</p>
              <p className="text-xs mt-1">اركب وابدأ تتراكم النقاط! 🏍️</p>
            </div>
          )}

          {/* My XP card at bottom if not visible */}
          {(() => {
            const me = sorted.find(r => r.id === profile.id);
            if (!me) return null;
            const lvl = getLevel(me.xp || 0);
            const prog = getLevelProgress(me.xp || 0);
            const nextLvl = LEVELS[LEVELS.indexOf(lvl) + 1];
            return (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                className="mt-4 bg-gradient-to-r from-orange-900/30 to-yellow-900/20 border border-orange-500/30 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{lvl.icon}</span>
                    <div>
                      <p className="text-white font-black text-sm">{lvl.name}</p>
                      <p className="text-gray-500 text-xs">{(me.xp || 0).toLocaleString("ar")} XP</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-gray-400 text-xs">مستواك</p>
                    <p className="text-orange-400 font-black">#{myRank || "—"}</p>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                  <motion.div className="h-full rounded-full"
                    style={{ background: `linear-gradient(90deg, ${lvl.color}, ${lvl.color}aa)` }}
                    initial={{ width: 0 }}
                    animate={{ width: `${prog}%` }}
                    transition={{ duration: 1, ease: "easeOut" }} />
                </div>
                <div className="flex justify-between mt-1">
                  <p className="text-gray-600 text-[10px]">{nextLvl ? `${nextLvl.name} →` : "المستوى الأعلى 👑"}</p>
                  <p className="text-gray-600 text-[10px]">{prog}%</p>
                </div>
                {/* Badges */}
                {(me.badges || []).length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-800">
                    <p className="text-gray-500 text-xs text-right mb-2">شاراتك</p>
                    <div className="flex flex-wrap gap-2 justify-end">
                      {(me.badges || []).map(b => {
                        const def = BADGES_DEF.find(x => x.id === b);
                        if (!def) return null;
                        return (
                          <motion.div key={b} initial={{ scale: 0 }} animate={{ scale: 1 }}
                            title={def.desc}
                            className="flex items-center gap-1 bg-gray-800 border border-gray-700 rounded-xl px-2 py-1">
                            <span className="text-sm">{def.icon}</span>
                            <span className="text-gray-300 text-xs">{def.label}</span>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })()}
          <div className="h-4" />
        </div>
      )}
    </motion.div>
  );
}




/* ─── DM Conversation Screen ─── */
function DMConversation({ profile, otherUser, onBack }) {
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef(null);

  const conversationId = [profile.id, otherUser.id].sort().join("_");

  useEffect(() => {
    const fetchMsgs = async () => {
      const { data } = await supabase
        .from("direct_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(100);
      if (data) setMsgs(data);
      setLoading(false);
      // mark as read
      await supabase.from("direct_messages")
        .update({ read: true })
        .eq("conversation_id", conversationId)
        .eq("receiver_id", profile.id);
    };
    fetchMsgs();

    const ch = supabase.channel(`dm-${conversationId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "direct_messages" },
        (payload) => {
          if (payload.new.conversation_id === conversationId) {
            setMsgs(prev => [...prev, payload.new]);
          }
        }
      ).subscribe();
    return () => supabase.removeChannel(ch);
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  const send = async () => {
    if (!input.trim()) return;
    const text = input.trim();
    setInput("");
    await supabase.from("direct_messages").insert({
      conversation_id: conversationId,
      sender_id: profile.id,
      sender_name: profile.full_name,
      receiver_id: otherUser.id,
      content: text,
      read: false,
    });
    // Push notification
    await sendPushToUser({
      userId: otherUser.id,
      title: `💬 ${profile.full_name}`,
      message: text,
      tag: "dm",
      url: "/",
    });
  };

  return (
    <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
      transition={{ type: "spring", bounce: 0.1, duration: 0.4 }}
      className="absolute inset-0 flex flex-col bg-gray-950 z-10">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800 shrink-0">
        <motion.button whileTap={{ scale: 0.9 }} onClick={onBack}
          className="w-9 h-9 bg-gray-800 rounded-full flex items-center justify-center shrink-0">
          <ArrowRight size={18} className="text-white" />
        </motion.button>
        <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-orange-500 shrink-0">
          {otherUser.avatar_url
            ? <img src={otherUser.avatar_url} className="w-full h-full object-cover" />
            : <div className="w-full h-full bg-gray-800 flex items-center justify-center">🏍️</div>}
        </div>
        <div className="flex-1 text-right">
          <p className="text-white font-bold text-sm">{otherUser.full_name}</p>
          <p className="text-gray-500 text-xs">{otherUser.bike_type}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
              <Loader size={24} className="text-orange-500" />
            </motion.div>
          </div>
        ) : msgs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-600">
            <MessageCircle size={36} className="opacity-30" />
            <p className="text-sm">ابدأ المحادثة مع {otherUser.full_name}</p>
          </div>
        ) : msgs.map(m => {
          const mine = m.sender_id === profile.id;
          return (
            <div key={m.id} className={`flex gap-2 ${mine ? "flex-row-reverse" : "flex-row"}`}>
              <div className={`max-w-[78%] flex flex-col ${mine ? "items-end" : "items-start"}`}>
                <div className={`px-4 py-2.5 rounded-2xl text-sm ${mine ? "bg-orange-500 text-white rounded-tr-sm" : "bg-gray-900 text-gray-200 border border-gray-800 rounded-tl-sm"}`}>
                  {m.content}
                </div>
                <p className="text-gray-600 text-[10px] mt-1">
                  {new Date(m.created_at).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" })}
                  {mine && <span className="ml-1">{m.read ? " ✓✓" : " ✓"}</span>}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-gray-800 flex gap-2 shrink-0">
        <motion.button whileTap={{ scale: 0.9 }} onClick={send}
          className="w-12 h-12 bg-orange-500 rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-orange-500/40">
          <ArrowRight size={18} className="text-white rotate-180" />
        </motion.button>
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && send()}
          placeholder={`راسل ${otherUser.full_name}...`} dir="rtl"
          className="flex-1 bg-gray-900 border border-gray-800 text-white placeholder-gray-600 rounded-2xl px-4 py-3 text-sm focus:border-orange-500 focus:outline-none" />
      </div>
    </motion.div>
  );
}

/* ─── Chat Tab — عامة + خاصة ─── */
function ChatTab({ profile, openDMWith, onDMOpened }) {
  const [tab, setTab] = useState("group"); // "group" | "dms"
  const [dmConversation, setDmConversation] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [unreadDMs, setUnreadDMs] = useState(0);

  // افتح DM مباشرة إذا جاء request من الخريطة
  useEffect(() => {
    if (openDMWith) {
      setDmConversation(openDMWith);
      setTab("dms");
      onDMOpened?.();
    }
  }, [openDMWith]);

  // جلب المحادثات الخاصة
  const fetchConversations = async () => {
    const { data } = await supabase
      .from("direct_messages")
      .select("*")
      .or(`sender_id.eq.${profile.id},receiver_id.eq.${profile.id}`)
      .order("created_at", { ascending: false });

    if (!data) return;
    // تجميع بـ conversation_id
    const map = {};
    data.forEach(m => {
      if (!map[m.conversation_id]) map[m.conversation_id] = m;
    });
    const convos = Object.values(map);
    setConversations(convos);
    setUnreadDMs(data.filter(m => m.receiver_id === profile.id && !m.read).length);
  };

  useEffect(() => {
    fetchConversations();
    const ch = supabase.channel("dms-list-rt")
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "direct_messages" },
        (payload) => {
          if (payload.new.receiver_id === profile.id || payload.new.sender_id === profile.id) {
            fetchConversations();
          }
        }
      ).subscribe();
    return () => supabase.removeChannel(ch);
  }, [profile.id]);

  // Group Chat state
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef(null);

  useEffect(() => {
    const fetchMsgs = async () => {
      const { data } = await supabase.from("messages").select("*")
        .order("created_at", { ascending: true }).limit(50);
      if (data) setMsgs(data);
      setLoading(false);
    };
    fetchMsgs();
    const ch = supabase.channel("messages-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" },
        (payload) => setMsgs(prev => [...prev, payload.new]))
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  const send = async () => {
    if (!input.trim()) return;
    const text = input.trim(); setInput("");
    await supabase.from("messages").insert({
      sender_id: profile.id, sender_name: profile.full_name, content: text,
    });
  };

  // إذا فيه محادثة خاصة مفتوحة
  if (dmConversation) {
    return (
      <DMConversation
        profile={profile}
        otherUser={dmConversation}
        onBack={() => { setDmConversation(null); fetchConversations(); }}
      />
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="absolute inset-0 flex flex-col">

      {/* Tab switcher */}
      <div className="flex bg-gray-900 border-b border-gray-800 shrink-0">
        {[
          { id: "group", label: "💬 عامة" },
          { id: "dms", label: "📩 خاصة", badge: unreadDMs },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 py-3 text-sm font-bold relative transition-all ${tab === t.id ? "text-orange-500 border-b-2 border-orange-500" : "text-gray-500"}`}>
            {t.label}
            {t.badge > 0 && (
              <span className="absolute top-2 right-[calc(50%-28px)] w-4 h-4 bg-red-500 rounded-full text-white text-[9px] font-black flex items-center justify-center">
                {t.badge > 9 ? "9+" : t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Group Chat */}
      {tab === "group" && (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                  <Loader size={28} className="text-orange-500" />
                </motion.div>
              </div>
            ) : msgs.length === 0 ? (
              <div className="flex items-center justify-center h-full flex-col gap-2">
                <MessageCircle size={40} className="text-gray-700" />
                <p className="text-gray-600 text-sm">لا توجد رسائل بعد</p>
              </div>
            ) : msgs.map(m => {
              const mine = m.sender_id === profile.id;
              return (
                <div key={m.id} className={`flex gap-2 ${mine ? "flex-row-reverse" : "flex-row"}`}>
                  <div className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center text-sm shrink-0 self-end">🏍️</div>
                  <div className={`max-w-[75%] flex flex-col ${mine ? "items-end" : "items-start"}`}>
                    {!mine && <p className="text-orange-400 text-xs mb-1 font-semibold">{m.sender_name}</p>}
                    <div className={`px-4 py-2.5 rounded-2xl text-sm ${mine ? "bg-orange-500 text-white rounded-tr-sm" : "bg-gray-900 text-gray-200 border border-gray-800 rounded-tl-sm"}`}>
                      {m.content}
                    </div>
                    <p className="text-gray-600 text-[10px] mt-1">
                      {new Date(m.created_at).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
          <div className="p-3 border-t border-gray-800 flex gap-2 shrink-0">
            <motion.button whileTap={{ scale: 0.9 }} onClick={send}
              className="w-12 h-12 bg-orange-500 rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-orange-500/40">
              <ArrowRight size={18} className="text-white rotate-180" />
            </motion.button>
            <input value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && send()}
              placeholder="اكتب رسالة..." dir="rtl"
              className="flex-1 bg-gray-900 border border-gray-800 text-white placeholder-gray-600 rounded-2xl px-4 py-3 text-sm focus:border-orange-500 focus:outline-none" />
          </div>
        </div>
      )}

      {/* DMs List */}
      {tab === "dms" && (
        <div className="flex-1 overflow-y-auto min-h-0">
          {conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-600">
              <MessageCircle size={40} className="opacity-20" />
              <p className="text-sm">لا توجد محادثات خاصة بعد</p>
              <p className="text-xs">اضغط على دراج من الخريطة أو السائقين لتراسله</p>
            </div>
          ) : (
            <DMList profile={profile} conversations={conversations} onOpen={setDmConversation} />
          )}
        </div>
      )}
    </motion.div>
  );
}

/* ─── DM List ─── */
function DMList({ profile, conversations, onOpen }) {
  const [users, setUsers] = useState({});

  useEffect(() => {
    const fetchUsers = async () => {
      const ids = [...new Set(conversations.map(c =>
        c.sender_id === profile.id ? c.receiver_id : c.sender_id
      ))];
      if (!ids.length) return;
      const { data } = await supabase.from("profiles")
        .select("id, full_name, bike_type, avatar_url").in("id", ids);
      if (data) {
        const map = {};
        data.forEach(u => map[u.id] = u);
        setUsers(map);
      }
    };
    fetchUsers();
  }, [conversations]);

  if (!conversations.length) return null;

  // deduplicate by conversation_id
  const seen = new Set();
  const unique = conversations.filter(c => {
    if (seen.has(c.conversation_id)) return false;
    seen.add(c.conversation_id); return true;
  });

  return (
    <div className="divide-y divide-gray-800/50">
      {unique.map(conv => {
        const otherId = conv.sender_id === profile.id ? conv.receiver_id : conv.sender_id;
        const other = users[otherId];
        const unread = conv.receiver_id === profile.id && !conv.read;
        if (!other) return null;
        return (
          <motion.div key={conv.conversation_id}
            whileTap={{ backgroundColor: "rgba(249,115,22,0.05)" }}
            onClick={() => onOpen(other)}
            className="flex items-center gap-3 px-4 py-3.5 cursor-pointer">
            <div className="text-right flex-1 min-w-0">
              <div className="flex items-center justify-end gap-2">
                {unread && <div className="w-2 h-2 bg-orange-500 rounded-full shrink-0" />}
                <p className={`text-sm font-bold truncate ${unread ? "text-white" : "text-gray-300"}`}>
                  {other.full_name}
                </p>
              </div>
              <p className="text-gray-500 text-xs truncate">{conv.content}</p>
            </div>
            <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-gray-700 shrink-0">
              {other.avatar_url
                ? <img src={other.avatar_url} className="w-full h-full object-cover" />
                : <div className="w-full h-full bg-gray-800 flex items-center justify-center text-lg">🏍️</div>}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}



/* ─── Groups Tab ─── */

function GroupsTab({ profile }) {
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [rideName, setRideName] = useState("");
  const [startLocation, setStartLocation] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [maxMembers, setMaxMembers] = useState(10);
  const [creating, setCreating] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [selectedRide, setSelectedRide] = useState(null);
  const [rideMessages, setRideMessages] = useState([]);
  const [msgInput, setMsgInput] = useState("");
  const [toast, setToast] = useState(null);
  const bottomRef = useRef(null);

  // تحويل العنوان لإحداثيات
  const geocodeAddress = async (address) => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`);
      const data = await res.json();
      if (data && data.length > 0) {
        return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      }
    } catch (e) { console.error(e); }
    return null;
  };

  const showToast = (msg, type) => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  useEffect(() => {
    fetchRides();
    const ch = supabase.channel("rides-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "rides" }, fetchRides)
      .on("postgres_changes", { event: "*", schema: "public", table: "ride_members" }, fetchRides)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  useEffect(() => {
    if (!selectedRide) return;
    fetchMessages(selectedRide.id);
    const ch = supabase.channel(`ride-chat-${selectedRide.id}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "ride_messages", filter: `ride_id=eq.${selectedRide.id}` },
        (payload) => setRideMessages(prev => [...prev, payload.new])
      ).subscribe();
    return () => supabase.removeChannel(ch);
  }, [selectedRide?.id]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [rideMessages]);

  const fetchRides = async () => {
    const { data } = await supabase
      .from("rides")
      .select("*, ride_members(profile_id, profile_name)")
      .neq("status", "completed")
      .order("created_at", { ascending: false });
    if (data) setRides(data);
    setLoading(false);
  };

  const fetchMessages = async (rideId) => {
    const { data } = await supabase.from("ride_messages").select("*")
      .eq("ride_id", rideId).order("created_at", { ascending: true }).limit(50);
    if (data) setRideMessages(data);
  };

  const createRide = async () => {
    if (!rideName.trim() || !startLocation.trim() || !startDate || !startTime) {
      showToast("يرجى تعبئة جميع الحقول!", "error");
      return;
    }

    // تحقق من أن التاريخ والوقت في المستقبل
    const rideDateTime = new Date(`${startDate}T${startTime}`);
    if (rideDateTime <= new Date()) {
      showToast("⚠️ يجب أن يكون موعد الرحلة في المستقبل!", "error");
      return;
    }

    setCreating(true);
    setGeocoding(true);

    // تحويل العنوان لإحداثيات
    const coords = await geocodeAddress(startLocation);
    setGeocoding(false);

    if (!coords) {
      showToast("⚠️ تعذّر تحديد موقع العنوان، جرب عنواناً أوضح", "error");
      setCreating(false);
      return;
    }

    const { data } = await supabase.from("rides").insert({
      name: rideName,
      leader_id: profile.id,
      leader_name: profile.full_name,
      max_members: maxMembers,
      start_location_name: startLocation,
      start_date: startDate,
      start_time: startTime,
      start_lat: coords.lat,
      start_lng: coords.lng,
      approved: false,
    }).select().single();

    if (data) {
      await supabase.from("ride_members").insert({
        ride_id: data.id, profile_id: profile.id, profile_name: profile.full_name,
      });
      showToast("✅ تم إرسال الرحلة للمراجعة!", "success");
      setRideName(""); setStartLocation(""); setStartDate(""); setStartTime(""); setShowCreate(false);
    }
    setCreating(false);
  };

  const joinRide = async (ride) => {
    const isMember = ride.ride_members?.some(m => m.profile_id === profile.id);
    if (isMember) {
      await supabase.from("ride_members").delete().eq("ride_id", ride.id).eq("profile_id", profile.id);
      await supabase.from("rides").update({ member_count: Math.max(0, ride.member_count - 1) }).eq("id", ride.id);
      showToast("غادرت الرحلة", "info");
    } else {
      await supabase.from("ride_members").insert({ ride_id: ride.id, profile_id: profile.id, profile_name: profile.full_name });
      await supabase.from("rides").update({ member_count: ride.member_count + 1 }).eq("id", ride.id);
      // إشعار + Push لصاحب الرحلة
      await supabase.from("notifications").insert({
        user_id: ride.leader_id,
        title: `🏍️ ${profile.full_name} انضم لرحلتك!`,
        body: `انضم ${profile.full_name} إلى رحلة "${ride.name}"`,
        type: "info",
      });
      await sendPushToUser({
        userId: ride.leader_id,
        title: `🏍️ ${profile.full_name} انضم لرحلتك!`,
        message: `انضم ${profile.full_name} إلى رحلة "${ride.name}"`,
        tag: "ride-join",
      });
      // XP للانضمام
      await awardXP(profile.id, XP_REWARDS.join_ride, `انضممت لرحلة "${ride.name}" 🏍️`);
      showToast("✅ انضممت للرحلة!", "success");
    }
  };

  const startRide = async (ride) => {
    await supabase.from("rides").update({ status: "active", started_at: new Date().toISOString() }).eq("id", ride.id);
    // Push لجميع الأعضاء
    const members = ride.ride_members || [];
    for (const m of members) {
      if (m.profile_id === profile.id) continue;
      await sendPushToUser({
        userId: m.profile_id,
        title: `🏁 رحلة "${ride.name}" انطلقت!`,
        message: `القائد ${ride.leader_name} بدأ الرحلة — انضم الآن`,
        tag: "ride-start",
        url: "/",
      });
    }
    showToast("🏁 انطلقت الرحلة!", "success");
  };

  const endRide = async (ride) => {
    await supabase.from("rides").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", ride.id);
    // XP لجميع الأعضاء
    const members = ride.ride_members || [];
    for (const m of members) {
      const isFirst = (await supabase.from("rides")
        .select("id", { count: "exact" })
        .eq("status", "completed")
        .contains("ride_members", [{ profile_id: m.profile_id }])
      ).count === 0;
      const xp = XP_REWARDS.ride_complete + (isFirst ? XP_REWARDS.first_ride : 0);
      await awardXP(m.profile_id, xp, `أكملت رحلة "${ride.name}" 🎉`);
    }
    showToast("🎉 انتهت الرحلة!", "success");
  };

  const sendMsg = async () => {
    if (!msgInput.trim() || !selectedRide) return;
    await supabase.from("ride_messages").insert({
      ride_id: selectedRide.id, sender_id: profile.id,
      sender_name: profile.full_name, content: msgInput.trim(),
    });
    setMsgInput("");
  };

  const statusColor = { waiting: "text-yellow-400 bg-yellow-500/20 border-yellow-500/30", active: "text-green-400 bg-green-500/20 border-green-500/30" };
  const statusLabel = { waiting: "⏳ انتظار", active: "🏁 جارية" };

  // شاشة دردشة الرحلة
  if (selectedRide) return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="absolute inset-0 flex flex-col">
      <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-3 shrink-0">
        <button onClick={() => setSelectedRide(null)} className="text-orange-400 font-bold text-sm flex items-center gap-1">
          <ArrowRight size={16} className="rotate-180" /> رجوع
        </button>
        <div className="flex-1 text-right">
          <p className="text-white font-bold text-sm">{selectedRide.name}</p>
          <p className="text-gray-500 text-xs">{selectedRide.member_count} عضو • {selectedRide.start_location_name || "بدون موقع"}</p>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full border font-bold ${statusColor[selectedRide.status] || statusColor.waiting}`}>
          {statusLabel[selectedRide.status] || "⏳"}
        </span>
      </div>

      {/* الأعضاء */}
      <div className="px-4 py-2 border-b border-gray-800 shrink-0">
        <p className="text-gray-500 text-xs text-right mb-2">الأعضاء:</p>
        <div className="flex gap-2 flex-wrap justify-end">
          {selectedRide.ride_members?.map((m, i) => (
            <div key={i} className="flex items-center gap-1 bg-gray-800 rounded-xl px-2 py-1">
              <span className="text-white text-xs font-medium">{m.profile_name}</span>
              <span className="text-sm">🏍️</span>
              {m.profile_id === selectedRide.leader_id && <span className="text-yellow-400 text-xs">👑</span>}
            </div>
          ))}
        </div>
      </div>

      {/* الرسائل */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {rideMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full flex-col gap-2">
            <MessageCircle size={36} className="text-gray-700" />
            <p className="text-gray-600 text-sm">لا توجد رسائل بعد</p>
          </div>
        ) : rideMessages.map(m => {
          const mine = m.sender_id === profile.id;
          return (
            <div key={m.id} className={`flex gap-2 ${mine ? "flex-row-reverse" : "flex-row"}`}>
              <div className="w-7 h-7 bg-gray-800 rounded-full flex items-center justify-center text-sm shrink-0 self-end">🏍️</div>
              <div className={`max-w-[75%] flex flex-col ${mine ? "items-end" : "items-start"}`}>
                {!mine && <p className="text-orange-400 text-xs mb-1 font-semibold">{m.sender_name}</p>}
                <div className={`px-3 py-2 rounded-2xl text-sm ${mine ? "bg-orange-500 text-white rounded-tr-sm" : "bg-gray-900 text-gray-200 border border-gray-800 rounded-tl-sm"}`}>
                  {m.content}
                </div>
                <p className="text-gray-600 text-[10px] mt-1">
                  {new Date(m.created_at).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* إرسال رسالة */}
      <div className="p-3 border-t border-gray-800 flex gap-2 shrink-0">
        <motion.button whileTap={{ scale: 0.9 }} onClick={sendMsg}
          className="w-12 h-12 bg-orange-500 rounded-2xl flex items-center justify-center shrink-0">
          <ArrowRight size={18} className="text-white rotate-180" />
        </motion.button>
        <input value={msgInput} onChange={e => setMsgInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && sendMsg()}
          placeholder="اكتب رسالة..." dir="rtl"
          className="flex-1 bg-gray-900 border border-gray-800 text-white placeholder-gray-600 rounded-2xl px-4 py-3 text-sm focus:border-orange-500 focus:outline-none" />
      </div>
    </motion.div>
  );

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
      className="absolute inset-0 overflow-y-auto p-4">

      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl font-bold text-sm shadow-xl ${toast.type === "success" ? "bg-green-600" : toast.type === "error" ? "bg-red-600" : "bg-orange-500"}`}>
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between mb-4">
        <motion.button whileTap={{ scale: 0.95 }} onClick={() => {
          if (showCreate) {
            setRideName("");
            setStartLocation("");
            setStartDate("");
            setStartTime("");
            setMaxMembers(10);
          }
          setShowCreate(!showCreate);
        }} className="bg-orange-500 text-white text-sm font-bold px-4 py-2 rounded-xl shadow-lg shadow-orange-500/30">
          {showCreate ? "✕ إلغاء" : "+ رحلة جديدة"}
        </motion.button>
        <h2 className="text-white font-black text-lg">الرحلات 🏍️</h2>
      </div>

      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mb-4">
            <div className="bg-gray-900 border border-orange-500/30 rounded-2xl p-4 space-y-3">
              <p className="text-white font-bold text-right">إنشاء رحلة جديدة</p>
              <input value={rideName} onChange={e => setRideName(e.target.value)}
                placeholder="اسم الرحلة..." dir="rtl"
                className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl px-4 py-3 text-sm focus:border-orange-500 focus:outline-none" />
              <div className="relative">
                <input value={startLocation} onChange={e => setStartLocation(e.target.value)}
                  placeholder="عنوان مكان الانطلاق (مثال: برج خليفة، دبي)..." dir="rtl"
                  className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl px-4 py-3 text-sm focus:border-orange-500 focus:outline-none" />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg">📍</span>
              </div>
              <div className="flex gap-2">
                <input type="date" value={startDate}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={e => setStartDate(e.target.value)}
                  className="flex-1 bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm focus:border-orange-500 focus:outline-none" />
                <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
                  className="flex-1 bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm focus:border-orange-500 focus:outline-none" />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {[5, 10, 20, 50].map(n => (
                    <button key={n} onClick={() => setMaxMembers(n)}
                      className={`w-10 h-10 rounded-xl text-sm font-bold transition-all ${maxMembers === n ? "bg-orange-500 text-white" : "bg-gray-800 text-gray-400"}`}>
                      {n}
                    </button>
                  ))}
                </div>
                <p className="text-gray-500 text-xs">أقصى عدد</p>
              </div>
              <p className="text-yellow-400 text-xs text-right">⚠️ ستظهر الرحلة على الخريطة بعد موافقة الأدمن</p>
              <motion.button whileTap={{ scale: 0.97 }} onClick={createRide} disabled={creating || !rideName.trim()}
                className="w-full bg-orange-500 text-white font-bold py-3 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2">
                {creating ? (
                  <>
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}><Loader size={16} /></motion.div>
                    {geocoding ? "جاري تحديد الموقع..." : "جاري الإنشاء..."}
                  </>
                ) : "🏍️ إرسال للمراجعة"}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}><Loader size={28} className="text-orange-500" /></motion.div>
        </div>
      ) : rides.filter(r => r.approved).length === 0 ? (
        <div className="text-center py-16 text-gray-600">
          <span className="text-5xl block mb-3">🏍️</span>
          <p className="text-sm">لا توجد رحلات معتمدة</p>
          <p className="text-xs mt-1">أنشئ رحلة وانتظر موافقة الأدمن!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rides.filter(r => r.approved).map((ride, i) => {
            const isMember = ride.ride_members?.some(m => m.profile_id === profile.id);
            const isLeader = ride.leader_id === profile.id;
            return (
              <motion.div key={ride.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                className={`bg-gray-900 border rounded-2xl p-4 transition-all ${isMember ? "border-orange-500/40" : "border-gray-800"}`}>
                <div className="flex items-start justify-between mb-2">
                  <span className={`text-xs px-2 py-1 rounded-full border font-bold ${statusColor[ride.status] || statusColor.waiting}`}>
                    {statusLabel[ride.status] || "⏳"}
                  </span>
                  <div className="text-right">
                    <p className="text-white font-black text-base">{ride.name}</p>
                    <p className="text-gray-500 text-xs">بقيادة {ride.leader_name}</p>
                    {ride.start_location_name && (
                      <p className="text-orange-400 text-xs mt-0.5">📍 {ride.start_location_name}</p>
                    )}
                    {(ride.start_date || ride.start_time) && (
                      <p className="text-blue-400 text-xs mt-0.5">
                        🗓️ {ride.start_date ? new Date(ride.start_date).toLocaleDateString("ar") : ""}
                        {ride.start_time ? ` ⏰ ${ride.start_time.slice(0, 5)}` : ""}
                      </p>
                    )}
                  </div>
                </div>

                {/* الأعضاء */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    {ride.ride_members?.slice(0, 5).map((m, j) => (
                      <div key={j} title={m.profile_name}
                        className="w-7 h-7 bg-gray-700 border-2 border-gray-900 rounded-full flex items-center justify-center text-xs -ml-1">
                        🏍️
                      </div>
                    ))}
                    {(ride.ride_members?.length || 0) > 5 && (
                      <div className="w-7 h-7 bg-gray-700 border-2 border-gray-900 rounded-full flex items-center justify-center text-[10px] text-gray-400 -ml-1">
                        +{ride.ride_members.length - 5}
                      </div>
                    )}
                  </div>
                  <p className="text-gray-500 text-xs">{ride.member_count}/{ride.max_members} عضو</p>
                </div>

                {/* Buttons */}
                <div className="flex gap-2">
                  <motion.button whileTap={{ scale: 0.95 }} onClick={() => setSelectedRide(ride)}
                    className="flex-1 bg-gray-800 border border-gray-700 text-gray-300 font-bold py-2 rounded-xl text-sm flex items-center justify-center gap-1">
                    <MessageCircle size={14} /> دردشة
                  </motion.button>
                  {isLeader && ride.status === "waiting" && (
                    <motion.button whileTap={{ scale: 0.95 }} onClick={() => startRide(ride)}
                      className="flex-1 bg-green-500/20 border border-green-500/40 text-green-400 font-bold py-2 rounded-xl text-sm">
                      🏁 ابدأ
                    </motion.button>
                  )}
                  {isLeader && ride.status === "active" && (
                    <motion.button whileTap={{ scale: 0.95 }} onClick={() => endRide(ride)}
                      className="flex-1 bg-red-500/20 border border-red-500/40 text-red-400 font-bold py-2 rounded-xl text-sm">
                      🏆 أنهِ
                    </motion.button>
                  )}
                  {!isLeader && (
                    <motion.button whileTap={{ scale: 0.95 }} onClick={() => joinRide(ride)}
                      className={`flex-1 font-bold py-2 rounded-xl text-sm ${isMember ? "bg-gray-700 text-gray-400 border border-gray-600" : "bg-orange-500 text-white shadow-lg shadow-orange-500/30"}`}>
                      {isMember ? "غادر" : "انضم 🏍️"}
                    </motion.button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

/* ─── Photos Tab — Instagram Style ─── */
function PhotosTab({ profile, onDM, onPing }) {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState("");
  const [preview, setPreview] = useState(null);
  const [file, setFile] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [fullscreen, setFullscreen] = useState(null);
  const [toast, setToast] = useState(null);
  const [selectedRider, setSelectedRider] = useState(null);
  const fileRef = useRef(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchPhotos = async () => {
    const { data } = await supabase
      .from("photos")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setPhotos(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchPhotos();
    const ch = supabase.channel("photos-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "photos" }, fetchPhotos)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) { showToast("الصورة أكبر من 10MB", "error"); return; }
    setFile(f);
    const reader = new FileReader();
    reader.onload = ev => setPreview(ev.target.result);
    reader.readAsDataURL(f);
    setShowUpload(true);
    e.target.value = "";
  };

  const uploadPhoto = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${profile.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("photos").upload(path, file);
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from("photos").getPublicUrl(path);
      await supabase.from("photos").insert({
        uploader_id: profile.id,
        uploader_name: profile.full_name,
        uploader_avatar: profile.avatar_url || null,
        url: publicUrl,
        caption: caption.trim() || null,
        likes: [],
        storage_path: path,
      });
      setFile(null); setPreview(null); setCaption(""); setShowUpload(false);
      showToast("✅ تم نشر الصورة!");
    } catch (e) { showToast("خطأ: " + e.message, "error"); }
    setUploading(false);
  };

  const toggleLike = async (photo) => {
    const likes = photo.likes || [];
    const liked = likes.includes(profile.id);
    const newLikes = liked ? likes.filter(id => id !== profile.id) : [...likes, profile.id];
    await supabase.from("photos").update({ likes: newLikes }).eq("id", photo.id);
    setPhotos(prev => prev.map(p => p.id === photo.id ? { ...p, likes: newLikes } : p));
    if (fullscreen?.id === photo.id) setFullscreen(prev => ({ ...prev, likes: newLikes }));
  };

  const deletePhoto = async (photo) => {
    if (photo.uploader_id !== profile.id) return;
    await supabase.storage.from("photos").remove([photo.storage_path]);
    await supabase.from("photos").delete().eq("id", photo.id);
    setPhotos(prev => prev.filter(p => p.id !== photo.id));
    setFullscreen(null);
    showToast("🗑️ تم حذف الصورة");
  };

  const timeAgo = (date) => {
    const diff = Date.now() - new Date(date).getTime();
    const m = Math.floor(diff / 60000);
    const h = Math.floor(diff / 3600000);
    const d = Math.floor(diff / 86400000);
    if (m < 1) return "الآن";
    if (m < 60) return `${m}د`;
    if (h < 24) return `${h}س`;
    return `${d}ي`;
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="absolute inset-0 flex flex-col bg-gray-950">

      <AnimatePresence>
        {selectedRider && <RiderProfile riderId={selectedRider} onClose={() => setSelectedRider(null)} onDM={onDM} onPing={onPing} />}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl font-bold text-sm shadow-xl text-white ${toast.type === "error" ? "bg-red-600" : "bg-green-600"}`}>
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fullscreen viewer */}
      <AnimatePresence>
        {fullscreen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black flex flex-col">
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800 shrink-0"
              style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}>
              <motion.button whileTap={{ scale: 0.9 }} onClick={() => setFullscreen(null)}
                className="w-9 h-9 bg-gray-800 rounded-full flex items-center justify-center shrink-0">
                <X size={18} className="text-white" />
              </motion.button>
              <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-orange-500 shrink-0">
                {fullscreen.uploader_avatar
                  ? <img src={fullscreen.uploader_avatar} className="w-full h-full object-cover" />
                  : <div className="w-full h-full bg-gray-800 flex items-center justify-center">🏍️</div>}
              </div>
              <div className="flex-1 text-right">
                <p className="text-white font-bold text-sm">{fullscreen.uploader_name}</p>
                <p className="text-gray-500 text-xs">{timeAgo(fullscreen.created_at)}</p>
              </div>
              {fullscreen.uploader_id === profile.id && (
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => deletePhoto(fullscreen)}
                  className="w-9 h-9 bg-red-500/20 border border-red-500/40 rounded-xl flex items-center justify-center">
                  <X size={16} className="text-red-400" />
                </motion.button>
              )}
            </div>
            {/* Image */}
            <div className="flex-1 flex items-center justify-center bg-black min-h-0">
              <img src={fullscreen.url} alt="" className="max-w-full max-h-full object-contain" />
            </div>
            {/* Footer */}
            <div className="px-4 py-4 border-t border-gray-800 shrink-0"
              style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}>
              {fullscreen.caption && (
                <p className="text-gray-300 text-sm text-right mb-3 leading-relaxed">{fullscreen.caption}</p>
              )}
              <div className="flex items-center justify-between">
                <p className="text-gray-500 text-xs">{(fullscreen.likes?.length || 0)} إعجاب</p>
                <motion.button whileTap={{ scale: 0.82 }} onClick={() => toggleLike(fullscreen)}
                  className="flex items-center gap-2 bg-gray-900 border border-gray-700 rounded-2xl px-5 py-2.5">
                  <Heart size={20}
                    className={fullscreen.likes?.includes(profile.id) ? "text-red-500 fill-red-500" : "text-gray-400"} />
                  <span className={`font-bold text-sm ${fullscreen.likes?.includes(profile.id) ? "text-red-400" : "text-gray-400"}`}>
                    {fullscreen.likes?.includes(profile.id) ? "أعجبني" : "إعجاب"}
                  </span>
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between shrink-0">
        <motion.button whileTap={{ scale: 0.93 }} onClick={() => fileRef.current?.click()}
          className="bg-orange-500 text-white text-sm font-bold px-4 py-2 rounded-xl shadow-lg shadow-orange-500/30 flex items-center gap-1.5">
          <Camera size={15} /> نشر صورة
        </motion.button>
        <h2 className="text-white font-black text-lg">لقطات 📸</h2>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </div>

      {/* Upload form */}
      <AnimatePresence>
        {showUpload && preview && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-b border-gray-800 shrink-0">
            <div className="p-4 flex gap-3">
              <div className="w-24 h-24 rounded-2xl overflow-hidden border border-gray-700 shrink-0">
                <img src={preview} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 flex flex-col gap-2">
                <input value={caption} onChange={e => setCaption(e.target.value)}
                  placeholder="أضف وصفاً..." dir="rtl"
                  className="w-full bg-gray-900 border border-gray-700 text-white placeholder-gray-600 rounded-xl px-3 py-2.5 text-sm focus:border-orange-500 focus:outline-none" />
                <div className="flex gap-2">
                  <motion.button whileTap={{ scale: 0.95 }}
                    onClick={() => { setShowUpload(false); setPreview(null); setFile(null); setCaption(""); }}
                    className="flex-1 bg-gray-800 text-gray-400 font-bold py-2.5 rounded-xl text-sm">
                    إلغاء
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.95 }} onClick={uploadPhoto} disabled={uploading}
                    className="flex-1 bg-orange-500 text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-60 flex items-center justify-center gap-1.5">
                    {uploading
                      ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}><Loader size={14} /></motion.div>
                      : <><Upload size={14} /> نشر</>}
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
              <Loader size={28} className="text-orange-500" />
            </motion.div>
          </div>
        ) : photos.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-600">
            <Camera size={48} className="opacity-20" />
            <p className="text-sm">لا توجد صور بعد</p>
            <p className="text-xs">كن أول من ينشر! 📸</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-800/50">
            {photos.map((photo, i) => (
              <motion.div key={photo.id}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="bg-gray-950">
                {/* Post header */}
                <div className="flex items-center gap-3 px-4 py-3 cursor-pointer active:opacity-70"
                  onClick={() => setSelectedRider(photo.uploader_id)}>
                  <div className="flex-1 text-right">
                    <p className="text-white font-bold text-sm">{photo.uploader_name}</p>
                    <p className="text-gray-500 text-xs">{timeAgo(photo.created_at)}</p>
                  </div>
                  <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-orange-500 shrink-0">
                    {photo.uploader_avatar
                      ? <img src={photo.uploader_avatar} className="w-full h-full object-cover" />
                      : <div className="w-full h-full bg-gray-800 flex items-center justify-center">🏍️</div>}
                  </div>
                </div>
                {/* Image */}
                <motion.div whileTap={{ opacity: 0.85 }} onClick={() => setFullscreen(photo)}
                  className="w-full aspect-square overflow-hidden bg-gray-900 cursor-pointer">
                  <img src={photo.url} alt="" className="w-full h-full object-cover" loading="lazy" />
                </motion.div>
                {/* Actions */}
                <div className="px-4 py-3 flex items-center justify-between">
                  <p className="text-gray-500 text-xs">{photo.likes?.length || 0} إعجاب</p>
                  <motion.button whileTap={{ scale: 0.75 }} onClick={() => toggleLike(photo)}
                    className="flex items-center gap-1.5">
                    <motion.div
                      animate={photo.likes?.includes(profile.id) ? { scale: [1, 1.4, 1] } : {}}
                      transition={{ duration: 0.3 }}>
                      <Heart size={24}
                        className={photo.likes?.includes(profile.id) ? "text-red-500 fill-red-500" : "text-gray-500"} />
                    </motion.div>
                  </motion.button>
                </div>
                {/* Caption */}
                {photo.caption && (
                  <div className="px-4 pb-3 text-right">
                    <span className="text-orange-400 text-xs font-bold">{photo.uploader_name.split(" ")[0]} </span>
                    <span className="text-gray-300 text-sm">{photo.caption}</span>
                  </div>
                )}
              </motion.div>
            ))}
            <div className="h-4" />
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ─── Profile Tab ─── */
function ProfileTab({ profile, speed, gpsStatus, tracking, toggleGPS, onSignOut }) {
  const [pushStatus, setPushStatus] = useState("loading");
  const [pushLoading, setPushLoading] = useState(false);

  useEffect(() => { getPushStatus().then(setPushStatus); }, []);

  const handlePushToggle = async () => {
    setPushLoading(true);
    if (pushStatus === "subscribed") {
      await unsubscribePush(profile.id);
      setPushStatus("not_subscribed");
    } else {
      const result = await subscribePush(profile.id);
      setPushStatus(result.ok ? "subscribed" : pushStatus);
    }
    setPushLoading(false);
  };

  const stats = [
    { label: "أعلى سرعة", value: `${profile?.top_speed || 0}`, unit: "كم/س", icon: "⚡" },
    { label: "الرحلات", value: `${profile?.total_rides || 0}`, unit: "رحلة", icon: "🗺️" },
    { label: "المسافة", value: `${(profile?.total_distance || 0).toFixed(0)}`, unit: "كم", icon: "📍" },
  ];
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 overflow-y-auto">
      <div className="relative bg-gradient-to-b from-orange-600/25 to-gray-950 pt-8 pb-6 px-4 text-center">
        <div className="relative inline-block mx-auto mb-3">
          <div className="w-20 h-20 bg-gray-800 border-4 border-orange-500 rounded-3xl overflow-hidden shadow-xl shadow-orange-500/30">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-4xl">🏍️</div>
            )}
          </div>
          <label className="absolute -bottom-2 -right-2 w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center cursor-pointer shadow-lg hover:bg-orange-400 transition-all">
            <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const ext = file.name.split(".").pop();
              const path = `${profile.id}/avatar_${Date.now()}.${ext}`;
              const { error: uploadError } = await supabase.storage
                .from("avatars")
                .upload(path, file, { upsert: true });
              if (uploadError) { alert("خطأ في الرفع"); return; }
              const { data: { publicUrl } } = supabase.storage
                .from("avatars")
                .getPublicUrl(path);
              await supabase.from("profiles")
                .update({ avatar_url: publicUrl })
                .eq("id", profile.id);
              // تحديث profile في قاعدة البيانات وإعادة جلبه
              const { data: updatedProfile } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", profile.id)
                .single();
              if (updatedProfile) {
                // تحديث الصورة في locations أيضاً
                await supabase.from("locations")
                  .update({ updated_at: new Date().toISOString() })
                  .eq("profile_id", profile.id);
              }
              window.location.reload();
            }} />
            <span className="text-white text-sm">📷</span>
          </label>
        </div>
        <h2 className="text-white font-black text-xl">{profile?.full_name}</h2>
        <p className="text-orange-400 text-sm">{profile?.bike_type}</p>
        <span className="mt-2 inline-block bg-green-500/20 text-green-400 text-xs px-3 py-1 rounded-full border border-green-500/30">✓ حساب موثق</span>
      </div>
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          {stats.map((s, i) => (
            <div key={i} className="bg-gray-900 border border-gray-800 rounded-2xl p-3 text-center">
              <div className="text-2xl mb-1">{s.icon}</div>
              <p className="text-white font-black text-lg">{s.value}</p>
              <p className="text-gray-500 text-xs">{s.unit}</p>
              <p className="text-gray-600 text-[10px]">{s.label}</p>
            </div>
          ))}
        </div>

        {/* GPS Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <motion.button whileTap={{ scale: 0.95 }} onClick={toggleGPS}
              className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${tracking ? "bg-red-500/20 border border-red-500/40 text-red-400" : "bg-orange-500 text-white shadow-lg shadow-orange-500/30"}`}>
              {tracking ? "إيقاف GPS" : "تفعيل GPS"}
            </motion.button>
            <div className="text-right">
              <p className="text-gray-300 text-sm font-bold">تتبع الموقع</p>
              <p className={`text-xs mt-0.5 ${gpsStatus === "active" ? "text-green-400" : gpsStatus === "searching" ? "text-yellow-400" : gpsStatus === "error" ? "text-red-400" : "text-gray-600"}`}>
                {gpsStatus === "active" ? `نشط — ${speed} كم/س` : gpsStatus === "searching" ? "جاري البحث..." : gpsStatus === "error" ? "تعذّر تحديد الموقع" : "متوقف"}
              </p>
            </div>
            <Navigation size={20} className={tracking ? "text-orange-500" : "text-gray-600"} />
          </div>
          {tracking && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 rounded-xl p-2.5">
              <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1, repeat: Infinity }}>
                <div className="w-2 h-2 bg-orange-500 rounded-full" />
              </motion.div>
              <span className="text-orange-400 text-xs">موقعك يُرسل كل 5 ثواني</span>
            </motion.div>
          )}
        </div>

        {/* Push Notifications Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <motion.button whileTap={{ scale: 0.95 }} onClick={handlePushToggle}
              disabled={pushLoading || pushStatus === "unsupported" || pushStatus === "denied" || pushStatus === "loading"}
              className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50 ${
                pushStatus === "subscribed" ? "bg-red-500/20 border border-red-500/40 text-red-400"
                : pushStatus === "denied" || pushStatus === "unsupported" ? "bg-gray-800 border border-gray-700 text-gray-500"
                : "bg-green-500/20 border border-green-500/40 text-green-400"}`}>
              {pushLoading
                ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="inline-block"><Loader size={14} /></motion.div>
                : pushStatus === "subscribed" ? "إيقاف" : "تفعيل"}
            </motion.button>
            <div className="text-right">
              <p className="text-gray-300 text-sm font-bold">إشعارات خارج التطبيق</p>
              <p className={`text-xs mt-0.5 ${pushStatus === "subscribed" ? "text-green-400" : pushStatus === "denied" ? "text-red-400" : pushStatus === "unsupported" ? "text-gray-600" : "text-gray-500"}`}>
                {pushStatus === "subscribed" ? "نشط — ستصلك إشعارات حتى لو التطبيق مغلق"
                 : pushStatus === "denied" ? "مرفوض — اسمح من إعدادات المتصفح"
                 : pushStatus === "unsupported" ? "غير مدعوم في هذا المتصفح"
                 : pushStatus === "loading" ? "جاري الفحص..." : "متوقف"}
              </p>
            </div>
            {pushStatus === "subscribed" ? <BellRing size={20} className="text-green-500" /> : <BellOff size={20} className="text-gray-600" />}
          </div>
          {pushStatus === "subscribed" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="mt-3 flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-xl p-2.5">
              <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.5, repeat: Infinity }}>
                <div className="w-2 h-2 bg-green-400 rounded-full" />
              </motion.div>
              <span className="text-green-400 text-xs">تلقّى إشعارات: موافقة حساب، رحلات، XP</span>
            </motion.div>
          )}
        </div>

        {/* Settings */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          {[{ icon: <Settings size={16} />, label: "إعدادات الحساب" }, { icon: <Bell size={16} />, label: "الإشعارات" }, { icon: <Star size={16} />, label: "الرحلات المفضلة" }].map((item, i, arr) => (
            <motion.button key={i} whileTap={{ scale: 0.98 }}
              className={`w-full flex items-center gap-3 px-4 py-4 text-right ${i < arr.length - 1 ? "border-b border-gray-800" : ""} hover:bg-gray-800/50 transition-colors`}>
              <ChevronRight size={16} className="text-gray-700" />
              <span className="flex-1 text-gray-300 text-sm">{item.label}</span>
              <span className="text-orange-500">{item.icon}</span>
            </motion.button>
          ))}
        </div>
        {profile?.role === "admin" && (
          <motion.button whileTap={{ scale: 0.97 }}
            onClick={() => window.location.href = "/admin"}
            className="w-full bg-orange-500/20 border border-orange-500/40 text-orange-400 font-bold py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-orange-500/30 transition-all">
            <Crown size={16} />
            لوحة الأدمن 👑
          </motion.button>
        )}
        <motion.button whileTap={{ scale: 0.97 }} onClick={onSignOut}
          className="w-full bg-red-900/30 border border-red-800 text-red-400 font-bold py-4 rounded-2xl flex items-center justify-center gap-2">
          <LogOut size={16} />تسجيل الخروج
        </motion.button>
      </div>
    </motion.div>
  );
}

/* ════════════════════════════════════════
   ADMIN PANEL — مدمج في نفس الملف
════════════════════════════════════════ */
function AdminPanel({ session, onSignOut }) {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [actionId, setActionId] = useState(null);
  const [toast, setToast] = useState(null);
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, banned: 0 });
  const [codes, setCodes] = useState([]);
  const [codesTab, setCodesTab] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [adminProfile, setAdminProfile] = useState(null);
  const [pendingRides, setPendingRides] = useState([]);
  const [showRides, setShowRides] = useState(false);
  const [allRides, setAllRides] = useState([]);
  const [showAllRides, setShowAllRides] = useState(false);
  const [showMenu, setShowMenu] = useState(false);


  useEffect(() => {
    if (session) {
      supabase.from("profiles").select("*").eq("id", session.user.id).single()
        .then(({ data }) => setAdminProfile(data));
      fetchAll();
    } else setLoading(false);
  }, [session]);

  const fetchAll = async () => {
    setLoading(true);
    const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
    if (data) {
      setProfiles(data);
      setStats({ total: data.length, pending: data.filter(p => p.status === "pending").length, approved: data.filter(p => p.status === "approved").length, banned: data.filter(p => p.status === "banned").length });
    }
    // جلب الرحلات غير المعتمدة
    const { data: ridesData } = await supabase
      .from("rides")
      .select("*")
      .order("created_at", { ascending: false });
    if (ridesData) {
      setPendingRides(ridesData.filter(r => !r.approved && !r.rejected));
      setAllRides(ridesData.filter(r => r.approved || r.rejected));
    }
    const { data: codesData } = await supabase.from("invite_codes").select("*").order("created_at", { ascending: false });
    if (codesData) setCodes(codesData);
    setLoading(false);
  };



  const generateCode = async () => {
    setGenerating(true);
    const code = "MOTO" + Math.random().toString(36).substring(2, 7).toUpperCase();
    await supabase.from("invite_codes").insert({
      code,
      created_by: session.user.id,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
    await fetchAll();
    showToast(`🎟️ تم إنشاء كود: ${code}`, "success");
    setGenerating(false);
  };

  const approveRide = async (ride, approve) => {
    await supabase.from("rides")
      .update({ approved: approve, rejected: !approve })
      .eq("id", ride.id);
    const notifTitle = approve ? "✅ تمت الموافقة على رحلتك!" : "❌ تم رفض رحلتك";
    const notifBody = approve ? `تمت الموافقة على رحلة "${ride.name}"!` : `تم رفض رحلة "${ride.name}" من قبل المسؤول.`;
    await supabase.from("notifications").insert({
      user_id: ride.leader_id, title: notifTitle, body: notifBody,
      type: approve ? "approval" : "rejection",
    });
    await sendPushToUser({ userId: ride.leader_id, title: notifTitle, message: notifBody, tag: "ride-approval" });
    showToast(approve ? `✅ ${ride.name}` : `❌ ${ride.name}`, approve ? "success" : "error");
    await fetchAll();
  };

  const deleteRide = async (id) => {
    await supabase.from("ride_members").delete().eq("ride_id", id);
    await supabase.from("ride_messages").delete().eq("ride_id", id);
    await supabase.from("rides").delete().eq("id", id);
    showToast("🗑️ تم حذف الرحلة", "info");
    await fetchAll();
  };

  const deleteCode = async (id) => {
    await supabase.from("invite_codes").delete().eq("id", id);
    setCodes(prev => prev.filter(c => c.id !== id));
    showToast("🗑️ تم حذف الكود", "info");
  };

  const updateStatus = async (id, newStatus, name) => {
    setActionId(id);
    const oldStatus = profiles.find(p => p.id === id)?.status;
    await supabase.from("profiles").update({ status: newStatus }).eq("id", id);

    // إرسال إشعار + Push للمستخدم
    if (newStatus === "approved") {
      await supabase.from("notifications").insert({
        user_id: id, title: "✅ تمت الموافقة على حسابك!",
        body: "مرحباً! تم قبول حسابك في MotoRiders. يمكنك الآن الوصول للخريطة.",
        type: "approval",
      });
      await sendPushToUser({ userId: id, title: "✅ تمت الموافقة على حسابك!", message: "مرحباً! تم قبول حسابك في MotoRiders. يمكنك الآن الوصول للخريطة.", tag: "account-approval" });
    } else if (newStatus === "banned") {
      await supabase.from("notifications").insert({
        user_id: id, title: "🚫 تم تعليق حسابك",
        body: "تم تعليق حسابك من قبل المسؤول. تواصل معنا للمزيد.",
        type: "rejection",
      });
      await sendPushToUser({ userId: id, title: "🚫 تم تعليق حسابك", message: "تم تعليق حسابك من قبل المسؤول. تواصل معنا للمزيد.", tag: "account-banned" });
    }

    setProfiles(prev => prev.map(p => p.id === id ? { ...p, status: newStatus } : p));
    setStats(prev => ({ ...prev, [oldStatus]: Math.max(0, prev[oldStatus] - 1), [newStatus]: prev[newStatus] + 1 }));
    showToast(newStatus === "approved" ? `✅ تمت الموافقة على ${name}` : newStatus === "banned" ? `🚫 تم حظر ${name}` : `⏳ تم إرجاع ${name}`, newStatus === "approved" ? "success" : newStatus === "banned" ? "error" : "info");
    setActionId(null);
  };

  const showToast = (msg, type) => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  const isAdmin = adminProfile?.role === "admin" || adminProfile?.role === "moderator";
  const filtered = profiles.filter(p => (filter === "all" || p.status === filter) && (p.full_name?.toLowerCase().includes(search.toLowerCase()) || p.bike_type?.toLowerCase().includes(search.toLowerCase())));

  if (!session) return (
    <div className="h-[100dvh] bg-gray-950 flex items-center justify-center p-4">
      <div className="text-center">
        <Shield size={48} className="text-orange-500 mx-auto mb-4" />
        <h1 className="text-white font-black text-2xl mb-2">لوحة الأدمن</h1>
        <p className="text-gray-500 mb-6">يجب تسجيل الدخول أولاً</p>
        <a href="/" className="bg-orange-500 text-white font-bold px-6 py-3 rounded-2xl inline-block">الذهاب للتطبيق</a>
      </div>
    </div>
  );

  if (!isAdmin && adminProfile) return (
    <div className="h-[100dvh] bg-gray-950 flex items-center justify-center p-4">
      <div className="text-center">
        <XCircle size={48} className="text-red-500 mx-auto mb-4" />
        <h1 className="text-white font-black text-2xl mb-2">غير مصرح</h1>
        <p className="text-gray-500 mb-4">أنت لست أدمن</p>
        <a href="/" className="text-orange-500 text-sm">← العودة للتطبيق</a>
      </div>
    </div>
  );

  return (
    <div className="h-[100dvh] bg-gray-950 text-white flex flex-col overflow-hidden" dir="rtl">
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -40 }}
            className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl font-bold text-sm shadow-xl ${toast.type === "success" ? "bg-green-600" : toast.type === "error" ? "bg-red-600" : "bg-orange-500"}`}>
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between shrink-0"
        style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}>

        {/* Burger Menu Button */}
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => setShowMenu(!showMenu)}
          className="w-9 h-9 bg-gray-800 border border-gray-700 rounded-xl flex items-center justify-center relative">
          <motion.div animate={{ rotate: showMenu ? 45 : 0 }} transition={{ duration: 0.2 }}>
            {showMenu ? <XCircle size={18} className="text-orange-400" /> : <Settings size={18} className="text-gray-400" />}
          </motion.div>
          {pendingRides.length > 0 && !showMenu && (
            <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1, repeat: Infinity }}
              className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
              <span className="text-white text-[9px] font-black">{pendingRides.length}</span>
            </motion.div>
          )}
        </motion.button>

        {/* Title */}
        <div className="flex items-center gap-2">
          <div className="text-right">
            <p className="text-base font-black">MOTO<span className="text-orange-500">RIDERS</span></p>
            <p className="text-gray-500 text-xs">لوحة الأدمن</p>
          </div>
          <div className="w-9 h-9 bg-orange-500/20 border border-orange-500/40 rounded-xl flex items-center justify-center">
            <Crown size={18} className="text-orange-500" />
          </div>
        </div>
      </div>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {showMenu && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ type: "spring", bounce: 0.3, duration: 0.3 }}
              className="absolute left-3 z-50 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden min-w-[200px]"
              style={{ top: "70px" }}>
              {[
                { icon: "🔄", label: "تحديث البيانات", onClick: () => { fetchAll(); setShowMenu(false); } },
                { icon: "🏍️", label: "رحلات الانتظار", badge: pendingRides.length, onClick: () => { setShowRides(!showRides); setShowMenu(false); } },
                { icon: "📋", label: "كل الرحلات", onClick: () => { setShowAllRides(!showAllRides); setShowMenu(false); } },
                { icon: "🎟️", label: "كودات الدعوة", onClick: () => { setCodesTab(!codesTab); setShowMenu(false); } },
                { icon: "←", label: "رجوع للتطبيق", onClick: () => window.location.href = "/", danger: false, back: true },
              ].map((item, i) => (
                <motion.button key={i} whileTap={{ scale: 0.97 }} onClick={item.onClick}
                  className={`w-full flex items-center justify-between px-4 py-3.5 text-right border-b border-gray-800 last:border-0 hover:bg-gray-800/50 transition-colors ${item.back ? "text-orange-400" : "text-gray-200"}`}>
                  <div className="flex items-center gap-2">
                    {item.badge > 0 && (
                      <span className="bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">
                        {item.badge}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{item.label}</span>
                    <span className="text-lg">{item.icon}</span>
                  </div>
                </motion.button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="p-4 space-y-4 max-w-2xl mx-auto">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: "الكل", value: stats.total, color: "blue", key: "all", Icon: Users },
              { label: "انتظار", value: stats.pending, color: "yellow", key: "pending", Icon: Clock },
              { label: "معتمد", value: stats.approved, color: "green", key: "approved", Icon: UserCheck },
              { label: "محظور", value: stats.banned, color: "red", key: "banned", Icon: UserX },
            ].map(s => {
              const colors = { blue: "border-blue-500/30 bg-blue-500/10 text-blue-400", yellow: "border-yellow-500/30 bg-yellow-500/10 text-yellow-400", green: "border-green-500/30 bg-green-500/10 text-green-400", red: "border-red-500/30 bg-red-500/10 text-red-400" };
              return (
                <motion.button key={s.key} whileTap={{ scale: 0.93 }} onClick={() => setFilter(s.key)}
                  className={`p-2.5 rounded-2xl border text-center transition-all ${colors[s.color]} ${filter === s.key ? "ring-2 ring-orange-500" : ""}`}>
                  <s.Icon size={18} className="mx-auto mb-1" />
                  <p className="font-black text-lg leading-none">{s.value}</p>
                  <p className="text-[10px] opacity-70 mt-0.5">{s.label}</p>
                </motion.button>
              );
            })}
          </div>

          {/* Search */}
          <div className="relative">
            <Search size={15} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث..."
              className="w-full bg-gray-900 border border-gray-800 text-white placeholder-gray-600 rounded-2xl py-3 pr-11 pl-4 text-sm focus:border-orange-500 focus:outline-none" />
          </div>

          {/* Rides Section */}
          {showRides && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-3">
              <p className="text-white font-bold text-right">رحلات بانتظار الموافقة</p>
              {pendingRides.length === 0 ? (
                <p className="text-gray-600 text-sm text-center py-4">لا توجد رحلات بانتظار الموافقة</p>
              ) : pendingRides.map(ride => (
                <div key={ride.id} className="bg-gray-800 rounded-xl p-3">
                  <div className="text-right mb-2">
                    <p className="text-white font-bold text-sm">{ride.name}</p>
                    <p className="text-gray-400 text-xs">بقيادة {ride.leader_name}</p>
                    {ride.start_location_name && <p className="text-orange-400 text-xs">📍 {ride.start_location_name}</p>}
                    {ride.start_date && <p className="text-blue-400 text-xs">🗓️ {new Date(ride.start_date).toLocaleDateString("ar")} {ride.start_time ? `⏰ ${ride.start_time.slice(0, 5)}` : ""}</p>}
                  </div>
                  <div className="flex gap-2">
                    <motion.button whileTap={{ scale: 0.95 }} onClick={() => approveRide(ride, false)}
                      className="flex-1 bg-red-500/20 border border-red-500/40 text-red-400 font-bold py-2 rounded-xl text-xs">
                      ❌ رفض
                    </motion.button>
                    <motion.button whileTap={{ scale: 0.95 }} onClick={() => approveRide(ride, true)}
                      className="flex-1 bg-green-500/20 border border-green-500/40 text-green-400 font-bold py-2 rounded-xl text-xs">
                      ✅ موافقة
                    </motion.button>
                  </div>
                </div>
              ))}
            </div>
          )}


          {/* All Rides Section */}
          {showAllRides && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-3">
              <p className="text-white font-bold text-right">كل الرحلات ({allRides.length})</p>
              {allRides.length === 0 ? (
                <p className="text-gray-600 text-sm text-center py-4">لا توجد رحلات</p>
              ) : allRides.map(ride => (
                <div key={ride.id} className="bg-gray-800 rounded-xl p-3">
                  <div className="flex items-start justify-between mb-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${ride.approved ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                      {ride.approved ? "✅ مقبولة" : "❌ مرفوضة"}
                    </span>
                    <div className="text-right">
                      <p className="text-white font-bold text-sm">{ride.name}</p>
                      <p className="text-gray-400 text-xs">بقيادة {ride.leader_name}</p>
                      {ride.start_location_name && <p className="text-orange-400 text-xs">📍 {ride.start_location_name}</p>}
                      {ride.start_date && <p className="text-blue-400 text-xs">🗓️ {new Date(ride.start_date).toLocaleDateString("ar")} {ride.start_time ? `⏰ ${ride.start_time.slice(0, 5)}` : ""}</p>}
                    </div>
                  </div>
                  <motion.button whileTap={{ scale: 0.95 }} onClick={() => deleteRide(ride.id)}
                    className="w-full bg-red-500/20 border border-red-500/40 text-red-400 font-bold py-2 rounded-xl text-xs">
                    🗑️ حذف الرحلة
                  </motion.button>
                </div>
              ))}
            </div>
          )}


          {/* Codes Section */}
          {codesTab && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <motion.button whileTap={{ scale: 0.95 }} onClick={generateCode} disabled={generating}
                  className="bg-orange-500 text-white text-sm font-bold px-4 py-2 rounded-xl flex items-center gap-2 disabled:opacity-60 shadow-lg shadow-orange-500/30">
                  {generating
                    ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}><Loader size={14} /></motion.div>
                    : "+"} توليد كود
                </motion.button>
                <p className="text-white font-bold text-right">كودات الدعوة</p>
              </div>
              {codes.length === 0 ? (
                <p className="text-gray-600 text-sm text-center py-4">لا توجد كودات بعد</p>
              ) : (
                <div className="space-y-2">
                  {codes.map(c => (
                    <div key={c.id} className="flex items-center gap-3 bg-gray-800 rounded-xl p-3">
                      <motion.button whileTap={{ scale: 0.9 }} onClick={() => deleteCode(c.id)}
                        className="w-8 h-8 bg-red-500/20 border border-red-500/40 rounded-lg flex items-center justify-center shrink-0">
                        <XCircle size={14} className="text-red-400" />
                      </motion.button>
                      <div className="flex-1 text-right">
                        <p className={`font-black text-sm tracking-widest ${c.is_used ? "text-gray-600 line-through" : "text-orange-400"}`}>
                          {c.code}
                        </p>
                        <p className="text-gray-600 text-xs">
                          {c.is_used ? "مستخدم ✓" : `ينتهي ${new Date(c.expires_at).toLocaleDateString("ar")}`}
                        </p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full font-bold ${c.is_used ? "bg-gray-700 text-gray-500" : "bg-green-500/20 text-green-400 border border-green-500/30"}`}>
                        {c.is_used ? "مستخدم" : "متاح"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* List */}
          {loading ? (
            <div className="text-center py-16">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}><RefreshCw size={30} className="text-orange-500 mx-auto" /></motion.div>
              <p className="text-gray-500 mt-3 text-sm">جاري التحميل...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-600"><Users size={36} className="mx-auto mb-3 opacity-30" /><p>لا يوجد مستخدمون</p></div>
          ) : (
            <div className="space-y-3">
              {filtered.map((p, i) => (
                <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                  className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                  <div className="flex items-center gap-3">
                    {/* Actions */}
                    <div className="flex flex-col gap-1.5 shrink-0">
                      {p.status !== "approved" && (
                        <motion.button whileTap={{ scale: 0.88 }} disabled={actionId === p.id}
                          onClick={() => updateStatus(p.id, "approved", p.full_name)}
                          className="w-9 h-9 bg-green-500/20 border border-green-500/40 rounded-xl flex items-center justify-center hover:bg-green-500/40 transition-all disabled:opacity-50">
                          {actionId === p.id ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}><Loader size={13} className="text-green-400" /></motion.div>
                            : <CheckCircle size={15} className="text-green-400" />}
                        </motion.button>
                      )}
                      {p.status !== "banned" && (
                        <motion.button whileTap={{ scale: 0.88 }} disabled={actionId === p.id}
                          onClick={() => updateStatus(p.id, "banned", p.full_name)}
                          className="w-9 h-9 bg-red-500/20 border border-red-500/40 rounded-xl flex items-center justify-center hover:bg-red-500/40 transition-all disabled:opacity-50">
                          <Ban size={15} className="text-red-400" />
                        </motion.button>
                      )}
                      {p.status !== "pending" && (
                        <motion.button whileTap={{ scale: 0.88 }} disabled={actionId === p.id}
                          onClick={() => updateStatus(p.id, "pending", p.full_name)}
                          className="w-9 h-9 bg-yellow-500/20 border border-yellow-500/40 rounded-xl flex items-center justify-center hover:bg-yellow-500/40 transition-all disabled:opacity-50">
                          <Clock size={15} className="text-yellow-400" />
                        </motion.button>
                      )}
                    </div>
                    {/* Info */}
                    <div className="flex-1 text-right">
                      <div className="flex items-center justify-end gap-2 mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-bold ${p.status === "approved" ? "bg-green-500/20 text-green-400 border-green-500/30" : p.status === "banned" ? "bg-red-500/20 text-red-400 border-red-500/30" : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"}`}>
                          {p.status === "approved" ? "معتمد" : p.status === "banned" ? "محظور" : "انتظار"}
                        </span>
                        <h3 className="font-bold text-white text-sm">{p.full_name}</h3>
                      </div>
                      <p className="text-orange-400 text-xs">{p.bike_type}</p>
                      <p className="text-gray-600 text-xs mt-0.5">
                        {p.role === "admin" ? "👑 أدمن" : "مستخدم"} • {new Date(p.created_at).toLocaleDateString("ar")}
                      </p>
                    </div>
                    <div className="w-11 h-11 bg-gray-800 border border-gray-700 rounded-2xl flex items-center justify-center text-xl shrink-0">🏍️</div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}