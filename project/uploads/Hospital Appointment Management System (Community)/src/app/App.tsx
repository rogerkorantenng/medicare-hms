import { useState, useEffect } from "react";
import {
  Calendar, Clock, Bell, User, Settings, LogOut, Menu, X,
  ChevronRight, ChevronLeft, Search, Plus, Check, AlertCircle,
  BarChart2, Users, FileText, Stethoscope, Heart, Activity,
  Phone, Mail, MapPin, Star, TrendingUp, CheckCircle, XCircle,
  RefreshCw, Eye, Download, Send, Filter, MoreVertical,
  Home, ClipboardList, UserCheck, Pill, MessageSquare, Shield,
  ArrowRight, Zap, Lock, EyeOff, ChevronDown, Info, Printer
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from "recharts";

// ─── Types ───────────────────────────────────────────────────────────────────

type View =
  | "splash" | "onboarding" | "login" | "register" | "forgot"
  | "patient-dashboard" | "patient-book" | "patient-appointments"
  | "patient-notifications" | "patient-profile"
  | "doctor-dashboard" | "doctor-schedule" | "doctor-patients"
  | "admin-dashboard" | "admin-doctors" | "admin-patients" | "admin-reports";

type Role = "patient" | "doctor" | "admin";

interface User {
  name: string;
  email: string;
  role: Role;
  avatar: string;
  specialty?: string;
}

// ─── Mock Data ───────────────────────────────────────────────────────────────

const MOCK_APPOINTMENTS = [
  { id: 1, patient: "Sarah Johnson", doctor: "Dr. Michael Chen", specialty: "Cardiology", date: "2026-05-24", time: "09:00 AM", status: "confirmed", type: "Follow-up" },
  { id: 2, patient: "Robert Davis", doctor: "Dr. Emily Parker", specialty: "Neurology", date: "2026-05-24", time: "10:30 AM", status: "pending", type: "Consultation" },
  { id: 3, patient: "Maria Garcia", doctor: "Dr. James Wilson", specialty: "Orthopedics", date: "2026-05-24", time: "02:00 PM", status: "confirmed", type: "Check-up" },
  { id: 4, patient: "David Kim", doctor: "Dr. Lisa Thompson", specialty: "Dermatology", date: "2026-05-25", time: "11:00 AM", status: "cancelled", type: "Consultation" },
  { id: 5, patient: "Emma White", doctor: "Dr. Michael Chen", specialty: "Cardiology", date: "2026-05-25", time: "03:30 PM", status: "confirmed", type: "ECG Review" },
  { id: 6, patient: "James Brown", doctor: "Dr. Emily Parker", specialty: "Neurology", date: "2026-05-26", time: "09:30 AM", status: "pending", type: "MRI Review" },
];

const MOCK_DOCTORS = [
  { id: 1, name: "Dr. Michael Chen", specialty: "Cardiology", patients: 142, rating: 4.9, available: true, img: "photo-1612349317150-e413f6a5b16d" },
  { id: 2, name: "Dr. Emily Parker", specialty: "Neurology", patients: 98, rating: 4.8, available: true, img: "photo-1594824476967-48c8b964273f" },
  { id: 3, name: "Dr. James Wilson", specialty: "Orthopedics", patients: 115, rating: 4.7, available: false, img: "photo-1622253692010-333f2da6031d" },
  { id: 4, name: "Dr. Lisa Thompson", specialty: "Dermatology", patients: 87, rating: 4.9, available: true, img: "photo-1559839734-2b71ea197ec2" },
  { id: 5, name: "Dr. Kevin Patel", specialty: "Pediatrics", patients: 203, rating: 4.8, available: true, img: "photo-1537368910025-700350fe46c7" },
  { id: 6, name: "Dr. Rachel Kim", specialty: "Oncology", patients: 64, rating: 4.9, available: false, img: "photo-1527613426441-4da17471b66d" },
];

const CHART_DATA = [
  { month: "Jan", appointments: 65, patients: 48 },
  { month: "Feb", appointments: 78, patients: 55 },
  { month: "Mar", appointments: 90, patients: 70 },
  { month: "Apr", appointments: 81, patients: 63 },
  { month: "May", appointments: 112, patients: 89 },
];

const STATUS_COLORS: Record<string, string> = {
  confirmed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  cancelled: "bg-red-50 text-red-600 border-red-200",
  completed: "bg-blue-50 text-blue-700 border-blue-200",
};

const PIE_DATA = [
  { name: "Cardiology", value: 28, color: "#1D4ED8" },
  { name: "Neurology", value: 18, color: "#0EA5E9" },
  { name: "Orthopedics", value: 22, color: "#10B981" },
  { name: "Dermatology", value: 15, color: "#F59E0B" },
  { name: "Other", value: 17, color: "#8B5CF6" },
];

// ─── Shared Components ────────────────────────────────────────────────────────

function Badge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${STATUS_COLORS[status] ?? "bg-gray-100 text-gray-600 border-gray-200"}`}>
      {status === "confirmed" && <CheckCircle size={10} />}
      {status === "pending" && <Clock size={10} />}
      {status === "cancelled" && <XCircle size={10} />}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function StatCard({ icon: Icon, label, value, delta, color }: {
  icon: React.ElementType; label: string; value: string; delta?: string; color: string;
}) {
  return (
    <div className="bg-card rounded-2xl p-5 shadow-sm border border-border flex items-start justify-between">
      <div>
        <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider mb-1">{label}</p>
        <p className="text-2xl font-bold text-foreground font-display">{value}</p>
        {delta && <p className="text-xs text-emerald-600 font-medium mt-1 flex items-center gap-1"><TrendingUp size={10} />{delta}</p>}
      </div>
      <div className={`w-11 h-11 rounded-xl ${color} flex items-center justify-center`}>
        <Icon size={20} className="text-white" />
      </div>
    </div>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

const NAV_ITEMS: Record<Role, { icon: React.ElementType; label: string; view: View }[]> = {
  patient: [
    { icon: Home, label: "Dashboard", view: "patient-dashboard" },
    { icon: Calendar, label: "My Appointments", view: "patient-appointments" },
    { icon: Plus, label: "Book Appointment", view: "patient-book" },
    { icon: Bell, label: "Notifications", view: "patient-notifications" },
    { icon: User, label: "Profile", view: "patient-profile" },
  ],
  doctor: [
    { icon: Home, label: "Dashboard", view: "doctor-dashboard" },
    { icon: Calendar, label: "Schedule", view: "doctor-schedule" },
    { icon: Users, label: "My Patients", view: "doctor-patients" },
    { icon: Bell, label: "Notifications", view: "patient-notifications" },
    { icon: User, label: "Profile", view: "patient-profile" },
  ],
  admin: [
    { icon: Home, label: "Dashboard", view: "admin-dashboard" },
    { icon: Stethoscope, label: "Doctors", view: "admin-doctors" },
    { icon: Users, label: "Patients", view: "admin-patients" },
    { icon: ClipboardList, label: "Appointments", view: "patient-appointments" },
    { icon: BarChart2, label: "Reports", view: "admin-reports" },
    { icon: Bell, label: "Notifications", view: "patient-notifications" },
  ],
};

function Sidebar({
  user, currentView, onNavigate, collapsed, setCollapsed
}: {
  user: User; currentView: View; onNavigate: (v: View) => void;
  collapsed: boolean; setCollapsed: (v: boolean) => void;
}) {
  const items = NAV_ITEMS[user.role];
  return (
    <aside
      className={`fixed left-0 top-0 h-screen bg-sidebar flex flex-col z-30 transition-all duration-300 ${collapsed ? "w-16" : "w-60"}`}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-sidebar-border shrink-0">
        <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shrink-0">
          <Heart size={16} className="text-primary" />
        </div>
        {!collapsed && <span className="text-white font-bold text-base font-display tracking-tight">MediCare+</span>}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto">
        {items.map(({ icon: Icon, label, view }) => {
          const active = currentView === view;
          return (
            <button
              key={view}
              onClick={() => onNavigate(view)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group
                ${active
                  ? "bg-sidebar-accent text-white"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-white"}`}
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed && <span>{label}</span>}
              {active && !collapsed && <div className="ml-auto w-1.5 h-1.5 bg-accent rounded-full" />}
            </button>
          );
        })}
      </nav>

      {/* User */}
      <div className="border-t border-sidebar-border p-3 shrink-0">
        {!collapsed ? (
          <div className="flex items-center gap-2">
            <img
              src={`https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=48&h=48&fit=crop&auto=format`}
              alt={user.name}
              className="w-8 h-8 rounded-full object-cover shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-semibold truncate">{user.name}</p>
              <p className="text-sidebar-foreground/60 text-xs capitalize truncate">{user.role}</p>
            </div>
            <button className="text-sidebar-foreground/60 hover:text-white transition-colors">
              <LogOut size={15} />
            </button>
          </div>
        ) : (
          <div className="flex justify-center">
            <LogOut size={16} className="text-sidebar-foreground/60" />
          </div>
        )}
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 w-6 h-6 bg-white border border-border rounded-full flex items-center justify-center shadow-sm hover:shadow-md transition-shadow"
      >
        {collapsed ? <ChevronRight size={12} className="text-primary" /> : <ChevronLeft size={12} className="text-primary" />}
      </button>
    </aside>
  );
}

