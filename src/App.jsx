import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Map, Users, MessageCircle, Shield, User, LogOut, Bike,
  Clock, Navigation, CheckCircle, XCircle, Bell,
  Settings, ChevronRight, Star, Wifi, WifiOff, Eye, EyeOff,
  Lock, Mail, Hash, ArrowRight, Loader, Ban, RefreshCw,
  UserCheck, UserX, Crown, Search
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
 
/* ─── SUPABASE — ضع بياناتك هنا ─── */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://hygfxmdsadiityhgifsz.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5Z2Z4bWRzYWRpaXR5aGdpZnN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMzY2MzUsImV4cCI6MjA5NDcxMjYzNX0.7tRlIaDyfgjZR4kJNHdIvfrcIwf-_cr5BQWjF3v7xgg";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
 
const VALID_INVITE_CODES = ["MOTO2024", "RIDER001", "SPEED99", "BIKER42"];
 
const MOCK_RIDERS = [
  { id: "m1", full_name: "أحمد السريع", bike_type: "Yamaha R1", speed: 120, current_speed: 120, lat: 24.688, lng: 46.722, status: "online" },
  { id: "m2", full_name: "محمد الصقر", bike_type: "Kawasaki Z900", speed: 95, current_speed: 95, lat: 24.695, lng: 46.730, status: "online" },
  { id: "m3", full_name: "خالد البرق", bike_type: "Honda CBR", speed: 0, current_speed: 0, lat: 24.680, lng: 46.715, status: "offline" },
];
 
