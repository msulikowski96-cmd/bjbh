/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  Calculator as CalcIcon, 
  History as HistoryIcon, 
  Settings as SettingsIcon,
  TrendingUp,
  TrendingDown,
  Scale,
  Activity,
  ChevronRight,
  ChevronLeft,
  Plus,
  Trash2,
  Info,
  LogOut,
  Search,
  Filter,
  ArrowUp,
  ArrowDown,
  Target,
  Calendar,
  Sparkles,
  Ruler
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import DemoTab from './components/DemoTab';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { format, subDays, isAfter, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { 
  UserProfile, 
  Measurement, 
  ACTIVITY_LABELS, 
  ActivityLevel,
  Gender
} from './types';
import { 
  calculateBMI, 
  calculateBMR, 
  calculateTDEE, 
  getBMICategory, 
  getBMICategoryColor 
} from './utils';
import {
  UnitSystem,
  kgToLbs,
  lbsToKg,
  cmToFtIn,
  ftInToCm,
  formatWeight,
  formatHeight
} from './units';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type Tab = 'dashboard' | 'calculator' | 'history' | 'settings' | 'demo';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [token, setToken] = useState<string | null>(localStorage.getItem('metabolic_token'));
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [historyFilter, setHistoryFilter] = useState('');
  const [historySort, setHistorySort] = useState<{ key: 'date' | 'weight' | 'bmi', order: 'asc' | 'desc' }>({ key: 'date', order: 'desc' });
  const [unitSystem, setUnitSystem] = useState<UnitSystem>('metric');
  const [showLanding, setShowLanding] = useState(true);

  const [profile, setProfile] = useState<UserProfile>({
    age: 30,
    gender: 'male',
    height: 180,
    weight: 80,
    activityLevel: 'moderately_active'
  });

  // Fetch Profile and Measurements
  useEffect(() => {
    if (!token) {
      setIsAuthLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const [profileRes, measurementsRes] = await Promise.all([
          fetch('/api/profile', { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch('/api/measurements', { headers: { 'Authorization': `Bearer ${token}` } })
        ]);

        if (profileRes.ok && measurementsRes.ok) {
          const profileData = await profileRes.json().catch(() => null);
          const measurementsData = await measurementsRes.json().catch(() => []);
          
          if (profileData) {
            setProfile(profileData);
            setUser(profileData);
          }
          setMeasurements(measurementsData || []);
        } else if (profileRes.status === 401 || profileRes.status === 403) {
          handleLogout();
        }
      } catch (error) {
        console.error("Fetch error:", error);
      } finally {
        setIsAuthLoading(false);
      }
    };

    fetchData();
  }, [token]);

  const handleLogout = () => {
    localStorage.removeItem('metabolic_token');
    setToken(null);
    setUser(null);
    setMeasurements([]);
    setShowLanding(true);
  };

  const handleAuth = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());

    const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
    
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      const text = await res.text();
      let result;
      try {
        result = JSON.parse(text);
      } catch (e) {
        result = { error: "Serwer zwrócił niepoprawną odpowiedź" };
      }

      if (res.ok) {
        localStorage.setItem('metabolic_token', result.token);
        setToken(result.token);
        setUser(result.user);
        setProfile(result.user);
      } else {
        alert(result.error || "Błąd autoryzacji");
      }
    } catch (error) {
      alert("Wystąpił błąd połączenia");
    }
  };

  const stats = useMemo(() => {
    if (measurements.length === 0) return null;
    
    const sorted = [...measurements].sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime());
    const latest = sorted[0];
    
    // 30-day progress
    const thirtyDaysAgo = subDays(new Date(), 30);
    const lastMonth = sorted.filter(m => isAfter(parseISO(m.date), thirtyDaysAgo));
    const firstInMonth = lastMonth[lastMonth.length - 1];
    const weightChange30d = lastMonth.length > 1 ? latest.weight - firstInMonth.weight : 0;
    
    // Target progress
    let targetProgress = null;
    if (profile.targetWeight) {
      const initialWeight = measurements[measurements.length - 1].weight;
      const totalToLose = initialWeight - profile.targetWeight;
      const lostSoFar = initialWeight - latest.weight;
      if (totalToLose !== 0) {
        targetProgress = Math.max(0, Math.min(100, (lostSoFar / totalToLose) * 100));
      }
    }

    // BMI Distribution
    const bmiDist = measurements.reduce((acc, m) => {
      const cat = getBMICategory(m.bmi);
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const bmiChartData = Object.entries(bmiDist).map(([name, value]) => ({ name, value }));

    return {
      latest,
      weightChange30d: Number(weightChange30d.toFixed(1)),
      bmiChartData,
      targetProgress: targetProgress !== null ? Number(targetProgress.toFixed(1)) : null,
      firstInMonth
    };
  }, [measurements, profile]);

  const filteredHistory = useMemo(() => {
    let result = [...measurements];
    if (historyFilter) {
      result = result.filter(m => 
        format(parseISO(m.date), 'PPP', { locale: pl }).toLowerCase().includes(historyFilter.toLowerCase()) ||
        m.weight.toString().includes(historyFilter) ||
        m.bmi.toString().includes(historyFilter)
      );
    }
    result.sort((a, b) => {
      let valA: any = a[historySort.key as keyof Measurement];
      let valB: any = b[historySort.key as keyof Measurement];
      if (historySort.key === 'date') {
        valA = parseISO(a.date).getTime();
        valB = parseISO(b.date).getTime();
      }
      if (historySort.order === 'asc') return valA > valB ? 1 : -1;
      return valA < valB ? 1 : -1;
    });
    return result;
  }, [measurements, historyFilter, historySort]);

  const bmrTdeeData = useMemo(() => {
    return [...measurements].reverse().map(m => ({
      date: format(parseISO(m.date), 'd MMM', { locale: pl }),
      bmr: m.bmr,
      tdee: m.tdee
    }));
  }, [measurements]);

  const addMeasurement = async (weight: number) => {
    const bmr = calculateBMR({ ...profile, weight });
    const tdee = calculateTDEE(bmr, profile.activityLevel);
    const bmi = calculateBMI(weight, profile.height);
    
    try {
      const res = await fetch('/api/measurements', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ weight, bmi, bmr, tdee })
      });

      if (res.ok) {
        const newM = await res.json();
        setMeasurements(prev => [newM, ...prev]);
        setProfile(prev => ({ ...prev, weight }));
        setActiveTab('dashboard');
      }
    } catch (error) {
      console.error(error);
    }
  };

  const deleteMeasurement = async (id: string) => {
    try {
      const res = await fetch(`/api/measurements/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setMeasurements(prev => prev.filter(m => m.id !== id));
      }
    } catch (error) {
      console.error(error);
    }
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-[#F5F5F0] flex items-center justify-center">
        <motion.div 
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="w-16 h-16 bg-[#141414] rounded-2xl flex items-center justify-center font-serif italic text-white text-3xl"
        >
          M
        </motion.div>
      </div>
    );
  }

  if (!token) {
    if (showLanding) {
      return (
        <DemoTab 
          isLanding 
          onGetStarted={() => setShowLanding(false)} 
        />
      );
    }

    return (
      <div className="min-h-screen bg-[#F5F5F0] flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white rounded-3xl p-10 shadow-xl border border-[#141414]/5"
        >
          <div className="text-center mb-10">
            <div className="w-16 h-16 bg-[#141414] text-white rounded-2xl flex items-center justify-center font-serif italic text-3xl mx-auto mb-6">
              M
            </div>
            <h2 className="text-3xl font-serif italic mb-2">MetabolicAI Pro</h2>
            <p className="text-muted-foreground text-sm">
              {authMode === 'login' ? 'Zaloguj się do swojego konta' : 'Stwórz nowe konto metaboliczne'}
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="text-[10px] uppercase tracking-widest opacity-50 block mb-2">Email</label>
              <input 
                name="email"
                type="email" 
                className="w-full bg-[#F5F5F0] border-none rounded-2xl p-4 font-mono text-sm"
                required
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest opacity-50 block mb-2">Hasło</label>
              <input 
                name="password"
                type="password" 
                className="w-full bg-[#F5F5F0] border-none rounded-2xl p-4 font-mono text-sm"
                required
              />
            </div>

            {authMode === 'register' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase tracking-widest opacity-50 block mb-2">Wiek</label>
                  <input name="age" type="number" className="w-full bg-[#F5F5F0] border-none rounded-2xl p-4 font-mono text-sm" required />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest opacity-50 block mb-2">Płeć</label>
                  <select name="gender" className="w-full bg-[#F5F5F0] border-none rounded-2xl p-4 text-sm appearance-none" required>
                    <option value="male">Mężczyzna</option>
                    <option value="female">Kobieta</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest opacity-50 block mb-2">Wzrost (cm)</label>
                  <input name="height" type="number" className="w-full bg-[#F5F5F0] border-none rounded-2xl p-4 font-mono text-sm" required />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest opacity-50 block mb-2">Waga (kg)</label>
                  <input name="weight" type="number" step="0.1" className="w-full bg-[#F5F5F0] border-none rounded-2xl p-4 font-mono text-sm" required />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] uppercase tracking-widest opacity-50 block mb-2">Aktywność</label>
                  <select name="activityLevel" className="w-full bg-[#F5F5F0] border-none rounded-2xl p-4 text-sm appearance-none" required>
                    {Object.entries(ACTIVITY_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <button 
              type="submit"
              className="w-full bg-[#141414] text-white rounded-2xl p-4 font-semibold hover:bg-opacity-90 transition-all mt-6"
            >
              {authMode === 'login' ? 'Zaloguj się' : 'Zarejestruj się'}
            </button>
          </form>

          <div className="text-center mt-8 space-y-4">
            <button 
              onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
              className="text-xs font-bold uppercase tracking-widest opacity-50 hover:opacity-100 transition-all block w-full"
            >
              {authMode === 'login' ? 'Nie masz konta? Zarejestruj się' : 'Masz już konto? Zaloguj się'}
            </button>
            <button 
              onClick={() => setShowLanding(true)}
              className="text-xs font-bold uppercase tracking-widest opacity-30 hover:opacity-100 transition-all"
            >
              Wróć do strony głównej
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F0] text-[#141414] font-sans flex">
      {/* Sidebar */}
      <motion.nav 
        initial={false}
        animate={{ width: isSidebarCollapsed ? 88 : 256 }}
        className="relative border-r border-[#141414]/10 flex flex-col bg-white/50 backdrop-blur-sm sticky top-0 h-screen z-40"
      >
        <button 
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className="absolute top-8 -right-4 w-8 h-8 bg-white border border-[#141414]/10 rounded-full flex items-center justify-center text-[#141414] hover:bg-[#F5F5F0] transition-colors z-50 shadow-sm"
        >
          {isSidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        <div className={cn("p-8 h-24 flex items-center overflow-hidden", isSidebarCollapsed ? "justify-center px-0" : "")}>
          <AnimatePresence mode="wait">
            {!isSidebarCollapsed ? (
              <motion.div 
                key="full"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20, transition: { duration: 0.1 } }}
                className="whitespace-nowrap"
              >
                <h1 className="text-2xl font-serif italic font-bold tracking-tight">MetabolicAI Pro</h1>
                <p className="text-[10px] uppercase tracking-widest opacity-50 mt-1">Advanced Health Analysis</p>
              </motion.div>
            ) : (
              <motion.div 
                key="icon"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.1 } }}
                className="w-10 h-10 bg-[#141414] text-white rounded-xl flex items-center justify-center font-serif italic font-bold text-xl"
              >
                M
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className={cn("flex-1 px-4 space-y-2 overflow-hidden", isSidebarCollapsed ? "px-2" : "")}>
          <NavButton 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')}
            icon={<LayoutDashboard size={18} />}
            label="Dashboard"
            collapsed={isSidebarCollapsed}
          />
          <NavButton 
            active={activeTab === 'calculator'} 
            onClick={() => setActiveTab('calculator')}
            icon={<CalcIcon size={18} />}
            label="Kalkulator"
            collapsed={isSidebarCollapsed}
          />
          <NavButton 
            active={activeTab === 'history'} 
            onClick={() => setActiveTab('history')}
            icon={<HistoryIcon size={18} />}
            label="Historia"
            collapsed={isSidebarCollapsed}
          />
          <NavButton 
            active={activeTab === 'settings'} 
            onClick={() => setActiveTab('settings')}
            icon={<SettingsIcon size={18} />}
            label="Profil"
            collapsed={isSidebarCollapsed}
          />
          <NavButton 
            active={activeTab === 'demo'} 
            onClick={() => setActiveTab('demo')}
            icon={<Sparkles size={18} />}
            label="Demo"
            collapsed={isSidebarCollapsed}
          />
        </div>

        <div className={cn("p-8 border-t border-[#141414]/10 overflow-hidden", isSidebarCollapsed ? "p-4 flex flex-col items-center gap-4" : "")}>
          <div className={cn("flex items-center gap-3", isSidebarCollapsed ? "justify-center" : "")}>
            <div className="w-10 h-10 rounded-full bg-[#141414] text-white flex items-center justify-center font-serif italic text-lg shrink-0">
              {profile.gender === 'male' ? 'M' : 'F'}
            </div>
            {!isSidebarCollapsed && (
              <div className="whitespace-nowrap">
                <p className="text-xs font-semibold">{profile.age} lat</p>
                <p className="text-[10px] opacity-50">{profile.height} cm • {profile.weight} kg</p>
              </div>
            )}
          </div>
          
          <button 
            onClick={handleLogout}
            className={cn(
              "flex items-center gap-3 text-red-500 hover:opacity-70 transition-all",
              isSidebarCollapsed ? "justify-center" : "mt-4 px-2"
            )}
            title="Wyloguj się"
          >
            <LogOut size={18} />
            {!isSidebarCollapsed && <span className="text-xs font-bold uppercase tracking-widest">Wyloguj</span>}
          </button>
        </div>
      </motion.nav>

      {/* Main Content */}
      <main className="flex-1 p-12 overflow-y-auto">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-12"
            >
              <header>
                <h2 className="text-4xl font-serif italic">Witaj z powrotem</h2>
                <p className="text-muted-foreground mt-2">Oto Twój aktualny stan metaboliczny.</p>
              </header>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                <StatCard 
                  label="Waga" 
                  value={formatWeight(profile.weight, unitSystem)} 
                  subValue={stats ? `${stats.weightChange30d > 0 ? '+' : ''}${unitSystem === 'metric' ? stats.weightChange30d : kgToLbs(stats.weightChange30d)} ${unitSystem === 'metric' ? 'kg' : 'lbs'} (30 dni)` : 'Brak danych'}
                  icon={<Scale className="text-blue-500" />}
                  trend={stats?.weightChange30d}
                />
                <StatCard 
                  label="BMI" 
                  value={stats?.latest.bmi.toString() || '0'} 
                  subValue={stats ? getBMICategory(stats.latest.bmi) : 'Oblicz BMI'}
                  icon={<Activity className={cn(stats ? getBMICategoryColor(stats.latest.bmi) : 'text-gray-400')} />}
                />
                <StatCard 
                  label="TDEE" 
                  value={`${calculateTDEE(calculateBMR(profile), profile.activityLevel)} kcal`} 
                  subValue="Dzienne zapotrzebowanie"
                  icon={<TrendingUp className="text-orange-500" />}
                />
                <StatCard 
                  label="Cel" 
                  value={profile.targetWeight ? formatWeight(profile.targetWeight, unitSystem) : 'Brak'} 
                  subValue={stats?.targetProgress !== null ? `Postęp: ${stats?.targetProgress}%` : 'Ustaw cel w profilu'}
                  icon={<Target className="text-purple-500" />}
                />
              </div>

              {/* Progress Section */}
              {stats && stats.firstInMonth && (
                <section className="bg-white rounded-3xl p-8 shadow-sm border border-[#141414]/5">
                  <div className="flex items-center gap-4 mb-6">
                    <Calendar className="text-blue-500" size={24} />
                    <h3 className="text-xl font-serif italic">Progres (30 dni)</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="p-6 bg-[#F5F5F0] rounded-2xl">
                      <p className="text-[10px] uppercase tracking-widest opacity-50 mb-1">Początek okresu</p>
                      <p className="text-2xl font-mono font-bold">{formatWeight(stats.firstInMonth.weight, unitSystem)}</p>
                      <p className="text-xs opacity-50 mt-1">{format(parseISO(stats.firstInMonth.date), 'PPP', { locale: pl })}</p>
                    </div>
                    <div className="p-6 bg-[#F5F5F0] rounded-2xl">
                      <p className="text-[10px] uppercase tracking-widest opacity-50 mb-1">Obecnie</p>
                      <p className="text-2xl font-mono font-bold">{formatWeight(stats.latest.weight, unitSystem)}</p>
                      <p className="text-xs opacity-50 mt-1">Najnowszy pomiar</p>
                    </div>
                    <div className={cn(
                      "p-6 rounded-2xl",
                      stats.weightChange30d <= 0 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                    )}>
                      <p className="text-[10px] uppercase tracking-widest opacity-50 mb-1 text-inherit">Zmiana netto</p>
                      <p className="text-2xl font-mono font-bold text-inherit">
                        {stats.weightChange30d > 0 ? '+' : ''}
                        {unitSystem === 'metric' ? stats.weightChange30d : kgToLbs(stats.weightChange30d)} {unitSystem === 'metric' ? 'kg' : 'lbs'}
                      </p>
                      <p className="text-xs opacity-50 mt-1 text-inherit">
                        {stats.weightChange30d <= 0 ? 'Świetna robota!' : 'Trzymaj się planu'}
                      </p>
                    </div>
                  </div>
                </section>
              )}

              {/* Charts Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <section className="bg-white rounded-3xl p-8 shadow-sm border border-[#141414]/5">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-xl font-serif italic">Trend wagi</h3>
                  </div>
                  <div className="h-[300px] w-full">
                    {measurements.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart 
                          data={[...measurements].reverse().map(m => ({
                            ...m,
                            weight: unitSystem === 'metric' ? m.weight : kgToLbs(m.weight)
                          }))}
                        >
                          <defs>
                            <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#141414" stopOpacity={0.1}/>
                              <stop offset="95%" stopColor="#141414" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#14141410" />
                          <XAxis 
                            dataKey="date" 
                            tickFormatter={(str) => format(parseISO(str), 'd MMM', { locale: pl })}
                            tick={{ fontSize: 10, fill: '#14141450' }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis 
                            domain={['dataMin - 5', 'dataMax + 5']}
                            tick={{ fontSize: 10, fill: '#14141450' }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip 
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                            labelFormatter={(str) => format(parseISO(str), 'PPP', { locale: pl })}
                            formatter={(value: number) => [`${value} ${unitSystem === 'metric' ? 'kg' : 'lbs'}`, 'Waga']}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="weight" 
                            stroke="#141414" 
                            strokeWidth={2}
                            fillOpacity={1} 
                            fill="url(#colorWeight)" 
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center opacity-30">
                        <TrendingUp size={48} />
                        <p className="mt-4">Dodaj pierwszy pomiar, aby zobaczyć wykres</p>
                      </div>
                    )}
                  </div>
                </section>

                <section className="bg-white rounded-3xl p-8 shadow-sm border border-[#141414]/5">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-xl font-serif italic">BMR & TDEE</h3>
                  </div>
                  <div className="h-[300px] w-full">
                    {measurements.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={bmrTdeeData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#14141410" />
                          <XAxis 
                            dataKey="date" 
                            tick={{ fontSize: 10, fill: '#14141450' }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis 
                            tick={{ fontSize: 10, fill: '#14141450' }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip 
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                          />
                          <Legend verticalAlign="top" height={36}/>
                          <Line type="monotone" dataKey="bmr" stroke="#3b82f6" strokeWidth={2} dot={false} name="BMR" />
                          <Line type="monotone" dataKey="tdee" stroke="#f97316" strokeWidth={2} dot={false} name="TDEE" />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center opacity-30">
                        <Activity size={48} />
                        <p className="mt-4">Brak danych do wykresu</p>
                      </div>
                    )}
                  </div>
                </section>

                <section className="bg-white rounded-3xl p-8 shadow-sm border border-[#141414]/5">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-xl font-serif italic">Rozkład BMI</h3>
                  </div>
                  <div className="h-[300px] w-full">
                    {measurements.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={stats?.bmiChartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {stats?.bmiChartData.map((entry, index) => (
                              <Cell 
                                key={`cell-${index}`} 
                                fill={
                                  entry.name === 'Niedowaga' ? '#3b82f6' :
                                  entry.name === 'Waga prawidłowa' ? '#10b981' :
                                  entry.name === 'Nadwaga' ? '#f59e0b' : '#ef4444'
                                } 
                              />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center opacity-30">
                        <Activity size={48} />
                        <p className="mt-4">Brak danych BMI</p>
                      </div>
                    )}
                  </div>
                </section>

                <section className="bg-[#141414] text-white rounded-3xl p-8">
                  <h3 className="text-xl font-serif italic mb-6">Analiza Metaboliczna</h3>
                  <div className="space-y-6">
                    <div className="flex justify-between items-end border-b border-white/10 pb-4">
                      <div>
                        <p className="text-[10px] uppercase tracking-widest opacity-50">BMR (Podstawowa przemiana materii)</p>
                        <p className="text-2xl font-mono">{calculateBMR(profile)} kcal</p>
                      </div>
                      <Info size={16} className="opacity-30" />
                    </div>
                    <div className="flex justify-between items-end border-b border-white/10 pb-4">
                      <div>
                        <p className="text-[10px] uppercase tracking-widest opacity-50">TDEE (Całkowite zapotrzebowanie)</p>
                        <p className="text-2xl font-mono">{calculateTDEE(calculateBMR(profile), profile.activityLevel)} kcal</p>
                      </div>
                      <Info size={16} className="opacity-30" />
                    </div>
                    <div className="pt-4">
                      <p className="text-sm opacity-70 leading-relaxed">
                        Twoje TDEE to ilość kalorii, którą spalasz każdego dnia, uwzględniając Twoją aktywność fizyczną. 
                        Aby schudnąć, celuj w deficyt (np. -500 kcal). Aby budować masę, celuj w nadwyżkę.
                      </p>
                    </div>
                  </div>
                </section>

                <section className="bg-white rounded-3xl p-8 border border-[#141414]/5">
                  <h3 className="text-xl font-serif italic mb-6">Szybki pomiar</h3>
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    let weight = parseFloat(formData.get('weight') as string);
                    if (weight) {
                      if (unitSystem === 'imperial') {
                        weight = lbsToKg(weight);
                      }
                      addMeasurement(weight);
                      (e.target as HTMLFormElement).reset();
                    }
                  }} className="space-y-4">
                    <div>
                      <label className="text-[10px] uppercase tracking-widest opacity-50 block mb-2">
                        Aktualna waga ({unitSystem === 'metric' ? 'kg' : 'lbs'})
                      </label>
                      <input 
                        name="weight"
                        type="number" 
                        step="0.1"
                        placeholder={unitSystem === 'metric' ? profile.weight.toString() : kgToLbs(profile.weight).toString()}
                        className="w-full bg-[#F5F5F0] border-none rounded-2xl p-4 text-xl font-mono focus:ring-2 focus:ring-[#141414]"
                        required
                      />
                    </div>
                    <button 
                      type="submit"
                      className="w-full bg-[#141414] text-white rounded-2xl p-4 font-semibold hover:bg-opacity-90 transition-all flex items-center justify-center gap-2"
                    >
                      <Plus size={18} />
                      Dodaj pomiar
                    </button>
                  </form>
                </section>
              </div>
            </motion.div>
          )}

          {activeTab === 'calculator' && (
            <motion.div
              key="calculator"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-2xl mx-auto space-y-12"
            >
              <header className="text-center">
                <h2 className="text-4xl font-serif italic">Kalkulator</h2>
                <p className="text-muted-foreground mt-2">Dostosuj swoje parametry, aby uzyskać dokładne wyniki.</p>
                <div className="flex justify-center mt-6">
                  <div className="bg-[#F5F5F0] p-1 rounded-xl inline-flex">
                    <button
                      onClick={() => setUnitSystem('metric')}
                      className={cn(
                        "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                        unitSystem === 'metric' ? "bg-white shadow-sm text-[#141414]" : "text-[#141414]/50"
                      )}
                    >
                      Metryczne (kg/cm)
                    </button>
                    <button
                      onClick={() => setUnitSystem('imperial')}
                      className={cn(
                        "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                        unitSystem === 'imperial' ? "bg-white shadow-sm text-[#141414]" : "text-[#141414]/50"
                      )}
                    >
                      Imperialne (lbs/ft)
                    </button>
                  </div>
                </div>
              </header>

              <div className="bg-white rounded-3xl p-10 shadow-sm border border-[#141414]/5 space-y-8">
                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <label className="text-[10px] uppercase tracking-widest opacity-50 block mb-3">Płeć</label>
                    <div className="flex bg-[#F5F5F0] rounded-2xl p-1">
                      <button 
                        onClick={async () => {
                          const newProfile = { ...profile, gender: 'male' as Gender };
                          setProfile(newProfile);
                          await fetch('/api/profile', {
                            method: 'PUT',
                            headers: { 
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify(newProfile)
                          });
                        }}
                        className={cn(
                          "flex-1 py-3 rounded-xl text-sm font-semibold transition-all",
                          profile.gender === 'male' ? "bg-white shadow-sm text-[#141414]" : "text-[#141414]/40"
                        )}
                      >Mężczyzna</button>
                      <button 
                        onClick={async () => {
                          const newProfile = { ...profile, gender: 'female' as Gender };
                          setProfile(newProfile);
                          await fetch('/api/profile', {
                            method: 'PUT',
                            headers: { 
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify(newProfile)
                          });
                        }}
                        className={cn(
                          "flex-1 py-3 rounded-xl text-sm font-semibold transition-all",
                          profile.gender === 'female' ? "bg-white shadow-sm text-[#141414]" : "text-[#141414]/40"
                        )}
                      >Kobieta</button>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest opacity-50 block mb-3">Wiek</label>
                    <input 
                      type="number" 
                      value={profile.age}
                      onChange={async (e) => {
                        const age = parseInt(e.target.value) || 0;
                        const newProfile = { ...profile, age };
                        setProfile(newProfile);
                        await fetch('/api/profile', {
                          method: 'PUT',
                          headers: { 
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                          },
                          body: JSON.stringify(newProfile)
                        });
                      }}
                      className="w-full bg-[#F5F5F0] border-none rounded-2xl p-4 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <label className="text-[10px] uppercase tracking-widest opacity-50 block mb-3">
                      Wzrost ({unitSystem === 'metric' ? 'cm' : 'ft/in'})
                    </label>
                    {unitSystem === 'metric' ? (
                      <input 
                        type="number" 
                        value={profile.height}
                        onChange={async (e) => {
                          const height = parseInt(e.target.value) || 0;
                          const newProfile = { ...profile, height };
                          setProfile(newProfile);
                          await fetch('/api/profile', {
                            method: 'PUT',
                            headers: { 
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify(newProfile)
                          });
                        }}
                        className="w-full bg-[#F5F5F0] border-none rounded-2xl p-4 font-mono"
                      />
                    ) : (
                      <div className="flex gap-2">
                        <input 
                          type="number" 
                          placeholder="ft"
                          value={cmToFtIn(profile.height).ft}
                          onChange={async (e) => {
                            const ft = parseInt(e.target.value) || 0;
                            const { in: inches } = cmToFtIn(profile.height);
                            const height = ftInToCm(ft, inches);
                            const newProfile = { ...profile, height };
                            setProfile(newProfile);
                            await fetch('/api/profile', {
                              method: 'PUT',
                              headers: { 
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                              },
                              body: JSON.stringify(newProfile)
                            });
                          }}
                          className="w-full bg-[#F5F5F0] border-none rounded-2xl p-4 font-mono"
                        />
                        <input 
                          type="number" 
                          placeholder="in"
                          value={cmToFtIn(profile.height).in}
                          onChange={async (e) => {
                            const inches = parseInt(e.target.value) || 0;
                            const { ft } = cmToFtIn(profile.height);
                            const height = ftInToCm(ft, inches);
                            const newProfile = { ...profile, height };
                            setProfile(newProfile);
                            await fetch('/api/profile', {
                              method: 'PUT',
                              headers: { 
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                              },
                              body: JSON.stringify(newProfile)
                            });
                          }}
                          className="w-full bg-[#F5F5F0] border-none rounded-2xl p-4 font-mono"
                        />
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest opacity-50 block mb-3">
                      Waga ({unitSystem === 'metric' ? 'kg' : 'lbs'})
                    </label>
                    <input 
                      type="number" 
                      step="0.1"
                      value={unitSystem === 'metric' ? profile.weight : kgToLbs(profile.weight)}
                      onChange={async (e) => {
                        let weight = parseFloat(e.target.value) || 0;
                        if (unitSystem === 'imperial') {
                          weight = lbsToKg(weight);
                        }
                        const newProfile = { ...profile, weight };
                        setProfile(newProfile);
                        await fetch('/api/profile', {
                          method: 'PUT',
                          headers: { 
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                          },
                          body: JSON.stringify(newProfile)
                        });
                      }}
                      className="w-full bg-[#F5F5F0] border-none rounded-2xl p-4 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] uppercase tracking-widest opacity-50 block mb-3">Poziom aktywności</label>
                  <select 
                    value={profile.activityLevel}
                    onChange={async (e) => {
                      const activityLevel = e.target.value as ActivityLevel;
                      const newProfile = { ...profile, activityLevel };
                      setProfile(newProfile);
                      await fetch('/api/profile', {
                        method: 'PUT',
                        headers: { 
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify(newProfile)
                      });
                    }}
                    className="w-full bg-[#F5F5F0] border-none rounded-2xl p-4 text-sm font-medium appearance-none"
                  >
                    {Object.entries(ACTIVITY_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>

                <div className="pt-6">
                  <div className="bg-[#141414] text-white rounded-3xl p-10 space-y-8">
                    <h3 className="text-2xl font-serif italic">Twoje Wyniki</h3>
                    <div className="grid grid-cols-2 gap-8">
                      <div>
                        <p className="text-[10px] uppercase tracking-widest opacity-50 mb-1">BMR</p>
                        <p className="text-4xl font-mono font-bold">{calculateBMR(profile)}</p>
                        <p className="text-xs opacity-50 mt-1">kcal / dzień</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-widest opacity-50 mb-1">TDEE</p>
                        <p className="text-4xl font-mono font-bold">{calculateTDEE(calculateBMR(profile), profile.activityLevel)}</p>
                        <p className="text-xs opacity-50 mt-1">kcal / dzień</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-widest opacity-50 mb-1">BMI</p>
                        <p className="text-4xl font-mono font-bold">{calculateBMI(profile.weight, profile.height)}</p>
                        <p className={cn("text-xs font-bold mt-1", getBMICategoryColor(calculateBMI(profile.weight, profile.height)))}>
                          {getBMICategory(calculateBMI(profile.weight, profile.height))}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-widest opacity-50 mb-1">Idealna waga</p>
                        <p className="text-4xl font-mono font-bold">
                          {unitSystem === 'metric' 
                            ? (21.75 * Math.pow(profile.height / 100, 2)).toFixed(1)
                            : kgToLbs(21.75 * Math.pow(profile.height / 100, 2)).toFixed(1)
                          }
                        </p>
                        <p className="text-xs opacity-50 mt-1">
                          {unitSystem === 'metric' ? 'kg' : 'lbs'} (szacunkowa)
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'history' && (
            <motion.div
              key="history"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-12"
            >
              <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                  <h2 className="text-4xl font-serif italic">Historia pomiarów</h2>
                  <p className="text-muted-foreground mt-2">Twoja droga do celu.</p>
                </div>
                <div className="flex flex-wrap gap-4 w-full md:w-auto">
                  <div className="relative flex-1 md:flex-none">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30" size={16} />
                    <input 
                      type="text" 
                      placeholder="Szukaj..."
                      value={historyFilter}
                      onChange={(e) => setHistoryFilter(e.target.value)}
                      className="pl-10 pr-4 py-2 bg-white border border-[#141414]/10 rounded-xl text-sm w-full"
                    />
                  </div>
                  <button 
                    onClick={async () => {
                      if (confirm('Czy na pewno chcesz wyczyścić całą historię?')) {
                        const res = await fetch('/api/measurements', {
                          method: 'DELETE',
                          headers: { 'Authorization': `Bearer ${token}` }
                        });
                        if (res.ok) {
                          setMeasurements([]);
                        }
                      }
                    }}
                    className="text-red-500 text-[10px] uppercase tracking-widest font-bold hover:opacity-70 transition-all flex items-center gap-2"
                  >
                    <Trash2 size={14} />
                    Wyczyść wszystko
                  </button>
                </div>
              </header>

              <div className="bg-white rounded-3xl overflow-hidden border border-[#141414]/5 shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#F5F5F0]/50 border-bottom border-[#141414]/5">
                      <th className="p-6 text-[10px] uppercase tracking-widest opacity-50">
                        <button 
                          onClick={() => setHistorySort(s => ({ key: 'date', order: s.key === 'date' && s.order === 'desc' ? 'asc' : 'desc' }))}
                          className="flex items-center gap-2"
                        >
                          Data {historySort.key === 'date' && (historySort.order === 'desc' ? <ArrowDown size={12} /> : <ArrowUp size={12} />)}
                        </button>
                      </th>
                      <th className="p-6 text-[10px] uppercase tracking-widest opacity-50">
                        <button 
                          onClick={() => setHistorySort(s => ({ key: 'weight', order: s.key === 'weight' && s.order === 'desc' ? 'asc' : 'desc' }))}
                          className="flex items-center gap-2"
                        >
                          Waga {historySort.key === 'weight' && (historySort.order === 'desc' ? <ArrowDown size={12} /> : <ArrowUp size={12} />)}
                        </button>
                      </th>
                      <th className="p-6 text-[10px] uppercase tracking-widest opacity-50">
                        <button 
                          onClick={() => setHistorySort(s => ({ key: 'bmi', order: s.key === 'bmi' && s.order === 'desc' ? 'asc' : 'desc' }))}
                          className="flex items-center gap-2"
                        >
                          BMI {historySort.key === 'bmi' && (historySort.order === 'desc' ? <ArrowDown size={12} /> : <ArrowUp size={12} />)}
                        </button>
                      </th>
                      <th className="p-6 text-[10px] uppercase tracking-widest opacity-50">BMR</th>
                      <th className="p-6 text-[10px] uppercase tracking-widest opacity-50">TDEE</th>
                      <th className="p-6 text-[10px] uppercase tracking-widest opacity-50">Akcja</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistory.map((m) => (
                      <tr key={m.id} className="border-b border-[#141414]/5 hover:bg-[#F5F5F0]/30 transition-all">
                        <td className="p-6 font-medium">{format(parseISO(m.date), 'PPP', { locale: pl })}</td>
                        <td className="p-6 font-mono">{formatWeight(m.weight, unitSystem)}</td>
                        <td className="p-6">
                          <span className={cn("font-mono", getBMICategoryColor(m.bmi))}>{m.bmi}</span>
                          <span className="text-[10px] ml-2 opacity-50">({getBMICategory(m.bmi)})</span>
                        </td>
                        <td className="p-6 font-mono text-sm">{m.bmr} kcal</td>
                        <td className="p-6 font-mono text-sm">{m.tdee} kcal</td>
                        <td className="p-6">
                          <button 
                            onClick={() => deleteMeasurement(m.id)}
                            className="text-[#141414]/30 hover:text-red-500 transition-all"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {measurements.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-20 text-center opacity-30 italic">
                          Brak zapisanych pomiarów.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {activeTab === 'settings' && (
            <motion.div
              key="settings"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="max-w-2xl mx-auto space-y-12"
            >
              <header className="text-center">
                <h2 className="text-4xl font-serif italic">Twój Profil</h2>
                <p className="text-muted-foreground mt-2">Zarządzaj swoimi danymi i preferencjami.</p>
              </header>

              <div className="bg-white rounded-3xl p-10 shadow-sm border border-[#141414]/5 space-y-8">
                <div className="flex items-center gap-6 pb-8 border-b border-[#141414]/5">
                  <div className="w-24 h-24 rounded-full bg-[#141414] text-white flex items-center justify-center font-serif italic text-4xl">
                    {profile.gender === 'male' ? 'M' : 'F'}
                  </div>
                  <div>
                    <h3 className="text-2xl font-serif italic">Użytkownik MetabolicAI</h3>
                    <p className="text-sm opacity-50">Ostatnia aktualizacja: {measurements.length > 0 ? format(parseISO(measurements[0].date), 'PPP', { locale: pl }) : 'Brak'}</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-semibold">Email konta</p>
                      <p className="text-xs opacity-50">{user?.email}</p>
                    </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-semibold">Cel wagowy</p>
                      <p className="text-xs opacity-50">Ustaw swoją docelową wagę.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input 
                        type="number" 
                        step="0.1"
                        value={profile.targetWeight 
                          ? (unitSystem === 'metric' ? profile.targetWeight : kgToLbs(profile.targetWeight)) 
                          : ''}
                        onChange={async (e) => {
                          let targetWeight = parseFloat(e.target.value) || 0;
                          if (unitSystem === 'imperial') {
                            targetWeight = lbsToKg(targetWeight);
                          }
                          const newProfile = { ...profile, targetWeight };
                          setProfile(newProfile);
                          await fetch('/api/profile', {
                            method: 'PUT',
                            headers: { 
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify(newProfile)
                          });
                        }}
                        placeholder={unitSystem === 'metric' ? 'kg' : 'lbs'}
                        className="w-24 bg-[#F5F5F0] border-none rounded-xl p-2 text-sm font-mono text-right"
                      />
                      <span className="text-xs opacity-50">{unitSystem === 'metric' ? 'kg' : 'lbs'}</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-semibold">Eksportuj dane</p>
                      <p className="text-xs opacity-50">Pobierz swoją historię w formacie JSON.</p>
                    </div>
                    <button 
                      onClick={() => {
                        const dataStr = JSON.stringify({ profile, measurements }, null, 2);
                        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
                        const exportFileDefaultName = 'metabolic_ai_data.json';
                        const linkElement = document.createElement('a');
                        linkElement.setAttribute('href', dataUri);
                        linkElement.setAttribute('download', exportFileDefaultName);
                        linkElement.click();
                      }}
                      className="px-6 py-2 border border-[#141414] rounded-xl text-xs font-bold hover:bg-[#141414] hover:text-white transition-all"
                    >
                      Eksportuj
                    </button>
                  </div>

                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-semibold text-red-500">Wyloguj się</p>
                      <p className="text-xs opacity-50">Zakończ obecną sesję.</p>
                    </div>
                    <button 
                      onClick={handleLogout}
                      className="px-6 py-2 bg-red-500 text-white rounded-xl text-xs font-bold hover:bg-red-600 transition-all"
                    >
                      Wyloguj
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'demo' && (
            <motion.div
              key="demo"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="h-full"
            >
              <DemoTab />
            </motion.div>
          )}
        </AnimatePresence>

        <footer className="mt-20 pt-8 border-t border-[#141414]/5 text-center">
          <p className="text-[10px] uppercase tracking-widest opacity-30">
            © 2026 MetabolicAI Pro • Advanced Metabolic Intelligence
          </p>
        </footer>
      </main>
    </div>
  );
}

function NavButton({ active, onClick, icon, label, collapsed }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string, collapsed?: boolean }) {
  return (
    <button 
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={cn(
        "w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all group",
        active ? "bg-[#141414] text-white shadow-lg" : "hover:bg-[#141414]/5 text-[#141414]/60",
        collapsed ? "justify-center px-0" : ""
      )}
    >
      <span className={cn(active ? "text-white" : "group-hover:text-[#141414]")}>{icon}</span>
      {!collapsed && <span className="text-sm font-medium whitespace-nowrap">{label}</span>}
      {active && !collapsed && <ChevronRight size={14} className="ml-auto opacity-50" />}
    </button>
  );
}

function StatCard({ label, value, subValue, icon, trend }: { label: string, value: string, subValue: string, icon: React.ReactNode, trend?: number }) {
  return (
    <div className="bg-white rounded-3xl p-8 shadow-sm border border-[#141414]/5 flex flex-col justify-between h-48">
      <div className="flex justify-between items-start">
        <div className="p-3 bg-[#F5F5F0] rounded-2xl">
          {icon}
        </div>
        {trend !== undefined && trend !== 0 && (
          <div className={cn(
            "flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full",
            trend < 0 ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
          )}>
            {trend < 0 ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
            {Math.abs(trend)}
          </div>
        )}
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-widest opacity-50 mb-1">{label}</p>
        <p className="text-3xl font-mono font-bold">{value}</p>
        <p className="text-xs opacity-50 mt-1">{subValue}</p>
      </div>
    </div>
  );
}