// ─── Dashboard Layout ─────────────────────────────────────────────────────────

function DashLayout({
  user, currentView, onNavigate, children, title, subtitle
}: {
  user: User; currentView: View; onNavigate: (v: View) => void;
  children: React.ReactNode; title: string; subtitle?: string;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background flex" style={{ fontFamily: "'Inter', sans-serif" }}>
      <Sidebar user={user} currentView={currentView} onNavigate={onNavigate} collapsed={collapsed} setCollapsed={setCollapsed} />
      <main className={`flex-1 transition-all duration-300 ${collapsed ? "ml-16" : "ml-60"} flex flex-col min-h-screen`}>
        {/* Topbar */}
        <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6 shrink-0 sticky top-0 z-20">
          <div>
            <h1 className="text-base font-bold text-foreground font-display">{title}</h1>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-3">
            <div className="relative hidden md:block">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                placeholder="Search..."
                className="pl-9 pr-4 py-2 text-sm bg-muted rounded-xl border-0 outline-none w-52 focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <button
              onClick={() => setNotifOpen(!notifOpen)}
              className="relative w-9 h-9 bg-muted rounded-xl flex items-center justify-center hover:bg-secondary transition-colors"
            >
              <Bell size={16} className="text-foreground" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-accent rounded-full" />
            </button>
            <img
              src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=40&h=40&fit=crop&auto=format"
              alt={user.name}
              className="w-8 h-8 rounded-xl object-cover cursor-pointer"
            />
          </div>
        </header>

        <div className="flex-1 p-6 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  );
}

// ─── Splash Screen ────────────────────────────────────────────────────────────

function SplashScreen({ onNext }: { onNext: () => void }) {
  useEffect(() => {
    const t = setTimeout(onNext, 2500);
    return () => clearTimeout(t);
  }, [onNext]);

  return (
    <div className="min-h-screen bg-primary flex flex-col items-center justify-center" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div className="flex flex-col items-center gap-6 animate-pulse">
        <div className="w-24 h-24 bg-white/10 rounded-3xl flex items-center justify-center backdrop-blur-sm border border-white/20">
          <Heart size={44} className="text-white" fill="white" />
        </div>
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white tracking-tight">MediCare+</h1>
          <p className="text-blue-200 text-sm mt-2 font-medium">Smart Healthcare Management</p>
        </div>
      </div>
      <div className="absolute bottom-12 flex gap-1.5">
        {[0, 1, 2].map(i => (
          <div key={i} className={`h-1.5 rounded-full bg-white/40 transition-all ${i === 0 ? "w-8 bg-white" : "w-2"}`} />
        ))}
      </div>
    </div>
  );
}

// ─── Onboarding ───────────────────────────────────────────────────────────────

const ONBOARDING_STEPS = [
  {
    icon: Calendar,
    title: "Easy Appointment Booking",
    desc: "Schedule appointments with your preferred doctors in seconds. Choose from hundreds of specialists across all departments.",
    color: "bg-blue-500",
    img: "photo-1576091160399-112ba8d25d1d",
  },
  {
    icon: Bell,
    title: "Smart Reminders",
    desc: "Never miss an appointment. Receive SMS and email reminders 24 hours and 1 hour before your scheduled visit.",
    color: "bg-sky-500",
    img: "photo-1559757175-0eb30cd8c063",
  },
  {
    icon: Activity,
    title: "Health Schedule Management",
    desc: "Track your complete medical history, upcoming appointments, and health metrics all in one place.",
    color: "bg-teal-500",
    img: "photo-1631217868264-e5b90bb7e133",
  },
];

function OnboardingScreen({ onFinish }: { onFinish: () => void }) {
  const [step, setStep] = useState(0);
  const current = ONBOARDING_STEPS[step];
  const Icon = current.icon;

  return (
    <div className="min-h-screen bg-background flex flex-col" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div className="flex-1 flex flex-col items-center justify-center px-8 max-w-md mx-auto w-full">
        {/* Image */}
        <div className="w-full h-56 rounded-3xl overflow-hidden mb-8 shadow-xl shadow-primary/10 relative">
          <img
            src={`https://images.unsplash.com/${current.img}?w=600&h=400&fit=crop&auto=format`}
            alt={current.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-primary/40 to-transparent" />
          <div className={`absolute top-4 left-4 w-10 h-10 ${current.color} rounded-2xl flex items-center justify-center`}>
            <Icon size={20} className="text-white" />
          </div>
        </div>

        {/* Text */}
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-foreground mb-3">{current.title}</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">{current.desc}</p>
        </div>

        {/* Dots */}
        <div className="flex gap-2 mb-8">
          {ONBOARDING_STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`h-2 rounded-full transition-all duration-300 ${i === step ? "w-8 bg-primary" : "w-2 bg-border"}`}
            />
          ))}
        </div>

        {/* Buttons */}
        <div className="w-full space-y-3">
          {step < ONBOARDING_STEPS.length - 1 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              className="w-full bg-primary text-white py-3.5 rounded-2xl font-semibold flex items-center justify-center gap-2 hover:bg-blue-700 active:scale-95 transition-all"
            >
              Next <ArrowRight size={16} />
            </button>
          ) : (
            <button
              onClick={onFinish}
              className="w-full bg-primary text-white py-3.5 rounded-2xl font-semibold flex items-center justify-center gap-2 hover:bg-blue-700 active:scale-95 transition-all"
            >
              Get Started <Zap size={16} />
            </button>
          )}
          {step < ONBOARDING_STEPS.length - 1 && (
            <button onClick={onFinish} className="w-full text-muted-foreground text-sm py-2 hover:text-foreground transition-colors">
              Skip
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Auth: Login ──────────────────────────────────────────────────────────────

function LoginScreen({ onLogin, onNavigate }: {
  onLogin: (role: Role) => void;
  onNavigate: (v: "register" | "forgot") => void;
}) {
  const [email, setEmail] = useState("sarah@example.com");
  const [password, setPassword] = useState("••••••••");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(false);
  const [role, setRole] = useState<Role>("patient");
  const [loading, setLoading] = useState(false);

  const handleLogin = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onLogin(role);
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-background flex" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* Left panel */}
      <div className="hidden lg:flex w-1/2 bg-primary flex-col justify-between p-12 relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-16">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Heart size={20} className="text-white" fill="white" />
            </div>
            <span className="text-white font-bold text-xl">MediCare+</span>
          </div>
          <h2 className="text-4xl font-bold text-white leading-tight mb-4">
            Your health,<br />our priority.
          </h2>
          <p className="text-blue-200 text-base leading-relaxed max-w-xs">
            Streamlined appointment booking, automated reminders, and comprehensive patient management — all in one platform.
          </p>
        </div>
        <div className="relative z-10 grid grid-cols-2 gap-4">
          {[
            { n: "2,400+", l: "Active Patients" },
            { n: "140+", l: "Specialists" },
            { n: "98%", l: "Satisfaction" },
            { n: "24/7", l: "Support" },
          ].map(({ n, l }) => (
            <div key={l} className="bg-white/10 rounded-2xl p-4 backdrop-blur-sm">
              <p className="text-white font-bold text-xl">{n}</p>
              <p className="text-blue-200 text-xs mt-0.5">{l}</p>
            </div>
          ))}
        </div>
        {/* decorative circles */}
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/5 rounded-full" />
        <div className="absolute bottom-20 -right-10 w-40 h-40 bg-white/5 rounded-full" />
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-foreground">Welcome back</h1>
            <p className="text-muted-foreground text-sm mt-1">Sign in to your account to continue</p>
          </div>

          {/* Role selector */}
          <div className="flex bg-muted rounded-xl p-1 mb-6">
            {(["patient", "doctor", "admin"] as Role[]).map(r => (
              <button
                key={r}
                onClick={() => setRole(r)}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg capitalize transition-all ${role === r ? "bg-white text-primary shadow-sm" : "text-muted-foreground"}`}
              >
                {r}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-foreground mb-1.5 block">Email Address</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full pl-9 pr-4 py-3 text-sm bg-input-background rounded-xl border border-border outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                  placeholder="you@example.com"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground mb-1.5 block">Password</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full pl-9 pr-10 py-3 text-sm bg-input-background rounded-xl border border-border outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                  placeholder="••••••••"
                />
                <button onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <div
                  onClick={() => setRemember(!remember)}
                  className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors cursor-pointer ${remember ? "bg-primary border-primary" : "border-border"}`}
                >
                  {remember && <Check size={10} className="text-white" />}
                </div>
                <span className="text-xs text-muted-foreground">Remember me</span>
              </label>
              <button onClick={() => onNavigate("forgot")} className="text-xs text-primary font-semibold hover:underline">
                Forgot password?
              </button>
            </div>

            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full bg-primary text-white py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-70"
            >
              {loading ? <RefreshCw size={16} className="animate-spin" /> : <><Lock size={15} /> Sign In</>}
            </button>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-6">
            {"Don't have an account? "}
            <button onClick={() => onNavigate("register")} className="text-primary font-semibold hover:underline">
              Create account
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Auth: Register ───────────────────────────────────────────────────────────

function RegisterScreen({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState(1);
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div className="w-full max-w-sm">
        <button onClick={onBack} className="flex items-center gap-2 text-muted-foreground text-sm mb-6 hover:text-foreground transition-colors">
          <ChevronLeft size={16} /> Back to Login
        </button>
        <h1 className="text-2xl font-bold text-foreground mb-1">Create account</h1>
        <p className="text-muted-foreground text-sm mb-6">Step {step} of 2 — {step === 1 ? "Personal Info" : "Account Setup"}</p>

        {/* Progress */}
        <div className="flex gap-2 mb-8">
          {[1, 2].map(s => (
            <div key={s} className={`h-1.5 flex-1 rounded-full transition-all ${s <= step ? "bg-primary" : "bg-border"}`} />
          ))}
        </div>

        {step === 1 ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {["First Name", "Last Name"].map(l => (
                <div key={l}>
                  <label className="text-xs font-semibold text-foreground mb-1.5 block">{l}</label>
                  <input className="w-full px-3 py-3 text-sm bg-input-background rounded-xl border border-border outline-none focus:ring-2 focus:ring-primary/30" placeholder={l} />
                </div>
              ))}
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground mb-1.5 block">Email Address</label>
              <input className="w-full px-3 py-3 text-sm bg-input-background rounded-xl border border-border outline-none focus:ring-2 focus:ring-primary/30" placeholder="you@example.com" />
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground mb-1.5 block">Phone Number</label>
              <input className="w-full px-3 py-3 text-sm bg-input-background rounded-xl border border-border outline-none focus:ring-2 focus:ring-primary/30" placeholder="+1 (555) 000-0000" />
            </div>
            <button onClick={() => setStep(2)} className="w-full bg-primary text-white py-3.5 rounded-xl font-semibold text-sm mt-2 hover:bg-blue-700 active:scale-95 transition-all">
              Continue <ArrowRight size={15} className="inline ml-1" />
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-foreground mb-1.5 block">Date of Birth</label>
              <input type="date" className="w-full px-3 py-3 text-sm bg-input-background rounded-xl border border-border outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground mb-1.5 block">Password</label>
              <input type="password" className="w-full px-3 py-3 text-sm bg-input-background rounded-xl border border-border outline-none focus:ring-2 focus:ring-primary/30" placeholder="Min. 8 characters" />
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground mb-1.5 block">Confirm Password</label>
              <input type="password" className="w-full px-3 py-3 text-sm bg-input-background rounded-xl border border-border outline-none focus:ring-2 focus:ring-primary/30" placeholder="Repeat password" />
            </div>
            <div className="flex items-start gap-2 pt-1">
              <div className="w-4 h-4 mt-0.5 rounded border-2 border-primary bg-primary flex items-center justify-center shrink-0">
                <Check size={9} className="text-white" />
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                I agree to the <span className="text-primary font-semibold">Terms of Service</span> and <span className="text-primary font-semibold">Privacy Policy</span>
              </p>
            </div>
            <button onClick={onBack} className="w-full bg-primary text-white py-3.5 rounded-xl font-semibold text-sm mt-2 hover:bg-blue-700 active:scale-95 transition-all">
              Create Account
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Auth: Forgot Password ────────────────────────────────────────────────────

function ForgotScreen({ onBack }: { onBack: () => void }) {
  const [sent, setSent] = useState(false);
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div className="w-full max-w-sm">
        <button onClick={onBack} className="flex items-center gap-2 text-muted-foreground text-sm mb-6 hover:text-foreground">
          <ChevronLeft size={16} /> Back to Login
        </button>
        {!sent ? (
          <>
            <div className="w-14 h-14 bg-secondary rounded-2xl flex items-center justify-center mb-6">
              <Lock size={24} className="text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-1">Forgot password?</h1>
            <p className="text-muted-foreground text-sm mb-8">Enter your email and we will send you reset instructions.</p>
            <div className="space-y-4">
              <input className="w-full px-4 py-3 text-sm bg-input-background rounded-xl border border-border outline-none focus:ring-2 focus:ring-primary/30" placeholder="your@email.com" />
              <button onClick={() => setSent(true)} className="w-full bg-primary text-white py-3.5 rounded-xl font-semibold text-sm hover:bg-blue-700 active:scale-95 transition-all">
                Send Reset Link
              </button>
            </div>
          </>
        ) : (
          <div className="text-center">
            <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <CheckCircle size={32} className="text-emerald-500" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Email sent!</h1>
            <p className="text-muted-foreground text-sm mb-8">Check your inbox for reset instructions. It may take a few minutes.</p>
            <button onClick={onBack} className="w-full bg-primary text-white py-3.5 rounded-xl font-semibold text-sm hover:bg-blue-700 active:scale-95 transition-all">
              Back to Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Patient Dashboard ────────────────────────────────────────────────────────

function PatientDashboard({ user, onNavigate }: { user: User; onNavigate: (v: View) => void }) {
  const upcoming = MOCK_APPOINTMENTS.filter(a => a.status !== "cancelled").slice(0, 3);
  return (
    <DashLayout user={user} currentView="patient-dashboard" onNavigate={onNavigate} title="My Dashboard" subtitle={`Welcome back, ${user.name.split(" ")[0]}`}>
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={Calendar} label="Upcoming" value="3" delta="+1 this week" color="bg-primary" />
        <StatCard icon={CheckCircle} label="Completed" value="18" delta="all time" color="bg-emerald-500" />
        <StatCard icon={Bell} label="Reminders" value="5" color="bg-sky-500" />
        <StatCard icon={Heart} label="Health Score" value="92%" delta="+4% vs last" color="bg-rose-500" />
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Upcoming appointments */}
        <div className="lg:col-span-2 bg-card rounded-2xl border border-border shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-foreground text-sm">Upcoming Appointments</h2>
            <button onClick={() => onNavigate("patient-appointments")} className="text-xs text-primary font-semibold hover:underline flex items-center gap-1">
              View all <ChevronRight size={12} />
            </button>
          </div>
          <div className="space-y-3">
            {upcoming.map(apt => (
              <div key={apt.id} className="flex items-center gap-3 p-3 bg-background rounded-xl hover:bg-secondary/30 transition-colors">
                <div className="w-10 h-10 bg-secondary rounded-xl flex items-center justify-center shrink-0">
                  <Stethoscope size={18} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{apt.doctor}</p>
                  <p className="text-xs text-muted-foreground">{apt.specialty} · {apt.type}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-semibold text-foreground">{apt.date}</p>
                  <p className="text-xs text-muted-foreground">{apt.time}</p>
                </div>
                <Badge status={apt.status} />
              </div>
            ))}
          </div>
          <button
            onClick={() => onNavigate("patient-book")}
            className="w-full mt-4 py-3 bg-secondary text-primary font-semibold text-sm rounded-xl hover:bg-primary hover:text-white transition-all flex items-center justify-center gap-2"
          >
            <Plus size={15} /> Book New Appointment
          </button>
        </div>

        {/* Quick actions */}
        <div className="space-y-4">
          <div className="bg-card rounded-2xl border border-border shadow-sm p-5">
            <h2 className="font-bold text-foreground text-sm mb-4">Quick Actions</h2>
            <div className="space-y-2">
              {[
                { icon: Calendar, label: "Book Appointment", view: "patient-book" as View, color: "bg-primary/10 text-primary" },
                { icon: ClipboardList, label: "View History", view: "patient-appointments" as View, color: "bg-emerald-50 text-emerald-600" },
                { icon: Bell, label: "Notifications", view: "patient-notifications" as View, color: "bg-amber-50 text-amber-600" },
                { icon: User, label: "Update Profile", view: "patient-profile" as View, color: "bg-purple-50 text-purple-600" },
              ].map(({ icon: Icon, label, view, color }) => (
                <button
                  key={view}
                  onClick={() => onNavigate(view)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted transition-colors text-left"
                >
                  <div className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center shrink-0`}>
                    <Icon size={15} />
                  </div>
                  <span className="text-sm font-medium text-foreground">{label}</span>
                  <ChevronRight size={14} className="text-muted-foreground ml-auto" />
                </button>
              ))}
            </div>
          </div>

          {/* Reminder card */}
          <div className="bg-primary rounded-2xl p-5 relative overflow-hidden">
            <div className="absolute -top-4 -right-4 w-24 h-24 bg-white/10 rounded-full" />
            <Bell size={20} className="text-white mb-3" />
            <p className="text-white font-bold text-sm mb-1">Reminder Set</p>
            <p className="text-blue-200 text-xs">Your appointment with Dr. Chen is tomorrow at 9:00 AM</p>
          </div>
        </div>
      </div>
    </DashLayout>
  );
}

// ─── Patient Appointments ─────────────────────────────────────────────────────

function PatientAppointments({ user, onNavigate }: { user: User; onNavigate: (v: View) => void }) {
  const [filter, setFilter] = useState<"all" | "confirmed" | "pending" | "cancelled">("all");
  const filtered = filter === "all" ? MOCK_APPOINTMENTS : MOCK_APPOINTMENTS.filter(a => a.status === filter);

  return (
    <DashLayout user={user} currentView="patient-appointments" onNavigate={onNavigate} title="My Appointments">
      <div className="flex items-center justify-between mb-5">
        <div className="flex gap-2">
          {(["all", "confirmed", "pending", "cancelled"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all ${filter === f ? "bg-primary text-white" : "bg-card border border-border text-muted-foreground hover:text-foreground"}`}
            >
              {f}
            </button>
          ))}
        </div>
        <button onClick={() => onNavigate("patient-book")} className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-all">
          <Plus size={14} /> Book New
        </button>
      </div>

      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-muted">
              {["Doctor", "Specialty", "Date", "Time", "Type", "Status", "Actions"].map(h => (
                <th key={h} className="text-left text-xs font-semibold text-muted-foreground px-4 py-3 first:pl-5">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((apt, i) => (
              <tr key={apt.id} className={`border-t border-border hover:bg-muted/40 transition-colors ${i % 2 === 0 ? "" : "bg-background/50"}`}>
                <td className="px-4 py-3 pl-5">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-secondary rounded-lg flex items-center justify-center">
                      <Stethoscope size={13} className="text-primary" />
                    </div>
                    <span className="text-sm font-semibold text-foreground">{apt.doctor}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{apt.specialty}</td>
                <td className="px-4 py-3 text-sm text-foreground font-mono">{apt.date}</td>
                <td className="px-4 py-3 text-sm text-foreground font-mono">{apt.time}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{apt.type}</td>
                <td className="px-4 py-3"><Badge status={apt.status} /></td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button className="w-7 h-7 bg-secondary rounded-lg flex items-center justify-center hover:bg-primary hover:text-white transition-all text-primary">
                      <Eye size={12} />
                    </button>
                    {apt.status !== "cancelled" && (
                      <button className="w-7 h-7 bg-red-50 rounded-lg flex items-center justify-center hover:bg-red-500 hover:text-white transition-all text-red-500">
                        <XCircle size={12} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DashLayout>
  );
}

// ─── Book Appointment ─────────────────────────────────────────────────────────

const SPECIALTIES = ["Cardiology", "Neurology", "Orthopedics", "Dermatology", "Pediatrics", "Oncology", "General Medicine", "Gynecology"];
const TIME_SLOTS = ["09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "02:00 PM", "02:30 PM", "03:00 PM", "03:30 PM", "04:00 PM"];

function BookAppointment({ user, onNavigate }: { user: User; onNavigate: (v: View) => void }) {
  const [step, setStep] = useState(1);
  const [specialty, setSpecialty] = useState("");
  const [selectedDoctor, setSelectedDoctor] = useState<typeof MOCK_DOCTORS[0] | null>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [appointmentType, setAppointmentType] = useState("Consultation");
  const [booked, setBooked] = useState(false);

  const filteredDoctors = specialty ? MOCK_DOCTORS.filter(d => d.specialty === specialty) : MOCK_DOCTORS;

  if (booked) {
    return (
      <DashLayout user={user} currentView="patient-book" onNavigate={onNavigate} title="Book Appointment">
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-20 h-20 bg-emerald-50 rounded-3xl flex items-center justify-center mb-6">
            <CheckCircle size={40} className="text-emerald-500" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2 font-display">Appointment Confirmed!</h2>
          <p className="text-muted-foreground text-sm mb-2">Your appointment has been successfully booked.</p>
          {selectedDoctor && (
            <div className="bg-card border border-border rounded-2xl p-5 mt-6 w-full max-w-sm">
              <div className="flex items-center gap-3 mb-4">
                <img src={`https://images.unsplash.com/${selectedDoctor.img}?w=56&h=56&fit=crop&auto=format`} alt={selectedDoctor.name} className="w-14 h-14 rounded-2xl object-cover" />
                <div>
                  <p className="font-bold text-foreground">{selectedDoctor.name}</p>
                  <p className="text-sm text-muted-foreground">{selectedDoctor.specialty}</p>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Date</span><span className="font-semibold">{selectedDate}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Time</span><span className="font-semibold">{selectedTime}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span className="font-semibold">{appointmentType}</span></div>
              </div>
            </div>
          )}
          <div className="flex gap-3 mt-8">
            <button onClick={() => { setBooked(false); setStep(1); setSelectedDoctor(null); }} className="px-6 py-2.5 bg-secondary text-primary rounded-xl font-semibold text-sm hover:bg-primary hover:text-white transition-all">
              Book Another
            </button>
            <button onClick={() => onNavigate("patient-dashboard")} className="px-6 py-2.5 bg-primary text-white rounded-xl font-semibold text-sm hover:bg-blue-700 transition-all">
              Go to Dashboard
            </button>
          </div>
        </div>
      </DashLayout>
    );
  }

  return (
    <DashLayout user={user} currentView="patient-book" onNavigate={onNavigate} title="Book Appointment" subtitle="Find and schedule with a specialist">
      {/* Steps */}
      <div className="flex items-center gap-3 mb-8">
        {["Choose Specialty", "Select Doctor", "Pick Date & Time", "Confirm"].map((label, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${i + 1 < step ? "bg-emerald-500 text-white" : i + 1 === step ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}>
              {i + 1 < step ? <Check size={12} /> : i + 1}
            </div>
            <span className={`text-xs font-semibold hidden sm:block ${i + 1 === step ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
            {i < 3 && <ChevronRight size={14} className="text-muted-foreground" />}
          </div>
        ))}
      </div>

      <div className="bg-card rounded-2xl border border-border shadow-sm p-6">
        {step === 1 && (
          <div>
            <h2 className="font-bold text-foreground mb-4">Choose a Specialty</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {SPECIALTIES.map(s => (
                <button
                  key={s}
                  onClick={() => { setSpecialty(s); setStep(2); }}
                  className={`p-4 rounded-xl border text-sm font-medium transition-all hover:border-primary hover:bg-secondary ${specialty === s ? "border-primary bg-secondary text-primary" : "border-border text-foreground"}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="font-bold text-foreground mb-4">Select a Doctor</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDoctors.map(doc => (
                <div
                  key={doc.id}
                  onClick={() => doc.available && (setSelectedDoctor(doc), setStep(3))}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${!doc.available ? "opacity-50 cursor-not-allowed" : "hover:border-primary hover:shadow-md"} ${selectedDoctor?.id === doc.id ? "border-primary bg-secondary" : "border-border"}`}
                >
                  <div className="flex items-start gap-3">
                    <img src={`https://images.unsplash.com/${doc.img}?w=56&h=56&fit=crop&auto=format`} alt={doc.name} className="w-12 h-12 rounded-xl object-cover" />
                    <div className="flex-1">
                      <p className="font-semibold text-sm text-foreground">{doc.name}</p>
                      <p className="text-xs text-muted-foreground">{doc.specialty}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <Star size={10} className="text-amber-400 fill-amber-400" />
                        <span className="text-xs font-semibold text-foreground">{doc.rating}</span>
                        <span className="text-xs text-muted-foreground">· {doc.patients} patients</span>
                      </div>
                    </div>
                    <div className={`w-2 h-2 rounded-full mt-1 ${doc.available ? "bg-emerald-500" : "bg-gray-300"}`} />
                  </div>
                  {!doc.available && <p className="text-xs text-red-500 font-medium mt-2">Not available</p>}
                </div>
              ))}
            </div>
            <button onClick={() => setStep(1)} className="mt-4 text-sm text-primary font-semibold hover:underline flex items-center gap-1">
              <ChevronLeft size={14} /> Back
            </button>
          </div>
        )}

        {step === 3 && (
          <div>
            <h2 className="font-bold text-foreground mb-4">Pick Date & Time</h2>
            <div className="grid sm:grid-cols-2 gap-6">
              <div>
                <label className="text-xs font-semibold text-foreground mb-2 block">Select Date</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  min="2026-05-22"
                  className="w-full px-4 py-3 text-sm bg-input-background rounded-xl border border-border outline-none focus:ring-2 focus:ring-primary/30"
                />
                <label className="text-xs font-semibold text-foreground mb-2 block mt-4">Appointment Type</label>
                <select
                  value={appointmentType}
                  onChange={e => setAppointmentType(e.target.value)}
                  className="w-full px-4 py-3 text-sm bg-input-background rounded-xl border border-border outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {["Consultation", "Follow-up", "Check-up", "Lab Review", "Emergency"].map(t => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground mb-2 block">Available Time Slots</label>
                <div className="grid grid-cols-2 gap-2">
                  {TIME_SLOTS.map(t => (
                    <button
                      key={t}
                      onClick={() => setSelectedTime(t)}
                      className={`py-2.5 rounded-xl text-xs font-semibold transition-all border ${selectedTime === t ? "bg-primary text-white border-primary" : "bg-input-background border-border text-foreground hover:border-primary"}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setStep(2)} className="px-5 py-2.5 border border-border rounded-xl text-sm font-semibold text-foreground hover:bg-muted transition-all flex items-center gap-1">
                <ChevronLeft size={14} /> Back
              </button>
              <button
                onClick={() => selectedDate && selectedTime && setStep(4)}
                disabled={!selectedDate || !selectedTime}
                className="flex-1 bg-primary text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-all disabled:opacity-50"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 4 && selectedDoctor && (
          <div>
            <h2 className="font-bold text-foreground mb-4">Confirm Appointment</h2>
            <div className="bg-background rounded-2xl p-5 mb-5 border border-border">
              <div className="flex items-center gap-4 mb-5 pb-4 border-b border-border">
                <img src={`https://images.unsplash.com/${selectedDoctor.img}?w=64&h=64&fit=crop&auto=format`} alt={selectedDoctor.name} className="w-14 h-14 rounded-2xl object-cover" />
                <div>
                  <p className="font-bold text-foreground">{selectedDoctor.name}</p>
                  <p className="text-sm text-muted-foreground">{selectedDoctor.specialty}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Star size={11} className="text-amber-400 fill-amber-400" />
                    <span className="text-xs font-semibold">{selectedDoctor.rating}</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  { label: "Date", value: selectedDate },
                  { label: "Time", value: selectedTime },
                  { label: "Type", value: appointmentType },
                  { label: "Status", value: "Pending Confirmation" },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-card rounded-xl p-3">
                    <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
                    <p className="font-semibold text-foreground text-sm">{value}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-blue-50 rounded-xl p-4 flex gap-3 mb-5">
              <Info size={16} className="text-primary shrink-0 mt-0.5" />
              <p className="text-xs text-primary leading-relaxed">You will receive SMS and email reminders 24 hours and 1 hour before your appointment.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(3)} className="px-5 py-2.5 border border-border rounded-xl text-sm font-semibold text-foreground hover:bg-muted transition-all flex items-center gap-1">
                <ChevronLeft size={14} /> Back
              </button>
              <button onClick={() => setBooked(true)} className="flex-1 bg-primary text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-all">
                Confirm Booking
              </button>
            </div>
          </div>
        )}
      </div>
    </DashLayout>
  );
}

// ─── Notifications ────────────────────────────────────────────────────────────

const NOTIFICATIONS = [
  { id: 1, type: "reminder", title: "Appointment Tomorrow", msg: "Dr. Michael Chen — Cardiology at 9:00 AM", time: "2h ago", read: false },
  { id: 2, type: "confirmed", title: "Appointment Confirmed", msg: "Your booking with Dr. Emily Parker is confirmed for May 26", time: "5h ago", read: false },
  { id: 3, type: "reminder", title: "Upcoming Appointment", msg: "Dr. James Wilson — Orthopedics at 2:00 PM tomorrow", time: "1d ago", read: true },
  { id: 4, type: "cancelled", title: "Appointment Cancelled", msg: "Your appointment on May 20 was cancelled by the clinic", time: "2d ago", read: true },
  { id: 5, type: "info", title: "New Health Update", msg: "Your latest lab results are ready. Please review with your doctor.", time: "3d ago", read: true },
  { id: 6, type: "reminder", title: "Prescription Reminder", msg: "Take your Lisinopril 10mg today at 8:00 PM", time: "4d ago", read: true },
];

function NotificationsPage({ user, onNavigate }: { user: User; onNavigate: (v: View) => void }) {
  const [notifs, setNotifs] = useState(NOTIFICATIONS);
  const markAll = () => setNotifs(n => n.map(x => ({ ...x, read: true })));

  const iconForType = (type: string) => {
    if (type === "reminder") return { icon: Bell, bg: "bg-blue-50", color: "text-primary" };
    if (type === "confirmed") return { icon: CheckCircle, bg: "bg-emerald-50", color: "text-emerald-500" };
    if (type === "cancelled") return { icon: XCircle, bg: "bg-red-50", color: "text-red-500" };
    return { icon: Info, bg: "bg-amber-50", color: "text-amber-500" };
  };

  return (
    <DashLayout user={user} currentView="patient-notifications" onNavigate={onNavigate} title="Notifications">
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm text-muted-foreground">{notifs.filter(n => !n.read).length} unread notifications</p>
        <button onClick={markAll} className="text-xs text-primary font-semibold hover:underline">Mark all as read</button>
      </div>
      <div className="space-y-2 max-w-2xl">
        {notifs.map(n => {
          const { icon: Icon, bg, color } = iconForType(n.type);
          return (
            <div
              key={n.id}
              onClick={() => setNotifs(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x))}
              className={`flex items-start gap-4 p-4 bg-card rounded-2xl border transition-all cursor-pointer hover:shadow-sm ${n.read ? "border-border opacity-70" : "border-primary/20 shadow-sm"}`}
            >
              <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center shrink-0`}>
                <Icon size={18} className={color} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-semibold text-foreground">{n.title}</p>
                  {!n.read && <span className="w-2 h-2 bg-accent rounded-full shrink-0" />}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{n.msg}</p>
              </div>
              <span className="text-xs text-muted-foreground shrink-0">{n.time}</span>
            </div>
          );
        })}
      </div>
    </DashLayout>
  );
}

// ─── Patient Profile ──────────────────────────────────────────────────────────

function PatientProfile({ user, onNavigate }: { user: User; onNavigate: (v: View) => void }) {
  return (
    <DashLayout user={user} currentView="patient-profile" onNavigate={onNavigate} title="Profile & Settings">
      <div className="max-w-2xl space-y-5">
        {/* Profile card */}
        <div className="bg-card rounded-2xl border border-border shadow-sm p-6">
          <div className="flex items-center gap-5 mb-6">
            <div className="relative">
              <img src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop&auto=format" alt={user.name} className="w-20 h-20 rounded-2xl object-cover" />
              <button className="absolute -bottom-1 -right-1 w-7 h-7 bg-primary rounded-lg flex items-center justify-center">
                <RefreshCw size={12} className="text-white" />
              </button>
            </div>
            <div>
              <h2 className="font-bold text-xl text-foreground">{user.name}</h2>
              <p className="text-muted-foreground text-sm">Patient · ID #PT-20481</p>
              <div className="flex gap-2 mt-2">
                <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-semibold">Active</span>
              </div>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { icon: User, label: "Full Name", value: user.name },
              { icon: Mail, label: "Email", value: user.email },
              { icon: Phone, label: "Phone", value: "+1 (555) 234-5678" },
              { icon: MapPin, label: "Address", value: "123 Maple St, Chicago, IL" },
              { icon: Activity, label: "Blood Type", value: "O+" },
              { icon: Heart, label: "Allergies", value: "Penicillin, Pollen" },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-start gap-3">
                <div className="w-8 h-8 bg-secondary rounded-lg flex items-center justify-center shrink-0">
                  <Icon size={14} className="text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-sm font-semibold text-foreground">{value}</p>
                </div>
              </div>
            ))}
          </div>
          <button className="w-full mt-5 py-3 bg-secondary text-primary font-semibold text-sm rounded-xl hover:bg-primary hover:text-white transition-all">
            Edit Profile
          </button>
        </div>

        {/* Settings */}
        <div className="bg-card rounded-2xl border border-border shadow-sm p-6">
          <h2 className="font-bold text-foreground mb-4 text-sm">Notification Preferences</h2>
          <div className="space-y-3">
            {[
              { label: "Email Reminders", desc: "Receive appointment reminders via email", enabled: true },
              { label: "SMS Notifications", desc: "Text message alerts for upcoming appointments", enabled: true },
              { label: "Push Notifications", desc: "Browser notifications for real-time updates", enabled: false },
              { label: "Marketing Emails", desc: "Health tips and clinic announcements", enabled: false },
            ].map(({ label, desc, enabled }) => (
              <div key={label} className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
                <div className={`w-10 h-5.5 rounded-full cursor-pointer transition-colors relative ${enabled ? "bg-primary" : "bg-switch-background"}`}>
                  <div className={`absolute top-0.5 w-4.5 h-4.5 bg-white rounded-full shadow transition-all ${enabled ? "left-5" : "left-0.5"}`} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashLayout>
  );
}

// ─── Doctor Dashboard ─────────────────────────────────────────────────────────

function DoctorDashboard({ user, onNavigate }: { user: User; onNavigate: (v: View) => void }) {
  const todayApts = MOCK_APPOINTMENTS.filter(a => a.date === "2026-05-24").slice(0, 4);

  return (
    <DashLayout user={user} currentView="doctor-dashboard" onNavigate={onNavigate} title="Doctor Dashboard" subtitle={`${user.name} · Cardiology`}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={Calendar} label="Today" value="8" delta="2 pending" color="bg-primary" />
        <StatCard icon={UserCheck} label="Total Patients" value="142" delta="+5 this month" color="bg-emerald-500" />
        <StatCard icon={CheckCircle} label="Completed" value="6" color="bg-sky-500" />
        <StatCard icon={Clock} label="Avg. Duration" value="28m" color="bg-amber-500" />
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Today's Schedule */}
        <div className="lg:col-span-2 bg-card rounded-2xl border border-border shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-foreground text-sm">{"Today's Schedule"}</h2>
            <span className="text-xs text-muted-foreground font-mono">May 24, 2026</span>
          </div>
          <div className="space-y-3">
            {todayApts.map((apt, i) => (
              <div key={apt.id} className="flex items-center gap-3 p-3 bg-background rounded-xl">
                <div className={`w-1 h-12 rounded-full ${i === 0 ? "bg-primary" : i === 1 ? "bg-amber-400" : "bg-emerald-400"}`} />
                <div className="w-10 text-center">
                  <p className="text-xs font-bold text-foreground font-mono">{apt.time.split(" ")[0]}</p>
                  <p className="text-xs text-muted-foreground font-mono">{apt.time.split(" ")[1]}</p>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">{apt.patient}</p>
                  <p className="text-xs text-muted-foreground">{apt.type}</p>
                </div>
                <Badge status={apt.status} />
                <div className="flex gap-1">
                  <button className="w-7 h-7 bg-emerald-50 rounded-lg flex items-center justify-center hover:bg-emerald-500 hover:text-white transition-all text-emerald-600">
                    <Check size={12} />
                  </button>
                  <button className="w-7 h-7 bg-red-50 rounded-lg flex items-center justify-center hover:bg-red-500 hover:text-white transition-all text-red-500">
                    <X size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Patient list */}
        <div className="bg-card rounded-2xl border border-border shadow-sm p-5">
          <h2 className="font-bold text-foreground text-sm mb-4">Recent Patients</h2>
          <div className="space-y-3">
            {["Sarah Johnson", "Robert Davis", "Maria Garcia", "Emma White", "David Kim"].map((name, i) => (
              <div key={name} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-secondary flex items-center justify-center text-xs font-bold text-primary shrink-0">
                  {name.split(" ").map(n => n[0]).join("")}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{name}</p>
                  <p className="text-xs text-muted-foreground">Last visit: {["Today", "Yesterday", "May 20", "May 18", "May 15"][i]}</p>
                </div>
                <button className="text-primary hover:text-blue-700">
                  <ChevronRight size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashLayout>
  );
}

// ─── Admin Dashboard ──────────────────────────────────────────────────────────

function AdminDashboard({ user, onNavigate }: { user: User; onNavigate: (v: View) => void }) {
  return (
    <DashLayout user={user} currentView="admin-dashboard" onNavigate={onNavigate} title="Admin Dashboard" subtitle="Hospital overview and management">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={Users} label="Total Patients" value="2,481" delta="+28 this week" color="bg-primary" />
        <StatCard icon={Stethoscope} label="Doctors" value="48" delta="+2 new" color="bg-emerald-500" />
        <StatCard icon={Calendar} label="Appointments" value="312" delta="this month" color="bg-sky-500" />
        <StatCard icon={TrendingUp} label="Occupancy" value="78%" delta="+3% vs avg" color="bg-amber-500" />
      </div>

      <div className="grid lg:grid-cols-3 gap-5 mb-5">
        {/* Area chart */}
        <div className="lg:col-span-2 bg-card rounded-2xl border border-border shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-foreground text-sm">Appointment Trends</h2>
            <span className="text-xs text-muted-foreground">Last 5 months</span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={CHART_DATA}>
              <defs>
                <linearGradient id="colAppt" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1D4ED8" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#1D4ED8" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colPat" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0EA5E9" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#0EA5E9" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid #E2E8F0", fontSize: "12px" }} />
              <Area type="monotone" dataKey="appointments" stroke="#1D4ED8" strokeWidth={2} fill="url(#colAppt)" name="Appointments" />
              <Area type="monotone" dataKey="patients" stroke="#0EA5E9" strokeWidth={2} fill="url(#colPat)" name="New Patients" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Pie chart */}
        <div className="bg-card rounded-2xl border border-border shadow-sm p-5">
          <h2 className="font-bold text-foreground text-sm mb-4">By Department</h2>
          <ResponsiveContainer width="100%" height={150}>
            <PieChart>
              <Pie data={PIE_DATA} cx="50%" cy="50%" innerRadius={45} outerRadius={65} paddingAngle={3} dataKey="value">
                {PIE_DATA.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid #E2E8F0", fontSize: "12px" }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-2">
            {PIE_DATA.map(d => (
              <div key={d.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                  <span className="text-muted-foreground">{d.name}</span>
                </div>
                <span className="font-semibold text-foreground">{d.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent appointments table */}
      <div className="bg-card rounded-2xl border border-border shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-foreground text-sm">Recent Appointments</h2>
          <div className="flex gap-2">
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-muted rounded-xl text-muted-foreground hover:text-foreground transition-colors">
              <Filter size={12} /> Filter
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-muted rounded-xl text-muted-foreground hover:text-foreground transition-colors">
              <Download size={12} /> Export
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-muted rounded-xl">
                {["Patient", "Doctor", "Specialty", "Date", "Time", "Type", "Status"].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-muted-foreground px-3 py-2.5 first:pl-4 first:rounded-l-xl last:rounded-r-xl">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MOCK_APPOINTMENTS.map((apt, i) => (
                <tr key={apt.id} className="border-t border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-3 pl-4 text-sm font-semibold text-foreground">{apt.patient}</td>
                  <td className="px-3 py-3 text-sm text-muted-foreground">{apt.doctor}</td>
                  <td className="px-3 py-3 text-sm text-muted-foreground">{apt.specialty}</td>
                  <td className="px-3 py-3 text-xs font-mono text-foreground">{apt.date}</td>
                  <td className="px-3 py-3 text-xs font-mono text-foreground">{apt.time}</td>
                  <td className="px-3 py-3 text-sm text-muted-foreground">{apt.type}</td>
                  <td className="px-3 py-3"><Badge status={apt.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashLayout>
  );
}

// ─── Admin: Doctors Management ────────────────────────────────────────────────

function AdminDoctors({ user, onNavigate }: { user: User; onNavigate: (v: View) => void }) {
  return (
    <DashLayout user={user} currentView="admin-doctors" onNavigate={onNavigate} title="Manage Doctors">
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm text-muted-foreground">{MOCK_DOCTORS.length} doctors registered</p>
        <button className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-all">
          <Plus size={14} /> Add Doctor
        </button>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {MOCK_DOCTORS.map(doc => (
          <div key={doc.id} className="bg-card rounded-2xl border border-border shadow-sm p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <img src={`https://images.unsplash.com/${doc.img}?w=56&h=56&fit=crop&auto=format`} alt={doc.name} className="w-12 h-12 rounded-xl object-cover" />
                <div>
                  <p className="font-bold text-sm text-foreground">{doc.name}</p>
                  <p className="text-xs text-muted-foreground">{doc.specialty}</p>
                </div>
              </div>
              <button className="text-muted-foreground hover:text-foreground">
                <MoreVertical size={16} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-4 text-center">
              <div className="bg-background rounded-xl py-2">
                <p className="text-xs font-bold text-foreground">{doc.patients}</p>
                <p className="text-xs text-muted-foreground">Patients</p>
              </div>
              <div className="bg-background rounded-xl py-2">
                <p className="text-xs font-bold text-foreground">{doc.rating}</p>
                <p className="text-xs text-muted-foreground">Rating</p>
              </div>
              <div className="bg-background rounded-xl py-2">
                <p className={`text-xs font-bold ${doc.available ? "text-emerald-600" : "text-red-500"}`}>{doc.available ? "Active" : "Away"}</p>
                <p className="text-xs text-muted-foreground">Status</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button className="flex-1 py-2 text-xs font-semibold bg-secondary text-primary rounded-xl hover:bg-primary hover:text-white transition-all">
                View Profile
              </button>
              <button className="flex-1 py-2 text-xs font-semibold bg-muted text-muted-foreground rounded-xl hover:bg-foreground hover:text-background transition-all">
                Schedule
              </button>
            </div>
          </div>
        ))}
      </div>
    </DashLayout>
  );
}

// ─── Admin Reports ────────────────────────────────────────────────────────────

function AdminReports({ user, onNavigate }: { user: User; onNavigate: (v: View) => void }) {
  return (
    <DashLayout user={user} currentView="admin-reports" onNavigate={onNavigate} title="Reports & Analytics">
      <div className="grid lg:grid-cols-2 gap-5 mb-5">
        <div className="bg-card rounded-2xl border border-border shadow-sm p-5">
          <h2 className="font-bold text-foreground text-sm mb-4">Monthly Appointments</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={CHART_DATA}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid #E2E8F0", fontSize: "12px" }} />
              <Bar dataKey="appointments" fill="#1D4ED8" radius={[6, 6, 0, 0]} name="Appointments" />
              <Bar dataKey="patients" fill="#0EA5E9" radius={[6, 6, 0, 0]} name="New Patients" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-card rounded-2xl border border-border shadow-sm p-5">
          <h2 className="font-bold text-foreground text-sm mb-4">Department Breakdown</h2>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={PIE_DATA} cx="50%" cy="50%" outerRadius={75} paddingAngle={3} dataKey="value" label={({ name, value }: { name: string; value: number }) => `${name} ${value}%`} labelLine={false}>
                {PIE_DATA.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid #E2E8F0", fontSize: "12px" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="grid sm:grid-cols-3 gap-4">
        {[
          { title: "Appointment Summary", desc: "Monthly report for May 2026", icon: FileText },
          { title: "Patient Demographics", desc: "Age, gender, and location data", icon: Users },
          { title: "Doctor Performance", desc: "Patient satisfaction scores", icon: Star },
        ].map(({ title, desc, icon: Icon }) => (
          <div key={title} className="bg-card rounded-2xl border border-border shadow-sm p-5 flex items-start gap-4 hover:shadow-md transition-shadow cursor-pointer">
            <div className="w-10 h-10 bg-secondary rounded-xl flex items-center justify-center shrink-0">
              <Icon size={18} className="text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm text-foreground">{title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
            </div>
            <Download size={14} className="text-muted-foreground mt-0.5" />
          </div>
        ))}
      </div>
    </DashLayout>
  );
}

// ─── Root App ────────────────────────────────────────────────────────────────

const USERS: Record<Role, User> = {
  patient: { name: "Sarah Johnson", email: "sarah@example.com", role: "patient", avatar: "" },
  doctor: { name: "Dr. Michael Chen", email: "mchen@medicare.com", role: "doctor", avatar: "", specialty: "Cardiology" },
  admin: { name: "Amanda Ross", email: "admin@medicare.com", role: "admin", avatar: "" },
};

export default function App() {
  const [view, setView] = useState<View>("splash");
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const handleLogin = (role: Role) => {
    setCurrentUser(USERS[role]);
    if (role === "patient") setView("patient-dashboard");
    else if (role === "doctor") setView("doctor-dashboard");
    else setView("admin-dashboard");
  };

  const nav = (v: View) => setView(v);

  if (view === "splash") return <SplashScreen onNext={() => setView("onboarding")} />;
  if (view === "onboarding") return <OnboardingScreen onFinish={() => setView("login")} />;
  if (view === "login") return <LoginScreen onLogin={handleLogin} onNavigate={v => setView(v)} />;
  if (view === "register") return <RegisterScreen onBack={() => setView("login")} />;
  if (view === "forgot") return <ForgotScreen onBack={() => setView("login")} />;

  if (!currentUser) return <LoginScreen onLogin={handleLogin} onNavigate={v => setView(v)} />;

  // Patient routes
  if (view === "patient-dashboard") return <PatientDashboard user={currentUser} onNavigate={nav} />;
  if (view === "patient-book") return <BookAppointment user={currentUser} onNavigate={nav} />;
  if (view === "patient-appointments") return <PatientAppointments user={currentUser} onNavigate={nav} />;
  if (view === "patient-notifications") return <NotificationsPage user={currentUser} onNavigate={nav} />;
  if (view === "patient-profile") return <PatientProfile user={currentUser} onNavigate={nav} />;

  // Doctor routes
  if (view === "doctor-dashboard") return <DoctorDashboard user={currentUser} onNavigate={nav} />;
  if (view === "doctor-schedule") return <PatientAppointments user={currentUser} onNavigate={nav} />;
  if (view === "doctor-patients") return <PatientAppointments user={currentUser} onNavigate={nav} />;

  // Admin routes
  if (view === "admin-dashboard") return <AdminDashboard user={currentUser} onNavigate={nav} />;
  if (view === "admin-doctors") return <AdminDoctors user={currentUser} onNavigate={nav} />;
  if (view === "admin-patients") return <PatientAppointments user={currentUser} onNavigate={nav} />;
  if (view === "admin-reports") return <AdminReports user={currentUser} onNavigate={nav} />;

  return <PatientDashboard user={currentUser} onNavigate={nav} />;
}