/* ─── Leaflet marker icon ─── */
const createRiderIcon = (name, speed, isOnline) => {
  const glowColor = isOnline ? "#f97316" : "#6b7280";
  const ringColor = isOnline ? "#f97316" : "#4b5563";
  return L.divIcon({
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;gap:3px;">
        <div style="position:relative;width:50px;height:50px;border-radius:50%;
          background:${isOnline ? "conic-gradient(#f97316,#fb923c,#f97316)" : "conic-gradient(#4b5563,#6b7280,#4b5563)"};
          padding:3px;box-shadow:0 0 ${isOnline ? "16px 3px" : "0px"} ${glowColor}88;">
          <div style="width:100%;height:100%;border-radius:50%;background:#111;
            display:flex;align-items:center;justify-content:center;">
            <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24"
              fill="none" stroke="${glowColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
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
      </div>`,
    iconSize: [60, 88],
    iconAnchor: [30, 88],
    popupAnchor: [0, -90],
    className: "",
  });
};
 
/* ─── GPS Hook ─── */
function useGPS(profileId, stealth) {
  const [loc, setLoc] = useState(null);
  const [speed, setSpeed] = useState(0);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);
  const watchRef = useRef(null);
  const intervalRef = useRef(null);
  const lastRef = useRef(null);
 
  const upload = useCallback(async (lat, lng, spd) => {
    if (!profileId || stealth) return;
    await supabase.from("locations").upsert(
      { profile_id: profileId, lat, lng, speed: Math.round(spd * 3.6), updated_at: new Date().toISOString() },
      { onConflict: "profile_id" }
    );
  }, [profileId, stealth]);
 
  const start = useCallback(() => {
    if (!navigator.geolocation) { setError("GPS غير مدعوم"); setStatus("error"); return; }
    setStatus("searching");
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng, speed: spd } = pos.coords;
        const kmh = spd ? Math.round(spd * 3.6) : 0;
        setLoc({ lat, lng }); setSpeed(kmh); setStatus("active"); setError(null);
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
    }, 5000);
  }, [upload]);
 
const stop = useCallback(async () => {
  if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current);
  if (intervalRef.current) clearInterval(intervalRef.current);
  setStatus("idle");
  // احذف الموقع نهائياً عند الإيقاف
  if (profileId) {
    await supabase.from("locations")
      .delete()
      .eq("profile_id", profileId);
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
 
  return { loc, speed, status, error, start, stop };
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
        if (!VALID_INVITE_CODES.includes(code.toUpperCase())) throw new Error("كود الدعوة غير صحيح!");
        if (!name || !bike) throw new Error("يرجى تعبئة جميع الحقول");
        const { data, error } = await supabase.auth.signUp({ email, password: pass });
        if (error) throw new Error(error.message);
        if (data.user) {
          await supabase.from("profiles").insert({
            id: data.user.id, full_name: name, bike_type: bike,
            status: "pending", role: "user", invite_code_used: code.toUpperCase(),
          });
        }
        setSuccess("تم التسجيل! حسابك قيد المراجعة."); setTimeout(() => setMode("login"), 3000);
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
  const { loc, speed, status: gpsStatus, error: gpsError, start, stop } = useGPS(profile?.id, stealth);
 
  useEffect(() => {
const load = async () => {
  const { data } = await supabase
    .from("approved_riders_with_location")
    .select("*")
    .neq("id", profile.id);
      if (data?.length) {
        setRiders(data.map(r => ({
          ...r, lat: r.locations?.[0]?.lat, lng: r.locations?.[0]?.lng,
          current_speed: r.locations?.[0]?.speed || 0,
          status: r.locations?.[0]?.lat ? "online" : "offline"
        })));
      } else setRiders(MOCK_RIDERS);
    };
    load();
  }, [profile.id]);
 
  useEffect(() => {
    const ch = supabase.channel("rt-locations")
      .on("postgres_changes", { event: "*", schema: "public", table: "locations" }, ({ new: n }) => {
        setRiders(prev => prev.map(r => r.id === n.profile_id
          ? { ...r, lat: n.lat, lng: n.lng, current_speed: n.speed, status: "online" } : r));
      })
      .subscribe(s => setConnected(s === "SUBSCRIBED"));
    return () => supabase.removeChannel(ch);
  }, []);
 
  const toggleGPS = () => {
    if (tracking) { stop(); setTracking(false); }
    else { start(); setTracking(true); }
  };
 
  const tabs = [
    { id: "map", icon: Map, label: "الخريطة" },
    { id: "riders", icon: Users, label: "سائقون" },
    { id: "chat", icon: MessageCircle, label: "دردشة" },
    { id: "groups", icon: Shield, label: "مجموعات" },
    { id: "profile", icon: User, label: "بروفايل" },
  ];
 
  return (
    <div className="h-[100dvh] bg-gray-950 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-gray-950/98 border-b border-gray-800/50 px-4 py-3 flex items-center justify-between shrink-0 safe-top">
        <div className="flex items-center gap-1.5">
          {connected
            ? <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.5, repeat: Infinity }}><Wifi size={13} className="text-green-500" /></motion.div>
            : <WifiOff size={13} className="text-gray-600" />}
          <span className="text-xs text-gray-500">{connected ? "مباشر" : "غير متصل"}</span>
        </div>
        <span className="text-orange-500 font-black text-lg tracking-widest">MOTO<span className="text-white">RIDERS</span></span>
        <div className={`flex items-center gap-1 px-2 py-1 rounded-xl text-xs font-bold ${
          gpsStatus === "active" ? "bg-green-500/20 text-green-400" :
          gpsStatus === "searching" ? "bg-yellow-500/20 text-yellow-400" :
          gpsStatus === "error" ? "bg-red-500/20 text-red-400" : "bg-gray-800 text-gray-500"}`}>
          {gpsStatus === "searching" && <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}><Loader size={10} /></motion.div>}
          {gpsStatus === "active" && <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1, repeat: Infinity }}><div className="w-1.5 h-1.5 bg-green-400 rounded-full" /></motion.div>}
          <Navigation size={11} />
          <span>{gpsStatus === "active" ? `${speed}` : gpsStatus === "searching" ? "..." : gpsStatus === "error" ? "!" : "GPS"}</span>
        </div>
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
 
      {/* Content */}
      <div className="flex-1 overflow-hidden relative min-h-0">
        <AnimatePresence mode="wait">
          {activeTab === "map" && <MapTab key="map" riders={riders} profile={profile} loc={loc} speed={speed} gpsStatus={gpsStatus} tracking={tracking} stealth={stealth} setStealth={setStealth} toggleGPS={toggleGPS} />}
          {activeTab === "riders" && <RidersTab key="riders" riders={riders} />}
          {activeTab === "chat" && <ChatTab key="chat" profile={profile} />}
          {activeTab === "groups" && <GroupsTab key="groups" />}
          {activeTab === "profile" && <ProfileTab key="profile" profile={profile} speed={speed} gpsStatus={gpsStatus} tracking={tracking} toggleGPS={toggleGPS} onSignOut={onSignOut} />}
        </AnimatePresence>
      </div>
 
      {/* Bottom Nav */}
      <div className="bg-gray-950/98 border-t border-gray-800/50 shrink-0 safe-bottom">
        <div className="flex items-center justify-around px-2 pt-2 pb-3 max-w-lg mx-auto">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <motion.button key={tab.id} whileTap={{ scale: 0.82 }} onClick={() => setActiveTab(tab.id)}
                className="flex flex-col items-center gap-1 py-1.5 px-3 relative min-w-[56px]">
                {active && <motion.div layoutId="nav-bg" className="absolute inset-0 bg-orange-500/15 rounded-2xl" transition={{ type: "spring", bounce: 0.35 }} />}
                <Icon size={22} className={`relative z-10 transition-colors ${active ? "text-orange-500" : "text-gray-600"}`} />
                <span className={`text-[10px] relative z-10 font-medium ${active ? "text-orange-500" : "text-gray-600"}`}>{tab.label}</span>
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
 
/* ─── Map Tab ─── */
function MapCentre({ loc }) {
  const map = useMap();
  useEffect(() => { if (loc) map.setView([loc.lat, loc.lng], map.getZoom()); }, [loc, map]);
  return null;
}
 
function MapTab({ riders, profile, loc, speed, gpsStatus, tracking, stealth, setStealth, toggleGPS }) {
  const center = loc ? [loc.lat, loc.lng] : [24.688, 46.722];
  const [sos, setSos] = useState(false);
  const [selected, setSelected] = useState(null);
 
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0">
      {/* My card */}
      <div className="absolute top-3 right-3 z-[1000]">
        <div className="bg-gray-950/95 backdrop-blur border border-orange-500/40 rounded-2xl px-3 py-2 text-right shadow-xl">
          <p className="text-white font-bold text-sm">{profile?.full_name || "أنت"}</p>
          <p className="text-orange-500 font-black text-base">{speed} كم/س</p>
        </div>
      </div>
 
      {/* Online + stealth */}
      <div className="absolute top-3 left-3 z-[1000] flex flex-col gap-2">
        <div className="bg-gray-950/95 backdrop-blur border border-green-500/40 rounded-2xl px-3 py-2 flex items-center gap-2">
          <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.2, repeat: Infinity }}>
            <div className="w-2 h-2 bg-green-500 rounded-full" />
          </motion.div>
          <span className="text-green-400 text-xs font-bold">{riders.filter(r => r.status === "online").length} سائق</span>
        </div>
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => setStealth(!stealth)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-bold border ${stealth ? "bg-purple-500/30 border-purple-500/60 text-purple-300" : "bg-gray-950/95 border-gray-700 text-gray-300"}`}>
          {stealth ? <EyeOff size={13} /> : <Eye size={13} />}{stealth ? "مخفي" : "الخفاء"}
        </motion.button>
      </div>
 
      {/* GPS + zoom */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 z-[1000] flex flex-col gap-2">
        <motion.button whileTap={{ scale: 0.9 }} onClick={toggleGPS}
          className={`w-11 h-11 rounded-2xl flex items-center justify-center border shadow-lg transition-all ${tracking ? "bg-orange-500 border-orange-400 shadow-orange-500/40" : "bg-gray-900 border-gray-700"}`}>
          {gpsStatus === "searching"
            ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}><Loader size={17} className="text-orange-400" /></motion.div>
            : <Navigation size={17} className={tracking ? "text-white" : "text-gray-500"} />}
        </motion.button>
      </div>
 
      {/* Selected rider */}
      <AnimatePresence>
        {selected && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-20 left-3 right-3 z-[1000]">
            <div className="bg-gray-950/98 border border-orange-500/40 rounded-2xl p-4 flex items-center gap-3 backdrop-blur shadow-xl">
              <button onClick={() => setSelected(null)} className="text-gray-500 text-xl leading-none">✕</button>
              <div className="flex-1 text-right">
                <p className="text-white font-bold text-sm">{selected.full_name}</p>
                <p className="text-gray-500 text-xs">{selected.bike_type}</p>
              </div>
              <div className="text-center bg-orange-500/10 border border-orange-500/30 rounded-xl px-3 py-2">
                <p className="text-orange-500 font-black text-xl">{selected.current_speed || 0}</p>
                <p className="text-gray-600 text-xs">كم/س</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
 
      {/* SOS */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] flex flex-col items-center gap-1">
        <motion.button whileTap={{ scale: 0.88 }} onClick={() => { setSos(true); setTimeout(() => setSos(false), 5000); }}
          animate={sos ? { scale: [1, 1.12, 1] } : {}} transition={{ duration: 0.5, repeat: sos ? Infinity : 0 }}
          className={`w-16 h-16 rounded-full font-black text-white text-sm flex items-center justify-center ${sos ? "bg-red-600" : "bg-red-500"}`}
          style={{ boxShadow: "0 0 28px #ef444466, 0 4px 20px rgba(0,0,0,0.5)" }}>
          {sos ? "📡" : "SOS"}
        </motion.button>
        {sos && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-red-400 text-xs font-bold">جاري الإرسال...</motion.p>}
      </div>
 
      <MapContainer center={center} zoom={15} className="h-full w-full" style={{ background: "#111" }} zoomControl={false}>
        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution="© CARTO" />
        {loc && !stealth && <Marker position={[loc.lat, loc.lng]} icon={createRiderIcon(profile?.full_name || "أنت", speed, true)} />}
        {riders.filter(r => r.lat && r.lng).map(r => (
          <Marker key={r.id} position={[r.lat, r.lng]} icon={createRiderIcon(r.full_name, r.current_speed || 0, r.status === "online")}
            eventHandlers={{ click: () => setSelected(r) }} />
        ))}
        {loc && <MapCentre loc={loc} />}
      </MapContainer>
    </motion.div>
  );
}
 
/* ─── Riders Tab ─── */
function RidersTab({ riders }) {
  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
      className="absolute inset-0 overflow-y-auto p-4">
      <h2 className="text-white font-black text-lg mb-1 text-right">السائقون <span className="text-orange-500">المتصلون</span></h2>
      <p className="text-gray-500 text-xs mb-4 text-right">{riders.filter(r => r.status === "online").length} من {riders.length} متصل</p>
      <div className="space-y-3">
        {riders.map((r, i) => (
          <motion.div key={r.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
            className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex items-center gap-3">
            <div className="relative shrink-0">
              <div className="w-12 h-12 bg-gray-800 rounded-2xl flex items-center justify-center text-xl">🏍️</div>
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
 
/* ─── Chat Tab ─── */
const MOCK_MSGS = [
  { id: 1, sender: "أحمد", text: "الطريق واضح 🟢", time: "14:32", mine: false },
  { id: 2, sender: "محمد", text: "كاميرا على الحلقة! ⚠️", time: "14:35", mine: false },
  { id: 3, sender: "أنت", text: "شكراً 👍", time: "14:36", mine: true },
];
 
function ChatTab({ profile }) {
  const [msgs, setMsgs] = useState(MOCK_MSGS);
  const [input, setInput] = useState("");
  const bottomRef = useRef(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);
 
  const send = () => {
    if (!input.trim()) return;
    setMsgs(p => [...p, { id: Date.now(), sender: "أنت", text: input, time: new Date().toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" }), mine: true }]);
    setInput("");
  };
 
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex flex-col">
      <div className="px-4 py-3 border-b border-gray-800 shrink-0">
        <p className="text-white font-bold text-sm text-right">دردشة المجموعة</p>
        <p className="text-green-400 text-xs text-right">متصلون</p>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {msgs.map(m => (
          <div key={m.id} className={`flex gap-2 ${m.mine ? "flex-row-reverse" : "flex-row"}`}>
            <div className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center text-sm shrink-0 self-end">🏍️</div>
            <div className={`max-w-[75%] flex flex-col ${m.mine ? "items-end" : "items-start"}`}>
              {!m.mine && <p className="text-orange-400 text-xs mb-1 font-semibold">{m.sender}</p>}
              <div className={`px-4 py-2.5 rounded-2xl text-sm ${m.mine ? "bg-orange-500 text-white rounded-tr-sm" : "bg-gray-900 text-gray-200 border border-gray-800 rounded-tl-sm"}`}>{m.text}</div>
              <p className="text-gray-600 text-[10px] mt-1">{m.time}</p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="p-3 border-t border-gray-800 flex gap-2 shrink-0">
        <motion.button whileTap={{ scale: 0.9 }} onClick={send}
          className="w-12 h-12 bg-orange-500 rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-orange-500/40">
          <ArrowRight size={18} className="text-white rotate-180" />
        </motion.button>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()}
          placeholder="اكتب رسالة..." dir="rtl"
          className="flex-1 bg-gray-900 border border-gray-800 text-white placeholder-gray-600 rounded-2xl px-4 py-3 text-sm focus:border-orange-500 focus:outline-none" />
      </div>
    </motion.div>
  );
}
 
/* ─── Groups Tab ─── */
const MOCK_GROUPS = [
  { id: 1, name: "فريق الصقور", members: 8, ride: "جدة → مكة", icon: "🦅" },
  { id: 2, name: "دراجي الليل", members: 5, ride: "الرياض ring road", icon: "🌙" },
];
 
function GroupsTab() {
  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
      className="absolute inset-0 overflow-y-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <motion.button whileTap={{ scale: 0.95 }} className="bg-orange-500 text-white text-sm font-bold px-4 py-2 rounded-xl">+ مجموعة</motion.button>
        <h2 className="text-white font-black text-lg">المجموعات</h2>
      </div>
      <div className="space-y-3">
        {MOCK_GROUPS.map((g, i) => (
          <motion.div key={g.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
            className="bg-gray-900 border border-gray-800 hover:border-orange-500/40 rounded-2xl p-4 transition-all">
            <div className="flex items-center gap-3">
              <ChevronRight size={16} className="text-gray-700" />
              <div className="flex-1 text-right">
                <p className="text-white font-bold text-sm">{g.name}</p>
                <p className="text-gray-500 text-xs">{g.ride}</p>
                <p className="text-orange-400 text-xs mt-1">{g.members} أعضاء</p>
              </div>
              <div className="w-12 h-12 bg-gray-800 rounded-2xl flex items-center justify-center text-2xl">{g.icon}</div>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
 
/* ─── Profile Tab ─── */
function ProfileTab({ profile, speed, gpsStatus, tracking, toggleGPS, onSignOut }) {
  const stats = [
    { label: "أعلى سرعة", value: `${profile?.top_speed || 0}`, unit: "كم/س", icon: "⚡" },
    { label: "الرحلات", value: "0", unit: "رحلة", icon: "🗺️" },
    { label: "المسافة", value: "0", unit: "كم", icon: "📍" },
  ];
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 overflow-y-auto">
      <div className="relative bg-gradient-to-b from-orange-600/25 to-gray-950 pt-8 pb-6 px-4 text-center">
        <div className="w-20 h-20 bg-gray-800 border-4 border-orange-500 rounded-3xl flex items-center justify-center text-4xl mx-auto mb-3 shadow-xl shadow-orange-500/30">🏍️</div>
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
  const [adminProfile, setAdminProfile] = useState(null);
 
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
    setLoading(false);
  };
 
  const updateStatus = async (id, newStatus, name) => {
    setActionId(id);
    const oldStatus = profiles.find(p => p.id === id)?.status;
    await supabase.from("profiles").update({ status: newStatus }).eq("id", id);
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
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between shrink-0 safe-top">
        <div className="flex items-center gap-3">
          <button onClick={fetchAll} className="text-gray-400 hover:text-orange-400 transition-colors"><RefreshCw size={17} /></button>
          <button onClick={onSignOut} className="text-gray-500 hover:text-red-400 transition-colors flex items-center gap-1 text-xs"><LogOut size={14} />خروج</button>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right">
            <p className="text-base font-black">MOTO<span className="text-orange-500">RIDERS</span></p>
            <p className="text-gray-500 text-xs">لوحة الأدمن</p>
          </div>
          <div className="w-9 h-9 bg-orange-500/20 border border-orange-500/40 rounded-xl flex items-center justify-center"><Crown size={18} className="text-orange-500" /></div>
        </div>
      </div>
 
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