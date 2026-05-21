
// ═══════════════════════════════════════════════════════════════
// MOTORIDERS — ADMIN PANEL
// أضف هذا الملف كـ src/AdminPanel.jsx
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, CheckCircle, XCircle, Clock, Users, Bike,
  LogOut, RefreshCw, Crown, Ban, ChevronRight, Search,
  AlertTriangle, TrendingUp, UserCheck, UserX
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";

// ⚠️ ضع نفس بياناتك هنا
const SUPABASE_URL = "https://hygfxmdsadiityhgifsz.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5Z2Z4bWRzYWRpaXR5aGdpZnN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMzY2MzUsImV4cCI6MjA5NDcxMjYzNX0.7tRlIaDyfgjZR4kJNHdIvfrcIwf-_cr5BQWjF3v7xgg"; // ← نفس الكي في App.jsx
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ⚠️ ضع الإيميل الخاص بك هنا — هو الوحيد يقدر يدخل لوحة الأدمن


export default function AdminPanel() {
  const [session, setSession] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // all | pending | approved | banned
  const [search, setSearch] = useState("");
  const [actionLoading, setActionLoading] = useState(null);
  const [toast, setToast] = useState(null);
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, banned: 0 });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfiles();
      else setLoading(false);
    });
  }, []);

  const fetchProfiles = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) {
      setProfiles(data);
      setStats({
        total: data.length,
        pending: data.filter(p => p.status === "pending").length,
        approved: data.filter(p => p.status === "approved").length,
        banned: data.filter(p => p.status === "banned").length,
      });
    }
    setLoading(false);
  };

  const updateStatus = async (userId, newStatus, name) => {
    setActionLoading(userId);
    const { error } = await supabase
      .from("profiles")
      .update({ status: newStatus })
      .eq("id", userId);

    if (!error) {
      setProfiles(prev =>
        prev.map(p => p.id === userId ? { ...p, status: newStatus } : p)
      );
      setStats(prev => {
        const oldStatus = profiles.find(p => p.id === userId)?.status;
        return {
          ...prev,
          [oldStatus]: Math.max(0, prev[oldStatus] - 1),
          [newStatus]: prev[newStatus] + 1,
        };
      });
      showToast(
        newStatus === "approved"
          ? `✅ تمت الموافقة على ${name}`
          : newStatus === "banned"
            ? `🚫 تم حظر ${name}`
            : `⏳ تم إرجاع ${name} للانتظار`,
        newStatus === "approved" ? "success" : newStatus === "banned" ? "error" : "info"
      );
    }
    setActionLoading(null);
  };

  const showToast = (msg, type) => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const isAdmin = profile?.role === 'admin' || profile?.role === 'moderator';

  const filtered = profiles.filter(p => {
    const matchFilter = filter === "all" || p.status === filter;
    const matchSearch = p.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      p.bike_type?.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  // ── Not logged in ──
  if (!session) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="text-center">
          <Shield size={48} className="text-orange-500 mx-auto mb-4" />
          <h1 className="text-white font-black text-2xl mb-2">لوحة الأدمن</h1>
          <p className="text-gray-500 mb-6">يجب تسجيل الدخول أولاً من التطبيق الرئيسي</p>
          <a href="http://localhost:5173"
            className="bg-orange-500 text-white font-bold px-6 py-3 rounded-2xl inline-block">
            الذهاب للتطبيق
          </a>
        </div>
      </div>
    );
  }

  // ── Not admin ──
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="text-center">
          <AlertTriangle size={48} className="text-red-500 mx-auto mb-4" />
          <h1 className="text-white font-black text-2xl mb-2">غير مصرح</h1>
          <p className="text-gray-500">أنت لست أدمن</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white" dir="rtl">

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-2xl font-bold text-sm shadow-xl ${toast.type === "success" ? "bg-green-600" :
              toast.type === "error" ? "bg-red-600" : "bg-orange-500"
              }`}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={fetchProfiles}
            className="text-gray-400 hover:text-orange-400 transition-colors"
          >
            <RefreshCw size={18} />
          </button>

          <button onClick={() => setCodesTab(!codesTab)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${codesTab ? "bg-orange-500 text-white border-orange-400" : "bg-gray-800 text-gray-400 border-gray-700"}`}>
            🎟️ الكودات
          </button>
          <button
            onClick={() => supabase.auth.signOut().then(() => setSession(null))}
            className="text-gray-400 hover:text-red-400 transition-colors flex items-center gap-1 text-sm"
          >
            <LogOut size={16} />
            خروج
          </button>
        </div>
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-xl font-black text-right">
              MOTO<span className="text-orange-500">RIDERS</span>
            </h1>
            <p className="text-gray-500 text-xs text-right">لوحة تحكم الأدمن</p>
          </div>
          <div className="w-10 h-10 bg-orange-500/20 border border-orange-500/40 rounded-2xl flex items-center justify-center">
            <Crown size={20} className="text-orange-500" />
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-4">

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "الكل", value: stats.total, icon: Users, color: "blue", key: "all" },
            { label: "انتظار", value: stats.pending, icon: Clock, color: "yellow", key: "pending" },
            { label: "معتمد", value: stats.approved, icon: UserCheck, color: "green", key: "approved" },
            { label: "محظور", value: stats.banned, icon: UserX, color: "red", key: "banned" },
          ].map((s) => {
            const Icon = s.icon;
            const colors = {
              blue: "border-blue-500/30 bg-blue-500/10 text-blue-400",
              yellow: "border-yellow-500/30 bg-yellow-500/10 text-yellow-400",
              green: "border-green-500/30 bg-green-500/10 text-green-400",
              red: "border-red-500/30 bg-red-500/10 text-red-400",
            };
            return (
              <motion.button
                key={s.key}
                whileTap={{ scale: 0.95 }}
                onClick={() => setFilter(s.key)}
                className={`p-3 rounded-2xl border text-center transition-all ${colors[s.color]} ${filter === s.key ? "ring-2 ring-orange-500" : ""
                  }`}
              >
                <Icon size={20} className="mx-auto mb-1" />
                <p className="font-black text-xl">{s.value}</p>
                <p className="text-xs opacity-70">{s.label}</p>
              </motion.button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث بالاسم أو نوع الدراجة..."
            className="w-full bg-gray-900 border border-gray-800 text-white placeholder-gray-600 rounded-2xl py-3 pr-11 pl-4 text-sm focus:border-orange-500 focus:outline-none"
          />
        </div>

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



        {/* Users List */}
        {loading ? (
          <div className="text-center py-12">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
              <RefreshCw size={32} className="text-orange-500 mx-auto" />
            </motion.div>
            <p className="text-gray-500 mt-3">جاري التحميل...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-600">
            <Users size={40} className="mx-auto mb-3 opacity-30" />
            <p>لا يوجد مستخدمون</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((profile, i) => (
              <motion.div
                key={profile.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-gray-900 border border-gray-800 rounded-2xl p-4"
              >
                <div className="flex items-center gap-3">
                  {/* Actions */}
                  <div className="flex flex-col gap-2 shrink-0">
                    {profile.status !== "approved" && (
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => updateStatus(profile.id, "approved", profile.full_name)}
                        disabled={actionLoading === profile.id}
                        className="w-9 h-9 bg-green-500/20 border border-green-500/40 rounded-xl flex items-center justify-center hover:bg-green-500/40 transition-all disabled:opacity-50"
                        title="موافقة"
                      >
                        {actionLoading === profile.id ? (
                          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                            <RefreshCw size={14} className="text-green-400" />
                          </motion.div>
                        ) : (
                          <CheckCircle size={16} className="text-green-400" />
                        )}
                      </motion.button>
                    )}
                    {profile.status !== "banned" && (
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => updateStatus(profile.id, "banned", profile.full_name)}
                        disabled={actionLoading === profile.id}
                        className="w-9 h-9 bg-red-500/20 border border-red-500/40 rounded-xl flex items-center justify-center hover:bg-red-500/40 transition-all disabled:opacity-50"
                        title="حظر"
                      >
                        <Ban size={16} className="text-red-400" />
                      </motion.button>
                    )}
                    {profile.status !== "pending" && (
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => updateStatus(profile.id, "pending", profile.full_name)}
                        disabled={actionLoading === profile.id}
                        className="w-9 h-9 bg-yellow-500/20 border border-yellow-500/40 rounded-xl flex items-center justify-center hover:bg-yellow-500/40 transition-all disabled:opacity-50"
                        title="إرجاع للانتظار"
                      >
                        <Clock size={16} className="text-yellow-400" />
                      </motion.button>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 text-right">
                    <div className="flex items-center justify-end gap-2 mb-1">
                      <StatusBadge status={profile.status} />
                      <h3 className="font-bold text-white">{profile.full_name}</h3>
                    </div>
                    <p className="text-orange-400 text-sm flex items-center justify-end gap-1">
                      <Bike size={13} />
                      {profile.bike_type}
                    </p>
                    <p className="text-gray-600 text-xs mt-1">
                      {profile.invite_code_used && `كود: ${profile.invite_code_used} • `}
                      {new Date(profile.created_at).toLocaleDateString("ar")}
                    </p>
                  </div>

                  {/* Avatar */}
                  <div className="w-12 h-12 bg-gray-800 border-2 border-gray-700 rounded-2xl flex items-center justify-center text-2xl shrink-0">
                    🏍️
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    pending: { label: "انتظار", class: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
    approved: { label: "معتمد", class: "bg-green-500/20 text-green-400 border-green-500/30" },
    banned: { label: "محظور", class: "bg-red-500/20 text-red-400 border-red-500/30" },
  };
  const s = map[status] || map.pending;
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-bold ${s.class}`}>
      {s.label}
    </span>
  );
}