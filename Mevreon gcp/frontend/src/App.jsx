import React, { useState, useEffect, useRef, useMemo, useCallback, createContext, useContext } from 'react';
import { 
  S3Client, 
  PutObjectCommand, 
  GetObjectCommand, 
  ListObjectsV2Command,
  DeleteObjectCommand 
} from './lib/gcpStorage';
import { 
  LayoutDashboard, Upload, FileText, Network, RefreshCw, 
  X, Activity, BarChart3, BrainCircuit, ShieldCheck, 
  Database, CheckCircle2, Loader2, FileCode, 
  ChevronRight, AlertTriangle, User, Clock, Stethoscope, 
  ArrowLeft, Search, Layers, AlertOctagon, Terminal,
  FileJson, Filter, Trash2, Eye, Download, Zap,
  Play, Pause, CheckCircle, XCircle, Clock3,
  TrendingUp, Calendar, Pill, TestTube, Heart,
  Brain, FileCheck, MessageSquare, Code, Table,
  Sparkles, ChevronDown, ChevronUp, FolderOpen,
  FilePlus, Settings, Bell, BarChart, LineChart,
  PieChart, Share2, Copy, ExternalLink, Maximize2,
  Minimize2, Save, RotateCw, AlertCircle, Info,
  HelpCircle, Menu, SlidersHorizontal, Star,
  Bookmark, Tag, Archive, Send, Edit, Plus,
  Minus, Lock, Unlock, GitBranch, Package,
  Workflow, Box, Boxes, Component, Cpu, HardDrive,
  Sun, Moon, Monitor, Palette, Home, FileArchive,
  FolderTree, List, Grid, MoreVertical, Folder,
  History, BookOpen, ClipboardList, FileBarChart,
  Users, Building, MapPin, Phone, Mail, Globe,
  Shield, Key, Server, Cloud, Wifi, WifiOff,
  Battery, BatteryCharging, Thermometer, Gauge,
  Timer, Hourglass, CalendarDays, CalendarClock, ArrowUpDown, Target,
  Lightbulb, ArrowRight
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import PipelineLanding from './pages/PipelineLanding.jsx';
import EvidenceViewer from './components/EvidenceViewer.jsx';
import MedicationsPanel from './components/MedicationsPanel.jsx';
import { format, formatDistanceToNow, parseISO, isValid } from 'date-fns';
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ZAxis,
} from 'recharts';

/**
 * ═══════════════════════════════════════════════════════════════
 * MEVREON MULTIMODAL MEDICAL AI AGENTIC PLATFORM v8.0
 * ═══════════════════════════════════════════════════════════════
 * 4000+ Lines | Light/Dark Mode | Unbreakable Error Handling
 * Complete S3 Bucket File Discovery | Structured File Display
 * Longitudinal Summary Priority | Multi-Page Navigation
 * Clinical Dashboard | Patient Vitals | Medication Tracker
 * Agent Pipeline Visualization | Encounter History
 * Diagnostic Codes | Care Plan | Integrated File Preview
 */

// ═══════════════════════════════════════════════════════════════
// ERROR BOUNDARY CLASS COMPONENT
// ═══════════════════════════════════════════════════════════════

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white p-8">
          <div className="max-w-lg text-center">
            <div className="p-6 bg-slate-900 rounded-2xl border border-slate-800 mb-6">
              <AlertOctagon size={64} className="text-rose-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Application Error</h2>
              <p className="text-slate-400 mb-4">
                {this.state.error?.message || 'An unexpected error occurred'}
              </p>
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null, errorInfo: null });
                  window.location.reload();
                }}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all"
              >
                Reload Application
              </button>
            </div>
            <p className="text-xs text-slate-600">Mevreon Multimodal Medical AI Agentic Platform v8.0</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ═══════════════════════════════════════════════════════════════
// THEME CONTEXT & PROVIDER
// ═══════════════════════════════════════════════════════════════

const ThemeContext = createContext({ theme: 'dark', toggleTheme: () => {} });

const useTheme = () => useContext(ThemeContext);

const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('mevreon_theme') || 'dark';
    } catch { return 'dark'; }
  });

  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('mevreon_theme', next); } catch {}
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

// ═══════════════════════════════════════════════════════════════
// CONFIGURATION & UTILITIES
// ═══════════════════════════════════════════════════════════════

const CONFIG = {
  region: "us-east-1",
    buckets: {
    RAW: "mevreon-raw-gcp",
    STAGING: "mevreon-staging-gcp",
    PROCESSED: "mevreon-processed-gcp",
    CURATED: "mevreon-curated-gcp",
    MEMORY: "mevreon-memory-gcp",
    QUARANTINE: "mevreon-quarantine-gcp"
  },
  pollInterval: 5000,
    agents: [
    { id: 'ingestion', name: 'Ingestion Agent', icon: Database, color: 'blue', description: 'Extracts raw structured data from medical documents', step: 1, bucket: 'STAGING' },
    { id: 'cleaning', name: 'Cleaning Agent', icon: Sparkles, color: 'cyan', description: 'Standardizes, deduplicates and codes clinical data', step: 2, bucket: 'PROCESSED' },
    { id: 'validation', name: 'Validation Agent', icon: ShieldCheck, color: 'emerald', description: 'Validates clinical accuracy, drug interactions and risk scoring', step: 3, bucket: 'PROCESSED' },
    { id: 'feature', name: 'Feature Agent', icon: BrainCircuit, color: 'indigo', description: 'Synthesizes longitudinal patient narrative and clinical dashboard', step: 4, bucket: 'CURATED' }
  ],
  supportedFormats: ['.pdf', '.txt', '.json', '.xml', '.csv', '.tsv', '.docx', '.png', '.jpg', '.jpeg', '.tiff', '.bmp', '.dcm', '.dicom', '.hl7', '.hcp', '.vcf', '.parquet'],
  views: ['DASHBOARD', 'UPLOAD', 'CASE', 'SUMMARY', 'SETTINGS', 'HISTORY']
};

function cn(...inputs) {
  try {
    return twMerge(clsx(inputs));
  } catch {
    return inputs.filter(Boolean).join(' ');
  }
}

const formatBytes = (bytes) => {
  try {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  } catch {
    return '0 B';
  }
};

const safeParseJSON = (str, fallback = null) => {
  try { return JSON.parse(str); } 
  catch { return fallback; }
};

const safeDate = (dateStr) => {
  if (!dateStr) return null;
  try {
    const date = typeof dateStr === 'string' ? parseISO(dateStr) : new Date(dateStr);
    return isValid(date) ? date : null;
  } catch { return null; }
};

const safeFormat = (date, formatStr = 'MMM dd, yyyy HH:mm') => {
  const parsed = safeDate(date);
  if (!parsed) return 'N/A';
  try { return format(parsed, formatStr); } 
  catch { return 'N/A'; }
};

const safeFormatDistance = (date) => {
  const parsed = safeDate(date);
  if (!parsed) return 'Unknown';
  try { return formatDistanceToNow(parsed, { addSuffix: true }); }
  catch { return 'Unknown'; }
};

const safeGet = (obj, path, defaultVal = null) => {
  if (!obj) return defaultVal;
  try {
    const keys = path.split('.');
    let result = obj;
    for (const key of keys) {
      if (result === null || result === undefined) return defaultVal;
      result = result[key];
    }
    return result ?? defaultVal;
  } catch {
    return defaultVal;
  }
};

const safeArray = (val) => {
  try {
    return Array.isArray(val) ? val : (val ? [val] : []);
  } catch {
    return [];
  }
};

const safeString = (val) => {
  try {
    if (typeof val === 'string') return val;
    if (val === null || val === undefined) return '';
    if (typeof val === 'object') return JSON.stringify(val, null, 2);
    return String(val);
  } catch {
    return '';
  }
};

const getCaseRawFileCount = (caseData) => {
  try {
    return Number(caseData?.rawFileCount ?? caseData?.rawFiles?.length ?? 0);
  } catch {
    return 0;
  }
};

// ═══════════════════════════════════════════════════════════════
// NARRATIVE RAW RESPONSE PARSER - Extracts narrative from raw_response
// ═══════════════════════════════════════════════════════════════

const parseNarrativeData = (data) => {
  try {
    if (!data) return null;
    
    // If no parse_error, return as-is
    if (!data.parse_error) return data;
    
    // Has parse_error, try to extract from raw_response
    const raw = data.raw_response;
    if (!raw || typeof raw !== 'string') return data;
    
    // Strip markdown code fences (```json ... ```)
    let jsonStr = raw;
    jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
    
    // Try to parse the full JSON
    try {
      const parsed = JSON.parse(jsonStr);
      return { ...parsed, _system_meta: data.system_meta, _raw_available: true, _original_case_id: data.case_id };
    } catch {
      // JSON is likely truncated from the model output - extract what we can
      const extracted = {};
      
      // Extract case_id
      try {
        const caseMatch = jsonStr.match(/"case_id"\s*:\s*"([^"]*)"/); 
        if (caseMatch) extracted.case_id = caseMatch[1];
      } catch {}
      
      // Extract summary_type
      try {
        const typeMatch = jsonStr.match(/"summary_type"\s*:\s*"([^"]*)"/); 
        if (typeMatch) extracted.summary_type = typeMatch[1];
      } catch {}
      
      // Extract generation_date
      try {
        const dateMatch = jsonStr.match(/"generation_date"\s*:\s*"([^"]*)"/); 
        if (dateMatch) extracted.generation_date = dateMatch[1];
      } catch {}
      
      // Extract files_integrated array
      try {
        const filesSection = jsonStr.match(/"files_integrated"\s*:\s*(\[[\s\S]*?\]\s*(?:,|\}))/); 
        if (filesSection) {
          try { extracted.files_integrated = JSON.parse(filesSection[1].replace(/,\s*$/, '')); } catch {}
        }
      } catch {}
      
      // Extract patient_profile object
      try {
        const profileMatch = jsonStr.match(/"patient_profile"\s*:\s*\{([\s\S]*?)\}\s*,\s*"(?:longitudinal|clinical)/); 
        if (profileMatch) {
          try { extracted.patient_profile = JSON.parse('{' + profileMatch[1] + '}'); } catch {}
        }
        // Fallback: extract summary_snippet
        if (!extracted.patient_profile) {
          const snippetMatch = jsonStr.match(/"summary_snippet"\s*:\s*"([^"]*(?:\\"[^"]*)*)"/); 
          const ageMatch = jsonStr.match(/"age"\s*:\s*"([^"]*)"/); 
          const genderMatch = jsonStr.match(/"gender"\s*:\s*"([^"]*)"/); 
          const baselineMatch = jsonStr.match(/"baseline_status"\s*:\s*"([^"]*(?:\\"[^"]*)*)"/); 
          if (snippetMatch || ageMatch) {
            extracted.patient_profile = {
              age: ageMatch ? ageMatch[1] : 'Unknown',
              gender: genderMatch ? genderMatch[1] : 'Unknown',
              baseline_status: baselineMatch ? baselineMatch[1].replace(/\\"/g, '"') : '',
              summary_snippet: snippetMatch ? snippetMatch[1].replace(/\\"/g, '"') : ''
            };
          }
        }
        // Extract key_characteristics array
        try {
          const charMatch = jsonStr.match(/"key_characteristics"\s*:\s*(\[[\s\S]*?\])/); 
          if (charMatch && extracted.patient_profile) {
            try { extracted.patient_profile.key_characteristics = JSON.parse(charMatch[1]); } catch {}
          }
        } catch {}
      } catch {}
      
      // Extract longitudinal_narrative.narrative_text
      try {
        const narrativeMatch = jsonStr.match(/"narrative_text"\s*:\s*"([\s\S]*?)(?:"\s*[,}]|$)/);
        if (narrativeMatch) {
          let text = narrativeMatch[1];
          // Unescape common escape sequences
          text = text.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
          extracted.longitudinal_narrative = { narrative_text: text };
        }
      } catch {}
      
      // If we extracted useful data, return it
      if (Object.keys(extracted).length > 0) {
        return { ...extracted, _system_meta: data.system_meta, _raw_available: true, _raw_truncated: true };
      }
      
      // Last resort: treat the entire raw_response as narrative text
      return {
        ...data,
        longitudinal_narrative: { narrative_text: raw },
        _system_meta: data.system_meta,
        _raw_available: true,
        _raw_truncated: true
      };
    }
  } catch {
    return data;
  }
};

// Patient counter stored globally
let patientCounter = 0;
const getPatientNumber = () => {
  try {
    const stored = localStorage.getItem('mevreon_patient_counter');
    patientCounter = stored ? parseInt(stored) : 0;
  } catch {
    patientCounter = 0;
  }
  patientCounter++;
  try {
    localStorage.setItem('mevreon_patient_counter', String(patientCounter));
  } catch {}
  return patientCounter;
};

// ═══════════════════════════════════════════════════════════════
// THEME-AWARE STYLING UTILITIES
// ═══════════════════════════════════════════════════════════════

const getThemeClasses = (theme) => ({
  bg: theme === 'dark' ? 'bg-slate-950' : 'bg-gray-50',
  bgSecondary: theme === 'dark' ? 'bg-slate-900' : 'bg-white',
  bgTertiary: theme === 'dark' ? 'bg-slate-800' : 'bg-gray-100',
  bgHover: theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-gray-200',
  border: theme === 'dark' ? 'border-slate-800' : 'border-gray-200',
  borderHover: theme === 'dark' ? 'hover:border-slate-700' : 'hover:border-gray-300',
  text: theme === 'dark' ? 'text-slate-200' : 'text-gray-800',
  textSecondary: theme === 'dark' ? 'text-slate-400' : 'text-gray-600',
  textMuted: theme === 'dark' ? 'text-slate-500' : 'text-gray-500',
  input: theme === 'dark' ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-gray-300 text-gray-900',
  card: theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-200 shadow-sm',
  accent: theme === 'dark' ? 'text-teal-400' : 'text-teal-600',
  accentBg: theme === 'dark' ? 'bg-teal-500/10' : 'bg-teal-50',
});

// ═══════════════════════════════════════════════════════════════
// ANIMATED COMPONENTS LIBRARY
// ═══════════════════════════════════════════════════════════════

const AnimatedCounter = ({ value, duration = 1000, suffix = '' }) => {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    try {
      const numValue = parseInt(value) || 0;
      if (numValue === 0) { setCount(0); return; }
      
      let start = 0;
      const increment = numValue / 60;
      let frame = 0;
      
      const timer = setInterval(() => {
        frame++;
        start += increment;
        if (frame >= 60) {
          clearInterval(timer);
          setCount(numValue);
        } else {
          setCount(Math.floor(start));
        }
      }, duration / 60);
      
      return () => clearInterval(timer);
    } catch {
      setCount(parseInt(value) || 0);
    }
  }, [value, duration]);
  
  return <span>{count}{suffix}</span>;
};

const ProgressBar = ({ value = 0, max = 100, className, color = 'teal' }) => {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  const colorClasses = {
    teal: 'bg-teal-500',
    indigo: 'bg-indigo-500',
    emerald: 'bg-emerald-500',
    rose: 'bg-rose-500',
    amber: 'bg-amber-500',
    blue: 'bg-blue-500',
    cyan: 'bg-cyan-500',
    violet: 'bg-violet-500'
  };
  
  return (
    <div className={cn("h-2 bg-slate-800 rounded-full overflow-hidden", className)}>
      <div 
        className={cn("h-full transition-all duration-500 ease-out rounded-full", colorClasses[color] || colorClasses.teal)}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
};

const PulsingDot = ({ color = 'emerald', size = 'sm' }) => {
  const sizeClasses = { sm: 'h-2 w-2', md: 'h-3 w-3', lg: 'h-4 w-4' };
  const colorClasses = {
    emerald: 'bg-emerald-500',
    indigo: 'bg-indigo-500',
    rose: 'bg-rose-500',
    amber: 'bg-amber-500',
    blue: 'bg-blue-500'
  };
  
  return (
    <span className="relative flex items-center justify-center">
      <span className={cn(sizeClasses[size], colorClasses[color] || 'bg-emerald-500', "rounded-full animate-ping absolute opacity-75")} />
      <span className={cn(sizeClasses[size], colorClasses[color] || 'bg-emerald-500', "rounded-full relative")} />
    </span>
  );
};

const Spinner = ({ size = 'md', className }) => {
  const sizes = { sm: 'h-4 w-4', md: 'h-8 w-8', lg: 'h-12 w-12', xl: 'h-16 w-16' };
  return <Loader2 className={cn(sizes[size], "animate-spin text-teal-500", className)} />;
};

const EmptyState = ({ icon: Icon, title, description, action, theme }) => {
  const t = getThemeClasses(theme || 'dark');
  return (
    <div className={cn("flex flex-col items-center justify-center py-16", t.text)}>
      <div className={cn("p-6 rounded-2xl mb-6", t.bgTertiary)}>
        {Icon ? <Icon size={48} className={t.textMuted} /> : <Database size={48} className={t.textMuted} />}
      </div>
      <h3 className="text-xl font-bold mb-2">{title || 'No Data'}</h3>
      <p className={cn("text-sm mb-6 text-center max-w-md", t.textSecondary)}>{description || ''}</p>
      {action}
    </div>
  );
};

const ErrorBoundaryFallback = ({ error, resetError, theme }) => {
  const t = getThemeClasses(theme);
  return (
    <div className={cn("flex flex-col items-center justify-center p-8", t.bg, t.text)}>
      <AlertOctagon size={48} className="text-rose-500 mb-4" />
      <h3 className="text-xl font-bold mb-2">Something went wrong</h3>
      <p className={cn("text-sm mb-4", t.textSecondary)}>{error?.message || 'An unexpected error occurred'}</p>
      <button onClick={resetError} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">
        Try Again
      </button>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// MEDICAL ANIMATION COMPONENTS
// ═══════════════════════════════════════════════════════════════

// Heartbeat / ECG Line Animation
const HeartbeatLine = ({ className, color = 'currentColor' }) => (
  <svg viewBox="0 0 800 100" className={cn("w-full", className)} preserveAspectRatio="none">
    <polyline
      fill="none"
      stroke={color}
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      points="0,50 80,50 120,50 150,50 170,20 185,80 200,30 215,65 230,45 260,50 380,50 420,50 450,50 470,15 485,85 500,25 515,70 530,45 560,50 680,50 720,50 750,50 770,20 785,80 800,50"
      className="heartbeat-line-animate"
    />
  </svg>
);

// Animated Medical Cross Logo with Pulse
const MedicalCrossLogo = ({ size = 48, className, animated = true }) => (
  <div className={cn("relative flex items-center justify-center", className)}>
    {animated && <div className="absolute inset-0 rounded-full bg-teal-500/20 animate-ping" style={{ animationDuration: '2s' }} />}
    {animated && <div className="absolute inset-1 rounded-full bg-teal-500/10 animate-pulse" style={{ animationDuration: '3s' }} />}
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className="relative z-10">
      <circle cx="24" cy="24" r="23" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
      <rect x="19" y="8" width="10" height="32" rx="3" fill="currentColor" />
      <rect x="8" y="19" width="32" height="10" rx="3" fill="currentColor" />
    </svg>
  </div>
);

// DNA Helix Animation (simplified double-strand effect)
const DNAHelixAnimation = ({ className }) => (
  <div className={cn("flex items-center gap-1", className)}>
    {[...Array(12)].map((_, i) => (
      <div
        key={i}
        className="w-1 bg-teal-400/60 rounded-full dna-strand-animate"
        style={{
          height: '18px',
          animationDelay: `${i * 0.12}s`,
          animationDuration: '1.8s'
        }}
      />
    ))}
  </div>
);

// Stethoscope Pulse Ring
const StethoscopePulse = ({ className }) => (
  <div className={cn("relative inline-flex items-center justify-center", className)}>
    <div className="absolute h-20 w-20 rounded-full bg-teal-500/10 animate-ping" style={{ animationDuration: '2.5s' }} />
    <div className="absolute h-16 w-16 rounded-full bg-teal-500/10 animate-pulse" style={{ animationDuration: '2s' }} />
    <div className="h-12 w-12 rounded-full bg-gradient-to-br from-teal-600 to-cyan-600 flex items-center justify-center shadow-lg shadow-teal-500/20">
      <Stethoscope size={24} className="text-white" />
    </div>
  </div>
);

// Medical Shield Badge
const MedicalShieldBadge = ({ label, className, theme }) => {
  const t = getThemeClasses(theme || 'dark');
  return (
    <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-full border", t.bgTertiary, t.border, className)}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-emerald-400">
        <path d="M12 2L3 7v5c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z" fill="currentColor" opacity="0.2" />
        <path d="M12 2L3 7v5c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z" stroke="currentColor" strokeWidth="1.5" />
        <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className={cn("text-xs font-bold", t.textMuted)}>{label || 'HIPAA'}</span>
    </div>
  );
};

// Narrative Markdown Renderer - renders emoji-sectioned V8.0 clinical narratives
const NarrativeMarkdownRenderer = ({ text, theme }) => {
  const t = getThemeClasses(theme || 'dark');
  if (!text) return null;

  // Emoji → section style mapping for V8.0 format
  const EMOJI_SECTIONS = {
    '🧾': { icon: User, color: 'text-blue-400', border: 'border-blue-500/30', bg: 'bg-blue-500/10', gradient: 'from-blue-500 to-blue-400', label: 'Patient Summary' },
    '🔴': { icon: AlertCircle, color: 'text-rose-400', border: 'border-rose-500/30', bg: 'bg-rose-500/10', gradient: 'from-rose-500 to-pink-400', label: 'Findings' },
    '🟠': { icon: Activity, color: 'text-orange-400', border: 'border-orange-500/30', bg: 'bg-orange-500/10', gradient: 'from-orange-500 to-amber-400', label: 'Symptoms' },
    '💊': { icon: Pill, color: 'text-violet-400', border: 'border-violet-500/30', bg: 'bg-violet-500/10', gradient: 'from-violet-500 to-purple-400', label: 'Treatment' },
    '🧪': { icon: TestTube, color: 'text-cyan-400', border: 'border-cyan-500/30', bg: 'bg-cyan-500/10', gradient: 'from-cyan-500 to-sky-400', label: 'Labs' },
    '🧠': { icon: Brain, color: 'text-indigo-400', border: 'border-indigo-500/30', bg: 'bg-indigo-500/10', gradient: 'from-indigo-500 to-blue-400', label: 'Interpretation' },
    '⚠️': { icon: AlertTriangle, color: 'text-amber-400', border: 'border-amber-500/30', bg: 'bg-amber-500/10', gradient: 'from-amber-500 to-yellow-400', label: 'Important' },
    '🥗': { icon: Heart, color: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10', gradient: 'from-emerald-500 to-green-400', label: 'Lifestyle' },
    '🔁': { icon: ClipboardList, color: 'text-green-400', border: 'border-green-500/30', bg: 'bg-green-500/10', gradient: 'from-green-500 to-emerald-400', label: 'Follow-up' },
    '📌': { icon: Target, color: 'text-teal-400', border: 'border-teal-500/30', bg: 'bg-teal-500/10', gradient: 'from-teal-500 to-cyan-400', label: 'Summary' },
    '🩺': { icon: Stethoscope, color: 'text-teal-400', border: 'border-teal-500/30', bg: 'bg-teal-500/10', gradient: 'from-teal-500 to-cyan-400', label: 'Clinical' },
    '🩸': { icon: TestTube, color: 'text-red-400', border: 'border-red-500/30', bg: 'bg-red-500/10', gradient: 'from-red-500 to-rose-400', label: 'Blood' },
    '🦠': { icon: Shield, color: 'text-lime-400', border: 'border-lime-500/30', bg: 'bg-lime-500/10', gradient: 'from-lime-500 to-green-400', label: 'Infection' },
  };

  // Keyword-based fallback for non-emoji headings (markdown H2/H3)
  const getSectionStyle = (heading) => {
    const h = (heading || '').toLowerCase();
    if (h.includes('patient') || h.includes('demographics')) return EMOJI_SECTIONS['🧾'];
    if (h.includes('finding') || h.includes('diagnos') || h.includes('neuro') || h.includes('gastro') || h.includes('imaging') || h.includes('dicom') || h.includes('hematol') || h.includes('hepat') || h.includes('renal')) return EMOJI_SECTIONS['🔴'];
    if (h.includes('symptom')) return EMOJI_SECTIONS['🟠'];
    if (h.includes('treatment') || h.includes('medication') || h.includes('drug')) return EMOJI_SECTIONS['💊'];
    if (h.includes('lab') || h.includes('blood') || h.includes('test')) return EMOJI_SECTIONS['🧪'];
    if (h.includes('interpretation') || h.includes('clinical') && h.includes('overall')) return EMOJI_SECTIONS['🧠'];
    if (h.includes('importance') || h.includes('risk') || h.includes('warning') || h.includes('alert')) return EMOJI_SECTIONS['⚠️'];
    if (h.includes('diet') || h.includes('lifestyle') || h.includes('nutrition')) return EMOJI_SECTIONS['🥗'];
    if (h.includes('follow') || h.includes('next step') || h.includes('plan')) return EMOJI_SECTIONS['🔁'];
    if (h.includes('summary') || h.includes('one-line') || h.includes('core')) return EMOJI_SECTIONS['📌'];
    return { icon: Brain, color: 'text-cyan-400', border: 'border-cyan-500/30', bg: 'bg-cyan-500/10', gradient: 'from-cyan-500 to-teal-400', label: 'Clinical' };
  };

  // Detect if a line starts with an emoji section header
  const getEmojiSection = (line) => {
    for (const [emoji, style] of Object.entries(EMOJI_SECTIONS)) {
      if (line.startsWith(emoji)) return { emoji, style, rest: line.slice(emoji.length).trim() };
    }
    return null;
  };

  // Render inline markdown (bold, code, → arrows)
  const renderInline = (text) => {
    return text
      .replace(/\*\*([^*]+)\*\*/g, '<strong class="text-teal-300 font-bold">$1</strong>')
      .replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 rounded bg-slate-800 text-cyan-300 text-xs font-mono">$1</code>')
      .replace(/→/g, '<span class="text-amber-400 font-bold mx-0.5">→</span>')
      .replace(/➡/g, '<span class="text-amber-400 font-bold mx-0.5">➡</span>')
      .replace(/↑/g, '<span class="text-rose-400 font-bold">↑</span>')
      .replace(/↓/g, '<span class="text-blue-400 font-bold">↓</span>')
      .replace(/⚠️/g, '<span class="text-amber-400">⚠️</span>');
  };

  try {
    const lines = text.split('\n');
    return (
      <div className="narrative-content space-y-1.5">
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          if (!trimmed) return <div key={idx} className="h-2" />;

          // Horizontal rule ---
          if (/^-{3,}$/.test(trimmed) || /^\*{3,}$/.test(trimmed) || /^_{3,}$/.test(trimmed)) {
            return <div key={idx} className="my-4 h-px bg-gradient-to-r from-transparent via-teal-500/40 to-transparent" />;
          }

          // Emoji section headers (🧾 **Patient Summary** – ...)
          const emojiMatch = getEmojiSection(trimmed);
          if (emojiMatch) {
            const { emoji, style, rest } = emojiMatch;
            const SectionIcon = style.icon;
            const heading = rest.replace(/\*\*/g, '');
            return (
              <div key={idx} className={cn("mt-6 mb-3")}>
                <div className={cn("flex items-center gap-3 p-3 rounded-xl border-l-4", style.border, style.bg)}>
                  <span className="text-2xl flex-shrink-0">{emoji}</span>
                  <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0", style.bg)}>
                    <SectionIcon size={18} className={style.color} />
                  </div>
                  <h2 className={cn("text-lg font-black bg-gradient-to-r bg-clip-text text-transparent flex-1", style.gradient)}>
                    {heading}
                  </h2>
                </div>
              </div>
            );
          }

          // H1
          if (trimmed.startsWith('# ') && !trimmed.startsWith('## ')) {
            const heading = trimmed.replace('# ', '').replace(/\*\*/g, '');
            return (
              <h1 key={idx} className={cn("text-2xl font-black mt-6 mb-3 bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent")}>
                {heading}
              </h1>
            );
          }
          // H2 — section-aware color
          if (trimmed.startsWith('## ')) {
            const heading = trimmed.replace('## ', '').replace(/\*\*/g, '');
            const style = getSectionStyle(heading);
            const SectionIcon = style.icon;
            return (
              <div key={idx} className={cn("mt-8 mb-4")}>
                <div className={cn("flex items-center gap-3 pb-3 border-b-2", style.border)}>
                  <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", style.bg)}>
                    <SectionIcon size={18} className={style.color} />
                  </div>
                  <h2 className={cn("text-xl font-bold bg-gradient-to-r bg-clip-text text-transparent", style.gradient)}>
                    {heading}
                  </h2>
                </div>
              </div>
            );
          }
          // H3 — subsection with colored accent
          if (trimmed.startsWith('### ')) {
            const heading = trimmed.replace('### ', '').replace(/\*\*/g, '');
            const style = getSectionStyle(heading);
            const SectionIcon = style.icon;
            return (
              <div key={idx} className={cn("mt-6 mb-3")}>
                <div className={cn("flex items-center gap-2.5")}>
                  <div className={cn("h-1.5 w-1.5 rounded-full", style.color.replace('text-', 'bg-'))} />
                  <SectionIcon size={16} className={cn(style.color, "flex-shrink-0")} />
                  <h3 className={cn("text-lg font-bold", t.text)}>{heading}</h3>
                </div>
              </div>
            );
          }
          // H4 — with left border accent
          if (trimmed.startsWith('#### ')) {
            const heading = trimmed.replace('#### ', '').replace(/\*\*/g, '');
            const style = getSectionStyle(heading);
            return (
              <h4 key={idx} className={cn("text-base font-bold mt-5 mb-2 pl-3 border-l-2", style.border, t.text)}>
                {heading}
              </h4>
            );
          }

          // Sub-bullets (indented: "  - " or "    - ")
          const subBulletMatch = line.match(/^(\s{2,})[-*]\s+(.+)/);
          if (subBulletMatch) {
            const indent = Math.min(Math.floor(subBulletMatch[1].length / 2), 4);
            const content = renderInline(subBulletMatch[2]);
            return (
              <div key={idx} className={cn("flex items-start gap-2 text-sm leading-relaxed", t.text)} style={{ marginLeft: `${indent * 16 + 16}px` }}>
                <span className="text-slate-500 mt-1.5 flex-shrink-0 h-1 w-1 rounded-full bg-slate-500" />
                <span dangerouslySetInnerHTML={{ __html: content }} />
              </div>
            );
          }

          // Top-level bullet points (- or *)
          if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            const content = renderInline(trimmed.slice(2));
            // Detect "What it means medically" style sub-section headers
            if (trimmed.match(/^[-*]\s+\*\*.*?:\*\*/)) {
              return (
                <div key={idx} className={cn("flex items-start gap-2.5 ml-4 mt-2", t.text)}>
                  <span className="text-teal-400 mt-1.5 flex-shrink-0 h-2 w-2 rounded-full bg-teal-400/60" />
                  <span className="text-sm leading-relaxed font-medium" dangerouslySetInnerHTML={{ __html: content }} />
                </div>
              );
            }
            return (
              <div key={idx} className={cn("flex items-start gap-2.5 ml-4", t.text)}>
                <span className="text-teal-400 mt-1.5 flex-shrink-0 h-1.5 w-1.5 rounded-full bg-teal-400" />
                <span className="text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: content }} />
              </div>
            );
          }

          // Numbered items
          const numberedMatch = trimmed.match(/^(\d+)\.\s+(.+)/);
          if (numberedMatch) {
            const content = renderInline(numberedMatch[2]);
            return (
              <div key={idx} className={cn("flex items-start gap-2.5 ml-4", t.text)}>
                <span className="text-cyan-400 font-bold text-sm mt-0.5 flex-shrink-0 min-w-[20px] h-5 w-5 rounded-full bg-cyan-500/10 flex items-center justify-center text-[10px]">{numberedMatch[1]}</span>
                <span className="text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: content }} />
              </div>
            );
          }

          // "This is a case of:" or "Without proper treatment →" — causality lines
          if (trimmed.includes('→') && (trimmed.startsWith('**') || trimmed.startsWith('➡'))) {
            const content = renderInline(trimmed);
            return (
              <div key={idx} className={cn("mt-2 mb-1 p-3 rounded-lg border-l-4 border-l-indigo-500/50 bg-indigo-500/5")}>
                <span className={cn("text-sm leading-relaxed", t.text)} dangerouslySetInnerHTML={{ __html: content }} />
              </div>
            );
          }

          // Bold date/timeline headers like **2025-08-03: ...**
          if (trimmed.startsWith('**') && (trimmed.includes(':') || trimmed.includes('—'))) {
            const content = renderInline(trimmed);
            return (
              <div key={idx} className={cn("mt-3 mb-1 p-3 rounded-lg border-l-4 border-l-amber-500/50", t.bgTertiary)}>
                <span className={cn("text-sm leading-relaxed", t.text)} dangerouslySetInnerHTML={{ __html: content }} />
              </div>
            );
          }

          // Regular paragraph
          const content = renderInline(trimmed);
          return (
            <p key={idx} className={cn("text-sm leading-relaxed", t.text)} dangerouslySetInnerHTML={{ __html: content }} />
          );
        })}
      </div>
    );
  } catch {
    return <p className={cn("text-sm whitespace-pre-wrap", t.text)}>{text}</p>;
  }
};

// ═══════════════════════════════════════════════════════════════
// TOAST NOTIFICATION SYSTEM
// ═══════════════════════════════════════════════════════════════

const Toast = ({ message, type = 'info', onClose, theme }) => {
  const t = getThemeClasses(theme || 'dark');
  const icons = {
    success: <CheckCircle2 className="text-emerald-500" size={20} />,
    error: <XCircle className="text-rose-500" size={20} />,
    info: <Info className="text-blue-500" size={20} />,
    warning: <AlertTriangle className="text-amber-500" size={20} />
  };
  
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);
  
  return (
    <div className="fixed top-4 right-4 z-[9999] animate-in slide-in-from-top-5 fade-in">
      <div className={cn("rounded-xl p-4 shadow-2xl flex items-center gap-3 min-w-[320px] border", t.card)}>
        {icons[type]}
        <p className={cn("text-sm flex-1", t.text)}>{message}</p>
        <button onClick={onClose} className={cn("p-1 rounded", t.bgHover)}>
          <X size={16} className={t.textMuted} />
        </button>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// THEME TOGGLE COMPONENT
// ═══════════════════════════════════════════════════════════════

const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();
  const t = getThemeClasses(theme);
  
  return (
    <button
      onClick={toggleTheme}
      className={cn("p-2 rounded-lg transition-all", t.bgTertiary, t.bgHover)}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {theme === 'dark' ? (
        <Sun size={18} className="text-amber-400" />
      ) : (
        <Moon size={18} className="text-indigo-600" />
      )}
    </button>
  );
};

// ═══════════════════════════════════════════════════════════════
// MEDICAL BADGE COMPONENT
// ═══════════════════════════════════════════════════════════════

const MedicalBadge = ({ label, value, color = 'teal', icon: Icon, theme }) => {
  const t = getThemeClasses(theme || 'dark');
  const colorMap = {
    teal: { bg: 'bg-teal-500/10', text: 'text-teal-400', border: 'border-teal-500/20' },
    rose: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/20' },
    amber: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
    emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
    indigo: { bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/20' },
    blue: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
    violet: { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/20' },
    cyan: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/20' },
  };
  const c = colorMap[color] || colorMap.teal;
  
  return (
    <div className={cn("rounded-xl border p-4", t.card, c.border)}>
      <div className="flex items-center gap-2 mb-2">
        {Icon && <Icon size={16} className={c.text} />}
        <span className={cn("text-xs uppercase font-bold", t.textMuted)}>{label || ''}</span>
      </div>
      <div className={cn("text-2xl font-bold", c.text)}>
        {typeof value === 'number' ? <AnimatedCounter value={value} /> : (value || '0')}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// AGENT OUTPUT EXPLORER - Shows all 7 agent outputs from S3
// ═══════════════════════════════════════════════════════════════

const AgentOutputExplorer = ({ caseData, s3Client, theme }) => {
  const t = getThemeClasses(theme || 'dark');
  const [expandedAgent, setExpandedAgent] = useState(null);
  const [agentData, setAgentData] = useState({});
  const [loadingAgent, setLoadingAgent] = useState(null);
  const agentOutputs = caseData?.agentOutputs || {};

  const loadAgentOutput = async (agentId) => {
    if (agentData[agentId] || !s3Client) return;
    setLoadingAgent(agentId);
    try {
      const files = agentOutputs[agentId] || [];
      const results = [];
      for (const file of files.slice(0, 10)) {
        try {
          const resp = await s3Client.send(new GetObjectCommand({ Bucket: file.bucket || CONFIG.buckets.PROCESSED, Key: file.key }));
          const content = await resp.Body.transformToString();
          results.push({ name: file.name, data: safeParseJSON(content, content), raw: content, size: file.size, lastModified: file.lastModified });
        } catch (e) {
          results.push({ name: file.name, data: null, error: e.message, size: file.size, lastModified: file.lastModified });
        }
      }
      setAgentData(prev => ({ ...prev, [agentId]: results }));
    } catch {}
    setLoadingAgent(null);
  };

  const toggleAgent = (agentId) => {
    if (expandedAgent === agentId) {
      setExpandedAgent(null);
    } else {
      setExpandedAgent(agentId);
      loadAgentOutput(agentId);
    }
  };

  const completedCount = CONFIG.agents.filter(a => !!agentOutputs[a.id]).length;
  const totalOutputFiles = Object.values(agentOutputs).reduce((sum, arr) => sum + (arr?.length || 0), 0);

  return (
    <div className="space-y-4">
      {/* Summary Header */}
      <div className={cn("p-5 rounded-xl border", t.card)}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Cpu size={22} className="text-teal-400" />
            <h3 className={cn("text-lg font-bold", t.text)}>Agent Output Explorer</h3>
          </div>
          <div className="flex items-center gap-3">
            <span className={cn("text-xs px-3 py-1 rounded-full font-bold", completedCount === CONFIG.agents.length ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400")}>
              {completedCount}/{CONFIG.agents.length} Agents Complete
            </span>
            <span className={cn("text-xs px-3 py-1 rounded-full font-bold", t.bgTertiary, t.textMuted)}>
              {totalOutputFiles} Total Files
            </span>
          </div>
        </div>
        {/* Progress bar */}
        <div className={cn("h-2 rounded-full overflow-hidden", t.bgTertiary)}>
          <div className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full transition-all duration-500" style={{ width: `${(completedCount / CONFIG.agents.length) * 100}%` }} />
        </div>
      </div>

      {/* Agent Cards */}
      <div className="space-y-3">
        {CONFIG.agents.map((agent, idx) => {
          const hasOutput = !!agentOutputs[agent.id];
          const outputCount = hasOutput ? (agentOutputs[agent.id]?.length || 0) : 0;
          const Icon = agent.icon || Database;
          const isExpanded = expandedAgent === agent.id;
          const isLoading = loadingAgent === agent.id;
          const data = agentData[agent.id] || [];
          const isActive = !hasOutput && idx === Object.keys(agentOutputs).length;

          const agentColors = {
            ingestion: { bg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-400', glow: 'shadow-blue-500/5' },
            cleaning: { bg: 'bg-cyan-500/10', border: 'border-cyan-500/20', text: 'text-cyan-400', glow: 'shadow-cyan-500/5' },
            validation: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400', glow: 'shadow-emerald-500/5' },
            normalization: { bg: 'bg-violet-500/10', border: 'border-violet-500/20', text: 'text-violet-400', glow: 'shadow-violet-500/5' },
            enrichment: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-400', glow: 'shadow-amber-500/5' },
            analysis: { bg: 'bg-rose-500/10', border: 'border-rose-500/20', text: 'text-rose-400', glow: 'shadow-rose-500/5' },
            feature: { bg: 'bg-indigo-500/10', border: 'border-indigo-500/20', text: 'text-indigo-400', glow: 'shadow-indigo-500/5' },
            compass: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400', glow: 'shadow-emerald-500/5' },
            pinnacle: { bg: 'bg-sky-500/10', border: 'border-sky-500/20', text: 'text-sky-400', glow: 'shadow-sky-500/5' },
            madrigal: { bg: 'bg-rose-500/10', border: 'border-rose-500/20', text: 'text-rose-400', glow: 'shadow-rose-500/5' },
            judge: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-400', glow: 'shadow-amber-500/5' },
          };
          const colors = agentColors[agent.id] || agentColors.ingestion;

          return (
            <div key={agent.id} className={cn("rounded-xl border overflow-hidden transition-all shadow-lg", hasOutput ? colors.border : t.border, hasOutput ? colors.glow : '')}>
              <button onClick={() => hasOutput && toggleAgent(agent.id)} disabled={!hasOutput} className={cn("w-full p-4 flex items-center gap-4 text-left transition-all", hasOutput ? cn(colors.bg, 'hover:opacity-80') : t.bgTertiary)}>
                <div className={cn("relative h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0", hasOutput ? colors.bg : t.bgSecondary)}>
                  {isActive && <div className="absolute inset-0 rounded-xl bg-teal-500/20 animate-ping" style={{ animationDuration: '2s' }} />}
                  {hasOutput ? <CheckCircle size={22} className={colors.text} /> : isActive ? <Loader2 size={22} className="text-teal-400 animate-spin" /> : <Icon size={22} className={t.textMuted} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full", hasOutput ? cn(colors.bg, colors.text) : cn(t.bgSecondary, t.textMuted))}>Step {agent.step}</span>
                    <h4 className={cn("font-bold", t.text)}>{agent.name}</h4>
                  </div>
                  <p className={cn("text-xs mt-0.5", t.textSecondary)}>{agent.description}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {hasOutput && <span className={cn("text-xs font-mono font-bold", colors.text)}>{outputCount} file{outputCount !== 1 ? 's' : ''}</span>}
                  {hasOutput && (isExpanded ? <ChevronUp size={18} className={t.textMuted} /> : <ChevronDown size={18} className={t.textMuted} />)}
                </div>
              </button>

              {/* Expanded output content */}
              {isExpanded && (
                <div className={cn("border-t", t.border)}>
                  {isLoading ? (
                    <div className="flex items-center justify-center py-8 gap-3">
                      <Loader2 size={20} className="text-teal-400 animate-spin" />
                      <span className={cn("text-sm", t.textSecondary)}>Loading {agent.name} output...</span>
                    </div>
                  ) : data.length === 0 ? (
                    <div className="p-6 text-center">
                      <p className={cn("text-sm", t.textSecondary)}>No output data could be loaded</p>
                    </div>
                  ) : (
                    <div className="divide-y" style={{ borderColor: theme === 'dark' ? '#1e293b' : '#e5e7eb' }}>
                      {data.map((file, fidx) => (
                        <AgentOutputFileCard key={fidx} file={file} agentId={agent.id} colors={colors} theme={theme} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Single agent output file viewer card
const AgentOutputFileCard = ({ file, agentId, colors, theme }) => {
  const t = getThemeClasses(theme || 'dark');
  const [showFull, setShowFull] = useState(false);

  const renderPreview = (data) => {
    if (!data) return <span className="text-rose-400 text-sm">Failed to load: {file.error || 'Unknown error'}</span>;
    if (typeof data === 'string') {
      return <pre className={cn("text-xs font-mono whitespace-pre-wrap", t.text)}>{showFull ? data : data.slice(0, 800)}{!showFull && data.length > 800 ? '...' : ''}</pre>;
    }
    // JSON data — show key stats
    const keys = Object.keys(data);
    const recordCount = Array.isArray(data) ? data.length : (data.records?.length || data.data?.length || data.entries?.length || data.patients?.length || null);
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {recordCount !== null && (
            <span className={cn("text-xs px-2 py-0.5 rounded-full font-bold", colors.bg, colors.text)}>{recordCount} records</span>
          )}
          <span className={cn("text-xs px-2 py-0.5 rounded-full", t.bgTertiary, t.textMuted)}>{keys.length} fields</span>
          {data.status && <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold">{safeString(data.status)}</span>}
          {data.agent_id && <span className={cn("text-xs px-2 py-0.5 rounded-full font-mono", t.bgTertiary, t.textMuted)}>{data.agent_id}</span>}
        </div>
        {/* Key fields preview */}
        <div className="grid grid-cols-2 gap-2">
          {keys.slice(0, 8).map(key => {
            const val = data[key];
            const display = val === null ? 'null' : typeof val === 'object' ? (Array.isArray(val) ? `[${val.length} items]` : `{${Object.keys(val).length} fields}`) : String(val).slice(0, 60);
            return (
              <div key={key} className={cn("p-2 rounded-lg", t.bgTertiary)}>
                <div className={cn("text-[10px] font-mono uppercase tracking-wider", t.textMuted)}>{key}</div>
                <div className={cn("text-xs font-mono truncate", t.text)}>{display}</div>
              </div>
            );
          })}
        </div>
        {showFull && (
          <pre className={cn("text-xs font-mono whitespace-pre-wrap max-h-[400px] overflow-auto p-3 rounded-lg", t.bgTertiary, t.text)}>
            {JSON.stringify(data, null, 2)}
          </pre>
        )}
      </div>
    );
  };

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileJson size={16} className={colors.text} />
          <span className={cn("text-sm font-mono font-bold", t.text)}>{file.name}</span>
          {file.size && <span className={cn("text-xs", t.textMuted)}>{formatBytes(file.size)}</span>}
        </div>
        <div className="flex items-center gap-2">
          {file.lastModified && <span className={cn("text-xs", t.textMuted)}>{safeFormat(file.lastModified)}</span>}
          <button onClick={() => setShowFull(!showFull)} className={cn("text-xs px-2 py-1 rounded-lg font-bold", t.bgTertiary, t.text, t.bgHover)}>
            {showFull ? 'Collapse' : 'Full JSON'}
          </button>
          {file.data && (
            <button onClick={() => { try { navigator.clipboard.writeText(typeof file.data === 'string' ? file.data : JSON.stringify(file.data, null, 2)); } catch {} }}
              className={cn("text-xs px-2 py-1 rounded-lg font-bold", t.bgTertiary, t.text, t.bgHover)}>
              <Copy size={12} />
            </button>
          )}
        </div>
      </div>
      {renderPreview(file.data)}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// PIPELINE FILE VIEWER - STRUCTURED AGENT OUTPUT PER FILE
// ═══════════════════════════════════════════════════════════════

const PipelineFileViewer = ({ caseData, s3Client, theme }) => {
  const t = getThemeClasses(theme || 'dark');
  const [selectedFile, setSelectedFile] = useState(null);
  const [pipelineData, setPipelineData] = useState({});
  const [loading, setLoading] = useState(false);
  const [rawToggles, setRawToggles] = useState({});
  const [expandedStages, setExpandedStages] = useState(new Set());
  const [showOriginal, setShowOriginal] = useState(false);
  const [originalContent, setOriginalContent] = useState(null);
  const [loadingOriginal, setLoadingOriginal] = useState(false);

  const rawFiles = caseData?.rawFiles || [];
  const rawFileCount = getCaseRawFileCount(caseData);
  const agentOutputs = caseData?.agentOutputs || {};

  const loadPipelineForFile = async (file) => {
    setSelectedFile(file);
    setPipelineData({});
    setLoading(true);
    setRawToggles({});
    setShowOriginal(false);
    setOriginalContent(null);
    setExpandedStages(new Set(['ingestion', 'cleaning', 'validation', 'compass', 'pinnacle', 'madrigal', 'feature', 'judge']));

    const safeFileName = (name) => (name || '').replace(/[^a-zA-Z0-9._-]/g, '_');
    const safeName = safeFileName(file.name);
    const results = {};

    for (const agent of CONFIG.agents) {
      const outputs = agentOutputs[agent.id] || [];
      if (outputs.length === 0) continue;
      
      // Multi-level matching: exact → partial name → combined output (no sourceFileName) → first
      const match = outputs.find(o => o.sourceFileName && o.sourceFileName === safeName) ||
                    outputs.find(o => o.sourceFileName && safeName && (
                      o.sourceFileName.includes(safeName) || safeName.includes(o.sourceFileName)
                    )) ||
                    outputs.find(o => !o.sourceFileName || o.sourceFileName === '') ||
                    (outputs.length === 1 ? outputs[0] : null) ||
                    outputs[0];

      if (match && s3Client) {
        // Use correct bucket per agent stage: ingestion→STAGING, cleaning/validation→PROCESSED
        const agentBucket = match.bucket || CONFIG.buckets[agent.bucket] || CONFIG.buckets.PROCESSED;
        try {
          const resp = await s3Client.send(new GetObjectCommand({ Bucket: agentBucket, Key: match.key }));
          const content = await resp.Body.transformToString();
          const parsed = safeParseJSON(content, content);
          results[agent.id] = { name: match.name, data: parsed, raw: typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2), size: match.size, lastModified: match.lastModified };
        } catch (e) {
          results[agent.id] = { name: match.name, error: e.message };
        }
      }
    }

    setPipelineData(results);
    setLoading(false);
  };

  const toggleRaw = (agentId) => setRawToggles(prev => ({ ...prev, [agentId]: !prev[agentId] }));
  const toggleStage = (agentId) => setExpandedStages(prev => { const s = new Set(prev); s.has(agentId) ? s.delete(agentId) : s.add(agentId); return s; });

  const viewOriginalFile = async () => {
    if (!selectedFile || !s3Client) return;
    if (showOriginal && originalContent !== null) {
      setShowOriginal(false);
      return;
    }
    setLoadingOriginal(true);
    setShowOriginal(true);
    try {
      const resp = await s3Client.send(new GetObjectCommand({
        Bucket: CONFIG.buckets.RAW,
        Key: selectedFile.key
      }));
      const ext = (selectedFile.name || '').split('.').pop()?.toLowerCase();
      const isImage = ['png', 'jpg', 'jpeg', 'bmp', 'tiff', 'gif', 'webp'].includes(ext);
      const BINARY_MIME = {
        dcm: 'application/dicom', dicom: 'application/dicom',
        doc: 'application/msword',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        xls: 'application/vnd.ms-excel',
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        parquet: 'application/octet-stream', zip: 'application/zip',
      };
      if (isImage) {
        const bytes = await resp.Body.transformToByteArray();
        const blob = new Blob([bytes], { type: resp.ContentType || `image/${ext}` });
        const url = URL.createObjectURL(blob);
        setOriginalContent({ type: 'image', url, name: selectedFile.name });
      } else if (BINARY_MIME[ext]) {
        // Binary clinical files (DICOM, Word, Excel, Parquet) can't render in
        // the browser — download them instead of garbling to text.
        const bytes = await resp.Body.transformToByteArray();
        const blob = new Blob([bytes], { type: BINARY_MIME[ext] });
        const url = URL.createObjectURL(blob);
        setOriginalContent({ type: 'download', url, name: selectedFile.name, size: bytes.length, ext });
      } else if (ext === 'pdf') {
        const bytes = await resp.Body.transformToByteArray();
        const blob = new Blob([bytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        setOriginalContent({ type: 'pdf', url, name: selectedFile.name });
      } else {
        const content = await resp.Body.transformToString();
        const parsed = safeParseJSON(content, null);
        if (parsed) {
          setOriginalContent({ type: 'json', text: JSON.stringify(parsed, null, 2), name: selectedFile.name });
        } else {
          setOriginalContent({ type: 'text', text: content, name: selectedFile.name });
        }
      }
    } catch (e) {
      setOriginalContent({ type: 'error', text: `Failed to load: ${e.message}`, name: selectedFile.name });
    }
    setLoadingOriginal(false);
  };

  // ── Structured renderers ──
  const renderStatBadge = (label, value, color = 'teal') => (
    <div className={cn(`px-3 py-1.5 rounded-lg bg-${color}-500/10 border border-${color}-500/20`)}>
      <div className={cn("text-[10px] uppercase tracking-wider", t.textMuted)}>{label}</div>
      <div className={cn(`text-sm font-bold text-${color}-400`)}>{value ?? 'N/A'}</div>
    </div>
  );

  const renderTable = (headers, rows) => (
    <div className="overflow-x-auto rounded-lg border border-slate-700/50">
      <table className="w-full text-xs">
        <thead><tr className={cn("bg-slate-800/60")}>{headers.map((h, i) => <th key={i} className="px-3 py-2 text-left font-bold text-slate-400 uppercase tracking-wider">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-700/40">
          {rows.map((row, ri) => <tr key={ri} className="hover:bg-slate-800/30">{row.map((cell, ci) => <td key={ci} className={cn("px-3 py-2", t.text)}>{cell}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  );

  const confidenceBadge = (conf) => {
    if (conf === undefined || conf === null) return null;
    const n = typeof conf === 'number' ? conf : parseFloat(conf);
    const color = n >= 0.9 ? 'emerald' : n >= 0.7 ? 'amber' : 'rose';
    return <span className={cn(`text-[10px] font-bold px-1.5 py-0.5 rounded bg-${color}-500/20 text-${color}-400`)}>{(n * 100).toFixed(0)}%</span>;
  };

  const severityBadge = (sev) => {
    if (!sev) return null;
    const s = String(sev).toUpperCase();
    const color = s === 'CRITICAL' || s === 'HIGH' || s === 'SEVERE' ? 'rose' : s === 'WARNING' || s === 'MODERATE' ? 'amber' : 'emerald';
    return <span className={cn(`text-[10px] font-bold px-1.5 py-0.5 rounded bg-${color}-500/20 text-${color}-400`)}>{s}</span>;
  };

  const renderIngestion = (data) => {
    if (!data || typeof data !== 'object') return null;
    const demo = data.demographics || {};
    const diseases = safeArray(data.diseases || data.conditions || []);
    const medications = safeArray(data.medications || []);
    const labs = safeArray(data.lab_tests || []);
    const vitals = safeArray(data.vital_signs || []);
    const procedures = safeArray(data.procedures || []);
    const allergies = safeArray(data.allergies || []);
    const imaging = safeArray(data.imaging_findings || []);
    const genomic = safeArray(data.genomic_data || []);
    const quality = data.quality || {};
    const qualityIssues = safeArray(quality.issues || []);
    const sysMeta = data.system_meta || {};
    const processing = sysMeta.processing || {};

    return (
      <div className="space-y-4">
        {/* File Type & Meta */}
        {(data.file_type || Object.keys(sysMeta).length > 0) && (
          <div className="flex flex-wrap gap-2">
            {data.file_type && renderStatBadge('File Type', data.file_type, 'blue')}
            {sysMeta.stage && renderStatBadge('Stage', sysMeta.stage, 'teal')}
            {processing.page_count && renderStatBadge('Pages', processing.page_count, 'violet')}
            {processing.method && renderStatBadge('Method', processing.method, 'cyan')}
            {processing.chunks_processed && renderStatBadge('Chunks', processing.chunks_processed, 'amber')}
            {processing.total_text_chars && renderStatBadge('Characters', processing.total_text_chars.toLocaleString(), 'emerald')}
          </div>
        )}
        {/* Demographics */}
        {Object.keys(demo).length > 0 && (
          <div>
            <h5 className={cn("text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2", t.textMuted)}><User size={14} className="text-blue-400" /> Demographics</h5>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[['Name', demo.patient_name], ['Age', demo.age], ['Gender', demo.gender], ['DOB', demo.dob], ['MRN', demo.mrn]].filter(([, v]) => v).map(([label, val], i) => (
                <div key={i} className={cn("p-2 rounded-lg", t.bgTertiary)}>
                  <div className={cn("text-[10px] uppercase tracking-wider", t.textMuted)}>{label}</div>
                  <div className={cn("text-sm font-medium", t.text)}>{safeString(val)}</div>
                </div>
              ))}
              {demo.confidence !== undefined && <div className={cn("p-2 rounded-lg", t.bgTertiary)}><div className={cn("text-[10px] uppercase", t.textMuted)}>Confidence</div><div>{confidenceBadge(demo.confidence)}</div></div>}
            </div>
          </div>
        )}
        {/* Summary */}
        {data.document_summary && <div className={cn("p-3 rounded-lg text-sm italic", t.bgTertiary, t.textSecondary)}>{data.document_summary}</div>}
        {/* Conditions */}
        {diseases.length > 0 && (
          <div>
            <h5 className={cn("text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2", t.textMuted)}><Heart size={14} className="text-rose-400" /> Conditions ({diseases.length})</h5>
            {renderTable(['Condition', 'ICD-10', 'Severity', 'Status', 'Confidence'],
              diseases.map(d => [safeString(d.condition || d.name), <code className="text-cyan-400 text-[10px]">{d.icd10 || '—'}</code>, severityBadge(d.severity), safeString(d.status || d.clinical_status || '—'), confidenceBadge(d.confidence)]))}
          </div>
        )}
        {/* Medications */}
        {medications.length > 0 && (
          <div>
            <h5 className={cn("text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2", t.textMuted)}><Pill size={14} className="text-blue-400" /> Medications ({medications.length})</h5>
            {renderTable(['Medication', 'Strength', 'Frequency', 'Route', 'Indication', 'Conf.'],
              medications.map(m => [safeString(m.name || m.medication), safeString(m.strength || '—'), safeString(m.frequency || '—'), safeString(m.route || '—'), safeString(m.indication || '—'), confidenceBadge(m.confidence)]))}
          </div>
        )}
        {/* Procedures */}
        {procedures.length > 0 && (
          <div>
            <h5 className={cn("text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2", t.textMuted)}><FileCheck size={14} className="text-violet-400" /> Procedures ({procedures.length})</h5>
            {renderTable(['Procedure', 'CPT', 'Date', 'Confidence'],
              procedures.map(p => [safeString(p.name || p.procedure), <code className="text-cyan-400 text-[10px]">{p.cpt || '—'}</code>, safeString(p.date || '—'), confidenceBadge(p.confidence)]))}
          </div>
        )}
        {/* Labs */}
        {labs.length > 0 && (
          <div>
            <h5 className={cn("text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2", t.textMuted)}><TestTube size={14} className="text-emerald-400" /> Lab Tests ({labs.length})</h5>
            {renderTable(['Test', 'Value', 'Units', 'Ref Range', 'Abnormal', 'Date', 'Conf.'],
              labs.map(l => [safeString(l.test_name || l.name || l.test || l.standard_name || ''), safeString(l.value), safeString(l.units || ''), safeString(l.ref_range || l.reference_range || '—'), l.abnormal ? <span className={l.abnormal === 'H' || l.abnormal === 'HH' ? 'text-rose-400 font-bold' : l.abnormal === 'L' || l.abnormal === 'LL' ? 'text-amber-400 font-bold' : 'text-emerald-400'}>{l.abnormal}</span> : '—', safeString(l.date || '—'), confidenceBadge(l.confidence)]))}
          </div>
        )}
        {/* Vitals */}
        {vitals.length > 0 && (
          <div>
            <h5 className={cn("text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2", t.textMuted)}><Activity size={14} className="text-teal-400" /> Vital Signs ({vitals.length})</h5>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {vitals.map((v, i) => (
                <div key={i} className={cn("p-2 rounded-lg", t.bgTertiary)}>
                  <div className={cn("text-[10px] uppercase", t.textMuted)}>{safeString(v.type || v.name)}</div>
                  <div className={cn("text-sm font-bold", t.text)}>{safeString(v.value)} <span className={cn("text-[10px]", t.textMuted)}>{safeString(v.units || '')}</span></div>
                </div>
              ))}
            </div>
          </div>
        )}
        {/* Imaging */}
        {imaging.length > 0 && (
          <div>
            <h5 className={cn("text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2", t.textMuted)}><Eye size={14} className="text-indigo-400" /> Imaging ({imaging.length})</h5>
            {renderTable(['Modality', 'Body Part', 'Finding', 'Impression', 'Confidence'],
              imaging.map(im => [safeString(im.modality), safeString(im.body_part), safeString(im.finding || im.findings), safeString(im.impression || '—'), confidenceBadge(im.confidence)]))}
          </div>
        )}
        {/* Allergies */}
        {allergies.length > 0 && (
          <div>
            <h5 className={cn("text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2", t.textMuted)}><AlertTriangle size={14} className="text-amber-400" /> Allergies ({allergies.length})</h5>
            <div className="flex flex-wrap gap-2">
              {allergies.map((a, i) => <span key={i} className="text-xs px-2 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">{safeString(a.allergen || a.substance || a)} {a.reaction ? `— ${a.reaction}` : ''}</span>)}
            </div>
          </div>
        )}
        {/* Genomic Data */}
        {genomic.length > 0 && (
          <div>
            <h5 className={cn("text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2", t.textMuted)}><Code size={14} className="text-indigo-400" /> Genomic Data ({genomic.length})</h5>
            {renderTable(['Gene', 'Variant', 'Classification', 'Confidence'],
              genomic.map(g => [safeString(g.gene), safeString(g.variant), safeString(g.classification || '—'), confidenceBadge(g.confidence)]))}
          </div>
        )}
        {/* Quality */}
        {Object.keys(quality).length > 0 && (
          <div>
            <div className="flex flex-wrap gap-2">
              {quality.completeness !== undefined && renderStatBadge('Completeness', typeof quality.completeness === 'number' ? `${(quality.completeness * 100).toFixed(0)}%` : quality.completeness, 'teal')}
              {quality.confidence !== undefined && renderStatBadge('Confidence', typeof quality.confidence === 'number' ? `${(quality.confidence * 100).toFixed(0)}%` : quality.confidence, 'blue')}
              {qualityIssues.length > 0 && renderStatBadge('Issues', qualityIssues.length, 'amber')}
            </div>
            {qualityIssues.length > 0 && (
              <div className="mt-2 space-y-1">
                {qualityIssues.map((issue, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-amber-400">
                    <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
                    <span>{safeString(issue)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderCleaning = (data) => {
    if (!data || typeof data !== 'object') return null;
    // Support both new structure (combined_standardized_data) and old (standardized_data)
    const std = data.combined_standardized_data || data.standardized_data || {};
    const stats = data.cleaning_stats || {};
    const warnings = safeArray(data.warnings || []);
    const quality = data.quality || {};
    const sysMeta = data.system_meta || {};
    const demographics = sysMeta.demographics || {};
    const conditions = safeArray(std.conditions || []);
    const procedures = safeArray(std.procedures || []);
    const medications = safeArray(std.medications || []);
    const labs = safeArray(std.lab_tests || []);
    const vitals = safeArray(std.vital_signs || []);
    const allergies = safeArray(std.allergies || []);

    // Helper to render source files badges
    const renderSourceFiles = (sourceFiles) => {
      const files = safeArray(sourceFiles);
      if (files.length === 0) return null;
      return (
        <div className="flex flex-wrap gap-1 mt-1">
          {files.map((f, i) => (
            <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-400 font-mono">
              {safeString(f)}
            </span>
          ))}
        </div>
      );
    };

    return (
      <div className="space-y-4">
        {/* Demographics from system_meta */}
        {Object.keys(demographics).length > 0 && (
          <div className="flex flex-wrap gap-2 p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
            <span className="text-[10px] font-bold uppercase text-indigo-400 w-full mb-1">Demographics</span>
            {demographics.name && renderStatBadge('Name', demographics.name, 'indigo')}
            {demographics.age && renderStatBadge('Age', demographics.age, 'violet')}
            {demographics.gender && renderStatBadge('Gender', demographics.gender, 'cyan')}
            {demographics.dob && renderStatBadge('DOB', demographics.dob, 'teal')}
            {demographics.mrn && renderStatBadge('MRN', demographics.mrn, 'blue')}
          </div>
        )}
        {/* Cleaning Stats */}
        <div className="flex flex-wrap gap-2">
          {renderStatBadge('Input', stats.total_input, 'blue')}
          {renderStatBadge('Output', stats.total_output, 'teal')}
          {renderStatBadge('Duplicates Removed', stats.duplicates_removed, 'amber')}
          {renderStatBadge('Corrections', stats.corrections_made, 'violet')}
          {renderStatBadge('Unmappable', stats.unmappable, 'rose')}
          {quality.standardization_rate !== undefined && renderStatBadge('Standardization', typeof quality.standardization_rate === 'number' ? `${(quality.standardization_rate * 100).toFixed(0)}%` : quality.standardization_rate, 'emerald')}
          {quality.integrity && renderStatBadge('Integrity', quality.integrity, quality.integrity === 'GOOD' ? 'emerald' : quality.integrity === 'FAIR' ? 'amber' : 'rose')}
        </div>
        {/* Conditions */}
        {conditions.length > 0 && (
          <div>
            <h5 className={cn("text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2", t.textMuted)}><Heart size={14} className="text-rose-400" /> Standardized Conditions ({conditions.length})</h5>
            {renderTable(['Original', 'Standard Name', 'ICD-10', 'SNOMED', 'Severity', 'Status', 'Sources'],
              conditions.map(c => [
                <span className="text-slate-500 italic text-[10px]">{safeString(c.original || '—')}</span>,
                safeString(c.standard_name),
                <code className="text-cyan-400 text-[10px]">{c.icd10 || '—'}</code>,
                <code className="text-violet-400 text-[10px]">{c.snomed || '—'}</code>,
                severityBadge(c.severity),
                safeString(c.clinical_status || c.status || '—'),
                c.source_files ? <div className="flex flex-wrap gap-1">{safeArray(c.source_files).map((f, i) => <span key={i} className="text-[9px] px-1 py-0.5 rounded bg-slate-700/50 text-slate-400">{f}</span>)}</div> : '—'
              ]))}
          </div>
        )}
        {/* Medications */}
        {medications.length > 0 && (
          <div>
            <h5 className={cn("text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2", t.textMuted)}><Pill size={14} className="text-blue-400" /> Standardized Medications ({medications.length})</h5>
            {renderTable(['Medication', 'RxNorm', 'Strength', 'Frequency', 'Route', 'Sources'],
              medications.map(m => [
                safeString(m.standard_name || m.original), 
                <code className="text-cyan-400 text-[10px]">{m.rxnorm || '—'}</code>, 
                safeString(m.strength || '—'), 
                safeString(m.frequency || '—'), 
                safeString(m.route || '—'), 
                m.source_files ? <div className="flex flex-wrap gap-1">{safeArray(m.source_files).map((f, i) => <span key={i} className="text-[9px] px-1 py-0.5 rounded bg-slate-700/50 text-slate-400">{f}</span>)}</div> : '—'
              ]))}
          </div>
        )}
        {/* Procedures */}
        {procedures.length > 0 && (
          <div>
            <h5 className={cn("text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2", t.textMuted)}><FileCheck size={14} className="text-violet-400" /> Standardized Procedures ({procedures.length})</h5>
            {renderTable(['Original', 'Standard Name', 'CPT', 'Date', 'Sources'],
              procedures.map(p => [
                <span className="text-slate-500 italic text-[10px]">{safeString(p.original || '—')}</span>, 
                safeString(p.standard_name), 
                <code className="text-cyan-400 text-[10px]">{p.cpt || '—'}</code>, 
                safeString(p.date || '—'), 
                p.source_files ? <div className="flex flex-wrap gap-1">{safeArray(p.source_files).map((f, i) => <span key={i} className="text-[9px] px-1 py-0.5 rounded bg-slate-700/50 text-slate-400">{f}</span>)}</div> : '—'
              ]))}
          </div>
        )}
        {/* Labs */}
        {labs.length > 0 && (
          <div>
            <h5 className={cn("text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2", t.textMuted)}><TestTube size={14} className="text-emerald-400" /> Standardized Labs ({labs.length})</h5>
            {renderTable(['Test', 'LOINC', 'Value', 'Units', 'Ref Range', 'Abnormal', 'Sources'],
              labs.map(l => [
                safeString(l.standard_name || l.original_name || l.test_name || l.name), 
                <code className="text-cyan-400 text-[10px]">{l.loinc || '—'}</code>, 
                safeString(l.value), 
                safeString(l.units || ''), 
                safeString(l.ref_range || '—'), 
                l.abnormal ? <span className={l.abnormal === 'H' || l.abnormal === 'HH' ? 'text-rose-400 font-bold' : l.abnormal === 'L' || l.abnormal === 'LL' ? 'text-amber-400 font-bold' : 'text-emerald-400'}>{l.abnormal}</span> : '—',
                l.source_files ? <div className="flex flex-wrap gap-1">{safeArray(l.source_files).map((f, i) => <span key={i} className="text-[9px] px-1 py-0.5 rounded bg-slate-700/50 text-slate-400">{f}</span>)}</div> : '—'
              ]))}
          </div>
        )}
        {/* Warnings */}
        {warnings.length > 0 && (
          <div>
            <h5 className={cn("text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2", t.textMuted)}><AlertTriangle size={14} className="text-amber-400" /> Warnings ({warnings.length})</h5>
            <div className="space-y-1">
              {warnings.map((w, i) => <div key={i} className="flex items-start gap-2 text-xs text-amber-400"><AlertTriangle size={12} className="mt-0.5 flex-shrink-0" /><span>{safeString(w)}</span></div>)}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderValidation = (data) => {
    if (!data || typeof data !== 'object') return null;
    const issues = safeArray(data.issues || []);
    const interactions = safeArray(data.drug_interactions || []);
    const alerts = safeArray(data.critical_alerts || []);
    const summary = data.summary || {};
    const sysMeta = data.system_meta || {};
    const demographics = sysMeta.demographics || {};
    // New structure: validated_data contains validated conditions, labs, etc.
    const vd = data.validated_data || {};
    const conditions = safeArray(vd.conditions || []);
    const labs = safeArray(vd.lab_tests || []);
    const medications = safeArray(vd.medications || []);

    return (
      <div className="space-y-4">
        {/* Demographics from system_meta */}
        {Object.keys(demographics).length > 0 && (
          <div className="flex flex-wrap gap-2 p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
            <span className="text-[10px] font-bold uppercase text-indigo-400 w-full mb-1">Demographics</span>
            {demographics.name && renderStatBadge('Name', demographics.name, 'indigo')}
            {demographics.age && renderStatBadge('Age', demographics.age, 'violet')}
            {demographics.gender && renderStatBadge('Gender', demographics.gender, 'cyan')}
            {demographics.dob && renderStatBadge('DOB', demographics.dob, 'teal')}
            {demographics.mrn && renderStatBadge('MRN', demographics.mrn, 'blue')}
          </div>
        )}
        {/* Status & Risk */}
        <div className="flex flex-wrap gap-3 items-center">
          {data.validation_status && (
            <span className={cn("text-sm font-bold px-3 py-1.5 rounded-lg",
              data.validation_status === 'PASS' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
              data.validation_status === 'CRITICAL' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
              'bg-amber-500/20 text-amber-400 border border-amber-500/30'
            )}>
              {data.validation_status === 'PASS' ? <CheckCircle size={14} className="inline mr-1" /> :
               data.validation_status === 'CRITICAL' ? <XCircle size={14} className="inline mr-1" /> :
               <AlertTriangle size={14} className="inline mr-1" />}
              {data.validation_status}
            </span>
          )}
          {data.risk_score !== undefined && renderStatBadge('Risk Score', typeof data.risk_score === 'number' ? data.risk_score.toFixed(2) : data.risk_score, data.risk_level === 'HIGH' ? 'rose' : data.risk_level === 'MODERATE' ? 'amber' : 'emerald')}
          {data.risk_level && renderStatBadge('Risk Level', data.risk_level, data.risk_level === 'HIGH' ? 'rose' : data.risk_level === 'MODERATE' ? 'amber' : 'emerald')}
        </div>
        {/* Summary stats */}
        {Object.keys(summary).length > 0 && (
          <div className="flex flex-wrap gap-2">
            {summary.total_checks !== undefined && renderStatBadge('Total Checks', summary.total_checks, 'blue')}
            {summary.passed !== undefined && renderStatBadge('Passed', summary.passed, 'emerald')}
            {summary.warnings !== undefined && renderStatBadge('Warnings', summary.warnings, 'amber')}
            {summary.critical !== undefined && renderStatBadge('Critical', summary.critical, 'rose')}
            {summary.conditions_validated !== undefined && renderStatBadge('Conditions', summary.conditions_validated, 'violet')}
            {summary.labs_validated !== undefined && renderStatBadge('Labs', summary.labs_validated, 'teal')}
          </div>
        )}
        {/* Validated Conditions */}
        {conditions.length > 0 && (
          <div>
            <h5 className={cn("text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2", t.textMuted)}><Heart size={14} className="text-rose-400" /> Validated Conditions ({conditions.length})</h5>
            {renderTable(['Condition', 'ICD-10', 'Status', 'Validated', 'Sources'],
              conditions.map(c => [
                safeString(c.standard_name || c.name),
                <code className="text-cyan-400 text-[10px]">{c.icd10 || '—'}</code>,
                safeString(c.clinical_status || c.status || '—'),
                c.validated === true ? <CheckCircle size={12} className="text-emerald-400" /> : c.validated === false ? <XCircle size={12} className="text-rose-400" /> : '—',
                c.source_files ? <div className="flex flex-wrap gap-1">{safeArray(c.source_files).map((f, i) => <span key={i} className="text-[9px] px-1 py-0.5 rounded bg-slate-700/50 text-slate-400">{f}</span>)}</div> : '—'
              ]))}
          </div>
        )}
        {/* Validated Labs */}
        {labs.length > 0 && (
          <div>
            <h5 className={cn("text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2", t.textMuted)}><TestTube size={14} className="text-emerald-400" /> Validated Labs ({labs.length})</h5>
            {renderTable(['Test', 'LOINC', 'Value', 'Units', 'Abnormal', 'Validated', 'Sources'],
              labs.map(l => [
                safeString(l.standard_name || l.test_name || l.name),
                <code className="text-cyan-400 text-[10px]">{l.loinc || '—'}</code>,
                safeString(l.value),
                safeString(l.units || ''),
                l.abnormal ? <span className={l.abnormal === 'H' || l.abnormal === 'HH' ? 'text-rose-400 font-bold' : l.abnormal === 'L' || l.abnormal === 'LL' ? 'text-amber-400 font-bold' : 'text-emerald-400'}>{l.abnormal}</span> : '—',
                l.validated === true ? <CheckCircle size={12} className="text-emerald-400" /> : l.validated === false ? <XCircle size={12} className="text-rose-400" /> : '—',
                l.source_files ? <div className="flex flex-wrap gap-1">{safeArray(l.source_files).map((f, i) => <span key={i} className="text-[9px] px-1 py-0.5 rounded bg-slate-700/50 text-slate-400">{f}</span>)}</div> : '—'
              ]))}
          </div>
        )}
        {/* Critical Alerts */}
        {alerts.length > 0 && (
          <div className="space-y-2">
            <h5 className={cn("text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-rose-400")}><AlertOctagon size={14} /> Critical Alerts ({alerts.length})</h5>
            {alerts.map((a, i) => <div key={i} className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">{safeString(a)}</div>)}
          </div>
        )}
        {/* Issues */}
        {issues.length > 0 && (
          <div>
            <h5 className={cn("text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2", t.textMuted)}><AlertTriangle size={14} className="text-amber-400" /> Validation Issues ({issues.length})</h5>
            {renderTable(['Severity', 'Category', 'Entity', 'Issue', 'Recommendation'],
              issues.map(iss => [severityBadge(iss.severity), <span className="text-[10px] text-violet-400 font-mono">{safeString(iss.category)}</span>, safeString(iss.entity || '—'), safeString(iss.issue), safeString(iss.recommendation || '—')]))}
          </div>
        )}
        {/* Drug Interactions */}
        {interactions.length > 0 && (
          <div>
            <h5 className={cn("text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2", t.textMuted)}><Pill size={14} className="text-rose-400" /> Drug Interactions ({interactions.length})</h5>
            {renderTable(['Drug 1', 'Drug 2', 'Interaction', 'Severity', 'Recommendation'],
              interactions.map(di => [safeString(di.drug1), safeString(di.drug2), safeString(di.interaction), severityBadge(di.severity), safeString(di.recommendation || '—')]))}
          </div>
        )}
        {/* Summary notes */}
        {safeArray(summary.notes || []).length > 0 && (
          <div>
            <h5 className={cn("text-xs font-bold uppercase tracking-wider mb-2", t.textMuted)}>Summary Notes</h5>
            <ul className="space-y-1">{safeArray(summary.notes).map((n, i) => <li key={i} className={cn("text-xs flex items-start gap-2", t.textSecondary)}><Info size={12} className="mt-0.5 text-blue-400 flex-shrink-0" />{safeString(n)}</li>)}</ul>
          </div>
        )}
      </div>
    );
  };

  const renderGenericStage = (data) => {
    if (!data || typeof data !== 'object') return null;
    const keys = Object.keys(data).filter(k => k !== 'system_meta' && k !== 'raw_text_snapshot');
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {keys.slice(0, 12).map(key => {
            const val = data[key];
            const display = val === null ? 'null' : typeof val === 'object' ? (Array.isArray(val) ? `[${val.length} items]` : `{${Object.keys(val).length} fields}`) : String(val).slice(0, 100);
            return (
              <div key={key} className={cn("p-2 rounded-lg", t.bgTertiary)}>
                <div className={cn("text-[10px] font-mono uppercase tracking-wider", t.textMuted)}>{key}</div>
                <div className={cn("text-xs font-mono truncate", t.text)}>{display}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Get the right renderer for each agent stage
  const renderFeature = (data) => {
    if (!data || typeof data !== 'object') return null;
    const parsed = data.parse_error ? parseNarrativeData(data) : data;
    const summaryType = safeGet(parsed, 'summary_type') || '';
    const genDate = safeGet(parsed, 'generation_date') || '';
    const filesInt = safeArray(safeGet(parsed, 'files_integrated') || []);
    const patientProfile = safeGet(parsed, 'patient_profile') || {};
    const narrativeText = safeGet(parsed, 'longitudinal_narrative.narrative_text') || safeGet(parsed, 'narrative_text') || '';
    const keyChars = safeArray(safeGet(patientProfile, 'key_characteristics') || []);
    const baselineStatus = safeGet(patientProfile, 'baseline_status') || '';
    const snippet = safeGet(patientProfile, 'summary_snippet') || '';
    const sysMeta = safeGet(parsed, 'system_meta') || safeGet(parsed, '_system_meta') || {};
    const processing = safeGet(sysMeta, 'processing') || {};
    const demographics = safeGet(sysMeta, 'demographics') || {};

    return (
      <div className="space-y-4">
        {/* Meta badges */}
        <div className="flex flex-wrap gap-2">
          {summaryType && renderStatBadge('Summary Type', summaryType.replace(/_/g, ' '), 'indigo')}
          {genDate && renderStatBadge('Generated', new Date(genDate).toLocaleDateString(), 'teal')}
          {processing.page_count && renderStatBadge('Pages', processing.page_count, 'violet')}
          {processing.method && renderStatBadge('Method', processing.method, 'cyan')}
          {processing.chunks_processed && renderStatBadge('Chunks', processing.chunks_processed, 'amber')}
          {processing.total_text_chars && renderStatBadge('Characters', processing.total_text_chars.toLocaleString(), 'emerald')}
          {safeGet(sysMeta, 'file_size') && renderStatBadge('File Size', formatBytes(safeGet(sysMeta, 'file_size')), 'blue')}
        </div>

        {/* Demographics from system_meta */}
        {Object.keys(demographics).length > 0 && (
          <div>
            <h5 className={cn("text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2", t.textMuted)}><User size={14} className="text-blue-400" /> Patient Demographics</h5>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[['Age', demographics.age], ['Gender', demographics.gender], ['MRN', demographics.mrn], ['Confidence', demographics.confidence !== undefined ? `${(Number(demographics.confidence) * 100).toFixed(0)}%` : null]].filter(([, v]) => v).map(([label, val], i) => (
                <div key={i} className={cn("p-2 rounded-lg", t.bgTertiary)}>
                  <div className={cn("text-[10px] uppercase tracking-wider", t.textMuted)}>{label}</div>
                  <div className={cn("text-sm font-medium", t.text)}>{safeString(val)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Patient Profile */}
        {(patientProfile.age || patientProfile.gender) && (
          <div>
            <h5 className={cn("text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2", t.textMuted)}><Heart size={14} className="text-rose-400" /> Patient Profile</h5>
            <div className="grid grid-cols-2 gap-2">
              {patientProfile.age && <div className={cn("p-2 rounded-lg", t.bgTertiary)}><div className={cn("text-[10px] uppercase", t.textMuted)}>Age</div><div className={cn("text-sm font-medium", t.text)}>{safeString(patientProfile.age)}</div></div>}
              {patientProfile.gender && <div className={cn("p-2 rounded-lg", t.bgTertiary)}><div className={cn("text-[10px] uppercase", t.textMuted)}>Gender</div><div className={cn("text-sm font-medium", t.text)}>{safeString(patientProfile.gender)}</div></div>}
            </div>
          </div>
        )}

        {/* Key Characteristics */}
        {keyChars.length > 0 && (
          <div>
            <h5 className={cn("text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2", t.textMuted)}><Sparkles size={14} className="text-amber-400" /> Key Characteristics</h5>
            <div className="flex flex-wrap gap-2">
              {keyChars.map((c, i) => {
                const colors = ['bg-teal-500/10 text-teal-400 border-teal-500/20', 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20', 'bg-blue-500/10 text-blue-400 border-blue-500/20', 'bg-violet-500/10 text-violet-400 border-violet-500/20'];
                return <span key={i} className={cn("text-xs px-2.5 py-1 rounded-lg border font-medium", colors[i % colors.length])}>{safeString(c)}</span>;
              })}
            </div>
          </div>
        )}

        {/* Baseline Status */}
        {baselineStatus && (
          <div className={cn("p-3 rounded-lg border-l-4 border-l-rose-500/40 text-sm", t.bgTertiary, t.text)}>
            <div className={cn("text-[10px] uppercase font-bold mb-1 text-rose-400")}>Baseline Status</div>
            {safeString(baselineStatus)}
          </div>
        )}

        {/* Summary Snippet */}
        {snippet && (
          <div className={cn("p-3 rounded-lg border-l-4 border-l-teal-500/40 text-sm italic", t.bgTertiary, t.textSecondary)}>
            {safeString(snippet)}
          </div>
        )}

        {/* Source Documents */}
        {filesInt.length > 0 && (
          <div>
            <h5 className={cn("text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2", t.textMuted)}><FileBarChart size={14} className="text-cyan-400" /> Source Documents ({filesInt.length})</h5>
            {renderTable(['Filename', 'Date', 'Document Type', 'Key Contribution'],
              filesInt.map(f => [
                safeString(typeof f === 'string' ? f : safeGet(f, 'filename') || 'Unknown'),
                safeString(safeGet(f, 'date') || '—'),
                safeString(safeGet(f, 'document_type') || '—'),
                safeString(safeGet(f, 'key_contribution') || '—')
              ]))}
          </div>
        )}

        {/* Narrative Text (markdown rendered) */}
        {narrativeText && (
          <div className={cn("rounded-lg border overflow-hidden", t.card)}>
            <div className={cn("p-3 border-b flex items-center gap-2", t.border, 'bg-indigo-500/5')}>
              <BookOpen size={16} className="text-indigo-400" />
              <span className={cn("text-sm font-bold", t.text)}>Longitudinal Narrative</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 font-bold flex items-center gap-1 ml-auto">
                <BrainCircuit size={10} /> AI Generated
              </span>
            </div>
            <div className="p-4">
              <NarrativeMarkdownRenderer text={narrativeText} theme={theme} />
            </div>
          </div>
        )}
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════════
  // RENDER JUDGE (LLM-as-a-Judge Quality Evaluation)
  // ═══════════════════════════════════════════════════════════════
  
  // Parse judge data - handles nested inline_judge and parse_error cases
  const parseJudgeData = (raw) => {
    if (!raw || typeof raw !== 'object') return raw;
    
    // Check for inline_judge wrapper (from backend structure)
    let judgeData = raw.inline_judge || raw;
    
    // If parse_error, try to extract from raw_response
    if (judgeData.parse_error && judgeData.raw_response) {
      const rawText = judgeData.raw_response;
      // Try to extract JSON from markdown code block
      let cleaned = rawText.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
      
      // Try to parse whatever JSON we can
      try {
        const parsed = JSON.parse(cleaned);
        // Merge with metadata from the wrapper
        return {
          ...parsed,
          judge_model: judgeData.judge_model || parsed.judge_model,
          evaluation_timestamp: judgeData.evaluation_timestamp || parsed.evaluation_timestamp,
          case_id: raw.case_id || judgeData.case_id,
          run_id: raw.run_id || judgeData.run_id,
          _parse_recovered: true
        };
      } catch {
        // JSON is truncated - try to extract what we can
        const extracted = {
          judge_model: judgeData.judge_model,
          evaluation_timestamp: judgeData.evaluation_timestamp,
          case_id: raw.case_id || judgeData.case_id,
          run_id: raw.run_id || judgeData.run_id,
          scores: {},
          _parse_error: true,
          _raw_excerpt: rawText.substring(0, 1500)
        };
        
        // Try to extract individual scores using regex
        const scorePatterns = [
          { key: 'correctness', regex: /"correctness":\s*\{\s*"score":\s*([\d.]+)/i },
          { key: 'completeness', regex: /"completeness":\s*\{\s*"score":\s*([\d.]+)/i },
          { key: 'faithfulness', regex: /"faithfulness":\s*\{\s*"score":\s*([\d.]+)/i },
          { key: 'helpfulness', regex: /"helpfulness":\s*\{\s*"score":\s*([\d.]+)/i },
          { key: 'coherence', regex: /"coherence":\s*\{\s*"score":\s*([\d.]+)/i },
          { key: 'relevance', regex: /"relevance":\s*\{\s*"score":\s*([\d.]+)/i },
          { key: 'following_instructions', regex: /"following_instructions":\s*\{\s*"score":\s*([\d.]+)/i },
          { key: 'professional_style', regex: /"professional_style":\s*\{\s*"score":\s*([\d.]+)/i }
        ];
        
        for (const { key, regex } of scorePatterns) {
          const match = rawText.match(regex);
          if (match) {
            extracted.scores[key] = { score: parseFloat(match[1]) };
            // Try to extract explanation
            const explMatch = rawText.match(new RegExp(`"${key}":\\s*\\{[^}]*"explanation":\\s*"([^"]+)"`, 'i'));
            if (explMatch) extracted.scores[key].explanation = explMatch[1];
          }
        }
        
        // Try to extract overall score and grade
        const overallMatch = rawText.match(/"overall_score":\s*([\d.]+)/i);
        if (overallMatch) extracted.overall_score = parseFloat(overallMatch[1]);
        
        const gradeMatch = rawText.match(/"quality_grade":\s*"([^"]+)"/i);
        if (gradeMatch) extracted.quality_grade = gradeMatch[1];
        
        // Calculate overall if we have scores but no overall
        if (!extracted.overall_score && Object.keys(extracted.scores).length > 0) {
          const weights = { correctness: 0.2, completeness: 0.2, faithfulness: 0.2, helpfulness: 0.15, coherence: 0.1, relevance: 0.05, following_instructions: 0.05, professional_style: 0.05 };
          let total = 0, weightSum = 0;
          for (const [k, v] of Object.entries(extracted.scores)) {
            if (v.score !== undefined && weights[k]) {
              total += v.score * weights[k];
              weightSum += weights[k];
            }
          }
          if (weightSum > 0) extracted.overall_score = total / weightSum;
        }
        
        // Derive grade from overall score if missing
        if (!extracted.quality_grade && extracted.overall_score !== undefined) {
          const s = extracted.overall_score;
          extracted.quality_grade = s >= 0.9 ? 'EXCELLENT' : s >= 0.75 ? 'GOOD' : s >= 0.6 ? 'FAIR' : 'POOR';
        }
        
        return extracted;
      }
    }
    
    // Merge inline_judge data with outer metadata
    return {
      ...judgeData,
      case_id: raw.case_id || judgeData.case_id,
      run_id: raw.run_id || judgeData.run_id
    };
  };
  
  const renderJudge = (data) => {
    if (!data || typeof data !== 'object') return null;
    
    // Parse the judge data (handles inline_judge wrapper and parse_error)
    const parsed = parseJudgeData(data);
    
    const judgeModel = safeGet(parsed, 'judge_model') || 'Unknown';
    const timestamp = safeGet(parsed, 'evaluation_timestamp') || '';
    const scores = safeGet(parsed, 'scores') || {};
    const overallScore = safeGet(parsed, 'overall_score');
    const qualityGrade = safeGet(parsed, 'quality_grade') || 'UNKNOWN';
    const criticalIssues = safeArray(safeGet(parsed, 'critical_issues') || []);
    const improvementSuggestions = safeArray(safeGet(parsed, 'improvement_suggestions') || []);
    const medicationsVerified = safeArray(safeGet(parsed, 'medications_verified') || []);
    const conditionsVerified = safeArray(safeGet(parsed, 'conditions_verified') || []);
    const missingMedications = safeArray(safeGet(parsed, 'missing_medications') || []);
    const missingConditions = safeArray(safeGet(parsed, 'missing_conditions') || []);
    const parseError = parsed._parse_error;
    const rawExcerpt = parsed._raw_excerpt;

    const gradeColors = {
      'EXCELLENT': 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
      'GOOD': 'text-teal-400 bg-teal-500/10 border-teal-500/30',
      'FAIR': 'text-amber-400 bg-amber-500/10 border-amber-500/30',
      'POOR': 'text-red-400 bg-red-500/10 border-red-500/30',
      'UNKNOWN': 'text-slate-400 bg-slate-500/10 border-slate-500/30'
    };

    const scoreColor = (score) => {
      const s = Number(score);
      if (s >= 0.9) return 'bg-emerald-500';
      if (s >= 0.75) return 'bg-teal-500';
      if (s >= 0.6) return 'bg-amber-500';
      return 'bg-red-500';
    };

    const scoreDimensions = [
      { key: 'correctness', label: 'Correctness', icon: CheckCircle2, desc: 'Accuracy of clinical data representation', weight: '20%' },
      { key: 'completeness', label: 'Completeness', icon: ClipboardList, desc: 'All entities captured', weight: '20%' },
      { key: 'faithfulness', label: 'Faithfulness', icon: Shield, desc: 'Claims grounded in source data', weight: '20%' },
      { key: 'helpfulness', label: 'Helpfulness', icon: Heart, desc: 'Clinical utility for physicians', weight: '15%' },
      { key: 'coherence', label: 'Coherence', icon: Network, desc: 'Logical organization and flow', weight: '10%' },
      { key: 'relevance', label: 'Relevance', icon: Target, desc: 'Prioritized clinically relevant content', weight: '5%' },
      { key: 'following_instructions', label: 'Schema Compliance', icon: FileCheck, desc: 'Required sections present', weight: '5%' },
      { key: 'professional_style', label: 'Professional Style', icon: BookOpen, desc: 'Medical-professional language', weight: '5%' }
    ];

    return (
      <div className="space-y-4">
        {/* Header with Overall Grade */}
        <div className={cn("p-4 rounded-xl border-2 flex items-center justify-between", gradeColors[qualityGrade] || gradeColors['UNKNOWN'])}>
          <div className="flex items-center gap-4">
            <div className="flex flex-col">
              <span className={cn("text-xs uppercase tracking-wider", t.textMuted)}>Quality Grade</span>
              <span className="text-2xl font-black">{qualityGrade}</span>
            </div>
            {overallScore !== undefined && (
              <div className="flex items-center gap-2 px-4 border-l border-current/20">
                <Gauge size={24} className="opacity-60" />
                <div className="text-3xl font-black">{(Number(overallScore) * 100).toFixed(0)}%</div>
              </div>
            )}
          </div>
          <div className="text-right space-y-1">
            <div className={cn("text-[10px] uppercase tracking-wider", t.textMuted)}>Judge Model</div>
            <div className="text-xs font-mono opacity-80">{safeString(judgeModel)}</div>
            {timestamp && <div className={cn("text-[10px]", t.textMuted)}>{new Date(timestamp).toLocaleString()}</div>}
          </div>
        </div>

        {/* Parse Error Notice */}
        {parseError && (
          <div className={cn("p-3 rounded-lg border-l-4 border-l-amber-500 text-xs", 'bg-amber-500/5', t.text)}>
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle size={12} className="text-amber-400" />
              <span className="font-bold text-amber-400">Partial Data Recovered</span>
            </div>
            <span className={cn(t.textMuted)}>The judge response was truncated. Scores shown are extracted from available data.</span>
          </div>
        )}

        {/* Score Dimensions Grid */}
        <div>
          <h5 className={cn("text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2", t.textMuted)}>
            <BarChart3 size={14} className="text-amber-400" /> Evaluation Dimensions
          </h5>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {scoreDimensions.map(dim => {
              const scoreData = scores[dim.key] || {};
              const score = scoreData.score;
              const explanation = scoreData.explanation || '';
              const DimIcon = dim.icon || Info;
              
              return (
                <div key={dim.key} className={cn("p-3 rounded-lg border", t.card)}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <DimIcon size={14} className="text-amber-400" />
                      <span className={cn("text-sm font-semibold", t.text)}>{dim.label}</span>
                      <span className={cn("text-[9px] px-1.5 py-0.5 rounded bg-slate-500/20", t.textMuted)}>{dim.weight}</span>
                    </div>
                    {score !== undefined && (
                      <span className={cn("text-sm font-bold", score >= 0.75 ? 'text-emerald-400' : score >= 0.6 ? 'text-amber-400' : 'text-red-400')}>
                        {(Number(score) * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                  {/* Progress bar */}
                  {score !== undefined && (
                    <div className={cn("w-full h-1.5 rounded-full overflow-hidden mb-2", t.bgTertiary)}>
                      <div className={cn("h-full rounded-full transition-all", scoreColor(score))} style={{ width: `${Math.max(Number(score) * 100, 3)}%` }} />
                    </div>
                  )}
                  <div className={cn("text-[10px]", t.textMuted)}>{dim.desc}</div>
                  {explanation && <div className={cn("text-xs mt-1.5 leading-relaxed", t.textSecondary)}>{safeString(explanation)}</div>}
                  {/* Deficiencies / Missing Items / Hallucinations / Gaps */}
                  {(() => {
                    const details = safeArray(scoreData.deficiencies || scoreData.missing_items || scoreData.hallucinations || scoreData.gaps || scoreData.missing_sections || []);
                    if (details.length === 0) return null;
                    const label = scoreData.deficiencies ? 'Deficiencies' : scoreData.missing_items ? 'Missing' : scoreData.hallucinations ? 'Hallucinations' : scoreData.gaps ? 'Gaps' : 'Issues';
                    return (
                      <div className="mt-2 pt-2 border-t border-dashed border-current/10">
                        <div className={cn("text-[9px] uppercase font-bold mb-1 text-rose-400")}>{label}</div>
                        <ul className="space-y-0.5">
                          {details.slice(0, 4).map((item, idx) => (
                            <li key={idx} className={cn("text-[10px] flex items-start gap-1.5", t.textMuted)}>
                              <span className="text-rose-400 mt-0.5">•</span>
                              <span>{safeString(item)}</span>
                            </li>
                          ))}
                          {details.length > 4 && <li className={cn("text-[10px] text-rose-400")}>...and {details.length - 4} more</li>}
                        </ul>
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        </div>

        {/* Critical Issues */}
        {criticalIssues.length > 0 && (
          <div className={cn("rounded-lg border-l-4 border-l-red-500 p-4", 'bg-red-500/5')}>
            <h5 className="text-sm font-bold text-red-400 mb-2 flex items-center gap-2"><AlertCircle size={14} /> Critical Issues ({criticalIssues.length})</h5>
            <ul className="space-y-1">
              {criticalIssues.map((issue, i) => (
                <li key={i} className={cn("text-xs flex items-start gap-2", t.text)}>
                  <span className="text-red-400 mt-0.5">•</span>
                  <span>{safeString(issue)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Improvement Suggestions */}
        {improvementSuggestions.length > 0 && (
          <div className={cn("rounded-lg border-l-4 border-l-amber-500 p-4", 'bg-amber-500/5')}>
            <h5 className="text-sm font-bold text-amber-400 mb-2 flex items-center gap-2"><Sparkles size={14} /> Improvement Suggestions</h5>
            <ol className="space-y-1.5">
              {improvementSuggestions.slice(0, 8).map((suggestion, i) => (
                <li key={i} className={cn("text-xs flex items-start gap-2", t.text)}>
                  <span className="text-amber-400 font-bold w-4">{i + 1}.</span>
                  <span>{safeString(suggestion)}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Missing Items */}
        {(missingMedications.length > 0 || missingConditions.length > 0) && (
          <div className={cn("rounded-lg border-l-4 border-l-rose-500 p-4", 'bg-rose-500/5')}>
            <h5 className="text-sm font-bold text-rose-400 mb-2 flex items-center gap-2"><AlertTriangle size={14} /> Missing from Narrative</h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {missingMedications.length > 0 && (
                <div>
                  <div className={cn("text-[10px] uppercase font-bold mb-1 text-rose-400")}>Medications ({missingMedications.length})</div>
                  <div className="flex flex-wrap gap-1">
                    {missingMedications.map((med, i) => (
                      <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">{safeString(med)}</span>
                    ))}
                  </div>
                </div>
              )}
              {missingConditions.length > 0 && (
                <div>
                  <div className={cn("text-[10px] uppercase font-bold mb-1 text-rose-400")}>Conditions ({missingConditions.length})</div>
                  <div className="flex flex-wrap gap-1">
                    {missingConditions.map((cond, i) => (
                      <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">{safeString(cond)}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Verified Items */}
        {(medicationsVerified.length > 0 || conditionsVerified.length > 0) && (
          <div className={cn("rounded-lg border p-4", t.card)}>
            <h5 className={cn("text-sm font-bold mb-3 flex items-center gap-2", t.text)}><CheckCircle2 size={14} className="text-emerald-400" /> Verified in Narrative</h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {medicationsVerified.length > 0 && (
                <div>
                  <div className={cn("text-[10px] uppercase font-bold mb-1.5 text-emerald-400 flex items-center gap-1")}><Pill size={10} /> Medications ({medicationsVerified.length})</div>
                  <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                    {medicationsVerified.map((med, i) => (
                      <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">{safeString(med)}</span>
                    ))}
                  </div>
                </div>
              )}
              {conditionsVerified.length > 0 && (
                <div>
                  <div className={cn("text-[10px] uppercase font-bold mb-1.5 text-teal-400 flex items-center gap-1")}><Stethoscope size={10} /> Conditions ({conditionsVerified.length})</div>
                  <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                    {conditionsVerified.map((cond, i) => (
                      <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20">{safeString(cond)}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const getStageRenderer = (agentId) => {
    switch (agentId) {
      case 'ingestion': return renderIngestion;
      case 'cleaning': return renderCleaning;
      case 'validation': return renderValidation;
      case 'feature': return renderFeature;
      case 'judge': return renderJudge;
      default: return renderGenericStage;
    }
  };

  const agentColors = {
    ingestion: { bg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-400', accent: 'blue' },
    cleaning: { bg: 'bg-cyan-500/10', border: 'border-cyan-500/20', text: 'text-cyan-400', accent: 'cyan' },
    validation: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400', accent: 'emerald' },
    normalization: { bg: 'bg-violet-500/10', border: 'border-violet-500/20', text: 'text-violet-400', accent: 'violet' },
    enrichment: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-400', accent: 'amber' },
    analysis: { bg: 'bg-rose-500/10', border: 'border-rose-500/20', text: 'text-rose-400', accent: 'rose' },
    feature: { bg: 'bg-indigo-500/10', border: 'border-indigo-500/20', text: 'text-indigo-400', accent: 'indigo' },
    compass: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400', accent: 'emerald' },
    pinnacle: { bg: 'bg-sky-500/10', border: 'border-sky-500/20', text: 'text-sky-400', accent: 'sky' },
    madrigal: { bg: 'bg-rose-500/10', border: 'border-rose-500/20', text: 'text-rose-400', accent: 'rose' },
    judge: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-400', accent: 'amber' },
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* File List Sidebar */}
      <div className="lg:col-span-1">
        <div className={cn("rounded-xl border overflow-hidden sticky top-0", t.card)}>
          <div className={cn("p-4 border-b flex items-center gap-2", t.border)}>
            <FolderOpen size={18} className="text-teal-400" />
            <h3 className={cn("font-bold text-sm", t.text)}>Patient Files</h3>
            <span className={cn("text-[10px] px-2 py-0.5 rounded-full ml-auto", t.bgTertiary, t.textMuted)}>{rawFileCount}</span>
          </div>
          <div className="max-h-[600px] overflow-y-auto">
            {rawFiles.length === 0 ? (
              <div className={cn("p-6 text-center text-sm", t.textMuted)}>
                {selectedFile ? 'No files available for this case' : 'Open a case to load files'}
              </div>
            ) : (
              <div className={cn("divide-y", t.border)}>
                {rawFiles.map((file, idx) => {
                  const ext = (file.name || '').split('.').pop()?.toLowerCase();
                  const isSelected = selectedFile?.name === file.name;
                  return (
                    <button key={idx} onClick={() => loadPipelineForFile(file)} className={cn("w-full text-left p-3 flex items-center gap-2.5 transition-all", isSelected ? "bg-teal-500/10 border-l-4 border-l-teal-500" : t.bgHover)}>
                      <FileText size={16} className="text-teal-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className={cn("text-sm font-medium truncate", t.text)}>{file.name || 'Unknown'}</div>
                        <div className="flex gap-2 mt-0.5">
                          <span className={cn("text-[10px]", t.textMuted)}>{formatBytes(file.size)}</span>
                          {ext && <span className={cn("text-[10px] font-mono", t.textMuted)}>.{ext}</span>}
                        </div>
                      </div>
                      <ChevronRight size={14} className={t.textMuted} />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pipeline Stages Panel */}
      <div className="lg:col-span-3 space-y-4">
        {!selectedFile ? (
          <div className={cn("flex flex-col items-center justify-center py-20 rounded-2xl border", t.card)}>
            <FolderOpen size={48} className={cn("mb-4", t.textMuted)} />
            <h3 className={cn("text-lg font-bold mb-1", t.text)}>Select a File</h3>
            <p className={cn("text-sm", t.textSecondary)}>Choose a patient file to view its pipeline processing stages</p>
          </div>
        ) : loading ? (
          <div className={cn("flex flex-col items-center justify-center py-20 rounded-2xl border", t.card)}>
            <Loader2 size={32} className="text-teal-400 animate-spin mb-4" />
            <p className={cn("text-sm", t.textSecondary)}>Loading pipeline outputs for <strong className={t.text}>{selectedFile.name}</strong>...</p>
          </div>
        ) : (
          <>
            {/* Selected file header */}
            <div className={cn("p-4 rounded-xl border flex items-center gap-3", t.card)}>
              <FileText size={20} className="text-teal-400" />
              <div className="flex-1">
                <h3 className={cn("font-bold", t.text)}>{selectedFile.name}</h3>
                <div className="flex gap-3 mt-0.5">
                  <span className={cn("text-xs", t.textMuted)}>{formatBytes(selectedFile.size)}</span>
                  <span className={cn("text-xs px-2 py-0 rounded bg-teal-500/10 text-teal-400")}>Raw Upload</span>
                </div>
              </div>
              <button
                onClick={viewOriginalFile}
                className={cn("flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border transition-all",
                  showOriginal ? 'bg-teal-500/20 border-teal-500/40 text-teal-400' : cn(t.bgTertiary, t.border, t.text, t.bgHover)
                )}
              >
                <Eye size={14} />
                {showOriginal ? 'Hide Original' : 'View Original'}
              </button>
              <span className={cn("text-xs", t.textMuted)}>{Object.keys(pipelineData).length} pipeline stages loaded</span>
            </div>

            {/* Original file preview panel */}
            {showOriginal && (
              <div className={cn("rounded-xl border overflow-hidden", t.card)}>
                <div className={cn("p-3 border-b flex items-center gap-2", t.border, 'bg-amber-500/5')}>
                  <FileArchive size={16} className="text-amber-400" />
                  <span className={cn("text-sm font-bold", t.text)}>Original File — {selectedFile.name}</span>
                  <span className={cn("text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 ml-auto")}>RAW Bucket</span>
                </div>
                <div className="p-4">
                  {loadingOriginal ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 size={24} className="text-amber-400 animate-spin mr-3" />
                      <span className={cn("text-sm", t.textSecondary)}>Loading original file...</span>
                    </div>
                  ) : !originalContent ? (
                    <div className={cn("text-sm text-center py-6", t.textMuted)}>No content loaded</div>
                  ) : originalContent.type === 'error' ? (
                    <div className="flex items-center gap-2 text-rose-400 text-sm py-4"><AlertTriangle size={16} />{originalContent.text}</div>
                  ) : originalContent.type === 'image' ? (
                    <div className="flex justify-center">
                      <img src={originalContent.url} alt={originalContent.name} className="max-w-full max-h-[600px] rounded-lg border border-slate-700/50" />
                    </div>
                  ) : originalContent.type === 'pdf' ? (
                    <iframe src={originalContent.url} title={originalContent.name} className="w-full h-[600px] rounded-lg border border-slate-700/50" />
                  ) : originalContent.type === 'download' ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-3">
                      <FileArchive size={40} className="text-amber-400" />
                      <div className={cn("text-sm font-bold", t.text)}>{originalContent.name}</div>
                      <div className={cn("text-xs text-center max-w-md", t.textMuted)}>
                        {originalContent.ext === 'dcm' || originalContent.ext === 'dicom'
                          ? 'DICOM medical image — binary format, browser preview not supported. Download to open in a DICOM viewer (e.g. Horos, RadiAnt, microDICOM).'
                          : 'Binary document (Word/Excel/other) — browser preview not supported. Download to view the original file.'}
                      </div>
                      {typeof originalContent.size === 'number' && (
                        <div className={cn("text-[10px] font-mono", t.textMuted)}>{formatBytes(originalContent.size)}</div>
                      )}
                      <a
                        href={originalContent.url}
                        download={originalContent.name}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm font-bold hover:bg-amber-500/20 transition-all"
                      >
                        <Download size={16} /> Download original file
                      </a>
                    </div>
                  ) : (
                    <div className="relative">
                      <button onClick={() => { try { navigator.clipboard.writeText(originalContent.text); } catch {} }} className={cn("absolute top-2 right-2 text-[10px] px-2 py-1 rounded-lg font-bold z-10", t.bgTertiary, t.text, t.bgHover)}>
                        <Copy size={12} className="inline mr-1" />Copy
                      </button>
                      <pre className={cn("text-[11px] font-mono whitespace-pre-wrap max-h-[600px] overflow-auto p-3 rounded-lg", t.bgTertiary, t.text)}>
                        {originalContent.text}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Pipeline stages - vertical connector */}
            {/* Note: feature and judge are accumulative (run on all files combined), so we only show them in summary view */}
            <div className="relative">
              {/* Vertical connector line */}
              <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-500/30 via-emerald-500/30 to-indigo-500/30 rounded-full" />

              <div className="space-y-3">
                {CONFIG.agents.filter(a => a.id !== 'feature' && a.id !== 'judge').map((agent) => {
                  const stageData = pipelineData[agent.id];
                  const hasData = stageData && !stageData.error && stageData.data;
                  const isExpanded = expandedStages.has(agent.id);
                  const isRaw = rawToggles[agent.id];
                  const colors = agentColors[agent.id] || agentColors.ingestion;
                  const Icon = agent.icon || Database;
                  const renderer = getStageRenderer(agent.id);

                  return (
                    <div key={agent.id} className={cn("relative pl-12 transition-all", !stageData && "opacity-40")}>
                      {/* Stage icon on the line */}
                      <div className={cn("absolute left-2.5 top-3.5 h-7 w-7 rounded-full flex items-center justify-center z-10 border-2", hasData ? cn(colors.bg, colors.border) : cn(t.bgTertiary, t.border))}>
                        {hasData ? <CheckCircle size={14} className={colors.text} /> : stageData?.error ? <XCircle size={14} className="text-rose-400" /> : <Icon size={14} className={t.textMuted} />}
                      </div>

                      <div className={cn("rounded-xl border overflow-hidden", hasData ? colors.border : t.border)}>
                        <button onClick={() => hasData && toggleStage(agent.id)} disabled={!hasData} className={cn("w-full p-3 flex items-center gap-3 text-left transition-all", hasData ? cn(colors.bg, 'hover:opacity-80') : t.bgTertiary)}>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded", hasData ? cn(colors.bg, colors.text) : cn(t.bgSecondary, t.textMuted))}>Step {agent.step}</span>
                              <span className={cn("text-sm font-bold", t.text)}>{agent.name}</span>
                            </div>
                            <p className={cn("text-[11px] mt-0.5", t.textMuted)}>{agent.description}</p>
                          </div>
                          {stageData?.error && <span className="text-[10px] text-rose-400">Error: {stageData.error}</span>}
                          {hasData && (
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <button onClick={(e) => { e.stopPropagation(); toggleRaw(agent.id); }} className={cn("text-[10px] px-2 py-1 rounded-lg font-bold", isRaw ? 'bg-teal-500/20 text-teal-400' : cn(t.bgTertiary, t.textMuted))}>
                                {isRaw ? 'Structured' : 'Raw JSON'}
                              </button>
                              {isExpanded ? <ChevronUp size={16} className={t.textMuted} /> : <ChevronDown size={16} className={t.textMuted} />}
                            </div>
                          )}
                          {!stageData && <span className={cn("text-[10px]", t.textMuted)}>No output</span>}
                        </button>

                        {isExpanded && hasData && (
                          <div className={cn("border-t p-4", t.border)}>
                            {isRaw ? (
                              <div className="relative">
                                <button onClick={() => { try { navigator.clipboard.writeText(stageData.raw); } catch {} }} className={cn("absolute top-2 right-2 text-[10px] px-2 py-1 rounded-lg font-bold z-10", t.bgTertiary, t.text, t.bgHover)}>
                                  <Copy size={12} className="inline mr-1" />Copy
                                </button>
                                <pre className={cn("text-[11px] font-mono whitespace-pre-wrap max-h-[500px] overflow-auto p-3 rounded-lg", t.bgTertiary, t.text)}>
                                  {stageData.raw}
                                </pre>
                              </div>
                            ) : (
                              renderer(stageData.data)
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// RISK ASSESSMENT DASHBOARD COMPONENT
// ═══════════════════════════════════════════════════════════════

const RiskAssessmentDashboard = ({ narrative, theme }) => {
  const t = getThemeClasses(theme || 'dark');

  const riskData = useMemo(() => {
    try {
      const risks = safeGet(narrative, 'risk_assessment') || safeGet(narrative, 'risks') || safeGet(narrative, 'risk_stratification') || {};
      const clinicalRisks = safeGet(narrative, 'clinical_assessment.risk_factors') || safeGet(narrative, 'risk_factors') || [];
      const alerts = safeGet(narrative, 'clinical_alerts') || safeGet(narrative, 'alerts') || safeGet(narrative, 'warnings') || [];
      const overallRisk = safeGet(risks, 'overall') || safeGet(risks, 'risk_level') || safeGet(risks, 'overall_risk') || safeGet(narrative, 'patient_profile.risk_level') || null;
      const comorbidities = safeGet(narrative, 'comorbidities') || safeGet(narrative, 'comorbidity_index') || null;
      const readmissionRisk = safeGet(risks, 'readmission') || safeGet(risks, 'readmission_risk') || null;
      const mortalityRisk = safeGet(risks, 'mortality') || safeGet(risks, 'mortality_risk') || null;
      const fallRisk = safeGet(risks, 'fall') || safeGet(risks, 'fall_risk') || null;

      // Extract risk categories from risk object
      const categories = [];
      if (typeof risks === 'object' && !Array.isArray(risks)) {
        for (const [key, val] of Object.entries(risks)) {
          if (key === 'overall' || key === 'risk_level' || key === 'overall_risk') continue;
          const name = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          const level = typeof val === 'string' ? val : safeGet(val, 'level') || safeGet(val, 'score') || safeGet(val, 'value') || JSON.stringify(val);
          const desc = typeof val === 'object' ? safeGet(val, 'description') || safeGet(val, 'details') || '' : '';
          categories.push({ name, level: String(level), description: desc });
        }
      }

      return { risks, clinicalRisks: safeArray(clinicalRisks), alerts: safeArray(alerts), overallRisk, comorbidities, readmissionRisk, mortalityRisk, fallRisk, categories };
    } catch {
      return { risks: {}, clinicalRisks: [], alerts: [], overallRisk: null, comorbidities: null, readmissionRisk: null, mortalityRisk: null, fallRisk: null, categories: [] };
    }
  }, [narrative]);

  const getRiskColor = (level) => {
    if (!level) return { bg: 'bg-slate-500/10', text: 'text-slate-400', ring: 'ring-slate-500/30' };
    const l = String(level).toLowerCase();
    if (l.includes('critical') || l.includes('very high') || l.includes('severe')) return { bg: 'bg-rose-500/10', text: 'text-rose-400', ring: 'ring-rose-500/30' };
    if (l.includes('high') || l.includes('elevated')) return { bg: 'bg-orange-500/10', text: 'text-orange-400', ring: 'ring-orange-500/30' };
    if (l.includes('moderate') || l.includes('medium')) return { bg: 'bg-amber-500/10', text: 'text-amber-400', ring: 'ring-amber-500/30' };
    if (l.includes('low') || l.includes('minimal')) return { bg: 'bg-emerald-500/10', text: 'text-emerald-400', ring: 'ring-emerald-500/30' };
    return { bg: 'bg-blue-500/10', text: 'text-blue-400', ring: 'ring-blue-500/30' };
  };

  const hasData = riskData.overallRisk || riskData.categories.length > 0 || riskData.clinicalRisks.length > 0 || riskData.alerts.length > 0;

  if (!hasData) {
    return (
      <div className={cn("rounded-xl border p-8 text-center", t.card)}>
        <Shield size={48} className="mx-auto mb-4 text-teal-400 opacity-40" />
        <h3 className={cn("text-lg font-bold mb-2", t.text)}>Risk Assessment</h3>
        <p className={cn("text-sm", t.textSecondary)}>No risk assessment data available. Risk scores will appear after the analysis agent processes patient data.</p>
      </div>
    );
  }

  const overallColor = getRiskColor(riskData.overallRisk);

  return (
    <div className="space-y-4">
      {/* Overall Risk Indicator */}
      {riskData.overallRisk && (
        <div className={cn("p-6 rounded-xl border-2 ring-2", overallColor.bg, overallColor.ring, t.border)}>
          <div className="flex items-center gap-4">
            <div className={cn("h-16 w-16 rounded-2xl flex items-center justify-center", overallColor.bg)}>
              <Shield size={32} className={overallColor.text} />
            </div>
            <div>
              <div className={cn("text-xs uppercase font-bold tracking-wider", t.textMuted)}>Overall Risk Level</div>
              <div className={cn("text-2xl font-black uppercase", overallColor.text)}>{safeString(riskData.overallRisk)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Risk Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Readmission Risk', value: riskData.readmissionRisk, icon: RefreshCw },
          { label: 'Mortality Risk', value: riskData.mortalityRisk, icon: AlertTriangle },
          { label: 'Fall Risk', value: riskData.fallRisk, icon: Activity },
        ].filter(m => m.value).map((metric, idx) => {
          const mColor = getRiskColor(typeof metric.value === 'object' ? safeGet(metric.value, 'level') || safeGet(metric.value, 'score') : metric.value);
          const display = typeof metric.value === 'object' ? safeGet(metric.value, 'level') || safeGet(metric.value, 'score') || JSON.stringify(metric.value) : metric.value;
          return (
            <div key={idx} className={cn("p-4 rounded-xl border", t.card)}>
              <div className="flex items-center gap-2 mb-2">
                <metric.icon size={16} className={mColor.text} />
                <span className={cn("text-xs uppercase font-bold", t.textMuted)}>{metric.label}</span>
              </div>
              <div className={cn("text-xl font-black uppercase", mColor.text)}>{safeString(display)}</div>
            </div>
          );
        })}
      </div>

      {/* Risk Categories */}
      {riskData.categories.length > 0 && (
        <div className={cn("rounded-xl border overflow-hidden", t.card)}>
          <div className={cn("p-4 border-b flex items-center gap-3", t.border)}>
            <BarChart size={18} className="text-teal-400" />
            <h3 className={cn("font-bold", t.text)}>Risk Categories</h3>
          </div>
          <div className="divide-y" style={{ borderColor: theme === 'dark' ? '#1e293b' : '#e5e7eb' }}>
            {riskData.categories.map((cat, idx) => {
              const catColor = getRiskColor(cat.level);
              return (
                <div key={idx} className={cn("p-4 flex items-center gap-4", t.bgHover)}>
                  <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0", catColor.bg)}>
                    <Shield size={18} className={catColor.text} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={cn("font-bold text-sm", t.text)}>{cat.name}</div>
                    {cat.description && <div className={cn("text-xs mt-0.5", t.textSecondary)}>{safeString(cat.description)}</div>}
                  </div>
                  <span className={cn("text-xs px-3 py-1 rounded-full font-black uppercase", catColor.bg, catColor.text)}>{safeString(cat.level)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Clinical Risk Factors */}
      {riskData.clinicalRisks.length > 0 && (
        <div className={cn("rounded-xl border overflow-hidden", t.card)}>
          <div className={cn("p-4 border-b flex items-center gap-3", t.border)}>
            <AlertTriangle size={18} className="text-amber-400" />
            <h3 className={cn("font-bold", t.text)}>Clinical Risk Factors</h3>
            <span className={cn("text-xs px-2 py-0.5 rounded-full", t.bgTertiary, t.textMuted)}>{riskData.clinicalRisks.length}</span>
          </div>
          <div className="p-4 flex flex-wrap gap-2">
            {riskData.clinicalRisks.map((rf, idx) => {
              const text = typeof rf === 'string' ? rf : safeGet(rf, 'factor') || safeGet(rf, 'name') || safeGet(rf, 'description') || JSON.stringify(rf);
              return (
                <span key={idx} className={cn("px-3 py-1.5 rounded-lg text-sm font-medium border", t.bgTertiary, t.text, t.border)}>{safeString(text)}</span>
              );
            })}
          </div>
        </div>
      )}

      {/* Active Alerts */}
      {riskData.alerts.length > 0 && (
        <div className="space-y-3">
          {riskData.alerts.map((alert, idx) => {
            const alertText = typeof alert === 'string' ? alert : safeGet(alert, 'message') || safeGet(alert, 'text') || safeGet(alert, 'description') || JSON.stringify(alert);
            const severity = typeof alert === 'object' ? safeGet(alert, 'severity') || safeGet(alert, 'level') || '' : '';
            const sevColor = getRiskColor(severity);
            return (
              <div key={idx} className={cn("p-4 rounded-xl border-l-4 flex items-start gap-3", t.card, severity ? `border-l-${sevColor.text.replace('text-', '')}` : 'border-l-amber-500')}>
                <AlertTriangle size={18} className="text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <div className={cn("text-sm font-medium", t.text)}>{safeString(alertText)}</div>
                  {severity && <span className={cn("text-xs font-bold uppercase mt-1 inline-block", sevColor.text)}>{safeString(severity)}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// PATIENT EXPORT PANEL
// ═══════════════════════════════════════════════════════════════

const PatientExportPanel = ({ narrative, caseData, s3Client, theme }) => {
  const t = getThemeClasses(theme || 'dark');
  const [exportFormat, setExportFormat] = useState('json');
  const [exportStatus, setExportStatus] = useState(null);
  const [downloadingPdf, setDownloadingPdf] = useState(null);

  // PDF manifest from pipeline
  const pdfManifest = caseData?.pdfManifest;
  const pdfReports = pdfManifest?.reports || [];

  const downloadPdf = async (report) => {
    if (!s3Client || !report?.key) return;
    setDownloadingPdf(report.name);
    try {
      const resp = await s3Client.send(new GetObjectCommand({
        Bucket: CONFIG.buckets.CURATED,
        Key: report.key
      }));
      const arrayBuf = await resp.Body.transformToByteArray();
      const blob = new Blob([arrayBuf], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${caseData?.folderName || caseData?.id || 'patient'}_${report.name}`;
      a.click();
      URL.revokeObjectURL(url);
      setExportStatus('success');
      setTimeout(() => setExportStatus(null), 3000);
    } catch (e) {
      console.error('PDF download failed:', e);
      setExportStatus('error');
      setTimeout(() => setExportStatus(null), 3000);
    }
    setDownloadingPdf(null);
  };

  const pdfCategoryMeta = {
    'Complete_Report.pdf':       { icon: FileText,  color: 'text-teal-400',    bg: 'bg-teal-500/10',   border: 'border-teal-500/30', desc: 'Full patient report with all sections' },
    'Patient_Overview.pdf':      { icon: User,       color: 'text-blue-400',    bg: 'bg-blue-500/10',   border: 'border-blue-500/30', desc: 'Patient demographics & summary' },
    'Clinical_Findings.pdf':     { icon: Stethoscope, color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/30', desc: 'Diagnoses & clinical interpretation' },
    'Medications_Treatment.pdf': { icon: Pill,       color: 'text-rose-400',    bg: 'bg-rose-500/10',   border: 'border-rose-500/30', desc: 'Medications, dosages & treatment plan' },
    'Laboratory_Results.pdf':    { icon: TestTube,   color: 'text-cyan-400',    bg: 'bg-cyan-500/10',   border: 'border-cyan-500/30', desc: 'Lab values, panels & abnormals' },
    'Symptoms.pdf':              { icon: Heart,      color: 'text-pink-400',    bg: 'bg-pink-500/10',   border: 'border-pink-500/30', desc: 'Documented symptoms & severity' },
    'Risk_Assessment.pdf':       { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', desc: 'Risk factors & monitoring' },
    'Diet_Lifestyle.pdf':        { icon: Heart,      color: 'text-green-400',   bg: 'bg-green-500/10',  border: 'border-green-500/30', desc: 'Diet, exercise & lifestyle guidance' },
    'Follow_Up_Plan.pdf':        { icon: Calendar,   color: 'text-indigo-400',  bg: 'bg-indigo-500/10', border: 'border-indigo-500/30', desc: 'Follow-up steps & referrals' },
  };

  const generateTextReport = () => {
    const lines = [];
    lines.push('═══════════════════════════════════════════════════════════════');
    lines.push('                    PATIENT CLINICAL REPORT                    ');
    lines.push('═══════════════════════════════════════════════════════════════');
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push(`Case ID: ${caseData?.id || 'N/A'}`);
    lines.push(`Patient: ${caseData?.folderName || 'N/A'}`);
    lines.push('');

    const patientInfo = safeGet(narrative, 'patient_info') || safeGet(narrative, 'patient') || safeGet(narrative, 'patient_profile') || {};
    if (Object.keys(patientInfo).length > 0) {
      lines.push('--- PATIENT INFORMATION ---');
      for (const [k, v] of Object.entries(patientInfo)) {
        if (typeof v !== 'object') lines.push(`  ${k.replace(/_/g, ' ').toUpperCase()}: ${v}`);
      }
      lines.push('');
    }

    const summary = safeGet(narrative, 'clinical_summary') || safeGet(narrative, 'summary') || safeGet(narrative, 'clinical_assessment.summary') || '';
    if (summary) {
      lines.push('--- CLINICAL SUMMARY ---');
      lines.push(`  ${summary}`);
      lines.push('');
    }

    const narrativeText = safeGet(narrative, 'longitudinal_narrative.narrative_text') || safeGet(narrative, 'narrative_text') || '';
    if (narrativeText) {
      lines.push('--- LONGITUDINAL NARRATIVE ---');
      lines.push(narrativeText);
      lines.push('');
    }

    const meds = safeArray(safeGet(narrative, 'medications') || safeGet(narrative, 'medication_list') || []);
    if (meds.length > 0) {
      lines.push('--- MEDICATIONS ---');
      meds.forEach((m, i) => {
        const name = typeof m === 'string' ? m : safeGet(m, 'name') || safeGet(m, 'medication') || 'Unknown';
        const dosage = typeof m === 'object' ? safeGet(m, 'dosage') || '' : '';
        lines.push(`  ${i + 1}. ${name}${dosage ? ` (${dosage})` : ''}`);
      });
      lines.push('');
    }

    const diagnoses = safeArray(safeGet(narrative, 'diagnoses') || safeGet(narrative, 'conditions') || safeGet(narrative, 'clinical_assessment.active_problems') || []);
    if (diagnoses.length > 0) {
      lines.push('--- DIAGNOSES ---');
      diagnoses.forEach((d, i) => {
        const name = typeof d === 'string' ? d : safeGet(d, 'name') || safeGet(d, 'description') || 'Unknown';
        const code = typeof d === 'object' ? safeGet(d, 'code') || '' : '';
        lines.push(`  ${i + 1}. ${name}${code ? ` [${code}]` : ''}`);
      });
      lines.push('');
    }

    lines.push('═══════════════════════════════════════════════════════════════');
    lines.push('  Report generated by Mevreon Medical AI Platform');
    lines.push('═══════════════════════════════════════════════════════════════');
    return lines.join('\n');
  };

  const generateCSV = () => {
    const rows = [['Field', 'Value']];
    const patientInfo = safeGet(narrative, 'patient_info') || safeGet(narrative, 'patient') || safeGet(narrative, 'patient_profile') || {};
    for (const [k, v] of Object.entries(patientInfo)) {
      if (typeof v !== 'object') rows.push([k.replace(/_/g, ' '), String(v)]);
    }
    const meds = safeArray(safeGet(narrative, 'medications') || []);
    meds.forEach((m, i) => {
      const name = typeof m === 'string' ? m : safeGet(m, 'name') || '';
      rows.push([`Medication ${i + 1}`, name]);
    });
    const diagnoses = safeArray(safeGet(narrative, 'diagnoses') || safeGet(narrative, 'conditions') || []);
    diagnoses.forEach((d, i) => {
      const name = typeof d === 'string' ? d : safeGet(d, 'name') || '';
      rows.push([`Diagnosis ${i + 1}`, name]);
    });
    return rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  };

  const handleExport = () => {
    try {
      let content, filename, mime;
      if (exportFormat === 'json') {
        content = JSON.stringify(narrative || {}, null, 2);
        filename = `${caseData?.folderName || caseData?.id || 'patient'}_report.json`;
        mime = 'application/json';
      } else if (exportFormat === 'text') {
        content = generateTextReport();
        filename = `${caseData?.folderName || caseData?.id || 'patient'}_report.txt`;
        mime = 'text/plain';
      } else {
        content = generateCSV();
        filename = `${caseData?.folderName || caseData?.id || 'patient'}_report.csv`;
        mime = 'text/csv';
      }
      const blob = new Blob([content], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      setExportStatus('success');
      setTimeout(() => setExportStatus(null), 3000);
    } catch (e) {
      setExportStatus('error');
      setTimeout(() => setExportStatus(null), 3000);
    }
  };

  const copyToClipboard = () => {
    try {
      const content = exportFormat === 'json' ? JSON.stringify(narrative || {}, null, 2) : exportFormat === 'text' ? generateTextReport() : generateCSV();
      navigator.clipboard.writeText(content);
      setExportStatus('copied');
      setTimeout(() => setExportStatus(null), 3000);
    } catch {}
  };

  // Compute stats for the report summary
  const stats = useMemo(() => {
    const meds = safeArray(safeGet(narrative, 'medications') || safeGet(narrative, 'medication_list') || []);
    const diagnoses = safeArray(safeGet(narrative, 'diagnoses') || safeGet(narrative, 'conditions') || safeGet(narrative, 'clinical_assessment.active_problems') || []);
    const encounters = safeArray(safeGet(narrative, 'encounter_timeline') || safeGet(narrative, 'encounters') || []);
    const labs = safeArray(safeGet(narrative, 'laboratory_results') || safeGet(narrative, 'labs') || []);
    const files = caseData?.rawFiles?.length || 0;
    const agents = Object.keys(caseData?.agentOutputs || {}).length;
    return { meds: meds.length, diagnoses: diagnoses.length, encounters: encounters.length, labs: labs.length, files, agents };
  }, [narrative, caseData]);

  return (
    <div className="space-y-6">
      {/* AI-Generated PDF Reports */}
      {pdfReports.length > 0 && (
        <div className={cn("p-6 rounded-xl border bg-gradient-to-br from-indigo-600/5 to-teal-600/5", t.card)}>
          <div className="flex items-center gap-3 mb-2">
            <FileText size={22} className="text-indigo-400" />
            <h3 className={cn("text-lg font-bold", t.text)}>AI-Generated PDF Reports</h3>
            <span className="px-2 py-0.5 text-[10px] font-bold bg-indigo-500/20 text-indigo-400 rounded-full">
              {pdfReports.length} reports
            </span>
          </div>
          <p className={cn("text-sm mb-4", t.textSecondary)}>
            Professional medical reports generated by the AI pipeline — one per clinical category plus a complete combined report.
            {pdfManifest?.generated && (
              <span className={cn("ml-2 text-xs", t.textMuted)}>Generated: {safeFormat(pdfManifest.generated)}</span>
            )}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {pdfReports.map((report, idx) => {
              const meta = pdfCategoryMeta[report.name] || { icon: FileText, color: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/30', desc: 'Report' };
              const IconComp = meta.icon;
              const isComplete = report.name === 'Complete_Report.pdf';
              const isDownloading = downloadingPdf === report.name;
              return (
                <button
                  key={idx}
                  onClick={() => downloadPdf(report)}
                  disabled={isDownloading}
                  className={cn(
                    "p-4 rounded-xl border text-left transition-all group relative overflow-hidden",
                    isComplete ? "md:col-span-2 lg:col-span-3 bg-gradient-to-r from-teal-600/10 to-indigo-600/10 border-teal-500/30 hover:border-teal-400/50" :
                    cn(meta.bg, meta.border, "hover:ring-2 hover:ring-offset-0"),
                    isDownloading && "opacity-60 cursor-wait"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn("p-2 rounded-lg", meta.bg)}>
                      {isDownloading ? (
                        <Loader2 size={isComplete ? 22 : 18} className={cn(meta.color, "animate-spin")} />
                      ) : (
                        <IconComp size={isComplete ? 22 : 18} className={meta.color} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={cn("font-bold text-sm", t.text)}>
                        {report.name.replace('.pdf', '').replace(/_/g, ' ')}
                      </div>
                      <div className={cn("text-xs", t.textSecondary)}>{meta.desc}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn("text-xs font-mono", t.textMuted)}>
                        {formatBytes(report.size)}
                      </span>
                      <Download size={16} className={cn("opacity-0 group-hover:opacity-100 transition-opacity", meta.color)} />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Report Summary Card */}
      <div className={cn("p-6 rounded-xl border bg-gradient-to-br from-teal-600/5 to-cyan-600/5", t.card)}>
        <div className="flex items-center gap-3 mb-4">
          <FileBarChart size={22} className="text-teal-400" />
          <h3 className={cn("text-lg font-bold", t.text)}>Patient Report Export</h3>
        </div>
        <p className={cn("text-sm mb-4", t.textSecondary)}>Generate a downloadable report containing all processed patient data, clinical assessments, and AI-generated narratives.</p>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {[
            { label: 'Medications', value: stats.meds, color: 'text-blue-400' },
            { label: 'Diagnoses', value: stats.diagnoses, color: 'text-rose-400' },
            { label: 'Encounters', value: stats.encounters, color: 'text-violet-400' },
            { label: 'Lab Results', value: stats.labs, color: 'text-cyan-400' },
            { label: 'Source Files', value: stats.files, color: 'text-amber-400' },
            { label: 'Agents Run', value: stats.agents, color: 'text-emerald-400' },
          ].map((s, i) => (
            <div key={i} className={cn("p-3 rounded-lg text-center", t.bgTertiary)}>
              <div className={cn("text-xl font-black", s.color)}>{s.value}</div>
              <div className={cn("text-[10px] uppercase font-bold", t.textMuted)}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Format Selection */}
      <div className={cn("p-6 rounded-xl border", t.card)}>
        <h4 className={cn("font-bold mb-4", t.text)}>Export Format</h4>
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { id: 'json', label: 'JSON', desc: 'Full structured data', icon: Code },
            { id: 'text', label: 'Text Report', desc: 'Human-readable format', icon: FileText },
            { id: 'csv', label: 'CSV', desc: 'Spreadsheet compatible', icon: Table },
          ].map(fmt => (
            <button key={fmt.id} onClick={() => setExportFormat(fmt.id)}
              className={cn("p-4 rounded-xl border text-left transition-all",
                exportFormat === fmt.id ? "border-teal-500 bg-teal-500/10 ring-2 ring-teal-500/20" : cn(t.bgTertiary, t.border, t.bgHover)
              )}>
              <fmt.icon size={20} className={exportFormat === fmt.id ? "text-teal-400" : t.textMuted} />
              <div className={cn("font-bold text-sm mt-2", t.text)}>{fmt.label}</div>
              <div className={cn("text-xs mt-0.5", t.textSecondary)}>{fmt.desc}</div>
            </button>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button onClick={handleExport} className="flex-1 px-4 py-3 bg-gradient-to-r from-teal-600 to-cyan-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:from-teal-500 hover:to-cyan-500 transition-all shadow-lg shadow-teal-500/10">
            <Download size={18} />
            Download {exportFormat.toUpperCase()} Report
          </button>
          <button onClick={copyToClipboard} className={cn("px-4 py-3 rounded-xl font-bold flex items-center gap-2 border", t.bgTertiary, t.text, t.border, t.bgHover)}>
            <Copy size={18} />
            Copy
          </button>
        </div>

        {/* Status Message */}
        {exportStatus && (
          <div className={cn("mt-4 p-3 rounded-lg text-sm font-bold flex items-center gap-2",
            exportStatus === 'success' ? "bg-emerald-500/10 text-emerald-400" :
            exportStatus === 'copied' ? "bg-blue-500/10 text-blue-400" :
            "bg-rose-500/10 text-rose-400"
          )}>
            {exportStatus === 'success' && <><CheckCircle size={16} /> Report downloaded successfully</>}
            {exportStatus === 'copied' && <><CheckCircle size={16} /> Copied to clipboard</>}
            {exportStatus === 'error' && <><AlertCircle size={16} /> Export failed — please try again</>}
          </div>
        )}
      </div>

      {/* Preview */}
      <div className={cn("rounded-xl border overflow-hidden", t.card)}>
        <div className={cn("p-4 border-b flex items-center justify-between", t.border)}>
          <div className="flex items-center gap-3">
            <Eye size={18} className="text-teal-400" />
            <h4 className={cn("font-bold", t.text)}>Preview</h4>
          </div>
        </div>
        <pre className={cn("p-4 text-xs font-mono whitespace-pre-wrap max-h-[400px] overflow-auto", t.text)}>
          {exportFormat === 'json' ? JSON.stringify(narrative || {}, null, 2).slice(0, 3000) + '...' :
           exportFormat === 'text' ? generateTextReport().slice(0, 3000) + '...' :
           generateCSV().slice(0, 2000) + '...'}
        </pre>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// JUDGE PANEL - LLM-AS-A-JUDGE QUALITY EVALUATION TAB
// ═══════════════════════════════════════════════════════════════

const JudgePanel = ({ caseData, activeRunData, theme }) => {
  const t = getThemeClasses(theme || 'dark');

  // Multi-model selection state inside JudgePanel
  const [selectedModelView, setSelectedModelView] = useState('primary');

  // Parse judge data - handles nested inline_judge and parse_error cases
  const parseJudgeData = (raw) => {
    if (!raw || typeof raw !== 'object') return raw;
    let judgeData = raw.inline_judge || raw;
    if (judgeData.parse_error && judgeData.raw_response) {
      const rawText = judgeData.raw_response;
      let cleaned = rawText.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
      try {
        const parsed = JSON.parse(cleaned);
        return { ...parsed, judge_model: judgeData.judge_model || parsed.judge_model, evaluation_timestamp: judgeData.evaluation_timestamp || parsed.evaluation_timestamp, case_id: raw.case_id || judgeData.case_id, run_id: raw.run_id || judgeData.run_id, _parse_recovered: true };
      } catch {
        const extracted = { judge_model: judgeData.judge_model, evaluation_timestamp: judgeData.evaluation_timestamp, case_id: raw.case_id || judgeData.case_id, run_id: raw.run_id || judgeData.run_id, scores: {}, _parse_error: true, _raw_excerpt: rawText.substring(0, 1500) };
        const scorePatterns = [
          { key: 'correctness', regex: /"correctness":\s*\{\s*"score":\s*([\d.]+)/i },
          { key: 'completeness', regex: /"completeness":\s*\{\s*"score":\s*([\d.]+)/i },
          { key: 'faithfulness', regex: /"faithfulness":\s*\{\s*"score":\s*([\d.]+)/i },
          { key: 'helpfulness', regex: /"helpfulness":\s*\{\s*"score":\s*([\d.]+)/i },
          { key: 'coherence', regex: /"coherence":\s*\{\s*"score":\s*([\d.]+)/i },
          { key: 'relevance', regex: /"relevance":\s*\{\s*"score":\s*([\d.]+)/i },
          { key: 'following_instructions', regex: /"following_instructions":\s*\{\s*"score":\s*([\d.]+)/i },
          { key: 'professional_style', regex: /"professional_style":\s*\{\s*"score":\s*([\d.]+)/i }
        ];
        for (const { key, regex } of scorePatterns) {
          const match = rawText.match(regex);
          if (match) {
            extracted.scores[key] = { score: parseFloat(match[1]) };
            const explMatch = rawText.match(new RegExp(`"${key}":\\s*\\{[^}]*"explanation":\\s*"([^"]+)"`, 'i'));
            if (explMatch) extracted.scores[key].explanation = explMatch[1];
          }
        }
        const overallMatch = rawText.match(/"overall_score":\s*([\d.]+)/i);
        if (overallMatch) extracted.overall_score = parseFloat(overallMatch[1]);
        const gradeMatch = rawText.match(/"quality_grade":\s*"([^"]+)"/i);
        if (gradeMatch) extracted.quality_grade = gradeMatch[1];
        if (!extracted.overall_score && Object.keys(extracted.scores).length > 0) {
          const weights = { correctness: 0.2, completeness: 0.2, faithfulness: 0.2, helpfulness: 0.15, coherence: 0.1, relevance: 0.05, following_instructions: 0.05, professional_style: 0.05 };
          let total = 0, weightSum = 0;
          for (const [k, v] of Object.entries(extracted.scores)) {
            if (v.score !== undefined && weights[k]) { total += v.score * weights[k]; weightSum += weights[k]; }
          }
          if (weightSum > 0) extracted.overall_score = total / weightSum;
        }
        if (!extracted.quality_grade && extracted.overall_score !== undefined) {
          const s = extracted.overall_score;
          extracted.quality_grade = s >= 0.9 ? 'EXCELLENT' : s >= 0.75 ? 'GOOD' : s >= 0.6 ? 'FAIR' : 'POOR';
        }
        return extracted;
      }
    }
    return { ...judgeData, case_id: raw.case_id || judgeData.case_id, run_id: raw.run_id || judgeData.run_id };
  };

  // Get judge data from caseData - check multiple possible locations
  let judgeRawPrimary = null;
  let judgeRawCompare = null;
  
  if (activeRunData) {
    if (activeRunData.judgeReport) judgeRawPrimary = activeRunData.judgeReport;
    if (activeRunData.judgeReportCompare) judgeRawCompare = activeRunData.judgeReportCompare;
  } else {
    // Fallback to top-level if no specific run
    if (caseData?.judgeReport) {
      judgeRawPrimary = caseData.judgeReport;
    } else {
      const judgeOutputs = safeGet(caseData, 'agentOutputs.judge') || [];
      const firstOutput = Array.isArray(judgeOutputs) && judgeOutputs.length > 0 ? judgeOutputs[0] : (typeof judgeOutputs === 'object' ? judgeOutputs : null);
      if (firstOutput) {
        if (firstOutput.data) {
          judgeRawPrimary = firstOutput.data;
        } else if (firstOutput.inline_judge || firstOutput.scores || firstOutput.overall_score) {
          judgeRawPrimary = firstOutput;
        }
      }
    }
  }

  const parsedPrimary = judgeRawPrimary ? parseJudgeData(judgeRawPrimary) : null;
  const parsedCompare = judgeRawCompare ? parseJudgeData(judgeRawCompare) : null;
  
  const hasCompare = !!parsedCompare && Object.keys(parsedCompare).length > 0;
  
  // Decide which one to render based on selection, wait we also should render a model toggle
  const parsed = selectedModelView === 'compare' && hasCompare ? parsedCompare : parsedPrimary;

  if (!parsed) {
    return (
      <div className={cn("p-12 text-center rounded-2xl border", t.card)}>
        <Gauge size={48} className={cn("mx-auto mb-4", t.textMuted)} />
        <h3 className={cn("text-xl font-bold mb-2", t.text)}>No Judge Evaluation Available</h3>
        <p className={cn("text-sm", t.textSecondary)}>The LLM-as-a-Judge quality evaluation has not been performed yet for this patient case.</p>
      </div>
    );
  }

  const judgeModel = safeGet(parsed, 'judge_model') || 'Unknown';
  const evalModel = safeGet(parsed, 'evaluation_model') || null; 
  const timestamp = safeGet(parsed, 'evaluation_timestamp') || '';
  const scores = safeGet(parsed, 'scores') || {};
  const overallScore = safeGet(parsed, 'overall_score');
  const qualityGrade = safeGet(parsed, 'quality_grade') || 'UNKNOWN';
  const criticalIssues = safeArray(safeGet(parsed, 'critical_issues') || []);
  const improvementSuggestions = safeArray(safeGet(parsed, 'improvement_suggestions') || []);
  const medicationsVerified = safeArray(safeGet(parsed, 'medications_verified') || []);
  const conditionsVerified = safeArray(safeGet(parsed, 'conditions_verified') || []);
  const missingMedications = safeArray(safeGet(parsed, 'missing_medications') || []);
  const missingConditions = safeArray(safeGet(parsed, 'missing_conditions') || []);
  const parseError = parsed._parse_error;

  const gradeColors = {
    'EXCELLENT': 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    'GOOD': 'text-teal-400 bg-teal-500/10 border-teal-500/30',
    'FAIR': 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    'POOR': 'text-red-400 bg-red-500/10 border-red-500/30',
    'UNKNOWN': 'text-slate-400 bg-slate-500/10 border-slate-500/30'
  };

  const scoreDimensions = [
    { key: 'correctness', label: 'Correctness', icon: CheckCircle2, desc: 'Accuracy of clinical data representation', weight: '20%' },
    { key: 'completeness', label: 'Completeness', icon: ClipboardList, desc: 'All entities captured from source files', weight: '20%' },
    { key: 'faithfulness', label: 'Faithfulness', icon: Shield, desc: 'Claims grounded in source data (no hallucinations)', weight: '20%' },
    { key: 'helpfulness', label: 'Helpfulness', icon: Heart, desc: 'Clinical utility for physicians', weight: '15%' },
    { key: 'coherence', label: 'Coherence', icon: Network, desc: 'Logical organization and narrative flow', weight: '10%' },
    { key: 'relevance', label: 'Relevance', icon: Target, desc: 'Prioritized clinically relevant content', weight: '5%' },
    { key: 'following_instructions', label: 'Schema Compliance', icon: FileCheck, desc: 'Required sections and format present', weight: '5%' },
    { key: 'professional_style', label: 'Professional Style', icon: BookOpen, desc: 'Medical-professional language', weight: '5%' }
  ];

  return (
    <div className="space-y-6">
      {hasCompare && (
        <div className="flex items-center justify-center p-1">
          <div className={cn("inline-flex p-1 rounded-xl", t.bgTertiary)}>
            <button
              onClick={() => setSelectedModelView('primary')}
              className={cn("px-4 py-2 text-sm font-bold rounded-lg transition-all", selectedModelView === 'primary' ? 'bg-indigo-600 text-white shadow-md' : cn('hover:bg-slate-700/50', t.textSecondary))}
            >
              Primary Model Judge 
              {parsedPrimary && parsedPrimary.overall_score !== undefined && ` (${(parsedPrimary.overall_score * 100).toFixed(0)}%)`}
            </button>
            <button
              onClick={() => setSelectedModelView('compare')}
              className={cn("px-4 py-2 text-sm font-bold rounded-lg transition-all", selectedModelView === 'compare' ? 'bg-teal-600 text-white shadow-md' : cn('hover:bg-slate-700/50', t.textSecondary))}
            >
              Compare Model Judge 
              {parsedCompare && parsedCompare.overall_score !== undefined && ` (${(parsedCompare.overall_score * 100).toFixed(0)}%)`}
            </button>
          </div>
        </div>
      )}

      {/* Header with Overall Grade */}
      <div className={cn("p-6 rounded-2xl border-2 flex flex-col sm:flex-row items-center justify-between gap-6", gradeColors[qualityGrade] || gradeColors['UNKNOWN'])}>
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-center sm:items-start">
            <span className={cn("text-xs uppercase tracking-wider mb-1", t.textMuted)}>Quality Grade</span>
            <span className="text-4xl font-black">{qualityGrade}</span>
          </div>
          {overallScore !== undefined && (
            <div className="flex items-center gap-3 px-6 border-l-2 border-current/20">
              <Gauge size={36} className="opacity-60" />
              <div className="text-5xl font-black">{(Number(overallScore) * 100).toFixed(0)}%</div>
            </div>
          )}
        </div>
        <div className="text-center sm:text-right space-y-1">
          <div className={cn("text-[10px] uppercase tracking-wider", t.textMuted)}>Evaluated By</div>
          <div className="text-sm font-mono opacity-80">{safeString(judgeModel)}</div>
          {timestamp && <div className={cn("text-xs", t.textMuted)}>{new Date(timestamp).toLocaleString()}</div>}
        </div>
      </div>

      {/* Parse Error Notice */}
      {parseError && (
        <div className={cn("p-4 rounded-xl border-l-4 border-l-amber-500 bg-amber-500/5 flex items-start gap-3")}>
          <AlertTriangle size={20} className="text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-amber-400 mb-1">Partial Data Recovered</div>
            <span className={cn("text-sm", t.textSecondary)}>The judge response was truncated. Scores shown are extracted from available data.</span>
          </div>
        </div>
      )}

      {/* Score Dimensions Grid */}
      <div className={cn("p-6 rounded-2xl border", t.card)}>
        <h4 className={cn("text-sm font-bold uppercase tracking-wider mb-4 flex items-center gap-2", t.textMuted)}>
          <BarChart3 size={16} className="text-amber-400" /> Evaluation Dimensions
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {scoreDimensions.map(dim => {
            const scoreData = scores[dim.key] || {};
            const score = scoreData.score;
            const explanation = scoreData.explanation || '';
            const deficiencies = safeArray(scoreData.deficiencies || []);
            const hallucinations = safeArray(scoreData.hallucinations || []);
            const gaps = safeArray(scoreData.gaps || []);
            const DimIcon = dim.icon || Info;
            const pct = score !== undefined ? (Number(score) * 100).toFixed(0) : null;
            const barColor = score >= 0.9 ? 'bg-emerald-500' : score >= 0.75 ? 'bg-teal-500' : score >= 0.6 ? 'bg-amber-500' : 'bg-red-500';

            return (
              <div key={dim.key} className={cn("p-4 rounded-xl border", t.bgTertiary, t.border)}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <DimIcon size={18} className="text-amber-400" />
                    <span className={cn("font-bold", t.text)}>{dim.label}</span>
                    <span className={cn("text-[10px] px-2 py-0.5 rounded-full", t.bgSecondary, t.textMuted)}>{dim.weight}</span>
                  </div>
                  {pct !== null && (
                    <span className={cn("text-xl font-black", score >= 0.75 ? 'text-emerald-400' : score >= 0.6 ? 'text-amber-400' : 'text-red-400')}>
                      {pct}%
                    </span>
                  )}
                </div>
                {pct !== null && (
                  <div className={cn("h-2 rounded-full overflow-hidden mb-3", t.bgSecondary)}>
                    <div className={cn("h-full transition-all", barColor)} style={{ width: `${pct}%` }} />
                  </div>
                )}
                <p className={cn("text-xs mb-2", t.textMuted)}>{dim.desc}</p>
                {explanation && <p className={cn("text-xs italic", t.textSecondary)}>"{explanation}"</p>}
                {deficiencies.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-rose-500/20">
                    <span className="text-[10px] font-bold uppercase text-rose-400">Deficiencies:</span>
                    <ul className="mt-1 space-y-0.5">
                      {deficiencies.slice(0, 3).map((d, i) => <li key={i} className="text-[11px] text-rose-300 flex items-start gap-1"><XCircle size={10} className="mt-0.5 flex-shrink-0" />{safeString(d)}</li>)}
                    </ul>
                  </div>
                )}
                {hallucinations.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-amber-500/20">
                    <span className="text-[10px] font-bold uppercase text-amber-400">Hallucinations:</span>
                    <ul className="mt-1 space-y-0.5">
                      {hallucinations.slice(0, 3).map((h, i) => <li key={i} className="text-[11px] text-amber-300 flex items-start gap-1"><AlertTriangle size={10} className="mt-0.5 flex-shrink-0" />{safeString(h)}</li>)}
                    </ul>
                  </div>
                )}
                {gaps.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-blue-500/20">
                    <span className="text-[10px] font-bold uppercase text-blue-400">Gaps:</span>
                    <ul className="mt-1 space-y-0.5">
                      {gaps.slice(0, 3).map((g, i) => <li key={i} className="text-[11px] text-blue-300 flex items-start gap-1"><Info size={10} className="mt-0.5 flex-shrink-0" />{safeString(g)}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Critical Issues */}
      {criticalIssues.length > 0 && (
        <div className={cn("p-6 rounded-2xl border border-rose-500/30 bg-rose-500/5")}>
          <h4 className="text-sm font-bold uppercase tracking-wider mb-4 flex items-center gap-2 text-rose-400">
            <AlertOctagon size={16} /> Critical Issues ({criticalIssues.length})
          </h4>
          <div className="space-y-2">
            {criticalIssues.map((issue, i) => (
              <div key={i} className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-sm text-rose-300 flex items-start gap-2">
                <XCircle size={14} className="mt-0.5 flex-shrink-0" />
                {safeString(issue)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Improvement Suggestions */}
      {improvementSuggestions.length > 0 && (
        <div className={cn("p-6 rounded-2xl border", t.card)}>
          <h4 className={cn("text-sm font-bold uppercase tracking-wider mb-4 flex items-center gap-2", t.textMuted)}>
            <Lightbulb size={16} className="text-amber-400" /> Improvement Suggestions ({improvementSuggestions.length})
          </h4>
          <div className="space-y-2">
            {improvementSuggestions.map((sug, i) => (
              <div key={i} className={cn("p-3 rounded-lg flex items-start gap-2 text-sm", t.bgTertiary)}>
                <ArrowRight size={14} className="text-amber-400 mt-0.5 flex-shrink-0" />
                <span className={t.textSecondary}>{safeString(sug)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Verification Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Verified Medications */}
        {medicationsVerified.length > 0 && (
          <div className={cn("p-6 rounded-2xl border", t.card)}>
            <h4 className={cn("text-sm font-bold uppercase tracking-wider mb-4 flex items-center gap-2", t.textMuted)}>
              <Pill size={16} className="text-blue-400" /> Medications Verified ({medicationsVerified.length})
            </h4>
            <div className="space-y-1">
              {medicationsVerified.slice(0, 10).map((med, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <CheckCircle size={12} className="text-emerald-400" />
                  <span className={t.text}>{safeString(med)}</span>
                </div>
              ))}
              {medicationsVerified.length > 10 && <div className={cn("text-xs", t.textMuted)}>+{medicationsVerified.length - 10} more</div>}
            </div>
          </div>
        )}

        {/* Missing Medications */}
        {missingMedications.length > 0 && (
          <div className={cn("p-6 rounded-2xl border border-amber-500/30 bg-amber-500/5")}>
            <h4 className="text-sm font-bold uppercase tracking-wider mb-4 flex items-center gap-2 text-amber-400">
              <Pill size={16} /> Missing Medications ({missingMedications.length})
            </h4>
            <div className="space-y-1">
              {missingMedications.slice(0, 8).map((med, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-amber-300">
                  <AlertTriangle size={12} />
                  <span>{safeString(med)}</span>
                </div>
              ))}
              {missingMedications.length > 8 && <div className="text-xs text-amber-400/60">+{missingMedications.length - 8} more</div>}
            </div>
          </div>
        )}

        {/* Verified Conditions */}
        {conditionsVerified.length > 0 && (
          <div className={cn("p-6 rounded-2xl border", t.card)}>
            <h4 className={cn("text-sm font-bold uppercase tracking-wider mb-4 flex items-center gap-2", t.textMuted)}>
              <Heart size={16} className="text-rose-400" /> Conditions Verified ({conditionsVerified.length})
            </h4>
            <div className="space-y-1">
              {conditionsVerified.slice(0, 10).map((cond, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <CheckCircle size={12} className="text-emerald-400" />
                  <span className={t.text}>{safeString(cond)}</span>
                </div>
              ))}
              {conditionsVerified.length > 10 && <div className={cn("text-xs", t.textMuted)}>+{conditionsVerified.length - 10} more</div>}
            </div>
          </div>
        )}

        {/* Missing Conditions */}
        {missingConditions.length > 0 && (
          <div className={cn("p-6 rounded-2xl border border-amber-500/30 bg-amber-500/5")}>
            <h4 className="text-sm font-bold uppercase tracking-wider mb-4 flex items-center gap-2 text-amber-400">
              <Heart size={16} /> Missing Conditions ({missingConditions.length})
            </h4>
            <div className="space-y-1">
              {missingConditions.slice(0, 8).map((cond, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-amber-300">
                  <AlertTriangle size={12} />
                  <span>{safeString(cond)}</span>
                </div>
              ))}
              {missingConditions.length > 8 && <div className="text-xs text-amber-400/60">+{missingConditions.length - 8} more</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// DATA QUALITY SCORECARD COMPONENT
// ═══════════════════════════════════════════════════════════════

const DataQualityScorecard = ({ narrative, caseData, theme }) => {
  const t = getThemeClasses(theme || 'dark');

  const scores = useMemo(() => {
    try {
      const agentCount = Object.keys(caseData?.agentOutputs || {}).length;
      const totalAgents = CONFIG.agents.length;
      const fileCount = (caseData?.rawFiles?.length || 0) + Object.keys(caseData?.files || {}).length;
      const hasNarrative = !!narrative;
      const hasMeds = safeArray(safeGet(narrative, 'medications') || safeGet(narrative, 'medication_list') || []).length > 0;
      const hasDiagnoses = safeArray(safeGet(narrative, 'diagnoses') || safeGet(narrative, 'conditions') || []).length > 0;
      const hasEncounters = safeArray(safeGet(narrative, 'encounter_timeline') || safeGet(narrative, 'encounters') || []).length > 0;
      const hasLabs = safeArray(safeGet(narrative, 'laboratory_results') || safeGet(narrative, 'labs') || []).length > 0;
      const hasPatientInfo = !!(safeGet(narrative, 'patient_info') || safeGet(narrative, 'patient_profile'));
      const hasRisk = !!(safeGet(narrative, 'risk_assessment') || safeGet(narrative, 'risks'));
      const hasCarePlan = !!(safeGet(narrative, 'care_plan') || safeGet(narrative, 'recommendations'));
      const hasNarrativeText = !!(safeGet(narrative, 'longitudinal_narrative.narrative_text') || safeGet(narrative, 'narrative_text'));

      const fields = [
        { name: 'Pipeline Completion', score: Math.round((agentCount / totalAgents) * 100), detail: `${agentCount}/${totalAgents} agents` },
        { name: 'Patient Identity', score: hasPatientInfo ? 100 : 0, detail: hasPatientInfo ? 'Identified' : 'Missing' },
        { name: 'Clinical Narrative', score: hasNarrativeText ? 100 : hasNarrative ? 50 : 0, detail: hasNarrativeText ? 'Generated' : hasNarrative ? 'Partial' : 'Missing' },
        { name: 'Medications', score: hasMeds ? 100 : 0, detail: hasMeds ? 'Extracted' : 'Not found' },
        { name: 'Diagnoses', score: hasDiagnoses ? 100 : 0, detail: hasDiagnoses ? 'Coded' : 'Not found' },
        { name: 'Encounters', score: hasEncounters ? 100 : 0, detail: hasEncounters ? 'Mapped' : 'Not found' },
        { name: 'Lab Results', score: hasLabs ? 100 : 0, detail: hasLabs ? 'Available' : 'Not found' },
        { name: 'Risk Assessment', score: hasRisk ? 100 : 0, detail: hasRisk ? 'Computed' : 'Not analyzed' },
        { name: 'Care Plan', score: hasCarePlan ? 100 : 0, detail: hasCarePlan ? 'Generated' : 'Not generated' },
        { name: 'Source Documents', score: fileCount > 0 ? 100 : 0, detail: `${fileCount} files` },
      ];
      const overall = Math.round(fields.reduce((s, f) => s + f.score, 0) / fields.length);
      return { fields, overall, fileCount };
    } catch {
      return { fields: [], overall: 0, fileCount: 0 };
    }
  }, [narrative, caseData]);

  const getScoreColor = (score) => {
    if (score >= 80) return { text: 'text-emerald-400', bg: 'bg-emerald-500', fill: 'bg-emerald-500/20' };
    if (score >= 50) return { text: 'text-amber-400', bg: 'bg-amber-500', fill: 'bg-amber-500/20' };
    return { text: 'text-rose-400', bg: 'bg-rose-500', fill: 'bg-rose-500/20' };
  };

  const overallColor = getScoreColor(scores.overall);

  return (
    <div className="space-y-4">
      {/* Overall Score */}
      <div className={cn("p-6 rounded-xl border bg-gradient-to-br from-slate-900/50 to-slate-800/50", t.card)}>
        <div className="flex items-center gap-6">
          <div className="relative">
            <svg width="100" height="100" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke={theme === 'dark' ? '#1e293b' : '#e5e7eb'} strokeWidth="8" />
              <circle cx="50" cy="50" r="42" fill="none" className={overallColor.bg} strokeWidth="8"
                strokeDasharray={`${(scores.overall / 100) * 264} 264`} strokeLinecap="round"
                transform="rotate(-90 50 50)" style={{ transition: 'stroke-dasharray 1s ease' }} stroke="currentColor" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={cn("text-2xl font-black", overallColor.text)}>{scores.overall}%</span>
            </div>
          </div>
          <div>
            <h3 className={cn("text-lg font-bold", t.text)}>Data Quality Score</h3>
            <p className={cn("text-sm", t.textSecondary)}>Based on completeness of extracted clinical information across all pipeline stages</p>
          </div>
        </div>
      </div>

      {/* Field Scores */}
      <div className={cn("rounded-xl border overflow-hidden", t.card)}>
        <div className={cn("p-4 border-b flex items-center gap-3", t.border)}>
          <BarChart size={18} className="text-teal-400" />
          <h3 className={cn("font-bold", t.text)}>Quality Breakdown</h3>
        </div>
        <div className="divide-y" style={{ borderColor: theme === 'dark' ? '#1e293b' : '#e5e7eb' }}>
          {scores.fields.map((field, idx) => {
            const fColor = getScoreColor(field.score);
            return (
              <div key={idx} className={cn("p-4 flex items-center gap-4", t.bgHover)}>
                <div className="w-40">
                  <span className={cn("text-sm font-medium", t.text)}>{field.name}</span>
                </div>
                <div className="flex-1">
                  <div className={cn("h-2.5 rounded-full overflow-hidden", t.bgTertiary)}>
                    <div className={cn("h-full rounded-full transition-all duration-700", fColor.bg)} style={{ width: `${field.score}%` }} />
                  </div>
                </div>
                <div className="w-12 text-right">
                  <span className={cn("text-sm font-black", fColor.text)}>{field.score}%</span>
                </div>
                <div className="w-24 text-right">
                  <span className={cn("text-xs", t.textMuted)}>{field.detail}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// PATIENT VITALS DASHBOARD COMPONENT
// ═══════════════════════════════════════════════════════════════

const PatientVitalsDashboard = ({ narrative, theme }) => {
  const t = getThemeClasses(theme || 'dark');
  
  const vitals = safeGet(narrative, 'vital_trends') ||
                 safeGet(narrative, 'vitals') ||
                 safeGet(narrative, 'vital_signs') ||
                 {};
  
  const vitalItems = useMemo(() => {
    try {
      if (Array.isArray(vitals)) {
        return vitals.map((v, idx) => ({
          id: idx,
          name: safeGet(v, 'name') || safeGet(v, 'type') || `Vital ${idx + 1}`,
          value: safeGet(v, 'value') || safeGet(v, 'reading') || 'N/A',
          unit: safeGet(v, 'unit') || '',
          date: safeGet(v, 'date') || safeGet(v, 'timestamp') || '',
          status: safeGet(v, 'status') || 'normal'
        }));
      }
      
      if (typeof vitals === 'object' && Object.keys(vitals).length > 0) {
        return Object.entries(vitals).map(([key, val], idx) => ({
          id: idx,
          name: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          value: typeof val === 'object' ? safeGet(val, 'value', JSON.stringify(val)) : val,
          unit: typeof val === 'object' ? safeGet(val, 'unit', '') : '',
          date: typeof val === 'object' ? safeGet(val, 'date', '') : '',
          status: typeof val === 'object' ? safeGet(val, 'status', 'normal') : 'normal'
        }));
      }
      
      return [];
    } catch {
      return [];
    }
  }, [vitals]);
  
  const vitalIcons = {
    'blood pressure': Heart,
    'heart rate': Activity,
    'temperature': Thermometer,
    'respiratory rate': Activity,
    'oxygen saturation': Gauge,
    'weight': Gauge,
    'height': Gauge,
    'bmi': BarChart,
    'pulse': Heart,
  };
  
  const getVitalIcon = (name) => {
    try {
      const lower = (name || '').toLowerCase();
      for (const [key, icon] of Object.entries(vitalIcons)) {
        if (lower.includes(key)) return icon;
      }
      return Activity;
    } catch {
      return Activity;
    }
  };
  
  const getStatusColor = (status) => {
    try {
      const s = (status || '').toLowerCase();
      if (s === 'critical' || s === 'high' || s === 'abnormal') return 'rose';
      if (s === 'warning' || s === 'borderline') return 'amber';
      return 'emerald';
    } catch {
      return 'emerald';
    }
  };
  
  if (vitalItems.length === 0) {
    return (
      <div className={cn("rounded-xl border p-6", t.card)}>
        <div className="flex items-center gap-3 mb-4">
          <Activity size={20} className="text-teal-400" />
          <h3 className={cn("font-bold", t.text)}>Patient Vitals</h3>
        </div>
        <p className={cn("text-sm", t.textSecondary)}>No vital signs data available in this narrative.</p>
      </div>
    );
  }
  
  return (
    <div className={cn("rounded-xl border overflow-hidden", t.card)}>
      <div className={cn("p-4 border-b flex items-center gap-3", t.border)}>
        <Activity size={20} className="text-teal-400" />
        <h3 className={cn("font-bold", t.text)}>Patient Vitals</h3>
        <span className={cn("text-xs px-2 py-0.5 rounded-full", t.bgTertiary, t.textMuted)}>
          {vitalItems.length} readings
        </span>
      </div>
      <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {vitalItems.map(vital => {
          const VIcon = getVitalIcon(vital.name);
          const statusColor = getStatusColor(vital.status);
          return (
            <div key={vital.id} className={cn("p-4 rounded-xl border", t.bgTertiary, t.border)}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <VIcon size={16} className={`text-${statusColor}-400`} />
                  <span className={cn("text-xs font-bold uppercase", t.textMuted)}>{vital.name}</span>
                </div>
                <span className={cn(
                  "h-2 w-2 rounded-full",
                  statusColor === 'rose' ? 'bg-rose-500' :
                  statusColor === 'amber' ? 'bg-amber-500' :
                  'bg-emerald-500'
                )} />
              </div>
              <div className={cn("text-xl font-bold", t.text)}>
                {safeString(vital.value)} <span className={cn("text-sm font-normal", t.textMuted)}>{vital.unit}</span>
              </div>
              {vital.date && (
                <div className={cn("text-xs mt-1", t.textMuted)}>{safeFormat(vital.date)}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// MEDICATION TRACKER COMPONENT
// ═══════════════════════════════════════════════════════════════

const MedicationTracker = ({ narrative, theme }) => {
  const t = getThemeClasses(theme || 'dark');
  
  const medications = useMemo(() => {
    try {
      const meds = safeGet(narrative, 'medications.current_regimen') ||
                   safeGet(narrative, 'medications') ||
                   safeGet(narrative, 'medication_list') ||
                   safeGet(narrative, 'current_medications') ||
                   safeGet(narrative, 'prescribed_medications') ||
                   [];
      return safeArray(meds);
    } catch {
      return [];
    }
  }, [narrative]);
  
  if (medications.length === 0) {
    return (
      <div className={cn("rounded-xl border p-6", t.card)}>
        <div className="flex items-center gap-3 mb-4">
          <Pill size={20} className="text-blue-400" />
          <h3 className={cn("font-bold", t.text)}>Medications</h3>
        </div>
        <p className={cn("text-sm", t.textSecondary)}>No medication data available.</p>
      </div>
    );
  }
  
  return (
    <div className={cn("rounded-xl border overflow-hidden", t.card)}>
      <div className={cn("p-4 border-b flex items-center gap-3", t.border)}>
        <Pill size={20} className="text-blue-400" />
        <h3 className={cn("font-bold", t.text)}>Medications</h3>
        <span className={cn("text-xs px-2 py-0.5 rounded-full", t.bgTertiary, t.textMuted)}>
          {medications.length} active
        </span>
      </div>
      <div className="divide-y" style={{ borderColor: theme === 'dark' ? '#1e293b' : '#e5e7eb' }}>
        {medications.map((med, idx) => {
          const name = typeof med === 'string' ? med : safeGet(med, 'name') || safeGet(med, 'medication') || safeGet(med, 'drug') || 'Unknown';
          const dosage = safeGet(med, 'dosage') || safeGet(med, 'dose') || '';
          const frequency = safeGet(med, 'frequency') || safeGet(med, 'schedule') || '';
          const route = safeGet(med, 'route') || '';
          const status = safeGet(med, 'status') || 'active';
          
          return (
            <div key={idx} className={cn("p-4 flex items-start gap-4", t.bgHover)}>
              <div className="p-2 bg-blue-500/10 rounded-lg flex-shrink-0">
                <Pill size={18} className="text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className={cn("font-bold", t.text)}>{safeString(name)}</div>
                <div className="flex flex-wrap gap-3 mt-1">
                  {dosage && (
                    <span className={cn("text-xs px-2 py-0.5 rounded-full", t.bgTertiary, t.textSecondary)}>
                      {safeString(dosage)}
                    </span>
                  )}
                  {frequency && (
                    <span className={cn("text-xs px-2 py-0.5 rounded-full", t.bgTertiary, t.textSecondary)}>
                      {safeString(frequency)}
                    </span>
                  )}
                  {route && (
                    <span className={cn("text-xs px-2 py-0.5 rounded-full", t.bgTertiary, t.textSecondary)}>
                      {safeString(route)}
                    </span>
                  )}
                </div>
              </div>
              <span className={cn(
                "px-2 py-0.5 rounded-full text-xs font-bold flex-shrink-0",
                (status === 'active' || status === 'Active') ? "bg-emerald-500/20 text-emerald-400" :
                (status === 'discontinued') ? "bg-slate-500/20 text-slate-400" :
                "bg-amber-500/20 text-amber-400"
              )}>
                {safeString(status)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// CLINICAL NOTES VIEWER COMPONENT
// ═══════════════════════════════════════════════════════════════

const ClinicalNotesViewer = ({ narrative, theme }) => {
  const t = getThemeClasses(theme || 'dark');
  const [expandedNote, setExpandedNote] = useState(null);
  
  const notes = useMemo(() => {
    try {
      const n = safeGet(narrative, 'clinical_notes') ||
                safeGet(narrative, 'notes') ||
                safeGet(narrative, 'progress_notes') ||
                safeGet(narrative, 'encounter_notes') ||
                [];
      return safeArray(n);
    } catch {
      return [];
    }
  }, [narrative]);
  
  if (notes.length === 0) return null;
  
  return (
    <div className={cn("rounded-xl border overflow-hidden", t.card)}>
      <div className={cn("p-4 border-b flex items-center gap-3", t.border)}>
        <MessageSquare size={20} className="text-violet-400" />
        <h3 className={cn("font-bold", t.text)}>Clinical Notes</h3>
        <span className={cn("text-xs px-2 py-0.5 rounded-full", t.bgTertiary, t.textMuted)}>
          {notes.length} notes
        </span>
      </div>
      <div className="divide-y" style={{ borderColor: theme === 'dark' ? '#1e293b' : '#e5e7eb' }}>
        {notes.map((note, idx) => {
          const noteType = typeof note === 'string' ? 'Note' : safeGet(note, 'type') || safeGet(note, 'category') || 'Clinical Note';
          const noteText = typeof note === 'string' ? note : safeGet(note, 'text') || safeGet(note, 'content') || safeGet(note, 'note') || JSON.stringify(note);
          const noteDate = safeGet(note, 'date') || safeGet(note, 'timestamp') || '';
          const noteAuthor = safeGet(note, 'author') || safeGet(note, 'provider') || '';
          const isExpanded = expandedNote === idx;
          
          return (
            <div key={idx} className={cn("p-4", t.bgHover)}>
              <button
                onClick={() => setExpandedNote(isExpanded ? null : idx)}
                className="w-full text-left"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText size={16} className="text-violet-400" />
                    <span className={cn("font-bold text-sm", t.text)}>{safeString(noteType)}</span>
                    {noteDate && (
                      <span className={cn("text-xs", t.textMuted)}>{safeFormat(noteDate)}</span>
                    )}
                  </div>
                  {isExpanded ? <ChevronUp size={16} className={t.textMuted} /> : <ChevronDown size={16} className={t.textMuted} />}
                </div>
                {noteAuthor && (
                  <div className={cn("text-xs mt-1 ml-7", t.textMuted)}>By: {safeString(noteAuthor)}</div>
                )}
              </button>
              {isExpanded && (
                <div className={cn("mt-3 ml-7 p-4 rounded-lg text-sm whitespace-pre-wrap", t.bgTertiary, t.text)}>
                  {safeString(noteText)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// DIAGNOSTIC CODES COMPONENT
// ═══════════════════════════════════════════════════════════════

const DiagnosticCodes = ({ narrative, theme }) => {
  const t = getThemeClasses(theme || 'dark');
  
  const diagnoses = useMemo(() => {
    try {
      const d = safeGet(narrative, 'problem_list') ||
                safeGet(narrative, 'diagnoses') ||
                safeGet(narrative, 'diagnosis_codes') ||
                safeGet(narrative, 'icd_codes') ||
                safeGet(narrative, 'conditions') ||
                safeGet(narrative, 'active_problems') ||
                safeGet(narrative, 'clinical_assessment.active_problems') ||
                [];
      return safeArray(d);
    } catch {
      return [];
    }
  }, [narrative]);
  
  if (diagnoses.length === 0) return null;
  
  return (
    <div className={cn("rounded-xl border overflow-hidden", t.card)}>
      <div className={cn("p-4 border-b flex items-center gap-3", t.border)}>
        <Tag size={20} className="text-rose-400" />
        <h3 className={cn("font-bold", t.text)}>Diagnostic Codes & Conditions</h3>
        <span className={cn("text-xs px-2 py-0.5 rounded-full", t.bgTertiary, t.textMuted)}>
          {diagnoses.length} diagnoses
        </span>
      </div>
      <div className="p-4 flex flex-wrap gap-3">
        {diagnoses.map((dx, idx) => {
          const name = typeof dx === 'string' ? dx : safeGet(dx, 'name') || safeGet(dx, 'description') || safeGet(dx, 'diagnosis') || 'Unknown';
          const code = typeof dx === 'object' ? safeGet(dx, 'code') || safeGet(dx, 'icd_code') || '' : '';
          const severity = typeof dx === 'object' ? safeGet(dx, 'severity') || '' : '';
          
          return (
            <div key={idx} className={cn("px-4 py-3 rounded-xl border", t.bgTertiary, t.border)}>
              <div className={cn("font-medium text-sm", t.text)}>{safeString(name)}</div>
              <div className="flex gap-2 mt-1">
                {code && (
                  <span className="text-xs px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 font-mono">
                    {safeString(code)}
                  </span>
                )}
                {severity && (
                  <span className={cn(
                    "text-xs px-2 py-0.5 rounded font-bold",
                    (severity.toLowerCase() === 'high' || severity.toLowerCase() === 'severe') ? "bg-rose-500/20 text-rose-400" :
                    (severity.toLowerCase() === 'moderate' || severity.toLowerCase() === 'medium') ? "bg-amber-500/20 text-amber-400" :
                    "bg-emerald-500/20 text-emerald-400"
                  )}>
                    {safeString(severity)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// CARE PLAN COMPONENT
// ═══════════════════════════════════════════════════════════════

const CarePlanSection = ({ narrative, theme }) => {
  const t = getThemeClasses(theme || 'dark');
  
  const carePlan = useMemo(() => {
    try {
      return safeGet(narrative, 'care_plan') ||
             safeGet(narrative, 'treatment_plan') ||
             safeGet(narrative, 'plan') ||
             safeGet(narrative, 'recommendations') ||
             null;
    } catch {
      return null;
    }
  }, [narrative]);
  
  if (!carePlan) return null;
  
  const items = safeArray(
    typeof carePlan === 'string' ? [carePlan] :
    Array.isArray(carePlan) ? carePlan :
    safeGet(carePlan, 'items') || safeGet(carePlan, 'goals') || safeGet(carePlan, 'actions') || [carePlan]
  );
  
  if (items.length === 0) return null;
  
  return (
    <div className={cn("rounded-xl border overflow-hidden", t.card)}>
      <div className={cn("p-4 border-b flex items-center gap-3", t.border)}>
        <ClipboardList size={20} className="text-emerald-400" />
        <h3 className={cn("font-bold", t.text)}>Care Plan & Recommendations</h3>
      </div>
      <div className="p-4 space-y-3">
        {items.map((item, idx) => {
          const text = typeof item === 'string' ? item : safeGet(item, 'description') || safeGet(item, 'action') || safeGet(item, 'goal') || JSON.stringify(item);
          const priority = typeof item === 'object' ? safeGet(item, 'priority') || '' : '';
          const status = typeof item === 'object' ? safeGet(item, 'status') || '' : '';
          
          return (
            <div key={idx} className={cn("flex items-start gap-3 p-4 rounded-xl", t.bgTertiary)}>
              <div className="flex-shrink-0 mt-0.5">
                <div className="h-6 w-6 bg-emerald-500/20 rounded-full flex items-center justify-center">
                  <span className="text-xs font-bold text-emerald-400">{idx + 1}</span>
                </div>
              </div>
              <div className="flex-1">
                <p className={cn("text-sm", t.text)}>{safeString(text)}</p>
                <div className="flex gap-2 mt-2">
                  {priority && (
                    <span className={cn("text-xs px-2 py-0.5 rounded", t.bgSecondary, t.textMuted)}>
                      Priority: {safeString(priority)}
                    </span>
                  )}
                  {status && (
                    <span className={cn("text-xs px-2 py-0.5 rounded", t.bgSecondary, t.textMuted)}>
                      {safeString(status)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// LAB RESULTS COMPONENT
// ═══════════════════════════════════════════════════════════════

const LabResultsSection = ({ narrative, theme }) => {
  const t = getThemeClasses(theme || 'dark');
  
  const labs = useMemo(() => {
    try {
      const l = safeGet(narrative, 'laboratory_summary.key_values') ||
                safeGet(narrative, 'laboratory_summary.critical_values') ||
                safeGet(narrative, 'laboratory_results') ||
                safeGet(narrative, 'labs') ||
                safeGet(narrative, 'lab_results') ||
                safeGet(narrative, 'lab_values') ||
                [];
      return safeArray(l);
    } catch {
      return [];
    }
  }, [narrative]);
  
  if (labs.length === 0) return null;
  
  return (
    <div className={cn("rounded-xl border overflow-hidden", t.card)}>
      <div className={cn("p-4 border-b flex items-center gap-3", t.border)}>
        <TestTube size={20} className="text-cyan-400" />
        <h3 className={cn("font-bold", t.text)}>Laboratory Results</h3>
        <span className={cn("text-xs px-2 py-0.5 rounded-full", t.bgTertiary, t.textMuted)}>
          {labs.length} results
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className={t.bgTertiary}>
            <tr>
              <th className={cn("px-4 py-3 text-left text-xs font-bold uppercase", t.textMuted)}>Test</th>
              <th className={cn("px-4 py-3 text-left text-xs font-bold uppercase", t.textMuted)}>Value</th>
              <th className={cn("px-4 py-3 text-left text-xs font-bold uppercase", t.textMuted)}>Reference</th>
              <th className={cn("px-4 py-3 text-left text-xs font-bold uppercase", t.textMuted)}>Status</th>
            </tr>
          </thead>
          <tbody className={cn("divide-y", t.border)}>
            {labs.map((lab, idx) => {
              const name = typeof lab === 'string' ? lab : safeGet(lab, 'test_name') || safeGet(lab, 'name') || safeGet(lab, 'test') || safeGet(lab, 'standard_name') || safeGet(lab, 'original_name') || `Lab ${idx + 1}`;
              const value = typeof lab === 'object' ? safeGet(lab, 'value') || safeGet(lab, 'result') || '' : '';
              const reference = typeof lab === 'object' ? safeGet(lab, 'reference') || safeGet(lab, 'normal_range') || '' : '';
              const status = typeof lab === 'object' ? safeGet(lab, 'status') || safeGet(lab, 'flag') || '' : '';
              
              return (
                <tr key={idx} className={t.bgHover}>
                  <td className={cn("px-4 py-3 font-medium text-sm", t.text)}>{safeString(name)}</td>
                  <td className={cn("px-4 py-3 font-mono text-sm", t.text)}>{safeString(value)}</td>
                  <td className={cn("px-4 py-3 text-sm", t.textSecondary)}>{safeString(reference)}</td>
                  <td className="px-4 py-3">
                    {status && (
                      <span className={cn(
                        "text-xs px-2 py-0.5 rounded-full font-bold",
                        (status.toLowerCase() === 'high' || status.toLowerCase() === 'abnormal' || status.toLowerCase() === 'critical')
                          ? "bg-rose-500/20 text-rose-400"
                          : (status.toLowerCase() === 'low')
                            ? "bg-amber-500/20 text-amber-400"
                            : "bg-emerald-500/20 text-emerald-400"
                      )}>
                        {safeString(status)}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// FILE BROWSER COMPONENT - SHOWS ALL BUCKET FILES
// ═══════════════════════════════════════════════════════════════

const FileBrowser = ({ s3Client, bucketName, prefix = '', onFileSelect, theme }) => {
  const t = getThemeClasses(theme || 'dark');
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('list');
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [filterText, setFilterText] = useState('');

  const loadFiles = useCallback(async () => {
    if (!s3Client || !bucketName) return;
    setLoading(true);
    setError(null);
    
    try {
      const response = await s3Client.send(new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: prefix,
        MaxKeys: 1000
      }));
      
      const fileList = (response.Contents || []).map(obj => ({
        key: obj.Key,
        name: obj.Key.split('/').pop() || obj.Key,
        path: obj.Key,
        size: obj.Size || 0,
        lastModified: obj.LastModified,
        isFolder: obj.Key.endsWith('/'),
        extension: (obj.Key.split('.').pop() || '').toLowerCase(),
        bucket: bucketName
      })).filter(f => f.name && !f.isFolder);
      
      setFiles(fileList);
    } catch (e) {
      console.error('File browser error:', e);
      setError(e.message || 'Failed to load files');
    }
    setLoading(false);
  }, [s3Client, bucketName, prefix]);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  const sortedFiles = useMemo(() => {
    try {
      let filtered = files.filter(f => 
        (f.name || '').toLowerCase().includes((filterText || '').toLowerCase()) ||
        (f.path || '').toLowerCase().includes((filterText || '').toLowerCase())
      );
      
      return filtered.sort((a, b) => {
        let compare = 0;
        switch (sortBy) {
          case 'name': compare = (a.name || '').localeCompare(b.name || ''); break;
          case 'size': compare = (a.size || 0) - (b.size || 0); break;
          case 'date': compare = new Date(a.lastModified || 0) - new Date(b.lastModified || 0); break;
          case 'type': compare = (a.extension || '').localeCompare(b.extension || ''); break;
          default: compare = 0;
        }
        return sortDir === 'asc' ? compare : -compare;
      });
    } catch {
      return files;
    }
  }, [files, filterText, sortBy, sortDir]);

  const getFileIcon = (ext) => {
    const icons = {
      pdf: FileText, json: FileJson, txt: FileText, csv: Table,
      xml: FileCode, png: FileArchive, jpg: FileArchive, jpeg: FileArchive
    };
    return icons[ext] || FileText;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("p-6 text-center", t.text)}>
        <AlertCircle className="mx-auto mb-4 text-rose-500" size={48} />
        <p className="text-rose-500 mb-4">{error}</p>
        <button onClick={loadFiles} className="px-4 py-2 bg-teal-600 text-white rounded-lg">Retry</button>
      </div>
    );
  }

  return (
    <div className={cn("rounded-xl border overflow-hidden", t.card)}>
      {/* Toolbar */}
      <div className={cn("p-4 border-b flex items-center gap-4 flex-wrap", t.border)}>
        <div className="flex-1 relative min-w-[200px]">
          <Search className={cn("absolute left-3 top-1/2 -translate-y-1/2", t.textMuted)} size={16} />
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Filter files..."
            className={cn("w-full pl-10 pr-4 py-2 rounded-lg border outline-none focus:border-teal-500", t.input)}
          />
        </div>
        
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className={cn("px-3 py-2 rounded-lg border outline-none", t.input)}>
          <option value="name">Name</option>
          <option value="size">Size</option>
          <option value="date">Date</option>
          <option value="type">Type</option>
        </select>
        
        <button onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')} className={cn("p-2 rounded-lg border", t.input)}>
          {sortDir === 'asc' ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
        
        <div className="flex border rounded-lg overflow-hidden">
          <button onClick={() => setViewMode('list')} className={cn("p-2", viewMode === 'list' ? 'bg-teal-600 text-white' : t.bgTertiary)}>
            <List size={18} />
          </button>
          <button onClick={() => setViewMode('grid')} className={cn("p-2", viewMode === 'grid' ? 'bg-teal-600 text-white' : t.bgTertiary)}>
            <Grid size={18} />
          </button>
        </div>
        
        <button onClick={loadFiles} className={cn("p-2 rounded-lg", t.bgTertiary, t.bgHover)}>
          <RefreshCw size={18} className={t.textSecondary} />
        </button>
      </div>
      
      <div className={cn("px-4 py-2 border-b text-sm", t.border, t.textSecondary)}>
        {sortedFiles.length} files
      </div>
      
      {sortedFiles.length === 0 ? (
        <EmptyState icon={FolderOpen} title="No files found" description="This location is empty" theme={theme} />
      ) : viewMode === 'list' ? (
        <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
          <table className="w-full">
            <thead className={cn("sticky top-0", t.bgTertiary)}>
              <tr>
                <th className={cn("px-4 py-3 text-left text-xs font-bold uppercase", t.textMuted)}>Name</th>
                <th className={cn("px-4 py-3 text-left text-xs font-bold uppercase", t.textMuted)}>Size</th>
                <th className={cn("px-4 py-3 text-left text-xs font-bold uppercase", t.textMuted)}>Modified</th>
                <th className={cn("px-4 py-3 text-left text-xs font-bold uppercase", t.textMuted)}>Actions</th>
              </tr>
            </thead>
            <tbody className={cn("divide-y", t.border)}>
              {sortedFiles.map((file, idx) => {
                const Icon = getFileIcon(file.extension);
                return (
                  <tr key={idx} className={cn("transition-colors", t.bgHover)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Icon size={18} className="text-teal-400 flex-shrink-0" />
                        <div className="min-w-0">
                          <div className={cn("font-medium truncate", t.text)}>{file.name}</div>
                          <div className={cn("text-xs truncate", t.textMuted)}>{file.path}</div>
                        </div>
                      </div>
                    </td>
                    <td className={cn("px-4 py-3 text-sm font-mono", t.textSecondary)}>{formatBytes(file.size)}</td>
                    <td className={cn("px-4 py-3 text-sm", t.textSecondary)}>{safeFormat(file.lastModified)}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => onFileSelect?.(file)} className="p-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded transition-colors">
                        <Eye size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-h-[500px] overflow-y-auto custom-scrollbar">
          {sortedFiles.map((file, idx) => {
            const Icon = getFileIcon(file.extension);
            return (
              <button
                key={idx}
                onClick={() => onFileSelect?.(file)}
                className={cn("p-4 rounded-xl border text-left transition-all hover:border-teal-500", t.card)}
              >
                <Icon size={32} className="text-teal-400 mb-3" />
                <div className={cn("font-medium truncate text-sm", t.text)}>{file.name}</div>
                <div className={cn("text-xs mt-1", t.textMuted)}>{formatBytes(file.size)}</div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// ALL BUCKETS FILE EXPLORER PAGE
// ═══════════════════════════════════════════════════════════════

const AllFilesPage = ({ s3Client, theme, onBack }) => {
  const t = getThemeClasses(theme || 'dark');
  const [selectedBucket, setSelectedBucket] = useState('RAW');
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState(null);
  const [loadingContent, setLoadingContent] = useState(false);

  const bucketInfo = {
    RAW: { name: 'Patient Uploads', icon: Upload, color: 'blue', description: 'Original uploaded patient folders' },
    STAGING: { name: 'Staging', icon: Clock3, color: 'amber', description: 'Files being processed by AI agents' },
    PROCESSED: { name: 'Processed', icon: CheckCircle, color: 'emerald', description: 'Completed agent processing outputs' },
    CURATED: { name: 'Curated', icon: Star, color: 'violet', description: 'Final longitudinal patient narratives' },
    QUARANTINE: { name: 'Quarantine', icon: AlertOctagon, color: 'rose', description: 'Files with processing errors' }
  };

  const loadFileContent = async (file) => {
    if (!s3Client || !file) return;
    setLoadingContent(true);
    setSelectedFile(file);
    
    try {
      const response = await s3Client.send(new GetObjectCommand({
        Bucket: file.bucket,
        Key: file.key
      }));
      
      const content = await response.Body.transformToString();
      
      if (file.extension === 'json') {
        setFileContent({ type: 'json', data: safeParseJSON(content, content) });
      } else {
        setFileContent({ type: 'text', data: content });
      }
    } catch (e) {
      setFileContent({ type: 'error', data: e.message || 'Failed to load file' });
    }
    setLoadingContent(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className={cn("p-2 rounded-lg", t.bgTertiary, t.bgHover)}>
            <ArrowLeft size={20} className={t.textSecondary} />
          </button>
          <div>
            <h1 className={cn("text-2xl font-bold", t.text)}>Pipeline File Explorer</h1>
            <p className={t.textSecondary}>Browse patient files across all S3 buckets</p>
          </div>
        </div>
      </div>
      
      {/* Bucket Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {Object.entries(bucketInfo).map(([key, info]) => {
          const Icon = info.icon;
          const isActive = selectedBucket === key;
          return (
            <button
              key={key}
              onClick={() => { setSelectedBucket(key); setSelectedFile(null); setFileContent(null); }}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all",
                isActive ? "bg-teal-600 text-white" : cn(t.bgTertiary, t.text, t.bgHover)
              )}
            >
              <Icon size={18} />
              <span>{info.name}</span>
            </button>
          );
        })}
      </div>
      
      <div className={cn("p-4 rounded-xl border", t.card)}>
        <div className="flex items-center gap-3">
          {(() => { const BInfo = bucketInfo[selectedBucket]; const BIcon = BInfo.icon; return <BIcon size={24} className="text-teal-400" />; })()}
          <div>
            <h3 className={cn("font-bold", t.text)}>{bucketInfo[selectedBucket].name}</h3>
            <p className={t.textSecondary}>{bucketInfo[selectedBucket].description}</p>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <FileBrowser s3Client={s3Client} bucketName={CONFIG.buckets[selectedBucket]} onFileSelect={loadFileContent} theme={theme} />
        </div>
        
        <div className={cn("rounded-xl border overflow-hidden", t.card)}>
          <div className={cn("p-4 border-b flex items-center gap-3", t.border)}>
            <Eye size={18} className="text-teal-400" />
            <h3 className={cn("font-bold", t.text)}>File Preview</h3>
          </div>
          
          <div className="h-[500px] overflow-auto custom-scrollbar">
            {!selectedFile ? (
              <EmptyState icon={FileText} title="No file selected" description="Select a file to preview its contents" theme={theme} />
            ) : loadingContent ? (
              <div className="flex items-center justify-center h-full"><Spinner size="lg" /></div>
            ) : fileContent?.type === 'error' ? (
              <div className="p-6 text-center text-rose-500">
                <AlertCircle className="mx-auto mb-4" size={48} />
                <p>{fileContent.data}</p>
              </div>
            ) : fileContent?.type === 'json' ? (
              <div className="p-4">
                <pre className={cn("text-xs font-mono whitespace-pre-wrap", t.text)}>
                  {typeof fileContent.data === 'string' ? fileContent.data : JSON.stringify(fileContent.data, null, 2)}
                </pre>
              </div>
            ) : (
              <div className="p-4">
                <pre className={cn("text-sm whitespace-pre-wrap", t.text)}>{fileContent?.data || 'No content'}</pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// INTEGRATED PATIENT SUMMARY PAGE (WITH FILE PREVIEW)
// ═══════════════════════════════════════════════════════════════

const PatientSummaryPage = ({ narrative: initialNarrative, caseData, s3Client, theme, isLoading, onBack }) => {
  const t = getThemeClasses(theme || 'dark');
  const [activeTab, setActiveTab] = useState('overview');
  const [expandedSections, setExpandedSections] = useState(new Set(['patient_info', 'clinical_assessment']));
  const [evidence, setEvidence] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState(null);
  const [loadingContent, setLoadingContent] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState('latest');

  // Derive active run data
  const availableRuns = caseData?.runs ? Object.keys(caseData.runs).sort((a, b) => {
    return new Date(caseData.runs[b].timestamp || 0) - new Date(caseData.runs[a].timestamp || 0);
  }) : [];

  const activeRunData = selectedRunId !== 'latest' && caseData?.runs?.[selectedRunId] 
    ? caseData.runs[selectedRunId] 
    : { dashboard: caseData?.dashboard, judgeReport: caseData?.judgeReport };

  const narrative = selectedRunId !== 'latest' && activeRunData?.dashboard 
    ? parseNarrativeData(activeRunData.dashboard) 
    : initialNarrative;

  const toggleSection = (key) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) newSet.delete(key);
      else newSet.add(key);
      return newSet;
    });
  };

  // Load file content for preview
  const loadFileContent = async (file) => {
    if (!s3Client || !file) return;
    setLoadingContent(true);
    setSelectedFile(file);
    
    try {
      const bucket = file.bucket || CONFIG.buckets.RAW;
      const key = file.key || `${caseData?.id}/${file.name}`;
      
      const response = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      const content = await response.Body.transformToString();
      const ext = (file.name || '').split('.').pop()?.toLowerCase();
      
      if (ext === 'json') {
        setFileContent({ type: 'json', data: safeParseJSON(content, content) });
      } else {
        setFileContent({ type: 'text', data: content });
      }
    } catch (e) {
      setFileContent({ type: 'error', data: e.message || 'Failed to load file' });
    }
    setLoadingContent(false);
  };

  // Derive tabs early (before any early-return) so the useEffect below is always called.
  const caseVariant_early = getCaseVariant(caseData);
  const isPinnacleCase_early = caseVariant_early === 'pinnacle';
  const isCompassCase_early = caseVariant_early === 'compass';
  const tabIds_early = ['overview', 'files'];
  if (isPinnacleCase_early) tabIds_early.push('pinnacle');
  else if (isCompassCase_early) tabIds_early.push('compass');
  else { tabIds_early.push('medications', 'madrigal', 'judge'); }
  tabIds_early.push('export');

  useEffect(() => {
    if (!tabIds_early.includes(activeTab)) {
      setActiveTab('overview');
    }
  }, [tabIds_early.join(','), activeTab]);

  const hasDiscoveryData = !!(caseData?.compassPrediction || caseData?.hasCompassPrediction || caseData?.pinnacleDiscovery || caseData?.hasPinnacleDiscovery || safeArray(safeGet(caseData, 'agentOutputs.compass')).length > 0 || safeArray(safeGet(caseData, 'agentOutputs.pinnacle')).length > 0);
  const realNarrative = narrative && !narrative._lazy;
  
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className={cn("p-2 rounded-lg", t.bgTertiary, t.bgHover)}>
            <ArrowLeft size={20} className={t.textSecondary} />
          </button>
          <h1 className={cn("text-2xl font-bold flex items-center gap-3", t.text)}>
            <MedicalCrossLogo size={28} className="text-teal-400" animated={true} />
            Patient Summary
          </h1>
        </div>
        <div className={cn("flex flex-col items-center justify-center py-20 rounded-2xl border mac-glass-panel", t.card)}>
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-teal-500/20 rounded-full blur-xl animate-pulse"></div>
            <Activity className="text-teal-400 animate-pulse relative z-10" size={48} />
          </div>
          <h3 className={cn("text-2xl font-black mb-3", t.text)}>
            <span className="bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">
              Loading Patient Data
            </span>
          </h3>
          <p className={cn("text-sm font-medium mb-6 text-center max-w-sm", t.textSecondary)}>
            Please wait securely fetching longitudinal patient records and AI inferences from the clinical pipeline...
          </p>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
        </div>
      </div>
    );
  }
  
  if (!realNarrative && !hasDiscoveryData && (!caseData || (!caseData.rawFiles?.length && !Object.keys(caseData.files || {}).length))) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className={cn("p-2 rounded-lg", t.bgTertiary, t.bgHover)}>
            <ArrowLeft size={20} className={t.textSecondary} />
          </button>
          <h1 className={cn("text-2xl font-bold flex items-center gap-3", t.text)}>
            <MedicalCrossLogo size={28} className="text-teal-400" animated={false} />
            Patient Summary
          </h1>
        </div>
        <div className={cn("flex flex-col items-center justify-center py-16 rounded-2xl border", t.card)}>
          <StethoscopePulse className="mb-6" />
          <h3 className={cn("text-xl font-bold mb-2", t.text)}>Awaiting Patient Data</h3>
          <p className={cn("text-sm mb-3 text-center max-w-md", t.textSecondary)}>
            The patient narrative has not been generated yet. Please wait for AI agent processing to complete.
          </p>
          <DNAHelixAnimation className="mb-6 text-teal-400" />
          <div className="flex items-center gap-3">
            <MedicalShieldBadge label="HIPAA Compliant" theme={theme} />
            <MedicalShieldBadge label="AI Powered" theme={theme} />
          </div>
          <button onClick={onBack} className="mt-6 px-6 py-2.5 bg-teal-600 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-teal-500 transition-all">
            <ArrowLeft size={16} />
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const caseVariant = getCaseVariant(caseData);
  const isPinnacleCase = caseVariant === 'pinnacle';
  const isCompassCase = caseVariant === 'compass';
  const trackedAgents = isPinnacleCase
    ? [{ id: 'pinnacle', name: 'Target Discovery', icon: LineChart }]
    : isCompassCase
    ? [{ id: 'compass', name: 'Immunotherapy', icon: Target }]
    : CONFIG.agents.filter((a) => a.id !== 'pinnacle' && a.id !== 'compass');
  const completedTrackedAgents = trackedAgents.filter((a) => !!safeGet(caseData, `agentOutputs.${a.id}`)).length;
  const hasPinnacleOutput = !!(
    caseData?.pinnacleDiscovery ||
    caseData?.dashboard?.pinnacle_discovery ||
    safeArray(safeGet(caseData, 'agentOutputs.pinnacle')).length > 0
  );
  const hasCompassOutput = !!(
    caseData?.compassPrediction ||
    caseData?.dashboard?.compass_prediction ||
    safeArray(safeGet(caseData, 'agentOutputs.compass')).length > 0
  );

  // Show processing state when outputs are expected but not complete yet.
  const hasInputs = (caseData?.rawFiles?.length > 0 || Object.keys(caseData?.agentOutputs || {}).length > 0);
  const hasNarrative = !!(
    safeGet(caseData, 'agentOutputs.feature') ||
    caseData?.narrative ||
    caseData?.dashboard
  );
  // Processing banner only while the narrative itself hasn't landed —
  // the narrative is the pipeline's final deliverable, so its presence
  // means the run is done even if optional side-outputs are still hydrating.
  const isProcessingPipeline = (isPinnacleCase || isCompassCase)
    ? false
    : hasInputs && !hasNarrative;

  const tabs = [
    { id: 'overview', label: isPinnacleCase ? 'Target Discovery' : isCompassCase ? 'Immunotherapy' : 'Summary', icon: isPinnacleCase ? LineChart : isCompassCase ? Target : Stethoscope },
    { id: 'files', label: (isPinnacleCase || isCompassCase) ? 'Files & Discovery' : 'Files & Pipeline', icon: FolderOpen },
  ];

  if (isPinnacleCase) {
    tabs.push({ id: 'pinnacle', label: 'Discovery', icon: LineChart, badge: caseData?.pinnacleDiscovery ? 'sky' : null });
  } else if (isCompassCase) {
    tabs.push({ id: 'compass', label: 'Immunotherapy', icon: Target, badge: hasCompassOutput ? 'emerald' : null });
  } else {
    tabs.push({ id: 'medications', label: 'Medications', icon: Pill });
    tabs.push({ id: 'judge', label: 'AI Judge', icon: Gauge });
  }
  tabs.push({ id: 'export', label: 'Export Report', icon: Download });


  const pinnacleData = caseData?.pinnacleDiscovery || caseData?.dashboard?.pinnacle_discovery || {};
  const pinnacleTargets = safeArray(pinnacleData.nominated_targets || pinnacleData.top_targets || []);
  const pinnacleCellTypes = safeArray(pinnacleData.analyzed_cell_types || []);
  const pinnaclePoints = safeArray(safeGet(pinnacleData, 'embedding_plot.points') || []);
  const pinnacleDiseaseName = safeString(pinnacleData.disease_name || pinnacleData.disease || 'Unknown Disease');
  const pinnacleDiseaseId = safeString(pinnacleData.disease_id || 'N/A');
  const pinnacleRequestedTargets = safeArray(pinnacleData.requested_targets || []);
  const compassData = caseData?.compassPrediction || caseData?.dashboard?.compass_prediction || {};
  const compassPredictions = safeArray(compassData.predictions || []);
  const compassResponseRate = compassData.response_rate != null
    ? (Number(compassData.response_rate) * 100).toFixed(1)
    : null;
  const compassCancerType = safeString(compassData.cancer_type || 'N/A');
  const compassCancerName = safeString(compassData.cancer_name || compassData.cancer_type || 'Unknown Cancer');

  // Recursive value renderer
  const renderValue = (value, depth = 0) => {
    try {
      if (value === null || value === undefined) {
        return <span className="text-slate-500 italic text-sm">null</span>;
      }
      if (typeof value === 'boolean') {
        return (
          <span className={cn("px-2 py-0.5 rounded text-xs font-bold", value ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400")}>
            {value.toString()}
          </span>
        );
      }
      if (typeof value === 'number') return <span className="text-cyan-400 font-mono text-sm">{value}</span>;
      if (typeof value === 'string') {
        const dateValue = safeDate(value);
        if (dateValue && value.includes('-') && value.length > 8) {
          return <span className="text-amber-400 text-sm">{safeFormat(value, 'MMM dd, yyyy HH:mm')}</span>;
        }
        if (value.length > 200) {
          return <div className={cn("text-sm p-3 rounded-lg whitespace-pre-wrap", t.bgTertiary, t.text)}>{value}</div>;
        }
        return <span className={cn("text-sm", t.text)}>{value}</span>;
      }
      if (Array.isArray(value)) {
        if (value.length === 0) return <span className="text-slate-500 italic text-sm">empty array</span>;
        return (
          <div className="space-y-2 mt-2">
            {value.map((item, idx) => (
              <div key={idx} className={cn("p-3 rounded-lg border", t.bgSecondary, t.border)}>
                <div className="flex items-start gap-2">
                  <span className="text-teal-400 font-mono text-xs mt-1">[{idx}]</span>
                  <div className="flex-1">{renderValue(item, depth + 1)}</div>
                </div>
              </div>
            ))}
          </div>
        );
      }
      if (typeof value === 'object') {
        const keys = Object.keys(value);
        if (keys.length === 0) return <span className="text-slate-500 italic text-sm">empty object</span>;
        return (
          <div className={cn("space-y-2 mt-2", depth > 0 && "ml-4 pl-4 border-l-2 border-slate-700")}>
            {keys.map(key => (
              <div key={key} className="space-y-1">
                <span className="text-teal-400 font-medium text-sm">{key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                <div className="ml-4">{renderValue(value[key], depth + 1)}</div>
              </div>
            ))}
          </div>
        );
      }
      return <span className={t.text}>{String(value)}</span>;
    } catch {
      return <span className="text-rose-400 text-sm">Error rendering value</span>;
    }
  };

  // Render structured view
  const renderStructuredView = () => {
    if (!narrative) {
      return <EmptyState icon={Database} title="No Structured Data" description="Narrative not yet generated" theme={theme} />;
    }
    
    const sectionConfig = {
      metadata: { title: 'Document Metadata', icon: Info, priority: 1 },
      patient_info: { title: 'Patient Information', icon: User, priority: 2 },
      patient: { title: 'Patient', icon: User, priority: 2 },
      clinical_assessment: { title: 'Clinical Assessment', icon: Stethoscope, priority: 3 },
      risk_assessment: { title: 'Risk Assessment', icon: AlertTriangle, priority: 4 },
      encounter_timeline: { title: 'Encounter Timeline', icon: Calendar, priority: 5 },
      encounters: { title: 'Encounters', icon: Calendar, priority: 5 },
      medications: { title: 'Medications', icon: Pill, priority: 6 },
      medication_list: { title: 'Medication List', icon: Pill, priority: 6 },
      vital_trends: { title: 'Vital Signs Trends', icon: Activity, priority: 7 },
      vitals: { title: 'Vital Signs', icon: Activity, priority: 7 },
      laboratory_results: { title: 'Laboratory Results', icon: TestTube, priority: 8 },
      laboratory_summary: { title: 'Laboratory Summary', icon: TestTube, priority: 8 },
      labs: { title: 'Labs', icon: TestTube, priority: 8 },
      imaging_summary: { title: 'Imaging Summary', icon: Eye, priority: 8 },
      longitudinal_narrative: { title: 'Longitudinal Narrative', icon: BookOpen, priority: 9 },
      narrative_text: { title: 'Narrative Text', icon: FileText, priority: 10 },
      summary: { title: 'Summary', icon: ClipboardList, priority: 11 },
      care_plan: { title: 'Care Plan', icon: ClipboardList, priority: 12 },
      diagnoses: { title: 'Diagnoses', icon: Tag, priority: 13 },
      problem_list: { title: 'Problem List', icon: Heart, priority: 4 },
      clinical_timeline: { title: 'Clinical Timeline', icon: Calendar, priority: 5 },
      clinical_recommendations: { title: 'Clinical Recommendations', icon: ClipboardList, priority: 12 },
      clinical_notes: { title: 'Clinical Notes', icon: MessageSquare, priority: 14 },
      data_quality: { title: 'Data Quality', icon: ShieldCheck, priority: 15 },
    };
    
    const sections = [];
    try {
      Object.keys(narrative).forEach(key => {
        const value = narrative[key];
        if (value === null || value === undefined) return;
        if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) return;
        if (Array.isArray(value) && value.length === 0) return;
        
        const config = sectionConfig[key] || {
          title: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          icon: Database,
          priority: 100
        };
        sections.push({ key, ...config, data: value });
      });
    } catch {}
    
    sections.sort((a, b) => a.priority - b.priority);
    
    if (sections.length === 0) {
      return <EmptyState icon={Database} title="No Data" description="The narrative is empty" theme={theme} />;
    }
    
    return (
      <div className="space-y-4">
        {sections.map(section => {
          const Icon = section.icon || Database;
          const isExpanded = expandedSections.has(section.key);
          return (
            <div key={section.key} className={cn("rounded-xl border overflow-hidden", t.card)}>
              <button
                onClick={() => toggleSection(section.key)}
                className={cn("w-full p-4 flex items-center justify-between transition-colors", t.bgTertiary, t.bgHover)}
              >
                <div className="flex items-center gap-3">
                  <Icon size={20} className="text-teal-400" />
                  <h3 className={cn("font-bold", t.text)}>{section.title}</h3>
                  <span className={cn("text-xs px-2 py-0.5 rounded-full", t.bgSecondary, t.textMuted)}>
                    {Array.isArray(section.data) ? `${section.data.length} items` : 'object'}
                  </span>
                </div>
                {isExpanded ? <ChevronUp size={20} className={t.textMuted} /> : <ChevronDown size={20} className={t.textMuted} />}
              </button>
              {isExpanded && (
                <div className={cn("p-4 border-t", t.border)}>
                  {renderValue(section.data)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // Render clinical overview
  const renderPinnacleOverview = () => {
    if (!pinnacleData || Object.keys(pinnacleData).length === 0) {
      return (
        <div className={cn("rounded-xl border p-8 text-center", t.card)}>
          <LineChart size={46} className="mx-auto text-sky-400 mb-4" />
          <h3 className={cn("text-lg font-bold mb-2", t.text)}>Target Discovery Pending</h3>
          <p className={cn("text-sm", t.textSecondary)}>
            This case is configured for PINNACLE discovery. Results will appear here once processing completes.
          </p>
        </div>
      );
    }

    const topScore = safeGet(pinnacleData, 'summary.max_score');
    const meanScore = safeGet(pinnacleData, 'summary.mean_score');
    const normalizedPinnacleStatus = safeString(pinnacleData.status || '').trim().toUpperCase();
    const pinnacleStatusLabel = normalizedPinnacleStatus === 'SUCCESS' || hasPinnacleOutput ? 'READY' : '';

    return (
      <div className="space-y-6">
        <div className="relative overflow-hidden rounded-xl border border-sky-500/25 bg-gradient-to-r from-sky-500/10 via-cyan-500/5 to-indigo-500/10 p-5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <LineChart size={18} className="text-sky-300" />
                <span className="text-xs uppercase tracking-wider text-sky-300 font-bold">Target Discovery</span>
              </div>
              <h3 className={cn("text-xl font-bold", t.text)}>{pinnacleDiseaseName}</h3>
              <p className={cn("text-xs mt-1", t.textMuted)}>Disease ID: {pinnacleDiseaseId}</p>
            </div>
            {pinnacleStatusLabel && (
              <span className="text-xs px-3 py-1 rounded-full font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                {pinnacleStatusLabel}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className={cn("p-4 rounded-lg border", t.card)}>
            <div className={cn("text-[10px] uppercase", t.textMuted)}>Targets</div>
            <div className="text-2xl font-black text-sky-400">{pinnacleTargets.length}</div>
          </div>
          <div className={cn("p-4 rounded-lg border", t.card)}>
            <div className={cn("text-[10px] uppercase", t.textMuted)}>Cell Contexts</div>
            <div className="text-2xl font-black text-indigo-300">{pinnacleCellTypes.length}</div>
          </div>
          <div className={cn("p-4 rounded-lg border", t.card)}>
            <div className={cn("text-[10px] uppercase", t.textMuted)}>Embedding Points</div>
            <div className="text-2xl font-black text-emerald-400">{pinnaclePoints.length}</div>
          </div>
          <div className={cn("p-4 rounded-lg border", t.card)}>
            <div className={cn("text-[10px] uppercase", t.textMuted)}>Top Score</div>
            <div className="text-2xl font-black text-amber-400">{topScore != null ? Number(topScore).toFixed(3) : 'N/A'}</div>
          </div>
        </div>

        {(pinnacleRequestedTargets.length > 0 || meanScore != null) && (
          <div className={cn("rounded-xl border p-4", t.card)}>
            <div className="flex flex-wrap gap-2 items-center justify-between">
              {meanScore != null && (
                <span className={cn("text-xs px-2.5 py-1 rounded-lg", t.bgTertiary, t.textSecondary)}>
                  Mean score: {Number(meanScore).toFixed(3)}
                </span>
              )}
              {pinnacleRequestedTargets.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {pinnacleRequestedTargets.slice(0, 8).map((target, idx) => (
                    <span key={idx} className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-mono">
                      {safeString(target)}
                    </span>
                  ))}
                  {pinnacleRequestedTargets.length > 8 && (
                    <span className={cn("text-[10px] px-2 py-0.5 rounded-full", t.bgTertiary, t.textMuted)}>
                      +{pinnacleRequestedTargets.length - 8} more
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        <PinnaclePanel caseData={caseData} theme={theme} />
      </div>
    );
  };

  const renderCompassOverview = () => {
    if (!compassData || Object.keys(compassData).length === 0) {
      return (
        <div className={cn("rounded-xl border p-8 text-center", t.card)}>
          <Target size={46} className="mx-auto text-emerald-400 mb-4" />
          <h3 className={cn("text-lg font-bold mb-2", t.text)}>Immunotherapy Analysis Pending</h3>
          <p className={cn("text-sm", t.textSecondary)}>
            This case is configured for COMPASS discovery. Results will appear here once processing completes.
          </p>
        </div>
      );
    }

    const compassStatus = safeString(compassData.status || '').trim().toUpperCase();
    const compassStatusLabel = compassStatus === 'SUCCESS' || hasCompassOutput ? 'READY' : '';

    return (
      <div className="space-y-6">
        <div className="relative overflow-hidden rounded-xl border border-emerald-500/25 bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-cyan-500/10 p-5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Target size={18} className="text-emerald-300" />
                <span className="text-xs uppercase tracking-wider text-emerald-300 font-bold">Immunotherapy Response</span>
              </div>
              <h3 className={cn("text-xl font-bold", t.text)}>{compassCancerName}</h3>
              <p className={cn("text-xs mt-1", t.textMuted)}>Cancer Type: {compassCancerType}</p>
            </div>
            {compassStatusLabel && (
              <span className="text-xs px-3 py-1 rounded-full font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                {compassStatusLabel}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className={cn("p-4 rounded-lg border", t.card)}>
            <div className={cn("text-[10px] uppercase", t.textMuted)}>Response Rate</div>
            <div className="text-2xl font-black text-emerald-400">{compassResponseRate != null ? `${compassResponseRate}%` : 'N/A'}</div>
          </div>
          <div className={cn("p-4 rounded-lg border", t.card)}>
            <div className={cn("text-[10px] uppercase", t.textMuted)}>Patients Analyzed</div>
            <div className="text-2xl font-black text-cyan-300">{compassData.patients_analyzed || compassPredictions.length || 0}</div>
          </div>
          <div className={cn("p-4 rounded-lg border", t.card)}>
            <div className={cn("text-[10px] uppercase", t.textMuted)}>Responders</div>
            <div className="text-2xl font-black text-emerald-300">{compassData.responder_count ?? compassPredictions.filter((p) => p.predicted_response === 1).length}</div>
          </div>
          <div className={cn("p-4 rounded-lg border", t.card)}>
            <div className={cn("text-[10px] uppercase", t.textMuted)}>Non-Responders</div>
            <div className="text-2xl font-black text-rose-400">{compassData.non_responder_count ?? compassPredictions.filter((p) => p.predicted_response === 0).length}</div>
          </div>
        </div>

        <CompassPanel caseData={caseData} theme={theme} />
      </div>
    );
  };

  const renderClinicalOverview = () => {
    const summary = safeGet(narrative, 'clinical_assessment.summary_statement') ||
                    safeGet(narrative, 'patient_profile.summary_snippet') ||
                    safeGet(narrative, 'summary') ||
                    safeGet(narrative, 'longitudinal_narrative.narrative_text') ||
                    safeGet(narrative, 'narrative_text') ||
                    safeGet(narrative, 'narrative') ||
                    safeGet(narrative, 'clinical_summary') || '';
    
    // Full narrative text for rendered markdown display
    const narrativeText = safeGet(narrative, 'longitudinal_narrative.narrative_text') ||
                          safeGet(narrative, 'narrative_text') || '';
    // Files that were integrated into this narrative
    const filesIntegrated = safeArray(safeGet(narrative, 'files_integrated') || []);
    // Baseline clinical status from patient profile
    const baselineStatus = safeGet(narrative, 'patient_profile.baseline_status') || '';
    // Key characteristics from patient profile
    const keyCharacteristics = safeArray(safeGet(narrative, 'patient_profile.key_characteristics') || []);
    // System meta & processing info
    const sysMeta = safeGet(narrative, '_system_meta') || safeGet(narrative, 'system_meta') || {};
    const processing = safeGet(sysMeta, 'processing') || {};
    const summaryType = safeGet(narrative, 'summary_type') || '';
    const genDate = safeGet(narrative, 'generation_date') || '';
    
    const findings = safeArray(safeGet(narrative, 'clinical_assessment.key_findings') || keyCharacteristics || safeGet(narrative, 'findings') || []);
    const problems = safeArray(safeGet(narrative, 'problem_list') || safeGet(narrative, 'clinical_assessment.active_problems') || safeGet(narrative, 'diagnoses') || safeGet(narrative, 'conditions') || []);
    const risks = safeGet(narrative, 'risk_assessment') || safeGet(narrative, 'risks') || {};
    const patientInfo = safeGet(narrative, 'patient_info') || safeGet(narrative, 'patient') || safeGet(narrative, 'patient_profile') || {};
    const demographics = safeGet(sysMeta, 'demographics') || {};
    const bloodType = safeGet(patientInfo, 'blood_type') || '';
    const comorbidityBurden = safeGet(patientInfo, 'comorbidity_burden') || '';
    // V8.0 structured fields
    const medsData = safeGet(narrative, 'medications') || {};
    const currentMeds = safeArray(safeGet(medsData, 'current_regimen') || safeGet(narrative, 'medications') || safeGet(narrative, 'medication_list') || []);
    const labSummary = safeGet(narrative, 'laboratory_summary') || {};
    const criticalLabs = safeArray(safeGet(labSummary, 'critical_values') || []);
    const keyLabs = safeArray(safeGet(labSummary, 'key_values') || []);
    const imagingSummary = safeArray(safeGet(narrative, 'imaging_summary') || []);
    const clinicalTimeline = safeArray(safeGet(narrative, 'clinical_timeline') || []);
    const clinicalRecs = safeGet(narrative, 'clinical_recommendations') || {};
    const dataQuality = safeGet(narrative, 'data_quality') || {};
    const clinicalAssessment = safeGet(narrative, 'clinical_assessment') || {};
    // Judge data from case or run
    const judgeData = activeRunData?.judgeReport || caseData?.judgeReport || (Array.isArray(safeGet(caseData, 'agentOutputs.judge')) ? safeGet(caseData, 'agentOutputs.judge')[0]?.data : null);
    const judgeCompareData = activeRunData?.judgeReportCompare || null;
    // Merge demographics from system_meta if patient_profile is sparse
    const mergedPatient = {
      ...demographics,
      ...patientInfo,
      name: safeGet(patientInfo, 'name') || safeGet(patientInfo, 'patient_name') || safeGet(demographics, 'patient_name') || '',
      age: safeGet(patientInfo, 'age') || safeGet(demographics, 'age') || '',
      gender: safeGet(patientInfo, 'gender') || safeGet(demographics, 'gender') || '',
      mrn: safeGet(patientInfo, 'mrn') || safeGet(demographics, 'mrn') || '',
      dob: safeGet(patientInfo, 'dob') || safeGet(demographics, 'dob') || '',
    };
    
    return (
      <div className="space-y-6">
        {/* Summary Type & Generation Meta Banner */}
        {(summaryType || genDate || Object.keys(processing).length > 0) && (
          <div className="flex flex-wrap items-center gap-3">
            {summaryType && (
              <span className="text-xs font-bold px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-500/20 to-violet-500/20 border border-indigo-500/30 text-indigo-400 flex items-center gap-1.5">
                <BrainCircuit size={14} />
                {safeString(summaryType).replace(/_/g, ' ')}
              </span>
            )}
            {genDate && (
              <span className={cn("text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5", t.bgTertiary, t.textMuted)}>
                <CalendarClock size={14} className="text-teal-400" />
                Generated: {new Date(genDate).toLocaleString()}
              </span>
            )}
            {processing.page_count && (
              <span className={cn("text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5", t.bgTertiary, t.textMuted)}>
                <FileText size={14} className="text-blue-400" />
                {processing.page_count} pages
              </span>
            )}
            {processing.method && (
              <span className={cn("text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-mono", t.bgTertiary, t.textMuted)}>
                <Cpu size={14} className="text-violet-400" />
                {processing.method}
              </span>
            )}
            {processing.chunks_processed && (
              <span className={cn("text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5", t.bgTertiary, t.textMuted)}>
                <Layers size={14} className="text-cyan-400" />
                {processing.chunks_processed} chunks
              </span>
            )}
            {processing.total_text_chars && (
              <span className={cn("text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5", t.bgTertiary, t.textMuted)}>
                <Code size={14} className="text-emerald-400" />
                {processing.total_text_chars.toLocaleString()} chars
              </span>
            )}
            {/* Judge Score Badge */}
            {(() => {
              try {
                const jRaw = judgeData;
                if (!jRaw) return null;
                const jParsed = typeof jRaw === 'string' ? JSON.parse(jRaw) : jRaw;
                const jInline = jParsed?.inline_judge || jParsed;
                const score = jInline?.overall_score ?? jInline?.scores?.overall;
                const grade = jInline?.quality_grade;
                if (score === undefined && !grade) return null;
                const pct = typeof score === 'number' ? Math.round(score * 100) : null;
                const gradeColor = grade === 'EXCELLENT' ? 'from-emerald-500/30 to-green-500/30 border-emerald-500/40 text-emerald-400' :
                  grade === 'GOOD' ? 'from-teal-500/30 to-cyan-500/30 border-teal-500/40 text-teal-400' :
                  grade === 'ACCEPTABLE' ? 'from-amber-500/30 to-yellow-500/30 border-amber-500/40 text-amber-400' :
                  'from-rose-500/30 to-red-500/30 border-rose-500/40 text-rose-400';
                return (
                  <span className={cn("text-xs font-black px-3 py-1.5 rounded-lg bg-gradient-to-r border flex items-center gap-1.5", gradeColor)}>
                    <Star size={14} fill="currentColor" />
                    {pct !== null && `${pct}%`} {grade || ''}
                  </span>
                );
              } catch { return null; }
            })()}
          </div>
        )}

        {/* Patient Header Card with Medical Animation */}
        <div className="relative overflow-hidden p-6 rounded-xl bg-gradient-to-r from-teal-600/20 via-cyan-600/15 to-indigo-600/20 border border-teal-500/20">
          <HeartbeatLine className="absolute inset-0 text-teal-500 opacity-5" />
          <div className="relative z-10 flex items-center gap-4 mb-4">
            <div className="relative">
              <div className="absolute inset-0 bg-teal-500/20 rounded-2xl animate-pulse" style={{ animationDuration: '3s' }} />
              <div className="h-16 w-16 bg-gradient-to-br from-teal-600 to-cyan-600 rounded-2xl flex items-center justify-center relative shadow-lg shadow-teal-500/20">
                <MedicalCrossLogo size={28} className="text-white" animated={false} />
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-baseline gap-3">
                <h2 className={cn("text-2xl font-bold", t.text)}>
                  {caseData?.patientNumber ? `Patient ${caseData.patientNumber}` : (caseData?.folderName || caseData?.id || 'Patient')}
                </h2>
                {caseData?.folderName && (
                  <span className={cn("text-[10px] font-mono opacity-40", t.textMuted)} title={caseData.folderName}>{caseData.folderName}</span>
                )}
              </div>
              {mergedPatient.name && mergedPatient.name !== '[ANONYMIZED]' && (
                <p className={cn("text-sm font-medium mt-0.5", t.textSecondary)}>
                  {mergedPatient.name}
                </p>
              )}
              <div className="flex flex-wrap gap-3 mt-2">
                {mergedPatient.age && (
                  <span className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
                    <Calendar size={12} /> {safeString(mergedPatient.age)}
                  </span>
                )}
                {mergedPatient.gender && (
                  <span className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-400">
                    <User size={12} /> {safeString(mergedPatient.gender)}
                  </span>
                )}
                {mergedPatient.dob && (
                  <span className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-400">
                    <CalendarDays size={12} /> DOB: {safeString(mergedPatient.dob)}
                  </span>
                )}
                {mergedPatient.mrn && (
                  <span className="flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded-lg bg-slate-500/10 border border-slate-500/20 text-slate-400">
                    <Tag size={12} /> MRN: {safeString(mergedPatient.mrn)}
                  </span>
                )}
                {bloodType && (
                  <span className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400">
                    <Heart size={12} /> {safeString(bloodType)}
                  </span>
                )}
                {comorbidityBurden && (
                  <span className={cn("flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border",
                    comorbidityBurden === 'HIGH' ? "bg-rose-500/10 border-rose-500/20 text-rose-400" :
                    comorbidityBurden === 'MODERATE' ? "bg-amber-500/10 border-amber-500/20 text-amber-400" :
                    "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                  )}>
                    <AlertTriangle size={12} /> Comorbidity: {safeString(comorbidityBurden)}
                  </span>
                )}
                {safeGet(demographics, 'confidence') !== undefined && safeGet(demographics, 'confidence') !== null && (
                  <span className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                    <ShieldCheck size={12} /> Conf: {(Number(safeGet(demographics, 'confidence')) * 100).toFixed(0)}%
                  </span>
                )}
              </div>
            </div>
          </div>
          
          {/* Quick stats from real data */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className={cn("p-3 rounded-lg border", t.bgSecondary, 'border-blue-500/10')}>
              <div className={cn("text-[10px] uppercase tracking-wider flex items-center gap-1", t.textMuted)}><Calendar size={10} className="text-blue-400" /> Timeline</div>
              <div className={cn("text-xl font-bold", t.text)}>
                {clinicalTimeline.length || safeArray(safeGet(narrative, 'encounter_timeline') || safeGet(narrative, 'encounters') || []).length || '0'}
              </div>
              <div className={cn("text-[9px]", t.textMuted)}>events</div>
            </div>
            <div className={cn("p-3 rounded-lg border", t.bgSecondary, 'border-rose-500/10')}>
              <div className={cn("text-[10px] uppercase tracking-wider flex items-center gap-1", t.textMuted)}><Heart size={10} className="text-rose-400" /> Conditions</div>
              <div className={cn("text-xl font-bold", t.text)}>{problems.length}</div>
              <div className={cn("text-[9px]", t.textMuted)}>diagnoses</div>
            </div>
            <div className={cn("p-3 rounded-lg border", t.bgSecondary, 'border-violet-500/10')}>
              <div className={cn("text-[10px] uppercase tracking-wider flex items-center gap-1", t.textMuted)}><Pill size={10} className="text-violet-400" /> Medications</div>
              <div className={cn("text-xl font-bold", t.text)}>
                {currentMeds.length || safeArray(safeGet(narrative, 'medications') || safeGet(narrative, 'medication_list') || []).length}
              </div>
              <div className={cn("text-[9px]", t.textMuted)}>active</div>
            </div>
            <div className={cn("p-3 rounded-lg border", t.bgSecondary, 'border-cyan-500/10')}>
              <div className={cn("text-[10px] uppercase tracking-wider flex items-center gap-1", t.textMuted)}><TestTube size={10} className="text-cyan-400" /> Labs</div>
              <div className={cn("text-xl font-bold", t.text)}>
                {criticalLabs.length + keyLabs.length || '0'}
              </div>
              <div className={cn("text-[9px]", criticalLabs.length > 0 ? 'text-rose-400 font-bold' : t.textMuted)}>{criticalLabs.length > 0 ? `${criticalLabs.length} critical` : 'results'}</div>
            </div>
            <div className={cn("p-3 rounded-lg border", t.bgSecondary, 'border-teal-500/10')}>
              <div className={cn("text-[10px] uppercase tracking-wider flex items-center gap-1", t.textMuted)}><FolderOpen size={10} className="text-teal-400" /> Files</div>
              <div className={cn("text-xl font-bold", t.text)}>
                {(caseData?.rawFiles?.length || 0) + Object.keys(caseData?.files || {}).length}
              </div>
              <div className={cn("text-[9px]", t.textMuted)}>analyzed</div>
            </div>
          </div>
        </div>

        {/* Key Characteristics Chips */}
        {keyCharacteristics.length > 0 && (
          <div className={cn("p-5 rounded-xl border", t.card)}>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={18} className="text-amber-400" />
              <h3 className={cn("font-bold text-sm", t.text)}>Key Clinical Characteristics</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {keyCharacteristics.map((char, idx) => {
                const colors = ['bg-teal-500/10 text-teal-400 border-teal-500/20', 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20', 'bg-blue-500/10 text-blue-400 border-blue-500/20', 'bg-violet-500/10 text-violet-400 border-violet-500/20', 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20', 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'];
                return (
                  <span key={idx} className={cn("text-xs px-3 py-1.5 rounded-lg border font-medium", colors[idx % colors.length])}>
                    {safeString(char)}
                  </span>
                );
              })}
            </div>
          </div>
        )}
        
        {/* Clinical Summary / Snippet */}
        {(safeGet(narrative, 'patient_profile.summary_snippet') || (summary && !narrativeText)) && (
          <div className={cn("p-6 rounded-xl border border-l-4 border-l-teal-500/50", t.card)}>
            <div className="flex items-center gap-3 mb-3">
              <Stethoscope size={20} className="text-teal-400" />
              <h3 className={cn("font-bold", t.text)}>Clinical Summary</h3>
              {summaryType && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-400 font-bold">
                  {safeString(summaryType).replace(/_/g, ' ')}
                </span>
              )}
            </div>
            <div className={cn("text-sm leading-relaxed", t.text)}>
              {safeString(safeGet(narrative, 'patient_profile.summary_snippet') || summary)}
            </div>
          </div>
        )}
        
        {/* Baseline Clinical Status */}
        {baselineStatus && (
          <div className={cn("p-6 rounded-xl border border-l-4 border-l-rose-500/50", t.card)}>
            <div className="flex items-center gap-3 mb-3">
              <Heart size={20} className="text-rose-400" />
              <h3 className={cn("font-bold", t.text)}>Baseline Clinical Status</h3>
            </div>
            <div className={cn("text-sm leading-relaxed", t.text)}>
              {safeString(baselineStatus)}
            </div>
          </div>
        )}
        
        {/* Longitudinal Patient Narrative - Rendered Markdown */}
        {narrativeText && (
          <div className={cn("rounded-xl border overflow-hidden", t.card)}>
            <div className={cn("p-4 border-b flex items-center justify-between", t.border, 'bg-gradient-to-r from-indigo-500/5 to-violet-500/5')}>
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                  <BookOpen size={18} className="text-indigo-400" />
                </div>
                <div>
                  <h3 className={cn("font-bold", t.text)}>Longitudinal Patient Narrative</h3>
                  <p className={cn("text-[10px]", t.textMuted)}>AI-generated clinical narrative from integrated source documents</p>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 font-bold flex items-center gap-1 ml-2">
                  <BrainCircuit size={10} />
                  AI Generated
                </span>
              </div>
              <DNAHelixAnimation className="text-indigo-400 opacity-60" />
            </div>
            <div className="p-6">
              <NarrativeMarkdownRenderer text={narrativeText} theme={theme} />
            </div>
          </div>
        )}

        {/* Clinical Assessment & Acuity Card */}
        {(clinicalAssessment.summary_statement || clinicalAssessment.acuity_level) && (
          <div className={cn("rounded-xl border overflow-hidden", t.card)}>
            <div className={cn("p-4 border-b flex items-center justify-between", t.border, 'bg-gradient-to-r from-emerald-500/5 to-teal-500/5')}>
              <div className="flex items-center gap-3">
                <ShieldCheck size={20} className="text-emerald-400" />
                <h3 className={cn("font-bold", t.text)}>Clinical Assessment</h3>
              </div>
              <div className="flex items-center gap-2">
                {clinicalAssessment.acuity_level && (
                  <span className={cn("text-xs font-black px-3 py-1.5 rounded-lg border",
                    clinicalAssessment.acuity_level === 'CRITICAL' ? "bg-rose-500/20 text-rose-400 border-rose-500/30" :
                    clinicalAssessment.acuity_level === 'SERIOUS' ? "bg-amber-500/20 text-amber-400 border-amber-500/30" :
                    clinicalAssessment.acuity_level === 'GUARDED' ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" :
                    "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                  )}>
                    {clinicalAssessment.acuity_level}
                  </span>
                )}
                {clinicalAssessment.disposition && (
                  <span className={cn("text-xs px-2.5 py-1 rounded-lg", t.bgTertiary, t.textMuted)}>
                    {safeString(clinicalAssessment.disposition)}
                  </span>
                )}
              </div>
            </div>
            <div className="p-4 space-y-3">
              {clinicalAssessment.summary_statement && (
                <p className={cn("text-sm leading-relaxed", t.text)}>{safeString(clinicalAssessment.summary_statement)}</p>
              )}
              {clinicalAssessment.follow_up_timeline && (
                <div className={cn("flex items-center gap-2 text-xs", t.textSecondary)}>
                  <Clock size={12} className="text-teal-400" />
                  <span>Follow-up: {safeString(clinicalAssessment.follow_up_timeline)}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Critical Lab Values Alert */}
        {criticalLabs.length > 0 && (
          <div className={cn("rounded-xl border-2 border-rose-500/30 overflow-hidden")}>
            <div className="p-4 bg-gradient-to-r from-rose-500/10 to-red-500/10 flex items-center gap-3">
              <AlertCircle size={20} className="text-rose-400" />
              <h3 className={cn("font-bold text-rose-400")}>Critical Lab Values ({criticalLabs.length})</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className={t.bgTertiary}>
                  <tr>
                    <th className={cn("px-4 py-2 text-left text-xs font-bold uppercase", t.textMuted)}>Test</th>
                    <th className={cn("px-4 py-2 text-left text-xs font-bold uppercase", t.textMuted)}>Value</th>
                    <th className={cn("px-4 py-2 text-left text-xs font-bold uppercase", t.textMuted)}>Units</th>
                    <th className={cn("px-4 py-2 text-left text-xs font-bold uppercase", t.textMuted)}>Action Needed</th>
                  </tr>
                </thead>
                <tbody className={cn("divide-y", t.border)}>
                  {criticalLabs.map((lab, idx) => (
                    <tr key={idx} className="bg-rose-500/5">
                      <td className={cn("px-4 py-2.5 font-bold text-sm text-rose-300")}>{safeString(lab.test)}</td>
                      <td className={cn("px-4 py-2.5 font-mono text-sm font-bold text-rose-400")}>{safeString(lab.value)}</td>
                      <td className={cn("px-4 py-2.5 text-xs", t.textMuted)}>{safeString(lab.units)}</td>
                      <td className={cn("px-4 py-2.5 text-xs", t.text)}>{safeString(lab.clinical_action_needed)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Key Lab Values */}
        {keyLabs.length > 0 && (
          <div className={cn("rounded-xl border overflow-hidden", t.card)}>
            <div className={cn("p-4 border-b flex items-center gap-3", t.border)}>
              <TestTube size={20} className="text-cyan-400" />
              <h3 className={cn("font-bold", t.text)}>Laboratory Results ({keyLabs.length})</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className={t.bgTertiary}>
                  <tr>
                    <th className={cn("px-4 py-2 text-left text-xs font-bold uppercase", t.textMuted)}>Test</th>
                    <th className={cn("px-4 py-2 text-left text-xs font-bold uppercase", t.textMuted)}>Value</th>
                    <th className={cn("px-4 py-2 text-left text-xs font-bold uppercase", t.textMuted)}>Units</th>
                    <th className={cn("px-4 py-2 text-left text-xs font-bold uppercase", t.textMuted)}>Status</th>
                    <th className={cn("px-4 py-2 text-left text-xs font-bold uppercase", t.textMuted)}>Interpretation</th>
                  </tr>
                </thead>
                <tbody className={cn("divide-y", t.border)}>
                  {keyLabs.map((lab, idx) => (
                    <tr key={idx} className={t.bgHover}>
                      <td className={cn("px-4 py-2.5 font-medium text-sm", t.text)}>{safeString(lab.test)}</td>
                      <td className={cn("px-4 py-2.5 font-mono text-sm", t.text)}>{safeString(lab.value)}</td>
                      <td className={cn("px-4 py-2.5 text-xs", t.textMuted)}>{safeString(lab.units)}</td>
                      <td className="px-4 py-2.5">
                        <span className={cn("text-xs px-2 py-0.5 rounded-full font-bold",
                          (lab.status || '').toLowerCase() === 'critical' ? "bg-rose-500/20 text-rose-400" :
                          (lab.status || '').toLowerCase() === 'abnormal' ? "bg-amber-500/20 text-amber-400" :
                          "bg-emerald-500/20 text-emerald-400"
                        )}>{safeString(lab.status)}</span>
                      </td>
                      <td className={cn("px-4 py-2.5 text-xs", t.textSecondary)}>{safeString(lab.interpretation)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Imaging Summary */}
        {imagingSummary.length > 0 && (
          <div className={cn("rounded-xl border overflow-hidden", t.card)}>
            <div className={cn("p-4 border-b flex items-center gap-3", t.border)}>
              <Eye size={20} className="text-purple-400" />
              <h3 className={cn("font-bold", t.text)}>Imaging Summary ({imagingSummary.length})</h3>
            </div>
            <div className="p-4 space-y-4">
              {imagingSummary.map((study, idx) => (
                <div key={idx} className={cn("p-4 rounded-lg border", t.bgTertiary, t.border)}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <Eye size={16} className="text-purple-400" />
                      <span className={cn("font-bold text-sm", t.text)}>{safeString(study.modality)} — {safeString(study.body_part)}</span>
                    </div>
                    {study.study_date && (
                      <span className={cn("text-xs", t.textMuted)}>{safeString(study.study_date)}</span>
                    )}
                  </div>
                  {safeArray(study.findings || []).length > 0 && (
                    <div className="ml-7 space-y-1 mb-2">
                      {safeArray(study.findings).map((finding, fi) => (
                        <div key={fi} className={cn("text-xs flex items-start gap-2", t.text)}>
                          <span className="text-purple-400 mt-0.5">•</span>
                          <span>{safeString(finding)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {study.impression && (
                    <div className={cn("text-xs mt-2 p-2 rounded border-l-2 border-l-purple-500/40", t.bgSecondary, t.textSecondary)}>
                      <strong className="text-purple-400">Impression:</strong> {safeString(study.impression)}
                    </div>
                  )}
                  {study.follow_up_recommendation && (
                    <div className={cn("text-xs mt-1", t.textMuted)}>
                      <strong className="text-green-400">Follow-up:</strong> {safeString(study.follow_up_recommendation)}
                    </div>
                  )}
                  {study.source_file && (
                    <div className={cn("text-[10px] mt-1 font-mono", t.textMuted)}>Source: {safeString(study.source_file)}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Problem List (V8.0 with ICD codes, severity, trajectory) */}
        {problems.length > 0 && problems[0] && typeof problems[0] === 'object' && problems[0].diagnosis && (
          <div className={cn("rounded-xl border overflow-hidden", t.card)}>
            <div className={cn("p-4 border-b flex items-center gap-3", t.border)}>
              <Heart size={20} className="text-rose-400" />
              <h3 className={cn("font-bold", t.text)}>Problem List ({problems.length})</h3>
            </div>
            <div className="p-4 space-y-3">
              {problems.map((prob, idx) => {
                const severityColor = (prob.severity || '').toLowerCase() === 'critical' ? 'bg-rose-500/20 text-rose-400 border-rose-500/20' :
                  (prob.severity || '').toLowerCase() === 'severe' ? 'bg-red-500/20 text-red-400 border-red-500/20' :
                  (prob.severity || '').toLowerCase() === 'moderate' ? 'bg-amber-500/20 text-amber-400 border-amber-500/20' :
                  'bg-emerald-500/20 text-emerald-400 border-emerald-500/20';
                const trajectoryIcon = (prob.trajectory || '').toLowerCase() === 'declining' ? TrendingUp :
                  (prob.trajectory || '').toLowerCase() === 'improving' ? TrendingUp : Activity;
                const trajectoryColor = (prob.trajectory || '').toLowerCase() === 'declining' ? 'text-rose-400' :
                  (prob.trajectory || '').toLowerCase() === 'improving' ? 'text-emerald-400' : 'text-amber-400';
                const TrajectoryIcon = trajectoryIcon;
                return (
                  <div key={idx} className={cn("p-3 rounded-lg flex items-center justify-between", t.bgTertiary)}>
                    <div className="flex items-start gap-3">
                      <Heart size={14} className="text-rose-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className={cn("font-medium text-sm", t.text)}>{safeString(prob.diagnosis)}</div>
                        <div className="flex items-center gap-2 mt-1">
                          {prob.icd10 && <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-500/20 text-slate-400">{safeString(prob.icd10)}</span>}
                          {prob.status && <span className={cn("text-[10px] px-1.5 py-0.5 rounded",
                            prob.status === 'Active' ? 'bg-amber-500/20 text-amber-400' :
                            prob.status === 'Resolved' ? 'bg-emerald-500/20 text-emerald-400' :
                            prob.status === 'Chronic' ? 'bg-blue-500/20 text-blue-400' :
                            'bg-slate-500/20 text-slate-400'
                          )}>{safeString(prob.status)}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {prob.severity && <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", severityColor)}>{safeString(prob.severity)}</span>}
                      {prob.trajectory && (
                        <span className={cn("flex items-center gap-1 text-[10px]", trajectoryColor)}>
                          <TrajectoryIcon size={10} />
                          {safeString(prob.trajectory)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Medications Grid (V8.0 current_regimen) */}
        {currentMeds.length > 0 && currentMeds[0] && typeof currentMeds[0] === 'object' && currentMeds[0].name && (
          <div className={cn("rounded-xl border overflow-hidden", t.card)}>
            <div className={cn("p-4 border-b flex items-center justify-between", t.border)}>
              <div className="flex items-center gap-3">
                <Pill size={20} className="text-violet-400" />
                <h3 className={cn("font-bold", t.text)}>Current Medications ({currentMeds.length})</h3>
              </div>
              {medsData.polypharmacy_flag && (
                <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                  <AlertTriangle size={12} /> Polypharmacy
                </span>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className={t.bgTertiary}>
                  <tr>
                    <th className={cn("px-4 py-2 text-left text-xs font-bold uppercase", t.textMuted)}>Medication</th>
                    <th className={cn("px-4 py-2 text-left text-xs font-bold uppercase", t.textMuted)}>Dose</th>
                    <th className={cn("px-4 py-2 text-left text-xs font-bold uppercase", t.textMuted)}>Frequency</th>
                    <th className={cn("px-4 py-2 text-left text-xs font-bold uppercase", t.textMuted)}>Route</th>
                    <th className={cn("px-4 py-2 text-left text-xs font-bold uppercase", t.textMuted)}>Indication</th>
                  </tr>
                </thead>
                <tbody className={cn("divide-y", t.border)}>
                  {currentMeds.map((med, idx) => (
                    <tr key={idx} className={t.bgHover}>
                      <td className={cn("px-4 py-2.5 font-bold text-sm text-violet-300")}>{safeString(med.name)}</td>
                      <td className={cn("px-4 py-2.5 font-mono text-sm", t.text)}>{safeString(med.dose)}</td>
                      <td className={cn("px-4 py-2.5 text-xs", t.textSecondary)}>{safeString(med.frequency)}</td>
                      <td className={cn("px-4 py-2.5 text-xs", t.textMuted)}>{safeString(med.route)}</td>
                      <td className={cn("px-4 py-2.5 text-xs", t.text)}>{safeString(med.indication)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {safeArray(medsData.medication_concerns || []).length > 0 && (
              <div className={cn("p-3 border-t bg-amber-500/5", t.border)}>
                <div className="flex items-center gap-2 mb-1.5">
                  <AlertTriangle size={12} className="text-amber-400" />
                  <span className="text-xs font-bold text-amber-400">Medication Concerns</span>
                </div>
                <div className="space-y-1">
                  {safeArray(medsData.medication_concerns).map((concern, idx) => (
                    <div key={idx} className={cn("text-xs flex items-start gap-1.5", t.text)}>
                      <span className="text-amber-400 mt-0.5">•</span>
                      <span>{safeString(concern)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Clinical Recommendations */}
        {(safeArray(clinicalRecs.immediate_actions || []).length > 0 || safeArray(clinicalRecs.follow_up_schedule || []).length > 0 || safeArray(clinicalRecs.diagnostic_recommendations || []).length > 0) && (
          <div className={cn("rounded-xl border overflow-hidden", t.card)}>
            <div className={cn("p-4 border-b flex items-center gap-3", t.border, 'bg-gradient-to-r from-green-500/5 to-emerald-500/5')}>
              <ClipboardList size={20} className="text-green-400" />
              <h3 className={cn("font-bold", t.text)}>Clinical Recommendations</h3>
            </div>
            <div className="p-4 space-y-4">
              {safeArray(clinicalRecs.immediate_actions || []).length > 0 && (
                <div>
                  <h5 className={cn("text-xs font-bold uppercase tracking-wider mb-2 text-rose-400 flex items-center gap-1")}><AlertCircle size={12} /> Immediate Actions</h5>
                  <div className="space-y-1.5">
                    {safeArray(clinicalRecs.immediate_actions).map((action, idx) => (
                      <div key={idx} className={cn("text-sm flex items-start gap-2 p-2 rounded-lg bg-rose-500/5 border border-rose-500/10", t.text)}>
                        <span className="text-rose-400 font-bold text-xs mt-0.5">{idx + 1}.</span>
                        <span>{safeString(action)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {safeArray(clinicalRecs.follow_up_schedule || []).length > 0 && (
                <div>
                  <h5 className={cn("text-xs font-bold uppercase tracking-wider mb-2 text-green-400 flex items-center gap-1")}><Calendar size={12} /> Follow-up Schedule</h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {safeArray(clinicalRecs.follow_up_schedule).map((fu, idx) => (
                      <div key={idx} className={cn("p-3 rounded-lg border", t.bgTertiary, t.border)}>
                        <div className={cn("font-medium text-sm", t.text)}>{safeString(fu.specialty)}</div>
                        <div className={cn("text-xs mt-1 text-green-400")}>{safeString(fu.timeframe)}</div>
                        <div className={cn("text-xs mt-0.5", t.textMuted)}>{safeString(fu.reason)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {safeArray(clinicalRecs.diagnostic_recommendations || []).length > 0 && (
                <div>
                  <h5 className={cn("text-xs font-bold uppercase tracking-wider mb-2 text-cyan-400 flex items-center gap-1")}><TestTube size={12} /> Diagnostic Recommendations</h5>
                  <div className="space-y-2">
                    {safeArray(clinicalRecs.diagnostic_recommendations).map((rec, idx) => (
                      <div key={idx} className={cn("p-3 rounded-lg border flex items-start justify-between", t.bgTertiary, t.border)}>
                        <div>
                          <div className={cn("font-medium text-sm", t.text)}>{safeString(rec.test)}</div>
                          <div className={cn("text-xs mt-0.5", t.textMuted)}>{safeString(rec.rationale)}</div>
                        </div>
                        {rec.urgency && (
                          <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ml-2",
                            (rec.urgency || '').toLowerCase().includes('stat') ? "bg-rose-500/20 text-rose-400" :
                            (rec.urgency || '').toLowerCase().includes('routine') ? "bg-blue-500/20 text-blue-400" :
                            "bg-emerald-500/20 text-emerald-400"
                          )}>{safeString(rec.urgency)}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Clinical Timeline */}
        {clinicalTimeline.length > 0 && (
          <div className={cn("rounded-xl border overflow-hidden", t.card)}>
            <div className={cn("p-4 border-b flex items-center gap-3", t.border)}>
              <Calendar size={20} className="text-blue-400" />
              <h3 className={cn("font-bold", t.text)}>Clinical Timeline ({clinicalTimeline.length})</h3>
            </div>
            <div className="p-4">
              <div className="relative">
                <div className={cn("absolute left-3 top-0 bottom-0 w-0.5", t.bgTertiary)} />
                <div className="space-y-4">
                  {clinicalTimeline.map((event, idx) => {
                    const typeColors = {
                      'LAB': 'bg-cyan-500/20 text-cyan-400',
                      'IMAGING': 'bg-purple-500/20 text-purple-400',
                      'MED': 'bg-violet-500/20 text-violet-400',
                      'DIAGNOSIS': 'bg-rose-500/20 text-rose-400',
                      'PROCEDURE': 'bg-indigo-500/20 text-indigo-400',
                      'SYMPTOM': 'bg-orange-500/20 text-orange-400',
                      'ADMISSION': 'bg-blue-500/20 text-blue-400',
                      'DISCHARGE': 'bg-emerald-500/20 text-emerald-400',
                    };
                    return (
                      <div key={idx} className="relative pl-10">
                        <div className={cn("absolute left-0 top-1 h-6 w-6 rounded-full flex items-center justify-center text-[8px] font-bold",
                          typeColors[event.event_type] || 'bg-slate-500/20 text-slate-400'
                        )}>
                          {(event.event_type || '?').slice(0, 2)}
                        </div>
                        <div className={cn("p-3 rounded-lg", t.bgTertiary)}>
                          <div className="flex items-center justify-between">
                            <span className={cn("text-sm font-medium", t.text)}>{safeString(event.finding)}</span>
                            {event.event_date && <span className={cn("text-[10px] font-mono", t.textMuted)}>{safeString(event.event_date)}</span>}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={cn("text-[10px] px-1.5 py-0.5 rounded", typeColors[event.event_type] || 'bg-slate-500/20 text-slate-400')}>
                              {safeString(event.event_type)}
                            </span>
                            {event.value && <span className={cn("text-xs font-mono", t.textSecondary)}>{safeString(event.value)}</span>}
                            {event.source_file && <span className={cn("text-[9px] font-mono", t.textMuted)}>{safeString(event.source_file)}</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Data Quality Scorecard */}
        {dataQuality.completeness_score !== undefined && (
          <div className={cn("rounded-xl border overflow-hidden", t.card)}>
            <div className={cn("p-4 border-b flex items-center justify-between", t.border)}>
              <div className="flex items-center gap-3">
                <ShieldCheck size={20} className="text-emerald-400" />
                <h3 className={cn("font-bold", t.text)}>Data Quality</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn("text-lg font-black",
                  dataQuality.completeness_score >= 0.8 ? "text-emerald-400" :
                  dataQuality.completeness_score >= 0.6 ? "text-amber-400" : "text-rose-400"
                )}>
                  {(dataQuality.completeness_score * 100).toFixed(0)}%
                </span>
                <span className={cn("text-xs", t.textMuted)}>completeness</span>
              </div>
            </div>
            <div className="p-4 space-y-3">
              <div className={cn("w-full h-2 rounded-full overflow-hidden", t.bgTertiary)}>
                <div className={cn("h-full rounded-full transition-all",
                  dataQuality.completeness_score >= 0.8 ? "bg-emerald-500" :
                  dataQuality.completeness_score >= 0.6 ? "bg-amber-500" : "bg-rose-500"
                )} style={{ width: `${Math.max(dataQuality.completeness_score * 100, 3)}%` }} />
              </div>
              <div className="flex flex-wrap gap-3">
                {dataQuality.imaging_data_present !== undefined && (
                  <span className={cn("text-xs flex items-center gap-1", dataQuality.imaging_data_present ? 'text-emerald-400' : 'text-slate-400')}>
                    {dataQuality.imaging_data_present ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                    Imaging Data
                  </span>
                )}
                {dataQuality.dicom_files_analyzed !== undefined && (
                  <span className={cn("text-xs", t.textMuted)}>{dataQuality.dicom_files_analyzed} DICOM analyzed</span>
                )}
              </div>
              {safeArray(dataQuality.gaps_identified || []).length > 0 && (
                <div>
                  <div className={cn("text-[10px] uppercase font-bold mb-1 text-amber-400")}>Gaps Identified</div>
                  <div className="space-y-1">
                    {safeArray(dataQuality.gaps_identified).map((gap, idx) => (
                      <div key={idx} className={cn("text-xs flex items-start gap-1.5", t.textSecondary)}>
                        <span className="text-amber-400 mt-0.5">•</span>
                        <span>{safeString(gap)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Integrated Source Documents */}
        {filesIntegrated.length > 0 && (
          <div className={cn("rounded-xl border overflow-hidden", t.card)}>
            <div className={cn("p-4 border-b flex items-center gap-3", t.border, 'bg-gradient-to-r from-cyan-500/5 to-blue-500/5')}>
              <div className="h-8 w-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                <FileBarChart size={18} className="text-cyan-400" />
              </div>
              <div>
                <h3 className={cn("font-bold", t.text)}>Integrated Source Documents</h3>
                <p className={cn("text-[10px]", t.textMuted)}>Files analyzed and synthesized into this narrative</p>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-cyan-500/10 text-cyan-400 font-bold border border-cyan-500/20 ml-auto">
                {filesIntegrated.length} {filesIntegrated.length === 1 ? 'file' : 'files'}
              </span>
            </div>
            <div className={cn("divide-y", t.border)}>
              {filesIntegrated.map((file, idx) => {
                const fname = typeof file === 'string' ? file : safeGet(file, 'filename') || 'Unknown';
                const docType = safeGet(file, 'document_type') || '';
                const contrib = safeGet(file, 'key_contribution') || '';
                const fdate = safeGet(file, 'date') || '';
                const dtLower = docType.toLowerCase();
                // Flexible doc-type color: detect keywords in free-text doc type
                const getDocColor = () => {
                  if (dtLower.includes('imaging') || dtLower.includes('radiology') || dtLower.includes('scan')) return { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/20', icon: Eye };
                  if (dtLower.includes('lab') || dtLower.includes('test') || dtLower.includes('result')) return { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/20', icon: TestTube };
                  if (dtLower.includes('clinical') || dtLower.includes('medical') || dtLower.includes('record')) return { bg: 'bg-teal-500/10', text: 'text-teal-400', border: 'border-teal-500/20', icon: Stethoscope };
                  if (dtLower.includes('discharge') || dtLower.includes('summary')) return { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20', icon: FileCheck };
                  if (dtLower.includes('prescription') || dtLower.includes('medication')) return { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20', icon: Pill };
                  if (dtLower.includes('invalid') || dtLower.includes('error')) return { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/20', icon: AlertTriangle };
                  if (dtLower.includes('genomic') || dtLower.includes('genetic')) return { bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/20', icon: Code };
                  return { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/20', icon: FileText };
                };
                const dc = getDocColor();
                const DocIcon = dc.icon;
                
                return (
                  <div key={idx} className={cn("p-4 flex items-start gap-4 transition-all", t.bgHover)}>
                    <div className={cn("p-2.5 rounded-xl flex-shrink-0 mt-0.5 border", dc.bg, dc.border)}>
                      <DocIcon size={20} className={dc.text} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={cn("font-bold text-sm", t.text)}>{safeString(fname)}</span>
                        {fdate && (
                          <span className={cn("text-[10px] px-2 py-0.5 rounded-lg flex items-center gap-1", t.bgTertiary, t.textMuted)}>
                            <CalendarDays size={10} /> {safeString(fdate)}
                          </span>
                        )}
                      </div>
                      {docType && (
                        <div className={cn("text-xs px-2.5 py-1 rounded-lg font-medium inline-flex items-center gap-1.5 mb-1.5 border", dc.bg, dc.text, dc.border)}>
                          <DocIcon size={12} />
                          {safeString(docType)}
                        </div>
                      )}
                      {contrib && (
                        <p className={cn("text-xs leading-relaxed mt-1", t.textSecondary)}>{safeString(contrib)}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        
        {/* Key Findings */}
        {findings.length > 0 && (
          <div className={cn("rounded-xl border", t.card)}>
            <div className={cn("p-4 border-b flex items-center gap-3", t.border)}>
              <CheckCircle2 size={20} className="text-emerald-400" />
              <h3 className={cn("font-bold", t.text)}>Key Findings ({findings.length})</h3>
            </div>
            <div className="p-4 space-y-3">
              {findings.map((finding, idx) => (
                <div key={idx} className={cn("flex items-start gap-3 p-3 rounded-lg", t.bgTertiary)}>
                  <CheckCircle2 className="text-emerald-500 flex-shrink-0 mt-0.5" size={18} />
                  <p className={t.text}>{safeString(finding)}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Active Problems / Diagnoses */}
        <DiagnosticCodes narrative={narrative} theme={theme} />
        
        {/* Risk Assessment (from real data) */}
        {Object.keys(risks).length > 0 && (
          <div className={cn("rounded-xl border overflow-hidden", t.card)}>
            <div className={cn("p-4 border-b flex items-center gap-3", t.border)}>
              <AlertTriangle size={20} className="text-amber-400" />
              <h3 className={cn("font-bold", t.text)}>Risk Assessment</h3>
            </div>
            <div className="p-4">
              {renderValue(risks)}
            </div>
          </div>
        )}
        
        {/* Care Plan */}
        <CarePlanSection narrative={narrative} theme={theme} />
        
        {/* Clinical Notes */}
        <ClinicalNotesViewer narrative={narrative} theme={theme} />
      </div>
    );
  };

  // Render timeline
  const renderTimeline = () => {
    const timeline = safeArray(
      safeGet(narrative, 'encounter_timeline') ||
      safeGet(narrative, 'encounters') ||
      safeGet(narrative, 'timeline') ||
      safeGet(narrative, 'visits') || []
    );
    
    if (timeline.length === 0) {
      return <EmptyState icon={Calendar} title="No Timeline Data" description="Encounter timeline not available" theme={theme} />;
    }
    
    return (
      <div className="relative">
        <div className={cn("absolute left-6 top-0 bottom-0 w-0.5", t.bgTertiary)} />
        <div className="space-y-6">
          {timeline.map((enc, idx) => {
            const encType = safeGet(enc, 'type') || safeGet(enc, 'encounter_type') || 'Encounter';
            const encDate = safeGet(enc, 'date') || safeGet(enc, 'encounter_date') || safeGet(enc, 'timestamp');
            const encSummary = safeGet(enc, 'summary') || safeGet(enc, 'description') || safeGet(enc, 'notes');
            const encProvider = safeGet(enc, 'provider') || safeGet(enc, 'physician') || '';
            const encLocation = safeGet(enc, 'location') || safeGet(enc, 'facility') || '';
            
            return (
              <div key={idx} className="relative pl-16">
                <div className="absolute left-0 top-2 h-12 w-12 bg-teal-600 rounded-full flex items-center justify-center border-4" style={{ borderColor: theme === 'dark' ? '#0f172a' : '#f9fafb' }}>
                  <Calendar size={20} className="text-white" />
                </div>
                <div className={cn("rounded-xl border p-6", t.card)}>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className={cn("text-lg font-bold", t.text)}>{safeString(encType)}</h4>
                    <span className={cn("text-sm font-mono", t.textSecondary)}>{safeFormat(encDate)}</span>
                  </div>
                  {encSummary && <p className={cn("mb-2", t.text)}>{safeString(encSummary)}</p>}
                  <div className="flex gap-4">
                    {encProvider && (
                      <span className={cn("text-xs flex items-center gap-1", t.textMuted)}>
                        <User size={12} /> {safeString(encProvider)}
                      </span>
                    )}
                    {encLocation && (
                      <span className={cn("text-xs flex items-center gap-1", t.textMuted)}>
                        <Building size={12} /> {safeString(encLocation)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Render patient files tab (integrated file preview)
  const renderPatientFiles = () => {
    const allFiles = [
      ...(caseData?.rawFiles || []).map(f => ({ ...f, source: 'Upload', bucket: CONFIG.buckets.RAW, key: f.key || `${caseData.id}/${f.name}` })),
      ...Object.values(caseData?.files || {}).map(f => ({ ...f, source: 'Processed', bucket: CONFIG.buckets.CURATED, key: f.key || '' }))
    ];
    
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* File list */}
          <div className={cn("rounded-xl border overflow-hidden", t.card)}>
            <div className={cn("p-4 border-b flex items-center gap-3", t.border)}>
              <FolderOpen size={20} className="text-teal-400" />
              <h3 className={cn("font-bold", t.text)}>Patient Files</h3>
              <span className={cn("text-xs px-2 py-0.5 rounded-full", t.bgTertiary, t.textMuted)}>
                {allFiles.length} files
              </span>
            </div>
            
            <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
              {allFiles.length === 0 ? (
                <div className={cn("p-8 text-center", t.textMuted)}>No files found</div>
              ) : (
                <div className={cn("divide-y", t.border)}>
                  {allFiles.map((file, idx) => {
                    const ext = (file.name || '').split('.').pop()?.toLowerCase();
                    const isSelected = selectedFile?.name === file.name;
                    return (
                      <button
                        key={idx}
                        onClick={() => loadFileContent(file)}
                        className={cn(
                          "w-full text-left p-4 flex items-center gap-3 transition-all",
                          isSelected ? "bg-teal-500/10 border-l-4 border-l-teal-500" : t.bgHover
                        )}
                      >
                        <FileText size={18} className="text-teal-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className={cn("font-medium truncate text-sm", t.text)}>{file.name || 'Unknown'}</div>
                          <div className="flex gap-3 mt-1">
                            <span className={cn("text-xs", t.textMuted)}>{formatBytes(file.size)}</span>
                            <span className={cn("text-xs px-2 py-0 rounded", t.bgTertiary, t.textMuted)}>{file.source}</span>
                            {ext && <span className={cn("text-xs font-mono", t.textMuted)}>.{ext}</span>}
                          </div>
                        </div>
                        <ChevronRight size={16} className={t.textMuted} />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          
          {/* File Preview */}
          <div className={cn("rounded-xl border overflow-hidden", t.card)}>
            <div className={cn("p-4 border-b flex items-center gap-3", t.border)}>
              <Eye size={18} className="text-teal-400" />
              <h3 className={cn("font-bold", t.text)}>
                {selectedFile ? selectedFile.name : 'File Preview'}
              </h3>
            </div>
            
            <div className="h-[500px] overflow-auto custom-scrollbar">
              {!selectedFile ? (
                <EmptyState icon={FileText} title="Select a file" description="Click on a file to preview its contents" theme={theme} />
              ) : loadingContent ? (
                <div className="flex items-center justify-center h-full"><Spinner size="lg" /></div>
              ) : fileContent?.type === 'error' ? (
                <div className="p-6 text-center text-rose-500">
                  <AlertCircle className="mx-auto mb-4" size={48} />
                  <p>{fileContent.data}</p>
                </div>
              ) : fileContent?.type === 'json' ? (
                <div className="p-4">
                  <pre className={cn("text-xs font-mono whitespace-pre-wrap", t.text)}>
                    {typeof fileContent.data === 'string' ? fileContent.data : JSON.stringify(fileContent.data, null, 2)}
                  </pre>
                </div>
              ) : (
                <div className="p-4">
                  <pre className={cn("text-sm whitespace-pre-wrap", t.text)}>
                    {fileContent?.data || 'No content'}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Also show raw bucket browser if s3Client exists */}
        {s3Client && caseData?.id && (
          <div>
            <h3 className={cn("font-bold mb-3 flex items-center gap-2", t.text)}>
              <Database size={18} className="text-teal-400" />
              Browse Processed Outputs
            </h3>
            <FileBrowser
              s3Client={s3Client}
              bucketName={CONFIG.buckets.CURATED}
              prefix={`cases/${caseData.id}/`}
              onFileSelect={loadFileContent}
              theme={theme}
            />
          </div>
        )}
      </div>
    );
  };

  const metadata = safeGet(narrative, 'metadata', {});

  return (
    <div className="space-y-6">
      {/* Header with Medical Branding */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className={cn("p-2 rounded-lg", t.bgTertiary, t.bgHover)}>
            <ArrowLeft size={20} className={t.textSecondary} />
          </button>
          {isPinnacleCase ? (
            <div className="h-12 w-12 rounded-xl bg-sky-500/15 border border-sky-500/25 flex items-center justify-center">
              <LineChart size={22} className="text-sky-300" />
            </div>
          ) : isCompassCase ? (
            <div className="h-12 w-12 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
              <Target size={22} className="text-emerald-300" />
            </div>
          ) : (
            <StethoscopePulse />
          )}
          <div>
            <div className="flex items-baseline gap-3">
              <h1 className={cn("text-2xl font-bold", t.text)}>
                {caseData?.patientNumber ? `Patient ${caseData.patientNumber}` : (caseData?.folderName || caseData?.id || 'Patient')}
              </h1>
              {caseData?.folderName && (
                <span className={cn("text-[10px] font-mono opacity-40", t.textMuted)} title={caseData.folderName}>{caseData.folderName}</span>
              )}
            </div>
            {(() => {
              const pName = safeGet(narrative, 'patient_profile.patient_name') || safeGet(narrative, 'patient_info.name') || safeGet(narrative, 'patient.name') || '';
              const pAge = safeGet(narrative, 'patient_profile.age') || safeGet(narrative, 'patient_info.age') || '';
              if (isPinnacleCase) {
                return <p className={cn("text-sm", t.textSecondary)}>{pinnacleDiseaseName} {pinnacleDiseaseId !== 'N/A' ? `• ${pinnacleDiseaseId}` : ''}</p>;
              }
              if (isCompassCase) {
                return <p className={cn("text-sm", t.textSecondary)}>{compassCancerName} {compassCancerType !== 'N/A' ? `• ${compassCancerType}` : ''}</p>;
              }
              return pName ? <p className={cn("text-sm", t.textSecondary)}>{pName} {pAge ? `• Age ${pAge}` : ''}</p> : null;
            })()}
            <p className={cn("text-xs", t.textMuted)}>
              {isPinnacleCase
                ? `Target discovery case - ${(caseData?.rawFiles?.length || 0)} source files`
                : isCompassCase
                ? `Immunotherapy analysis case - ${(caseData?.rawFiles?.length || 0)} source files`
                : `${completedTrackedAgents}/${trackedAgents.length} pipeline stages • ${(caseData?.rawFiles?.length || 0)} source files`}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Pipeline Type Tag */}
          {isPinnacleCase && (
            <span className="px-3 py-1.5 bg-gradient-to-r from-sky-500/20 to-cyan-500/20 text-sky-300 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 border border-sky-500/30 shadow-lg shadow-sky-500/10">
              <LineChart size={14} />
              Target Discovery Pipeline
            </span>
          )}
          {isCompassCase && (
            <span className="px-3 py-1.5 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-300 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 border border-emerald-500/30 shadow-lg shadow-emerald-500/10">
              <Target size={14} />
              Immunotherapy Pipeline
            </span>
          )}
          {!isPinnacleCase && !isCompassCase && (
            <span className="px-3 py-1.5 bg-gradient-to-r from-teal-500/20 to-indigo-500/20 text-teal-300 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 border border-teal-500/30 shadow-lg shadow-teal-500/10">
              <Stethoscope size={14} />
              Clinical Pipeline
            </span>
          )}
          <MedicalShieldBadge label="HIPAA" theme={theme} />
          {narrative && (
            <button
              onClick={() => { try { navigator.clipboard.writeText(JSON.stringify(narrative, null, 2)); } catch {} }}
              className={cn("px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2", t.bgTertiary, t.text)}
            >
              <Copy size={14} />
              Copy JSON
            </button>
          )}
        </div>
      </div>
      
      {/* AI Agentic Platform Processing Banner */}
      {/* AI Agentic Platform banner — only for clinical pipeline cases, not COMPASS/PINNACLE */}
      {narrative && !isPinnacleCase && !isCompassCase && (
        <div className="relative overflow-hidden p-3 rounded-xl bg-gradient-to-r from-indigo-600/5 via-teal-600/5 to-cyan-600/5 border border-indigo-500/10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <BrainCircuit size={16} className="text-indigo-400" />
              <span className={cn("text-xs font-bold", t.textSecondary)}>AI Agentic Platform</span>
              {safeGet(narrative, 'generation_date') && (
                <span className={cn("text-[10px] font-mono", t.textMuted)}>{safeFormat(safeGet(narrative, 'generation_date'))}</span>
              )}
              {safeGet(narrative, 'summary_type') && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 font-mono">
                  {safeString(safeGet(narrative, 'summary_type')).replace(/_/g, ' ')}
                </span>
              )}
            </div>
            
            {/* Run Selection Dropdown */}
            {availableRuns.length > 0 && (
              <div className="flex items-center gap-2">
                <Activity size={14} className="text-indigo-400" />
                <span className={cn("text-xs font-medium", t.textSecondary)}>Agent Run:</span>
                <select
                  value={selectedRunId}
                  onChange={(e) => setSelectedRunId(e.target.value)}
                  className={cn("text-xs bg-transparent border rounded px-2 py-1 outline-none", t.text, t.border, t.bgHover)}
                >
                  <option value="latest">Latest Aggregated</option>
                  {availableRuns.map(runId => (
                    <option key={runId} value={runId}>
                      {runId.split('-').slice(-1)[0] || runId} ({safeFormat(caseData.runs[runId].timestamp, 'HH:mm:ss')})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Processing Pipeline Indicator */}
      {isProcessingPipeline && (
        <div className="relative overflow-hidden rounded-2xl border border-amber-500/20">
          <div className="absolute inset-0 bg-gradient-to-r from-amber-600/5 via-orange-600/5 to-rose-600/5" />
          <HeartbeatLine className="absolute inset-0 text-amber-500 opacity-10" />
          
          {/* Animated progress bar at top */}
          <div className="h-1 w-full bg-amber-500/10 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-amber-500 via-orange-400 to-amber-500 rounded-full animate-pulse" style={{ width: `${Math.max(10, (Object.keys(caseData?.agentOutputs || {}).length / CONFIG.agents.length) * 100)}%`, transition: 'width 1s ease' }} />
          </div>
          
          <div className="relative z-10 p-8">
            <div className="flex items-center gap-6">
              {/* Animated medical icon cluster */}
              <div className="relative flex-shrink-0">
                <div className="absolute inset-0 bg-amber-500/10 rounded-2xl animate-ping" style={{ animationDuration: '3s' }} />
                <div className="h-20 w-20 bg-gradient-to-br from-amber-600/20 to-orange-600/20 rounded-2xl flex items-center justify-center relative border border-amber-500/20">
                  <div className="absolute inset-2 border-2 border-dashed border-amber-500/20 rounded-xl animate-spin" style={{ animationDuration: '8s' }} />
                  <BrainCircuit size={36} className="text-amber-400 relative" />
                </div>
              </div>
              
              <div className="flex-1">
                <h3 className={cn("text-lg font-bold mb-1", t.text)}>
                  {isPinnacleCase ? 'Target Discovery Processing' : isCompassCase ? 'Immunotherapy Processing' : 'AI Agentic Pipeline Processing'}
                </h3>
                <p className={cn("text-sm mb-3", t.textSecondary)}>
                  {isPinnacleCase
                    ? `Your target discovery request is being processed.`
                    : isCompassCase
                    ? `Your immunotherapy analysis request is being processed.`
                    : `Your ${caseData?.rawFiles?.length || 0} patient files are being analyzed by ${trackedAgents.length} clinical pipeline agents.`}
                  {' '}Results will stream in automatically.
                </p>
                
                {/* Agent progress steps */}
                <div className="flex gap-1.5 mb-3">
                  {trackedAgents.map((agent, idx) => {
                    const done = !!(caseData?.agentOutputs || {})[agent.id];
                    const active = !done && idx === completedTrackedAgents;
                    return (
                      <div key={agent.id} className="flex-1 group relative">
                        <div className={cn("h-2 rounded-full transition-all duration-500", done ? "bg-emerald-500" : active ? "bg-amber-400 animate-pulse" : "bg-slate-700/50")} />
                        <div className={cn("absolute -bottom-5 left-1/2 -translate-x-1/2 text-[8px] font-bold uppercase whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity", done ? "text-emerald-400" : active ? "text-amber-400" : t.textMuted)}>
                          {agent.name.replace(' Agent', '')}
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                <div className="flex items-center gap-3 mt-5">
                  <Loader2 size={14} className="text-amber-400 animate-spin" />
                  <span className="text-xs text-amber-400 font-bold">
                    {completedTrackedAgents}/{trackedAgents.length} {(isPinnacleCase || isCompassCase) ? 'Discovery Stages Complete' : 'Pipeline Stages Complete'}
                  </span>
                  <span className={cn("text-xs", t.textMuted)}>&bull; Auto-refreshing every 5s</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Metadata Cards */}
      {(narrative || isPinnacleCase || isCompassCase) && (
        <div className={cn("grid gap-4", (isPinnacleCase || isCompassCase) ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-2 md:grid-cols-4')}>
          {[
            isPinnacleCase
              ? { label: 'Targets', value: pinnacleTargets.length, icon: Target, color: 'text-sky-400' }
              : isCompassCase
              ? { label: 'Response Rate', value: compassResponseRate != null ? `${compassResponseRate}%` : 'N/A', icon: Target, color: 'text-emerald-400' }
              : { label: 'Encounters', value: safeGet(metadata, 'total_encounters') || safeArray(safeGet(narrative, 'encounters') || safeGet(narrative, 'encounter_timeline') || []).length || safeGet(narrative, 'files_integrated.length') || '0', icon: Calendar, color: 'text-teal-400' },
            isPinnacleCase
              ? { label: 'Cell Contexts', value: pinnacleCellTypes.length, icon: Layers, color: 'text-indigo-400' }
              : isCompassCase
              ? { label: 'Patients', value: compassData.patients_analyzed || compassPredictions.length || 0, icon: Users, color: 'text-cyan-400' }
              : { label: 'Generated', value: safeFormat(safeGet(narrative, 'generation_date') || safeGet(metadata, 'generated_at'), 'MMM dd, HH:mm'), icon: Sparkles, color: 'text-teal-400' },
            isPinnacleCase
              ? { label: 'Embedding Points', value: pinnaclePoints.length, icon: Grid, color: 'text-cyan-400' }
              : isCompassCase
              ? { label: 'Cancer Type', value: compassCancerType, icon: TestTube, color: 'text-violet-400' }
              : { label: 'Time Span', value: safeGet(metadata, 'time_span') || 'N/A', icon: Clock, color: 'text-teal-400' },
            // Pipeline Stages — only for clinical pipeline cases
            ...(isPinnacleCase || isCompassCase ? [] : [{ label: 'Pipeline Stages', value: `${completedTrackedAgents}/${trackedAgents.length}`, icon: Cpu, color: 'text-teal-400' }])
          ].map((item, idx) => (
            <div key={idx} className={cn("p-4 rounded-xl border", t.card)}>
              <div className="flex items-center gap-2 mb-2">
                <item.icon size={16} className={item.color || 'text-teal-400'} />
                <span className={cn("text-xs uppercase", t.textMuted)}>{item.label}</span>
              </div>
              <div className={cn("text-xl font-bold", t.text)}>{item.value}</div>
            </div>
          ))}
        </div>
      )}
      
      {/* Tabs */}
      <div className={cn("flex gap-1 border-b pb-2 overflow-x-auto futuristic-tabbar", t.border)}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap text-sm futuristic-tab",
              activeTab === tab.id ? "bg-teal-600 text-white futuristic-tab-active" : cn(t.text, t.bgHover)
            )}
          >
            <tab.icon size={16} />
            <span>{tab.label}</span>
            {tab.badge && <span className={`h-2 w-2 rounded-full bg-${tab.badge}-400 animate-pulse`} />}
          </button>
        ))}
      </div>
      
      {/* Tab Content */}
      <div key={activeTab} className="min-h-[400px] tab-content-reveal">
        {activeTab === 'overview' && (isPinnacleCase ? renderPinnacleOverview() : isCompassCase ? renderCompassOverview() : renderClinicalOverview())}
        {activeTab === 'files' && <PipelineFileViewer caseData={caseData} s3Client={s3Client} theme={theme} />}
        {activeTab === 'compass' && <CompassPanel caseData={caseData} theme={theme} />}
        {activeTab === 'pinnacle' && <PinnaclePanel caseData={caseData} theme={theme} />}
        {activeTab === 'medications' && <MedicationsPanel caseData={caseData} narrative={narrative} s3Client={s3Client} theme={theme} onOpenEvidence={(ev) => { setEvidence(ev); }} />}
        {activeTab === 'madrigal' && <MadrigalPanel caseData={caseData} theme={theme} />}
        {activeTab === 'judge' && <JudgePanel caseData={caseData} activeRunData={activeRunData} theme={theme} />}
        {activeTab === 'export' && <PatientExportPanel narrative={narrative} caseData={caseData} s3Client={s3Client} theme={theme} />}
      </div>

      <EvidenceViewer open={!!evidence} evidence={evidence} caseId={caseData?.id} s3Client={s3Client} onClose={() => setEvidence(null)} />
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// COMPASS PANEL — Immunotherapy Prediction Results
// ═══════════════════════════════════════════════════════════════
const CompassPanel = ({ caseData, theme }) => {
  const t = getThemeClasses(theme || 'dark');
  const data = caseData?.compassPrediction || caseData?.dashboard?.compass_prediction;
  const scatterRef = useRef(null);
  const heatmapRef = useRef(null);
  const importanceRef = useRef(null);
  const [predictionPage, setPredictionPage] = useState(1);
  const [predictionPageSize, setPredictionPageSize] = useState(10);

  const downloadTextFile = (content, filename, mimeType) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadSvg = (ref, filename) => {
    const svg = ref.current?.outerHTML;
    if (!svg) return;
    downloadTextFile(svg, filename, 'image/svg+xml');
  };

  const blend = (a, b, amount) => a + (b - a) * amount;
  const divergingColor = (value, maxAbs) => {
    const clampMax = Math.max(Math.abs(maxAbs || 0), 1e-6);
    const normalized = Math.max(-1, Math.min(1, Number(value || 0) / clampMax));
    if (normalized >= 0) {
      const amount = normalized;
      const r = Math.round(blend(255, 239, amount));
      const g = Math.round(blend(255, 68, amount));
      const b = Math.round(blend(255, 68, amount));
      return `rgb(${r}, ${g}, ${b})`;
    }
    const amount = Math.abs(normalized);
    const r = Math.round(blend(59, 255, amount));
    const g = Math.round(blend(130, 255, amount));
    const b = Math.round(blend(246, 255, amount));
    return `rgb(${r}, ${g}, ${b})`;
  };

  if (!data) {
    return (
      <div className={cn("p-8 text-center rounded-xl border", t.card)}>
        <Target size={48} className="mx-auto text-slate-600 mb-4" />
        <h3 className={cn("text-lg font-bold mb-2", t.text)}>No Immunotherapy Results Available</h3>
        <p className={cn("text-sm max-w-md mx-auto", t.textMuted)}>
          Immunotherapy analysis has not been run for this case.
          Enable "Immunotherapy Analysis" when uploading and provide gene expression data (TSV/CSV) to get predictions.
        </p>
      </div>
    );
  }

  if (data.status === 'SKIPPED') {
    return (
      <div className={cn("p-8 text-center rounded-xl border", t.card)}>
        <Target size={48} className="mx-auto text-amber-500 mb-4" />
        <h3 className={cn("text-lg font-bold mb-2", t.text)}>Immunotherapy Analysis Skipped</h3>
        <p className={cn("text-sm max-w-md mx-auto", t.textMuted)}>{data.reason || 'No gene expression data was uploaded for this case.'}</p>
      </div>
    );
  }

  const predictions = safeArray(data.predictions || []);
  const predictionRows = safeArray(
    data.prediction_table || predictions.map((item) => ({
      index: item.patient_id,
      '$P_{NR}$': item.confidence_non_response,
      '$P_{R}$': item.confidence_response,
      predicted_response: item.predicted_response,
    }))
  );
  const preview = data.data_preview || {};
  const chartData = data.chart_data || {};
  const scatter = chartData.scatter || {};
  const heatmap = chartData.heatmap || {};
  const importance = chartData.concept_importance || {};
  const responders = predictions.filter((p) => p.predicted_response === 1);
  const nonResponders = predictions.filter((p) => p.predicted_response === 0);
  const responseRate = data.response_rate != null ? (Number(data.response_rate) * 100).toFixed(1) : 'N/A';
  const topBiomarkers = data.top_biomarkers || data.feature_extraction?.top_concepts || [];
  const previewColumns = safeArray(preview.columns || []);
  const previewRows = safeArray(preview.rows || []);

  const totalPredictionPages = Math.max(1, Math.ceil(predictionRows.length / predictionPageSize));
  const currentPredictionRows = predictionRows.slice((predictionPage - 1) * predictionPageSize, predictionPage * predictionPageSize);

  const stats = [
    { label: 'Response Rate', value: responseRate !== 'N/A' ? `${responseRate}%` : 'N/A', color: 'text-emerald-400' },
    { label: 'Patients Analyzed', value: data.patients_analyzed || predictions.length || 0, color: 'text-cyan-300' },
    { label: 'Responders', value: data.responder_count ?? responders.length, color: 'text-emerald-300' },
    { label: 'Non-Responders', value: data.non_responder_count ?? nonResponders.length, color: 'text-rose-400' },
  ];

  const scatterPoints = safeArray(scatter.points || []);
  const scatterPadding = { left: 56, right: 24, top: 24, bottom: 52 };
  const scatterWidth = 560;
  const scatterHeight = 420;
  const scatterInnerWidth = scatterWidth - scatterPadding.left - scatterPadding.right;
  const scatterInnerHeight = scatterHeight - scatterPadding.top - scatterPadding.bottom;
  const scatterXValues = scatterPoints.map((point) => Number(point.x || 0));
  const scatterYValues = scatterPoints.map((point) => Number(point.y || 0));
  const scatterXMin = scatterXValues.length ? Math.min(...scatterXValues) : 0;
  const scatterXMax = scatterXValues.length ? Math.max(...scatterXValues) : 1;
  const scatterYMin = scatterYValues.length ? Math.min(...scatterYValues) : 0;
  const scatterYMax = scatterYValues.length ? Math.max(...scatterYValues) : 1;
  const scatterScaleX = (value) => scatterPadding.left + ((Number(value || 0) - scatterXMin) / Math.max(scatterXMax - scatterXMin, 1e-6)) * scatterInnerWidth;
  const scatterScaleY = (value) => scatterPadding.top + scatterInnerHeight - ((Number(value || 0) - scatterYMin) / Math.max(scatterYMax - scatterYMin, 1e-6)) * scatterInnerHeight;

  const heatmapRows = safeArray(heatmap.rows || []);
  const heatmapColumns = safeArray(heatmap.columns || []);
  const heatmapMatrix = safeArray(heatmap.matrix || []);
  const heatmapMaxAbs = Math.max(
    1,
    ...heatmapMatrix.flat().map((value) => Math.abs(Number(value || 0)))
  );
  const heatmapCellSize = 14;
  const heatmapWidth = Math.max(860, heatmapColumns.length * heatmapCellSize + 240);
  const heatmapHeight = Math.max(280, heatmapRows.length * heatmapCellSize + 130);
  const heatmapSplitIndex = Math.max(0, Number(heatmap.responder_count || 0));

  const importanceItems = safeArray(importance.items || topBiomarkers || []).map((item) => ({
    concept: item.concept || item.name,
    r: Number(item.importance_to_r ?? item.mean_score ?? item.score ?? 0),
    nr: Number(item.importance_to_nr ?? 0),
    direction: item.direction || (Number(item.importance_to_r ?? item.mean_score ?? item.score ?? 0) >= 0 ? 'R' : 'NR'),
  }));
  const importanceMax = Math.max(1, ...importanceItems.map((item) => Math.max(Math.abs(item.r), Math.abs(item.nr))));
  const importanceWidth = 980;
  const importanceHeight = Math.max(280, importanceItems.length * 14 + 120);

  const maxPreviewColumns = previewColumns.length > 0 ? previewColumns : ['index'];

  const csvRows = [
    ['index', '$P_{NR}$', '$P_{R}$', 'predicted_response', 'response_label'],
    ...predictionRows.map((row) => [
      row.index,
      row['$P_{NR}$'],
      row['$P_{R}$'],
      row.predicted_response,
      row.response_label || '',
    ]),
  ];
  const csvContent = csvRows
    .map((row) => row.map((value) => `"${String(value ?? '')}"`).join(','))
    .join('\n');

  return (
    <div className="space-y-6">
      <div className={cn("rounded-xl border p-6", t.card)}>
        <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Target size={18} className="text-emerald-300" />
              <span className="text-xs uppercase tracking-wider text-emerald-300 font-bold">Immunotherapy Prediction</span>
            </div>
            <h3 className={cn("text-2xl font-black", t.text)}>Immunotherapy Prediction</h3>
            <p className={cn("text-sm mt-2 max-w-3xl", t.textSecondary)}>
              Important Notice: Predictions generated by COMPASS are based on curated transcriptionomic models and should be interpreted as research insights rather than clinical decisions.
            </p>
          </div>
          <span className={cn(
            "text-xs px-3 py-1 rounded-full font-bold border",
            data.status === 'SUCCESS' || predictions.length > 0
              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
              : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
          )}>
            {data.status || 'UNKNOWN'}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((item) => (
            <div key={item.label} className={cn("p-4 rounded-lg text-center border", t.bgTertiary, t.border)}>
              <div className={cn("text-2xl font-black", item.color)}>{item.value}</div>
              <div className={cn("text-xs mt-1", t.textMuted)}>{item.label}</div>
            </div>
          ))}
        </div>

        {data.cancer_type && (
          <div className={cn("mt-4 p-3 rounded-lg flex items-center gap-3", t.bgTertiary)}>
            <TestTube size={16} className="text-indigo-400" />
            <span className={cn("text-sm", t.text)}>
              <strong>Cancer Type:</strong> {data.cancer_type} — {data.cancer_name || 'Unknown'}
            </span>
          </div>
        )}

        {data.processing_time && (
          <div className={cn("mt-2 text-xs", t.textMuted)}>
            Processing time: {typeof data.processing_time === 'number' ? `${data.processing_time.toFixed(1)}s` : data.processing_time}
          </div>
        )}
      </div>

      <div className={cn("rounded-xl border overflow-hidden", t.card)}>
        <div className={cn("p-4 border-b flex items-center justify-between gap-3 flex-wrap", t.border)}>
          <div>
            <h4 className={cn("font-bold text-lg", t.text)}>Data Preview</h4>
            <p className={cn("text-xs mt-1", t.textMuted)}>Below is a preview of the patient transcriptomics data.</p>
          </div>
          <div className="text-xs px-3 py-1 rounded-full bg-slate-500/10 text-slate-300 border border-slate-500/20">
            {previewRows.length} rows previewed
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px]">
            <thead className={t.bgTertiary}>
              <tr>
                {maxPreviewColumns.map((column) => (
                  <th key={column} className={cn("px-4 py-2 text-left text-xs font-bold uppercase", t.textMuted)}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody className={cn("divide-y", t.border)}>
              {previewRows.map((row, idx) => (
                <tr key={idx} className={t.bgHover}>
                  {maxPreviewColumns.map((column) => (
                    <td key={column} className={cn(
                      "px-4 py-2.5 text-sm",
                      column === 'index' ? 'font-mono font-bold text-white' : 'font-mono',
                      t.text
                    )}>
                      {row[column] != null ? safeString(row[column]) : '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-6 items-start">
        <div className={cn("rounded-xl border p-6", t.card)}>
          <h4 className={cn("font-bold text-lg mb-1", t.text)}>Prediction Statistics</h4>
          <p className={cn("text-sm mb-5", t.textSecondary)}>
            Responders: {stats[2].value}, Non-responders: {stats[3].value}, Response Rate (R): {responseRate}%
          </p>
          <button
            onClick={() => downloadTextFile(csvContent, 'compass_prediction_results.csv', 'text/csv')}
            className="px-4 py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl transition-all flex items-center gap-2"
          >
            <Download size={16} />
            Download Prediction CSV
          </button>

          <div className="mt-6 rounded-xl border overflow-hidden bg-white text-slate-900 shadow-lg">
            <div className="p-4 border-b border-slate-200">
              <h5 className="text-lg font-black text-slate-900">Prediction Results</h5>
              <p className="text-sm text-slate-600 mt-1">Below is the prediction results:</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[360px]">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-500">Index</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-500">{'P(NR)'}</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-500">{'P(R)'}</th>
                  </tr>
                </thead>
                <tbody>
                  {currentPredictionRows.map((row, idx) => (
                    <tr key={`${row.index}-${idx}`} className="border-t border-slate-200">
                      <td className="px-4 py-3 text-sm font-mono font-bold text-slate-900">{safeString(row.index)}</td>
                      <td className="px-4 py-3 text-sm font-mono text-slate-900">{row['$P_{NR}$'] != null ? Number(row['$P_{NR}$']).toFixed(9) : '—'}</td>
                      <td className="px-4 py-3 text-sm font-mono text-slate-900">{row['$P_{R}$'] != null ? Number(row['$P_{R}$']).toFixed(9) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-slate-200 text-xs text-slate-600 flex-wrap">
              <div>
                {predictionRows.length ? `1 to ${Math.min(predictionPage * predictionPageSize, predictionRows.length)} of ${predictionRows.length}` : 'No prediction rows'}
              </div>
              <div className="flex items-center gap-2">
                <span>Page Size:</span>
                <select
                  value={predictionPageSize}
                  onChange={(e) => {
                    setPredictionPageSize(Number(e.target.value));
                    setPredictionPage(1);
                  }}
                  className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-slate-800"
                >
                  {[10, 25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
                </select>
                <button onClick={() => setPredictionPage((page) => Math.max(1, page - 1))} disabled={predictionPage <= 1} className="px-2 py-1 rounded border border-slate-300 disabled:opacity-40">&lt;</button>
                <span className="font-medium">Page {predictionPage} of {totalPredictionPages}</span>
                <button onClick={() => setPredictionPage((page) => Math.min(totalPredictionPages, page + 1))} disabled={predictionPage >= totalPredictionPages} className="px-2 py-1 rounded border border-slate-300 disabled:opacity-40">&gt;</button>
              </div>
            </div>
          </div>
        </div>

        <div className={cn("rounded-xl border p-6", t.card)}>
          <h4 className={cn("font-bold text-lg mb-4", t.text)}>Prediction Overview</h4>
          <div className="space-y-4">
            {predictionRows.slice(0, 10).map((row, idx) => {
              const pR = Number(row['$P_{R}$'] ?? 0);
              const pNR = Number(row['$P_{NR}$'] ?? 0);
              return (
                <div key={`${row.index}-${idx}`} className={cn("rounded-lg border p-3", t.bgTertiary, t.border)}>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div>
                      <div className={cn("text-sm font-bold", t.text)}>{safeString(row.index)}</div>
                      <div className={cn("text-[10px] uppercase tracking-wide", t.textMuted)}>Prediction row</div>
                    </div>
                    <span className={cn(
                      "text-[10px] px-2 py-1 rounded-full font-bold",
                      pR >= pNR ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                    )}>
                      {pR >= pNR ? 'RESPONDER' : 'NON-RESPONDER'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded bg-slate-900/40 border border-white/5">
                      <div className={cn("uppercase text-[10px]", t.textMuted)}>{'P(NR)'}</div>
                      <div className="font-mono text-slate-100">{Number.isFinite(pNR) ? pNR.toFixed(6) : '—'}</div>
                    </div>
                    <div className="p-2 rounded bg-slate-900/40 border border-white/5">
                      <div className={cn("uppercase text-[10px]", t.textMuted)}>{'P(R)'}</div>
                      <div className="font-mono text-slate-100">{Number.isFinite(pR) ? pR.toFixed(6) : '—'}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {scatterPoints.length > 0 && (
        <div className={cn("rounded-xl border overflow-hidden", t.card)}>
          <div className={cn("p-4 border-b flex items-center justify-between gap-3 flex-wrap", t.border)}>
            <div>
              <h4 className={cn("font-bold text-lg", t.text)}>Prediction Scatter</h4>
              <p className={cn("text-xs mt-1", t.textMuted)}>{scatter.x_concept || 'Concept 1'} vs {scatter.y_concept || 'Concept 2'}</p>
            </div>
            <button
              onClick={() => downloadSvg(scatterRef, 'compass_prediction_scatter.svg')}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl transition-all flex items-center gap-2"
            >
              <Download size={16} />
              Download SVG
            </button>
          </div>
          <div className="p-4 overflow-x-auto bg-white">
            <svg ref={scatterRef} viewBox={`0 0 ${scatterWidth} ${scatterHeight}`} className="w-full max-w-full h-auto" role="img" aria-label="Compass prediction scatter plot">
              <rect x="0" y="0" width={scatterWidth} height={scatterHeight} fill="#ffffff" />
              <line x1={scatterPadding.left} y1={scatterPadding.top + scatterInnerHeight} x2={scatterPadding.left + scatterInnerWidth} y2={scatterPadding.top + scatterInnerHeight} stroke="#cbd5e1" strokeWidth="1" />
              <line x1={scatterPadding.left} y1={scatterPadding.top} x2={scatterPadding.left} y2={scatterPadding.top + scatterInnerHeight} stroke="#cbd5e1" strokeWidth="1" />
              <text x={scatterWidth / 2} y={scatterHeight - 10} textAnchor="middle" fill="#334155" fontSize="12" fontWeight="700">
                {scatter.x_concept || 'Concept X'}
              </text>
              <text x="18" y={scatterHeight / 2} textAnchor="middle" fill="#334155" fontSize="12" fontWeight="700" transform={`rotate(-90 18 ${scatterHeight / 2})`}>
                {scatter.y_concept || 'Concept Y'}
              </text>
              <text x={scatterPadding.left} y="18" fill="#334155" fontSize="11" fontWeight="700">
                Predicted R probability
              </text>
              {scatterPoints.map((point, idx) => {
                const x = scatterScaleX(point.x);
                const y = scatterScaleY(point.y);
                const color = divergingColor(Number(point.response_probability || 0), 1);
                return (
                  <g key={`${point.patient_id}-${idx}`}>
                    <circle cx={x} cy={y} r={point.predicted_response === 1 ? 5.5 : 4.2} fill={color} fillOpacity="0.92" stroke="#ffffff" strokeWidth="1" />
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      )}

      {heatmapRows.length > 0 && (
        <div className={cn("rounded-xl border overflow-hidden", t.card)}>
          <div className={cn("p-4 border-b flex items-center justify-between gap-3 flex-wrap", t.border)}>
            <div>
              <h4 className={cn("font-bold text-lg", t.text)}>COMPASS Concept Score Heatmap</h4>
              <p className={cn("text-xs mt-1", t.textMuted)}>
                Pred. Responders (n={heatmap.responder_count || 0}) and Pred. Non-responders (n={heatmap.non_responder_count || 0})
              </p>
            </div>
            <button
              onClick={() => downloadSvg(heatmapRef, 'compass_concept_heatmap.svg')}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl transition-all flex items-center gap-2"
            >
              <Download size={16} />
              Download SVG
            </button>
          </div>
          <div className="p-4 overflow-x-auto bg-white">
            <svg ref={heatmapRef} viewBox={`0 0 ${heatmapWidth} ${heatmapHeight}`} className="h-auto" role="img" aria-label="Compass concept score heatmap" style={{ minWidth: `${heatmapWidth}px` }}>
              <rect x="0" y="0" width={heatmapWidth} height={heatmapHeight} fill="#ffffff" />
              <text x={heatmapWidth / 2} y="20" textAnchor="middle" fill="#1f2937" fontSize="13" fontWeight="700">
                COMPASS Concept Score Heatmap
              </text>
              <text x={heatmapWidth / 2} y="38" textAnchor="middle" fill="#4b5563" fontSize="11">
                Pred. Responders (n={heatmap.responder_count || 0})
              </text>
              <text x={heatmapWidth / 2 + 170} y="38" textAnchor="middle" fill="#4b5563" fontSize="11">
                Pred. Non-responders (n={heatmap.non_responder_count || 0})
              </text>
              <defs>
                <linearGradient id="compassHeatmapLegend" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#60a5fa" />
                  <stop offset="50%" stopColor="#ffffff" />
                  <stop offset="100%" stopColor="#ef4444" />
                </linearGradient>
              </defs>
              <rect x={heatmapWidth - 130} y="48" width="24" height="120" fill="url(#compassHeatmapLegend)" stroke="#94a3b8" strokeWidth="1" />
              <text x={heatmapWidth - 98} y="59" fill="#374151" fontSize="10">1</text>
              <text x={heatmapWidth - 98} y="110" fill="#374151" fontSize="10">0</text>
              <text x={heatmapWidth - 98} y="166" fill="#374151" fontSize="10">-1</text>
              <g transform={`translate(${150}, ${58})`}>
                {heatmapRows.map((rowName, rowIndex) => {
                  const rowValues = safeArray(heatmapMatrix[rowIndex] || []);
                  return (
                    <g key={rowName}>
                      <text x="-8" y={rowIndex * heatmapCellSize + 11} textAnchor="end" fill="#374151" fontSize="10" fontWeight="600">
                        {rowName}
                      </text>
                      {rowValues.map((value, columnIndex) => {
                        const x = columnIndex * heatmapCellSize;
                        const y = rowIndex * heatmapCellSize;
                        return (
                          <rect
                            key={`${rowName}-${columnIndex}`}
                            x={x}
                            y={y}
                            width={heatmapCellSize}
                            height={heatmapCellSize}
                            fill={divergingColor(value, heatmapMaxAbs)}
                            stroke="#f8fafc"
                            strokeWidth="0.5"
                          />
                        );
                      })}
                    </g>
                  );
                })}
                {heatmapSplitIndex > 0 && (
                  <line
                    x1={heatmapSplitIndex * heatmapCellSize}
                    y1="0"
                    x2={heatmapSplitIndex * heatmapCellSize}
                    y2={heatmapRows.length * heatmapCellSize}
                    stroke="#0f172a"
                    strokeDasharray="3 3"
                    strokeWidth="1"
                  />
                )}
                {heatmapColumns.map((columnName, columnIndex) => (
                  <text
                    key={columnName}
                    x={columnIndex * heatmapCellSize + heatmapCellSize / 2}
                    y={heatmapRows.length * heatmapCellSize + 14}
                    transform={`rotate(-90 ${columnIndex * heatmapCellSize + heatmapCellSize / 2} ${heatmapRows.length * heatmapCellSize + 14})`}
                    textAnchor="end"
                    fill="#374151"
                    fontSize="9"
                  >
                    {columnName}
                  </text>
                ))}
              </g>
            </svg>
          </div>
        </div>
      )}

      {importanceItems.length > 0 && (
        <div className={cn("rounded-xl border overflow-hidden", t.card)}>
          <div className={cn("p-4 border-b flex items-center justify-between gap-3 flex-wrap", t.border)}>
            <div>
              <h4 className={cn("font-bold text-lg", t.text)}>Compass Concept Importance</h4>
              <p className={cn("text-xs mt-1", t.textMuted)}>Blue indicates importance to responder prediction, red indicates importance to non-responder prediction.</p>
            </div>
            <button
              onClick={() => downloadSvg(importanceRef, 'compass_concept_importance.svg')}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl transition-all flex items-center gap-2"
            >
              <Download size={16} />
              Download SVG
            </button>
          </div>
          <div className="p-4 overflow-x-auto bg-white">
            <svg ref={importanceRef} viewBox={`0 0 ${importanceWidth} ${importanceHeight}`} className="h-auto" role="img" aria-label="Compass concept importance chart" style={{ minWidth: `${importanceWidth}px` }}>
              <rect x="0" y="0" width={importanceWidth} height={importanceHeight} fill="#ffffff" />
              <text x={importanceWidth / 2} y="22" textAnchor="middle" fill="#1f2937" fontSize="13" fontWeight="700">
                Compass Concept Importance
              </text>
              <g transform="translate(180, 44)">
                {importanceItems.map((item, idx) => {
                  const rowY = idx * 14;
                  const maxBarWidth = importanceWidth - 280;
                  const rWidth = Math.max(2, (Math.abs(item.r) / importanceMax) * (maxBarWidth / 2));
                  const nrWidth = Math.max(2, (Math.abs(item.nr) / importanceMax) * (maxBarWidth / 2));
                  return (
                    <g key={item.concept} transform={`translate(0, ${rowY})`}>
                      <text x="-12" y="10" textAnchor="end" fill="#374151" fontSize="10" fontWeight="600">
                        {item.concept}
                      </text>
                      <rect x="0" y="2" width={rWidth} height="8" fill="#2563eb" opacity="0.92" />
                      <rect x={maxBarWidth / 2} y="2" width={nrWidth} height="8" fill="#ef4444" opacity="0.92" />
                    </g>
                  );
                })}
              </g>
              <g transform="translate(180, 40)">
                <line x1="0" y1="0" x2="0" y2={importanceItems.length * 14 + 4} stroke="#cbd5e1" strokeWidth="1" />
                <line x1={importanceWidth - 280} y1="0" x2={importanceWidth - 280} y2={importanceItems.length * 14 + 4} stroke="#cbd5e1" strokeWidth="1" />
              </g>
              <g transform={`translate(${importanceWidth - 280}, 56)`}>
                <text x="0" y="0" fill="#2563eb" fontSize="11" fontWeight="700">Important to R prediction</text>
                <text x="0" y="18" fill="#ef4444" fontSize="11" fontWeight="700">Important to NR prediction</text>
              </g>
            </svg>
          </div>
        </div>
      )}

      {topBiomarkers.length > 0 && (
        <div className={cn("rounded-xl border overflow-hidden", t.card)}>
          <div className={cn("p-4 border-b flex items-center gap-2", t.border)}>
            <Brain size={16} className="text-indigo-400" />
            <h4 className={cn("font-bold", t.text)}>Top Biomarker Concepts</h4>
          </div>
          <div className="p-4 space-y-2">
            {topBiomarkers.map((b, idx) => (
              <div key={idx} className={cn("p-3 rounded-lg flex items-center justify-between", t.bgTertiary)}>
                <span className={cn("text-sm", t.text)}>{b.concept || b.name || `Concept ${idx + 1}`}</span>
                <span className="text-xs font-mono text-cyan-400">{b.mean_score != null ? b.mean_score.toFixed(4) : '—'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// PINNACLE PANEL — Context-Aware Target Discovery Results
// ═══════════════════════════════════════════════════════════════
const PinnaclePanel = ({ caseData, theme }) => {
  const t = getThemeClasses(theme || 'dark');
  const rawData = caseData?.pinnacleDiscovery || caseData?.dashboard?.pinnacle_discovery;

  const normalizeTargetRow = (row, idx = 0) => {
    if (!row || typeof row !== 'object') return null;
    const protein = safeString(row.protein || row.target || row.gene || row.name || `Target ${idx + 1}`);
    const score = Number(row.score ?? row.rank_score ?? row.probability ?? row.value ?? 0);
    const cellType = safeString(row.cell_type_context || row.cell_type || row.context || row.cell || 'Unknown cell context');
    const evidence = safeString(row.evidence || row.rationale || row.reason || row.description || '');
    const selectedByUser = Boolean(row.selected_by_user || row.user_selected || row.selected);
    return { protein, score, cell_type_context: cellType, evidence, selected_by_user: selectedByUser };
  };

  const normalizePoints = (sourcePoints, nominatedLookup = new Set()) => {
    if (!Array.isArray(sourcePoints)) return [];
    return sourcePoints
      .map((p, idx) => {
        if (!p || typeof p !== 'object') return null;
        const protein = safeString(p.protein || p.target || p.gene || p.label || `P${idx + 1}`);
        const x = Number(p.x ?? p.dim1 ?? p.umap_x ?? p.tsne_x ?? p.pca1 ?? 0);
        const y = Number(p.y ?? p.dim2 ?? p.umap_y ?? p.tsne_y ?? p.pca2 ?? 0);
        const score = Number(p.score ?? p.rank_score ?? p.value ?? 0);
        const cellType = safeString(p.cell_type_context || p.cell_type || p.context || p.cell || 'Unknown');
        const highlight = Boolean(p.highlight || nominatedLookup.has(protein));
        return {
          protein,
          x: Number.isFinite(x) ? x : 0,
          y: Number.isFinite(y) ? y : 0,
          score: Number.isFinite(score) ? score : 0,
          cell_type_context: cellType,
          highlight,
        };
      })
      .filter(Boolean);
  };

  const normalized = useMemo(() => {
    if (!rawData) return null;

    const source = rawData?.pinnacle_discovery && typeof rawData.pinnacle_discovery === 'object'
      ? rawData.pinnacle_discovery
      : rawData;

    const nominatedRaw = safeArray(
      source.nominated_targets || source.top_targets || source.targets || source.ranked_targets || source.target_ranking || []
    );
    const nominated = nominatedRaw.map((r, i) => normalizeTargetRow(r, i)).filter(Boolean);

    const nominatedLookup = new Set(nominated.map((n) => n.protein));

    let points = [];
    const embedding = source.embedding_plot || source.embedding || source.plot || source.figure || {};

    if (Array.isArray(embedding.points)) {
      points = normalizePoints(embedding.points, nominatedLookup);
    }

    if (points.length === 0 && Array.isArray(embedding.data) && embedding.data.length > 0) {
      const trace = embedding.data[0] || {};
      const xs = safeArray(trace.x || []);
      const ys = safeArray(trace.y || []);
      const labels = safeArray(trace.text || trace.hovertext || trace.labels || []);
      const cellTypes = safeArray(trace.customdata || []);
      const zipped = [];
      const n = Math.min(xs.length, ys.length);
      for (let i = 0; i < n; i++) {
        const cell = Array.isArray(cellTypes[i]) ? cellTypes[i][0] : cellTypes[i];
        zipped.push({
          protein: labels[i] || `P${i + 1}`,
          x: xs[i],
          y: ys[i],
          cell_type_context: safeString(cell || 'Unknown'),
          score: 0,
        });
      }
      points = normalizePoints(zipped, nominatedLookup);
    }

    if (points.length === 0 && nominated.length > 0) {
      points = nominated.slice(0, 40).map((n, idx) => ({
        protein: n.protein,
        x: idx,
        y: n.score,
        score: n.score,
        cell_type_context: n.cell_type_context,
        highlight: true,
      }));
    }

    return {
      status: source.status || 'SUCCESS',
      diseaseName: source.disease_name || source.disease || 'Unknown Disease',
      diseaseId: source.disease_id || source.ontology_id || 'N/A',
      title: safeString(embedding.title || source.plot_title || 'PINNACLE Embedding Landscape'),
      nominated,
      points,
      analyzedCellTypes: safeArray(source.analyzed_cell_types || source.cell_types || []),
      summary: source.summary || {},
      requestedTargets: safeArray(source.requested_targets || source.input_targets || []),
    };
  }, [rawData]);

  const [selectedCellType, setSelectedCellType] = useState('All');
  const [searchTarget, setSearchTarget] = useState('');

  const availableCellTypes = useMemo(() => {
    const cellSet = new Set();
    safeArray(normalized?.points || []).forEach((p) => {
      if (p.cell_type_context) cellSet.add(p.cell_type_context);
    });
    safeArray(normalized?.analyzedCellTypes || []).forEach((c) => {
      if (c) cellSet.add(c);
    });
    return ['All', ...Array.from(cellSet).sort((a, b) => a.localeCompare(b))];
  }, [normalized]);

  const filteredPoints = useMemo(() => {
    const pts = safeArray(normalized?.points || []);
    const query = (searchTarget || '').trim().toLowerCase();
    return pts.filter((p) => {
      const cellMatch = selectedCellType === 'All' || p.cell_type_context === selectedCellType;
      const targetMatch = !query || (p.protein || '').toLowerCase().includes(query);
      return cellMatch && targetMatch;
    });
  }, [normalized, selectedCellType, searchTarget]);

  const filteredNominated = useMemo(() => {
    const rows = safeArray(normalized?.nominated || []);
    const query = (searchTarget || '').trim().toLowerCase();
    return rows.filter((r) => {
      const cellMatch = selectedCellType === 'All' || r.cell_type_context === selectedCellType;
      const targetMatch = !query || (r.protein || '').toLowerCase().includes(query);
      return cellMatch && targetMatch;
    });
  }, [normalized, selectedCellType, searchTarget]);

  const maxScore = Math.max(...safeArray(filteredNominated).map((tg) => Number(tg.score || 0)), 1);

  if (!normalized) {
    return (
      <div className={cn("p-8 text-center rounded-xl border", t.card)}>
        <LineChart size={48} className="mx-auto text-slate-600 mb-4" />
        <h3 className={cn("text-lg font-bold mb-2", t.text)}>No Discovery Results Available</h3>
        <p className={cn("text-sm max-w-md mx-auto", t.textMuted)}>
          Target discovery has not been run for this case yet. Enable discovery in upload settings,
          provide a disease ID, and re-run pipeline processing.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className={cn("rounded-xl border p-6", t.card)}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-sky-500/20 rounded-xl flex items-center justify-center">
              <LineChart size={20} className="text-sky-400" />
            </div>
            <div>
              <h3 className={cn("font-bold text-lg", t.text)}>Target Discovery Results</h3>
              <p className={cn("text-xs", t.textMuted)}>Contextual target ranking and prioritization</p>
            </div>
          </div>
          <span className={cn("text-xs px-3 py-1 rounded-full font-bold",
            normalized.status === 'SUCCESS'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
          )}>{normalized.status || 'UNKNOWN'}</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className={cn("p-4 rounded-lg text-center", t.bgTertiary)}>
            <div className="text-2xl font-bold text-sky-400">{normalized.nominated.length}</div>
            <div className={cn("text-xs mt-1", t.textMuted)}>Nominated Targets</div>
          </div>
          <div className={cn("p-4 rounded-lg text-center", t.bgTertiary)}>
            <div className="text-2xl font-bold text-indigo-400">{normalized.analyzedCellTypes.length}</div>
            <div className={cn("text-xs mt-1", t.textMuted)}>Cell Contexts</div>
          </div>
          <div className={cn("p-4 rounded-lg text-center", t.bgTertiary)}>
            <div className="text-2xl font-bold text-emerald-400">{normalized.points.length}</div>
            <div className={cn("text-xs mt-1", t.textMuted)}>Embedding Points</div>
          </div>
          <div className={cn("p-4 rounded-lg text-center", t.bgTertiary)}>
            <div className="text-2xl font-bold text-amber-400">
              {safeGet(normalized, 'summary.max_score') != null ? Number(safeGet(normalized, 'summary.max_score')).toFixed(3) : 'N/A'}
            </div>
            <div className={cn("text-xs mt-1", t.textMuted)}>Top Score</div>
          </div>
        </div>

        <div className={cn("p-3 rounded-lg", t.bgTertiary)}>
          <div className={cn("text-sm", t.text)}>
            <strong>Disease:</strong> {normalized.diseaseName} ({normalized.diseaseId})
          </div>
          {normalized.requestedTargets.length > 0 && (
            <div className={cn("text-xs mt-1", t.textMuted)}>
              <strong>Requested targets:</strong> {normalized.requestedTargets.join(', ')}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
          <div className={cn("p-3 rounded-lg", t.bgTertiary)}>
            <label className={cn("text-[10px] uppercase font-bold tracking-wider", t.textMuted)}>Filter Cell Type</label>
            <select
              value={selectedCellType}
              onChange={(e) => setSelectedCellType(e.target.value)}
              className={cn("mt-1 w-full px-3 py-2 rounded-lg border outline-none", t.input)}
            >
              {availableCellTypes.map((ct) => (
                <option key={ct} value={ct}>{ct}</option>
              ))}
            </select>
          </div>
          <div className={cn("p-3 rounded-lg md:col-span-2", t.bgTertiary)}>
            <label className={cn("text-[10px] uppercase font-bold tracking-wider", t.textMuted)}>Search Target</label>
            <input
              type="text"
              value={searchTarget}
              onChange={(e) => setSearchTarget(e.target.value)}
              placeholder="e.g. IL6R, JAK3, TNF"
              className={cn("mt-1 w-full px-3 py-2 rounded-lg border outline-none", t.input)}
            />
          </div>
        </div>
      </div>

      {filteredPoints.length > 0 && (
        <div className={cn("rounded-xl border overflow-hidden", t.card)}>
          <div className={cn("p-4 border-b flex items-center gap-2", t.border)}>
            <Grid size={16} className="text-indigo-400" />
            <h4 className={cn("font-bold", t.text)}>{normalized.title || 'Embedding Landscape'}</h4>
            <span className={cn("ml-auto text-[10px] px-2 py-0.5 rounded-full", t.bgTertiary, t.textMuted)}>
              {filteredPoints.length} points shown
            </span>
          </div>
          <div className="p-4">
            <div style={{ width: '100%', height: 380 }}>
              <ResponsiveContainer>
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#334155' : '#e2e8f0'} />
                  <XAxis type="number" dataKey="x" name="X" tick={{ fill: theme === 'dark' ? '#94a3b8' : '#475569', fontSize: 11 }} />
                  <YAxis type="number" dataKey="y" name="Y" tick={{ fill: theme === 'dark' ? '#94a3b8' : '#475569', fontSize: 11 }} />
                  <ZAxis type="number" dataKey="score" range={[40, 260]} />
                  <RechartsTooltip
                    cursor={{ strokeDasharray: '3 3' }}
                    contentStyle={{
                      background: theme === 'dark' ? '#0f172a' : '#ffffff',
                      border: `1px solid ${theme === 'dark' ? '#334155' : '#e2e8f0'}`,
                      borderRadius: 10,
                      fontSize: 12,
                    }}
                    formatter={(value, name, payload) => {
                      if (name === 'score') {
                        return [Number(value || 0).toFixed(4), 'score'];
                      }
                      if (name === 'x' || name === 'y') {
                        return [Number(value || 0).toFixed(3), name];
                      }
                      return [String(value || ''), name];
                    }}
                    labelFormatter={(_, payload = []) => {
                      const row = payload[0]?.payload;
                      return row?.protein ? `Target: ${row.protein}` : '';
                    }}
                  />
                  <Scatter name="PINNACLE" data={filteredPoints} fill="#38bdf8" shape={(props) => {
                    const { cx, cy, payload } = props;
                    const highlighted = Boolean(payload?.highlight);
                    const radius = highlighted ? 6 : 4;
                    const fill = highlighted ? '#34d399' : '#38bdf8';
                    return <circle cx={cx} cy={cy} r={radius} fill={fill} fillOpacity={0.85} />;
                  }} />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {filteredNominated.length > 0 && (
        <div className={cn("rounded-xl border overflow-hidden", t.card)}>
          <div className={cn("p-4 border-b flex items-center gap-2", t.border)}>
            <Target size={16} className="text-sky-400" />
            <h4 className={cn("font-bold", t.text)}>Prioritized Targets</h4>
          </div>
          <div className="p-4 space-y-3">
            {filteredNominated.map((item, idx) => {
              const score = Number(item.score || 0);
              const w = `${Math.max(4, (score / maxScore) * 100)}%`;
              return (
                <div key={idx} className={cn("p-3 rounded-lg border", t.bgTertiary, t.border)}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className={cn("text-sm font-bold", t.text)}>{item.protein || `Target ${idx + 1}`}</div>
                      <div className={cn("text-xs", t.textMuted)}>{item.cell_type_context || 'Unknown cell context'}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-mono text-cyan-400">{score.toFixed(4)}</div>
                      {item.selected_by_user && (
                        <div className="text-[10px] text-emerald-400">User-selected</div>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-slate-700 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-sky-500 to-indigo-500" style={{ width: w }} />
                  </div>
                  {item.evidence && (
                    <div className={cn("mt-2 text-xs", t.textSecondary)}>{item.evidence}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// MADRIGAL PANEL — Drug-Drug Interaction Results v2.0
// ═══════════════════════════════════════════════════════════════
const MadrigalPanel = ({ caseData, theme }) => {
  const t = getThemeClasses(theme || 'dark');
  const data = caseData?.madrigalDDI || caseData?.dashboard?.madrigal_ddi;
  const [expandedPair, setExpandedPair] = useState(null);
  const [showAllPairs, setShowAllPairs] = useState(false);

  if (!data) {
    return (
      <div className={cn("p-8 text-center rounded-xl border", t.card)}>
        <Shield size={48} className="mx-auto text-slate-600 mb-4" />
        <h3 className={cn("text-lg font-bold mb-2", t.text)}>No Drug Interaction Results</h3>
        <p className={cn("text-sm max-w-md mx-auto", t.textMuted)}>
          Drug-drug interaction analysis was not found for this case. The analysis runs automatically when medication data is available.
        </p>
      </div>
    );
  }

  const interactions = data.interactions || [];
  const medications = data.medications_analyzed || data.medications || [];
  const polypharmacy = data.polypharmacy_assessment || data.polypharmacy || {};
  const overallRisk = data.overall_ddi_risk || 'LOW';
  const drugPairs = data.drug_pairs || [];
  const rankedPairs = data.ranked_pairs || [];
  const effectSummary = data.effect_summary || {};
  const clinicalSummary = data.clinical_summary || {};
  const medProfiles = data.medication_profiles || {};
  const pairsAnalyzed = polypharmacy.total_pairs_analyzed || drugPairs.length || 0;
  const modelSource = data.model_source || 'Madrigal DDI Engine';

  const criticalCount = data.critical_interactions || drugPairs.filter(p => p.risk_level === 'CRITICAL').length;
  const majorCount = data.major_interactions || drugPairs.filter(p => p.risk_level === 'MAJOR').length;
  const moderateCount = drugPairs.filter(p => p.risk_level === 'MODERATE').length;

  const highRiskFlags = clinicalSummary.high_risk_flags || [];
  const monitoringRequired = clinicalSummary.monitoring_required || [];
  const safeCombinations = clinicalSummary.safe_combinations || [];

  const riskColors = {
    'CRITICAL': { bg: 'bg-rose-500/15', border: 'border-rose-500/30', text: 'text-rose-400', bar: 'bg-rose-500' },
    'MAJOR': { bg: 'bg-orange-500/15', border: 'border-orange-500/30', text: 'text-orange-400', bar: 'bg-orange-500' },
    'MODERATE': { bg: 'bg-amber-500/15', border: 'border-amber-500/30', text: 'text-amber-400', bar: 'bg-amber-500' },
    'MINOR': { bg: 'bg-blue-500/15', border: 'border-blue-500/30', text: 'text-blue-400', bar: 'bg-blue-500' },
    'MINIMAL': { bg: 'bg-slate-500/15', border: 'border-slate-500/30', text: 'text-slate-400', bar: 'bg-slate-600' },
  };

  const overallRiskStyle = riskColors[overallRisk] || riskColors['MINIMAL'];

  const visiblePairs = showAllPairs ? drugPairs : drugPairs.slice(0, 8);

  return (
    <div className="space-y-5">

      {/* ═══ Header & Overall Risk ═══ */}
      <div className={cn("rounded-xl border p-6", t.card)}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 bg-rose-500/20 rounded-xl flex items-center justify-center">
              <Shield size={22} className="text-rose-400" />
            </div>
            <div>
              <h3 className={cn("font-bold text-lg", t.text)}>Drug-Drug Interaction Analysis</h3>
              <p className={cn("text-xs", t.textMuted)}>{modelSource}</p>
            </div>
          </div>
          <div className={cn("px-4 py-2 rounded-xl font-bold text-sm border", overallRiskStyle.bg, overallRiskStyle.border, overallRiskStyle.text)}>
            {overallRisk} RISK
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className={cn("p-3.5 rounded-lg text-center", t.bgTertiary)}>
            <div className="text-2xl font-bold text-teal-400">{medications.length || data.medication_count || 0}</div>
            <div className={cn("text-[10px] mt-1 uppercase tracking-wider", t.textMuted)}>Medications</div>
          </div>
          <div className={cn("p-3.5 rounded-lg text-center", t.bgTertiary)}>
            <div className="text-2xl font-bold text-violet-400">{pairsAnalyzed}</div>
            <div className={cn("text-[10px] mt-1 uppercase tracking-wider", t.textMuted)}>Pairs Analyzed</div>
          </div>
          <div className={cn("p-3.5 rounded-lg text-center", t.bgTertiary)}>
            <div className="text-2xl font-bold text-rose-400">{criticalCount}</div>
            <div className={cn("text-[10px] mt-1 uppercase tracking-wider", t.textMuted)}>Critical</div>
          </div>
          <div className={cn("p-3.5 rounded-lg text-center", t.bgTertiary)}>
            <div className="text-2xl font-bold text-orange-400">{majorCount}</div>
            <div className={cn("text-[10px] mt-1 uppercase tracking-wider", t.textMuted)}>Major</div>
          </div>
          <div className={cn("p-3.5 rounded-lg text-center", t.bgTertiary)}>
            <div className="text-2xl font-bold text-amber-400">{moderateCount}</div>
            <div className={cn("text-[10px] mt-1 uppercase tracking-wider", t.textMuted)}>Moderate</div>
          </div>
        </div>

        {/* Polypharmacy */}
        {polypharmacy.risk_level && (
          <div className={cn("mt-4 p-3.5 rounded-lg flex items-center gap-3 border",
            polypharmacy.risk_level === 'HIGH' ? 'bg-rose-500/10 border-rose-500/20' :
            polypharmacy.risk_level === 'MODERATE' ? 'bg-amber-500/10 border-amber-500/20' :
            'bg-emerald-500/10 border-emerald-500/20'
          )}>
            <AlertTriangle size={16} className={
              polypharmacy.risk_level === 'HIGH' ? 'text-rose-400' :
              polypharmacy.risk_level === 'MODERATE' ? 'text-amber-400' : 'text-emerald-400'
            } />
            <div>
              <span className={cn("text-sm font-bold", t.text)}>Polypharmacy: {polypharmacy.risk_level}</span>
              {polypharmacy.warning && <span className={cn("text-xs ml-2", t.textMuted)}>{polypharmacy.warning}</span>}
            </div>
          </div>
        )}
      </div>

      {/* ═══ Clinical Summary Triage ═══ */}
      {(highRiskFlags.length > 0 || monitoringRequired.length > 0 || safeCombinations.length > 0) && (
        <div className={cn("rounded-xl border overflow-hidden", t.card)}>
          <div className={cn("p-4 border-b flex items-center gap-2", t.border)}>
            <Stethoscope size={16} className="text-violet-400" />
            <h4 className={cn("font-bold", t.text)}>Clinical Summary</h4>
            <span className={cn("text-xs ml-auto", t.textMuted)}>Actionable triage for clinical review</span>
          </div>
          <div className="p-4 space-y-3">

            {/* High Risk */}
            {highRiskFlags.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-rose-500" />
                  <span className="text-xs font-bold uppercase tracking-wider text-rose-400">High Risk — Requires Clinical Review ({highRiskFlags.length})</span>
                </div>
                {highRiskFlags.map((flag, idx) => (
                  <div key={idx} className="ml-4 p-3 rounded-lg bg-rose-500/8 border border-rose-500/20">
                    <div className="flex items-center justify-between">
                      <span className={cn("text-sm font-bold", t.text)}>{flag.pair}</span>
                      <span className="text-xs font-mono font-bold text-rose-400">{(flag.risk_score || 0).toFixed(2)}</span>
                    </div>
                    <div className={cn("text-xs mt-1", t.textMuted)}>{flag.primary_concern}</div>
                    {flag.action && <div className="text-xs mt-1.5 text-rose-300 font-medium">{flag.action}</div>}
                    {(flag.monitoring || []).length > 0 && (
                      <div className="mt-2 space-y-1">
                        {flag.monitoring.map((m, mi) => (
                          <div key={mi} className="text-[11px] text-amber-300/80 flex items-start gap-1.5">
                            <Activity size={10} className="mt-0.5 shrink-0" />
                            <span>{m}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Monitoring Required */}
            {monitoringRequired.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Monitoring Required ({monitoringRequired.length})</span>
                </div>
                {monitoringRequired.map((item, idx) => (
                  <div key={idx} className="ml-4 p-3 rounded-lg bg-amber-500/8 border border-amber-500/20">
                    <div className="flex items-center justify-between">
                      <span className={cn("text-sm font-medium", t.text)}>{item.pair}</span>
                      <span className="text-xs font-mono font-bold text-amber-400">{(item.risk_score || 0).toFixed(2)}</span>
                    </div>
                    <div className={cn("text-xs mt-1", t.textMuted)}>{item.primary_concern}</div>
                    {(item.monitoring || []).length > 0 && (
                      <div className="mt-2 space-y-1">
                        {item.monitoring.map((m, mi) => (
                          <div key={mi} className="text-[11px] text-amber-300/70 flex items-start gap-1.5">
                            <Activity size={10} className="mt-0.5 shrink-0" />
                            <span>{m}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Safe Combinations */}
            {safeCombinations.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Safe Combinations ({safeCombinations.length})</span>
                </div>
                <div className="ml-4 flex flex-wrap gap-2">
                  {safeCombinations.map((item, idx) => (
                    <span key={idx} className="px-3 py-1.5 rounded-lg text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-medium">
                      {item.pair} <span className="font-mono ml-1 opacity-60">{(item.risk_score || 0).toFixed(2)}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ Effect Summary ═══ */}
      {Object.keys(effectSummary).length > 0 && (
        <div className={cn("rounded-xl border overflow-hidden", t.card)}>
          <div className={cn("p-4 border-b flex items-center gap-2", t.border)}>
            <Activity size={16} className="text-cyan-400" />
            <h4 className={cn("font-bold", t.text)}>Adverse Effect Profile</h4>
            <span className={cn("text-xs ml-auto", t.textMuted)}>Peak scores across all drug pairs</span>
          </div>
          <div className="p-4 space-y-2.5">
            {Object.entries(effectSummary).map(([effect, score]) => {
              const pct = Math.round(score * 100);
              const barColor = score >= 0.7 ? 'bg-rose-500' : score >= 0.4 ? 'bg-orange-500' : score >= 0.2 ? 'bg-amber-500' : 'bg-blue-500';
              const label = effect.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
              return (
                <div key={effect} className="flex items-center gap-3">
                  <div className={cn("w-40 text-xs font-medium truncate", t.text)}>{label}</div>
                  <div className={cn("flex-1 h-5 rounded-full overflow-hidden", t.bgTertiary)}>
                    <div className={cn("h-full rounded-full transition-all duration-700", barColor)}
                         style={{ width: `${Math.max(pct, 3)}%` }} />
                  </div>
                  <div className="w-12 text-right text-xs font-mono font-bold" style={{
                    color: score >= 0.7 ? '#f43f5e' : score >= 0.4 ? '#f97316' : score >= 0.2 ? '#f59e0b' : '#3b82f6'
                  }}>{score.toFixed(2)}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ Ranked Drug Pairs ═══ */}
      {drugPairs.length > 0 && (
        <div className={cn("rounded-xl border overflow-hidden", t.card)}>
          <div className={cn("p-4 border-b flex items-center gap-2", t.border)}>
            <BarChart3 size={16} className="text-rose-400" />
            <h4 className={cn("font-bold", t.text)}>Pairwise Risk Analysis ({drugPairs.length} pairs)</h4>
          </div>
          <div className="divide-y" style={{ borderColor: 'rgba(100,116,139,0.15)' }}>
            {visiblePairs.map((pair, idx) => {
              const rc = riskColors[pair.risk_level] || riskColors['MINIMAL'];
              const isExpanded = expandedPair === idx;
              const pct = Math.round((pair.risk_score || 0) * 100);
              const topEffects = pair.top_effects || [];
              const monitoring = pair.monitoring || [];
              const sources = pair.sources || [];

              return (
                <div key={idx} className="group">
                  {/* Pair row */}
                  <div className={cn("px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-white/[0.02] transition-colors",
                    isExpanded && 'bg-white/[0.03]'
                  )} onClick={() => setExpandedPair(isExpanded ? null : idx)}>
                    {/* Risk score bar */}
                    <div className="w-14 text-right">
                      <span className={cn("text-sm font-mono font-bold", rc.text)}>{(pair.risk_score || 0).toFixed(2)}</span>
                    </div>

                    {/* Mini bar */}
                    <div className={cn("w-20 h-2 rounded-full overflow-hidden", t.bgTertiary)}>
                      <div className={cn("h-full rounded-full", rc.bar)} style={{ width: `${Math.max(pct, 2)}%` }} />
                    </div>

                    {/* Severity badge */}
                    <span className={cn("text-[10px] px-2 py-0.5 rounded font-bold border shrink-0", rc.bg, rc.border, rc.text)}>
                      {pair.risk_level || 'MINIMAL'}
                    </span>

                    {/* Drug names */}
                    <span className={cn("text-sm font-medium flex-1", t.text)}>
                      {pair.drug_a || (pair.pair || [])[0]} <span className={cn("mx-1", t.textMuted)}>+</span> {pair.drug_b || (pair.pair || [])[1]}
                    </span>

                    {/* Top effect */}
                    {topEffects.length > 0 && (
                      <span className={cn("text-[11px] hidden md:inline", t.textMuted)}>
                        {topEffects[0].effect_name || topEffects[0].effect}
                      </span>
                    )}

                    <ChevronDown size={14} className={cn("transition-transform", t.textMuted, isExpanded && 'rotate-180')} />
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className={cn("px-4 pb-4 pt-1 ml-14 space-y-3 border-l-2", rc.border)}>
                      {/* Mechanism */}
                      <div>
                        <div className={cn("text-[10px] uppercase tracking-wider font-bold mb-1", t.textMuted)}>Mechanism</div>
                        <p className={cn("text-sm", t.textSecondary)}>{pair.mechanism}</p>
                      </div>

                      {/* Clinical Effect */}
                      <div>
                        <div className={cn("text-[10px] uppercase tracking-wider font-bold mb-1", t.textMuted)}>Clinical Effect</div>
                        <p className={cn("text-sm", t.textSecondary)}>{pair.clinical_effect}</p>
                      </div>

                      {/* Recommended Action */}
                      {pair.recommended_action && pair.recommended_action !== 'No action needed' && (
                        <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                          <div className="text-[10px] uppercase tracking-wider font-bold text-amber-400 mb-1">Recommended Action</div>
                          <p className="text-xs text-amber-300">{pair.recommended_action}</p>
                        </div>
                      )}

                      {/* Effect Scores */}
                      {topEffects.length > 0 && (
                        <div>
                          <div className={cn("text-[10px] uppercase tracking-wider font-bold mb-2", t.textMuted)}>Effect Scores</div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                            {topEffects.map((eff, ei) => (
                              <div key={ei} className="flex items-center gap-2">
                                <div className={cn("flex-1 h-1.5 rounded-full overflow-hidden", t.bgTertiary)}>
                                  <div className={cn("h-full rounded-full",
                                    eff.score >= 0.5 ? 'bg-rose-500' : eff.score >= 0.25 ? 'bg-amber-500' : 'bg-blue-500'
                                  )} style={{ width: `${Math.max(eff.score * 100, 3)}%` }} />
                                </div>
                                <span className={cn("text-[11px] w-24 truncate", t.textMuted)}>{eff.effect_name || eff.effect}</span>
                                <span className="text-[11px] font-mono font-bold w-8 text-right" style={{
                                  color: eff.score >= 0.5 ? '#f43f5e' : eff.score >= 0.25 ? '#f59e0b' : '#3b82f6'
                                }}>{eff.score.toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Monitoring */}
                      {monitoring.length > 0 && (
                        <div>
                          <div className={cn("text-[10px] uppercase tracking-wider font-bold mb-1.5", t.textMuted)}>Monitoring Recommendations</div>
                          <div className="space-y-1">
                            {monitoring.map((m, mi) => (
                              <div key={mi} className="flex items-start gap-2 text-xs">
                                <Activity size={11} className="text-cyan-400 mt-0.5 shrink-0" />
                                <span className={cn(t.textSecondary)}>{m}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Sources & Confidence */}
                      <div className="flex items-center justify-between pt-1">
                        <div className="flex flex-wrap gap-1.5">
                          {sources.map((src, si) => (
                            <span key={si} className={cn("text-[10px] px-2 py-0.5 rounded border", t.bgTertiary, t.border, t.textMuted)}>
                              {src}
                            </span>
                          ))}
                        </div>
                        {pair.confidence > 0 && (
                          <span className={cn("text-[10px] font-mono", t.textMuted)}>
                            Confidence: {(pair.confidence * 100).toFixed(0)}%
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Show more / less */}
          {drugPairs.length > 8 && (
            <div className={cn("p-3 border-t text-center", t.border)}>
              <button onClick={() => setShowAllPairs(!showAllPairs)}
                className={cn("text-xs font-medium hover:underline", t.textMuted)}>
                {showAllPairs ? `Show fewer pairs` : `Show all ${drugPairs.length} pairs`}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ═══ Medications Analyzed ═══ */}
      {medications.length > 0 && (
        <div className={cn("rounded-xl border overflow-hidden", t.card)}>
          <div className={cn("p-4 border-b flex items-center gap-2", t.border)}>
            <Pill size={16} className="text-teal-400" />
            <h4 className={cn("font-bold", t.text)}>Medication Profiles ({medications.length})</h4>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {medications.map((med, idx) => {
              const name = typeof med === 'string' ? med : med.name || med;
              const profile = medProfiles[name] || {};
              const cyp = profile.cyp_profile || {};
              const classes = profile.drug_classes || [];
              const hasCyp = (cyp.substrate || []).length > 0 || (cyp.inhibitor || []).length > 0 || (cyp.inducer || []).length > 0;

              return (
                <div key={idx} className={cn("p-3 rounded-lg border", t.bgTertiary, t.border)}>
                  <div className={cn("text-sm font-bold capitalize", t.text)}>{name}</div>
                  {classes.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {classes.map((cls, ci) => (
                        <span key={ci} className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-400 border border-violet-500/20">
                          {cls.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  )}
                  {hasCyp && (
                    <div className="mt-2 space-y-1">
                      {(cyp.substrate || []).length > 0 && (
                        <div className="text-[10px]">
                          <span className="text-cyan-400 font-bold">SUB: </span>
                          <span className={t.textMuted}>{cyp.substrate.join(', ')}</span>
                        </div>
                      )}
                      {(cyp.inhibitor || []).length > 0 && (
                        <div className="text-[10px]">
                          <span className="text-rose-400 font-bold">INH: </span>
                          <span className={t.textMuted}>{cyp.inhibitor.join(', ')}</span>
                        </div>
                      )}
                      {(cyp.inducer || []).length > 0 && (
                        <div className="text-[10px]">
                          <span className="text-amber-400 font-bold">IND: </span>
                          <span className={t.textMuted}>{cyp.inducer.join(', ')}</span>
                        </div>
                      )}
                    </div>
                  )}
                  {!hasCyp && classes.length === 0 && (
                    <div className={cn("text-[10px] mt-1", t.textMuted)}>Minimal CYP involvement</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ No interactions fallback ═══ */}
      {drugPairs.length === 0 && interactions.length === 0 && (
        <div className={cn("p-6 rounded-xl border text-center", t.card)}>
          <CheckCircle size={32} className="mx-auto text-emerald-400 mb-3" />
          <h4 className={cn("font-bold", t.text)}>No Drug Interactions Detected</h4>
          <p className={cn("text-sm mt-1", t.textMuted)}>
            No known drug-drug interactions were found among the analyzed medications.
          </p>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// FILE UPLOAD ZONE - SINGLE & MULTI-PATIENT UPLOAD
// ═══════════════════════════════════════════════════════════════

const FileUploadZone = ({ onFilesSelected, onMultiPatientUpload, isProcessing, theme }) => {
  const t = getThemeClasses(theme || 'dark');
  const [isDragging, setIsDragging] = useState(false);
  const [uploadMode, setUploadMode] = useState('single'); // 'single' | 'multi'
  const [singleWorkflow, setSingleWorkflow] = useState('pipeline'); // 'pipeline' | 'compass' | 'pinnacle' | 'madrigal'
  
  // ── Single-patient state ──
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [filterText, setFilterText] = useState('');
  const [detectedFolderName, setDetectedFolderName] = useState('');
  const folderInputRef = useRef(null);
  
  // ── Multi-patient state ──
  const [multiPatients, setMultiPatients] = useState([]); // [{ folderName, files: [...] }]
  const [multiReady, setMultiReady] = useState(false);
  const multiFolderInputRef = useRef(null);
  
  // ── Immunotherapy (COMPASS) state ──
  const [immunotherapyEnabled, setImmunotherapyEnabled] = useState(false);
  const [cancerType, setCancerType] = useState('');
  const [geneExprFile, setGeneExprFile] = useState(null);
  const geneExprInputRef = useRef(null);

  // ── PINNACLE discovery state ──
  const [pinnacleEnabled, setPinnacleEnabled] = useState(false);
  const [pinnacleDiseaseId, setPinnacleDiseaseId] = useState('');
  const [pinnacleTargets, setPinnacleTargets] = useState('');

  // ── MADRIGAL DDI state ──
  const [madrigalMedList, setMadrigalMedList] = useState('');
  
  const CANCER_TYPES = [
    {code:'ACC',name:'Adrenocortical Carcinoma'},{code:'BLCA',name:'Bladder Urothelial'},{code:'BRCA',name:'Breast Invasive'},
    {code:'CESC',name:'Cervical Squamous Cell'},{code:'CHOL',name:'Cholangiocarcinoma'},{code:'COAD',name:'Colon Adenocarcinoma'},
    {code:'DLBC',name:'Diffuse Large B-Cell Lymphoma'},{code:'ESCA',name:'Esophageal'},{code:'GBM',name:'Glioblastoma'},
    {code:'HNSC',name:'Head and Neck Squamous'},{code:'KICH',name:'Kidney Chromophobe'},{code:'KIRC',name:'Kidney Clear Cell'},
    {code:'KIRP',name:'Kidney Papillary'},{code:'LAML',name:'Acute Myeloid Leukemia'},{code:'LGG',name:'Brain Lower Grade Glioma'},
    {code:'LIHC',name:'Liver Hepatocellular'},{code:'LUAD',name:'Lung Adenocarcinoma'},{code:'LUSC',name:'Lung Squamous Cell'},
    {code:'MESO',name:'Mesothelioma'},{code:'OV',name:'Ovarian Serous'},{code:'PAAD',name:'Pancreatic'},
    {code:'PCPG',name:'Pheochromocytoma'},{code:'PRAD',name:'Prostate'},{code:'READ',name:'Rectum Adenocarcinoma'},
    {code:'SARC',name:'Sarcoma'},{code:'SKCM',name:'Melanoma'},{code:'STAD',name:'Stomach'},
    {code:'TGCT',name:'Testicular Germ Cell'},{code:'THCA',name:'Thyroid'},{code:'THYM',name:'Thymoma'},
    {code:'UCEC',name:'Uterine Endometrial'},{code:'UCS',name:'Uterine Carcinosarcoma'},{code:'UVM',name:'Uveal Melanoma'},
  ];
  
  // ── Shared helpers ──
  const isJunk = (name) => {
    if (!name) return true;
    return name.startsWith('.') || name.startsWith('__') || name === 'Thumbs.db' || name === '.DS_Store' || name === 'desktop.ini';
  };
  
  const makeFileObj = (f) => {
    const nameParts = (f.name || 'unknown').split('.');
    const ext = nameParts.length > 1 ? '.' + nameParts.pop().toLowerCase() : '';
    return {
      file: f,
      name: f.name || 'unknown',
      path: f.webkitRelativePath || f.name || 'unknown',
      size: f.size || 0,
      type: f.type || 'application/octet-stream',
      extension: ext,
      selected: true,
      id: Math.random().toString(36).substring(2) + Date.now(),
      isSupported: CONFIG.supportedFormats.includes(ext)
    };
  };
  
  // ── Single-patient: process folder ──
  const processSingleFiles = (files) => {
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);
    let folderName = '';
    try {
      for (const f of fileArray) {
        if (f.webkitRelativePath) {
          const parts = f.webkitRelativePath.split('/');
          if (parts.length > 1 && parts[0]) { folderName = parts[0]; break; }
        }
      }
    } catch {}
    if (folderName) setDetectedFolderName(folderName);
    const fileObjects = fileArray.filter(f => !isJunk(f.name)).map(makeFileObj);
    if (fileObjects.length > 0) setSelectedFiles(fileObjects);
  };
  
  // ── Multi-patient: group files by first subfolder ──
  const processMultiFolder = (files) => {
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);
    const groups = {};
    for (const f of fileArray) {
      if (isJunk(f.name)) continue;
      const rel = f.webkitRelativePath || '';
      const parts = rel.split('/');
      // parts[0] = root folder, parts[1] = subfolder (= patient), rest = file path
      if (parts.length < 3) continue; // files directly in root are skipped — only subfolders count
      const patientFolder = parts[1];
      if (!patientFolder || isJunk(patientFolder)) continue;
      if (!groups[patientFolder]) groups[patientFolder] = [];
      groups[patientFolder].push(makeFileObj(f));
    }
    const patients = Object.entries(groups)
      .map(([folderName, files]) => ({ folderName, files, selected: true }))
      .sort((a, b) => a.folderName.localeCompare(b.folderName));
    if (patients.length > 0) {
      setMultiPatients(patients);
      setMultiReady(true);
    }
  };
  
  const handleFolderInput = (e) => { e.preventDefault(); e.stopPropagation(); processSingleFiles(e.target.files); };
  const handleMultiFolderInput = (e) => { e.preventDefault(); e.stopPropagation(); processMultiFolder(e.target.files); };
  
  const handleDrop = (e) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false);
    try {
      const items = e.dataTransfer?.items;
      if (items) {
        const files = [];
        for (let i = 0; i < items.length; i++) {
          if (items[i].kind === 'file') { const file = items[i].getAsFile(); if (file) files.push(file); }
        }
        if (files.length > 0) {
          if (uploadMode === 'multi') processMultiFolder(files);
          else processSingleFiles(files);
        }
      } else if (e.dataTransfer?.files) {
        if (uploadMode === 'multi') processMultiFolder(e.dataTransfer.files);
        else processSingleFiles(e.dataTransfer.files);
      }
    } catch {}
  };
  
  // ── Single-patient actions ──
  const toggleFile = (id) => setSelectedFiles(prev => prev.map(f => f.id === id ? { ...f, selected: !f.selected } : f));
  const removeFile = (id) => setSelectedFiles(prev => prev.filter(f => f.id !== id));
  const selectAll = () => setSelectedFiles(prev => prev.map(f => ({ ...f, selected: true })));
  const deselectAll = () => setSelectedFiles(prev => prev.map(f => ({ ...f, selected: false })));
  
  const handleSingleUpload = () => {
    const filesToUpload = selectedFiles.filter(f => f.selected);
    const isPipeline = singleWorkflow === 'pipeline';
    const isCompass = singleWorkflow === 'compass';
    const isPinnacle = singleWorkflow === 'pinnacle';
    const isMadrigal = singleWorkflow === 'madrigal';

    if (isPipeline && filesToUpload.length === 0) return;
    if (isCompass && !geneExprFile) return;
    if (isPinnacle && !pinnacleDiseaseId.trim()) return;
    if (isMadrigal && !madrigalMedList.trim()) return;

    const immunoMeta = isCompass ? {
      enabled: true,
      discovery_only: filesToUpload.length === 0,
      cancer_type: cancerType,
      gene_expression_file: geneExprFile,
    } : null;
    const pinnacleMeta = isPinnacle ? {
      enabled: true,
      discovery_only: true,
      disease_id: pinnacleDiseaseId.trim(),
      protein_targets: pinnacleTargets.split(',').map(s => s.trim()).filter(Boolean)
    } : null;
    const madrigalMeta = isMadrigal ? {
      enabled: true,
      discovery_only: true,
      medications: madrigalMedList.split(',').map(s => s.trim()).filter(Boolean)
    } : null;
    onFilesSelected(filesToUpload, detectedFolderName, immunoMeta, pinnacleMeta, madrigalMeta);
    setSelectedFiles([]); setDetectedFolderName('');
    setImmunotherapyEnabled(false); setCancerType(''); setGeneExprFile(null);
    setPinnacleEnabled(false); setPinnacleDiseaseId(''); setPinnacleTargets('');
    setMadrigalMedList('');
  };
  
  // ── Multi-patient actions ──
  const togglePatient = (idx) => setMultiPatients(prev => prev.map((p, i) => i === idx ? { ...p, selected: !p.selected } : p));
  const removePatient = (idx) => setMultiPatients(prev => prev.filter((_, i) => i !== idx));
  
  const handleMultiUpload = () => {
    const selected = multiPatients.filter(p => p.selected);
    if (selected.length === 0) return;
    if (onMultiPatientUpload) {
      onMultiPatientUpload(selected);
    }
    setMultiPatients([]); setMultiReady(false);
  };
  
  // ── Reset when switching modes ──
  const switchMode = (mode) => {
    setUploadMode(mode);
    setSelectedFiles([]); setDetectedFolderName(''); setFilterText('');
    setMultiPatients([]); setMultiReady(false);
    if (mode !== 'single') {
      setSingleWorkflow('pipeline');
    }
  };

  const switchSingleWorkflow = (mode) => {
    setSingleWorkflow(mode);
    setSelectedFiles([]);
    setDetectedFolderName('');
    setFilterText('');
    if (mode !== 'compass') {
      setGeneExprFile(null);
      setCancerType('');
    }
    if (mode !== 'pinnacle') {
      setPinnacleDiseaseId('');
      setPinnacleTargets('');
    }
    if (mode !== 'madrigal') {
      setMadrigalMedList('');
    }
  };
  
  const filteredFiles = selectedFiles.filter(f =>
    (f.name || '').toLowerCase().includes((filterText || '').toLowerCase()) ||
    (f.path || '').toLowerCase().includes((filterText || '').toLowerCase())
  );
  const selectedCount = selectedFiles.filter(f => f.selected).length;
  const totalSize = selectedFiles.filter(f => f.selected).reduce((sum, f) => sum + (f.size || 0), 0);
  const canSubmitSingle = !isProcessing && (
    (singleWorkflow === 'pipeline' && selectedCount > 0) ||
    (singleWorkflow === 'compass' && Boolean(geneExprFile)) ||
    (singleWorkflow === 'pinnacle' && Boolean(pinnacleDiseaseId.trim())) ||
    (singleWorkflow === 'madrigal' && Boolean(madrigalMedList.trim()))
  );
  
  const multiSelectedCount = multiPatients.filter(p => p.selected).length;
  const multiTotalFiles = multiPatients.filter(p => p.selected).reduce((s, p) => s + p.files.length, 0);
  const multiTotalSize = multiPatients.filter(p => p.selected).reduce((s, p) => s + p.files.reduce((fs, f) => fs + (f.size || 0), 0), 0);
  
  const getFileIcon = (ext) => {
    const iconMap = {
      '.pdf': { icon: FileText, color: 'text-rose-400' },
      '.json': { icon: FileJson, color: 'text-amber-400' },
      '.txt': { icon: FileText, color: 'text-slate-400' },
      '.csv': { icon: Table, color: 'text-emerald-400' },
      '.xml': { icon: FileCode, color: 'text-orange-400' },
      '.docx': { icon: FileText, color: 'text-blue-400' },
      '.doc': { icon: FileText, color: 'text-blue-400' },
      '.png': { icon: FileArchive, color: 'text-purple-400' },
      '.jpg': { icon: FileArchive, color: 'text-purple-400' },
      '.jpeg': { icon: FileArchive, color: 'text-purple-400' },
      '.tiff': { icon: FileArchive, color: 'text-purple-400' },
      '.bmp': { icon: FileArchive, color: 'text-purple-400' },
      '.xlsx': { icon: Table, color: 'text-green-400' },
      '.xls': { icon: Table, color: 'text-green-400' },
    };
    return iconMap[ext] || { icon: FileText, color: t.textMuted };
  };
  
  return (
    <div className="space-y-4">
      {/* ── Mode Toggle Tabs ── */}
      <div className="flex gap-2">
        <button
          onClick={() => switchMode('single')}
          className={cn(
            "flex-1 py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all border",
            uploadMode === 'single'
              ? "bg-teal-600 text-white border-teal-500 shadow-lg shadow-teal-500/20"
              : cn(t.bgTertiary, t.text, t.border, "hover:border-teal-500/50")
          )}
        >
          <FolderOpen size={18} />
          Single Patient Upload
        </button>
        <button
          onClick={() => switchMode('multi')}
          className={cn(
            "flex-1 py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all border",
            uploadMode === 'multi'
              ? "bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-500/20"
              : cn(t.bgTertiary, t.text, t.border, "hover:border-indigo-500/50")
          )}
        >
          <Users size={18} />
          Multi-Patient Upload
        </button>
      </div>

      {uploadMode === 'single' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <button
            onClick={() => switchSingleWorkflow('pipeline')}
            className={cn(
              "py-2.5 px-3 rounded-xl font-bold text-xs border transition-all",
              singleWorkflow === 'pipeline'
                ? "bg-teal-600 text-white border-teal-500"
                : cn(t.bgTertiary, t.text, t.border, "hover:border-teal-500/50")
            )}
          >
            OG Pipeline Upload
          </button>
          <button
            onClick={() => switchSingleWorkflow('compass')}
            className={cn(
              "py-2.5 px-3 rounded-xl font-bold text-xs border transition-all",
              singleWorkflow === 'compass'
                ? "bg-emerald-600 text-white border-emerald-500"
                : cn(t.bgTertiary, t.text, t.border, "hover:border-emerald-500/50")
            )}
          >
            COMPASS Upload
          </button>
          <button
            onClick={() => switchSingleWorkflow('pinnacle')}
            className={cn(
              "py-2.5 px-3 rounded-xl font-bold text-xs border transition-all",
              singleWorkflow === 'pinnacle'
                ? "bg-sky-600 text-white border-sky-500"
                : cn(t.bgTertiary, t.text, t.border, "hover:border-sky-500/50")
            )}
          >
            PINNACLE Upload
          </button>
          <button
            onClick={() => switchSingleWorkflow('madrigal')}
            className={cn(
              "py-2.5 px-3 rounded-xl font-bold text-xs border transition-all",
              singleWorkflow === 'madrigal'
                ? "bg-rose-600 text-white border-rose-500"
                : cn(t.bgTertiary, t.text, t.border, "hover:border-rose-500/50")
            )}
          >
            MADRIGAL DDI
          </button>
        </div>
      )}

      {/* ── Drop Zone ── */}
      <div
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
        onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
        onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }}
        onDrop={handleDrop}
        className={cn(
          "border-2 border-dashed rounded-2xl p-12 transition-all duration-300",
          isDragging
            ? (uploadMode === 'multi' ? "border-indigo-500 bg-indigo-500/10 scale-[1.02]" : "border-teal-500 bg-teal-500/10 scale-[1.02]")
            : cn(t.border, t.bgSecondary, uploadMode === 'multi' ? "hover:border-indigo-500/50" : "hover:border-teal-500/50")
        )}
      >
        <div className="flex flex-col items-center gap-4">
          <div className={cn(
            "p-6 rounded-2xl transition-all duration-300",
            isDragging
              ? (uploadMode === 'multi' ? "bg-indigo-500 scale-110" : "bg-teal-500 scale-110")
              : t.bgTertiary
          )}>
            {uploadMode === 'multi'
              ? <Users size={48} className={isDragging ? "text-white" : "text-indigo-400"} />
              : <Stethoscope size={48} className={isDragging ? "text-white" : "text-teal-400"} />
            }
          </div>

          <div className="text-center">
            {uploadMode === 'single' ? (
              <>
                <h3 className={cn("text-xl font-bold mb-2", t.text)}>
                  {singleWorkflow === 'pipeline'
                    ? (isDragging ? "Drop Patient Files Here" : "Upload Patient Files")
                    : singleWorkflow === 'compass'
                    ? "Upload Gene Expression File"
                    : singleWorkflow === 'madrigal'
                    ? "Drug-Drug Interaction Analysis"
                    : "Configure Target Discovery"}
                </h3>
                <p className={t.textSecondary}>
                  {singleWorkflow === 'pipeline'
                    ? 'Select a patient folder containing medical records'
                    : singleWorkflow === 'compass'
                    ? 'Upload a TSV/CSV gene expression file for immunotherapy analysis'
                    : singleWorkflow === 'madrigal'
                    ? 'Provide a comma-separated medication list for GPU DDI analysis'
                    : 'Provide disease context to run target discovery'}
                </p>
              </>
            ) : (
              <>
                <h3 className={cn("text-xl font-bold mb-2", t.text)}>
                  {isDragging ? "Drop Multi-Patient Folder Here" : "Upload Multi-Patient Folder"}
                </h3>
                <p className={t.textSecondary}>Select a parent folder — each <strong>subfolder</strong> will be treated as a separate patient</p>
              </>
            )}
            <p className={cn("text-xs mt-2", t.textMuted)}>
              Supports PDF, TXT, JSON, XML, CSV, DOCX, Images, and more
            </p>
          </div>
          
          <div className="flex gap-3 mt-4">
            {uploadMode === 'single' ? (
              <button
                onClick={() => {
                  if (singleWorkflow === 'pipeline') folderInputRef.current?.click();
                  if (singleWorkflow === 'compass') geneExprInputRef.current?.click();
                }}
                disabled={isProcessing}
                className="px-6 py-2.5 bg-teal-600 hover:bg-teal-500 disabled:bg-slate-700 text-white font-bold rounded-xl transition-all flex items-center gap-2"
              >
                {singleWorkflow === 'pipeline' ? <FolderOpen size={18} /> : singleWorkflow === 'compass' ? <FileText size={18} /> : singleWorkflow === 'madrigal' ? <Shield size={18} /> : <LineChart size={18} />}
                {singleWorkflow === 'pipeline' ? 'Upload Patient Files' : singleWorkflow === 'compass' ? 'Upload COMPASS File' : singleWorkflow === 'madrigal' ? 'Enter Medications' : 'Configure PINNACLE'}
              </button>
            ) : (
              <button
                onClick={() => multiFolderInputRef.current?.click()}
                disabled={isProcessing}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white font-bold rounded-xl transition-all flex items-center gap-2"
              >
                <FolderTree size={18} />
                Select Parent Folder
              </button>
            )}
          </div>
        </div>
        
        <input ref={folderInputRef} type="file" className="hidden" webkitdirectory="true" directory="true" multiple onChange={handleFolderInput} disabled={isProcessing} />
        <input ref={multiFolderInputRef} type="file" className="hidden" webkitdirectory="true" directory="true" multiple onChange={handleMultiFolderInput} disabled={isProcessing} />
        <input
          ref={geneExprInputRef}
          type="file"
          accept=".tsv,.csv,.txt"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.[0]) {
              const f = e.target.files[0];
              const ext = f.name.split('.').pop().toLowerCase();
              if (['tsv', 'csv', 'txt'].includes(ext)) setGeneExprFile(f);
              else alert('Please select a TSV or CSV file.');
            }
          }}
          disabled={isProcessing}
        />
      </div>
      
      {/* ════════════════ SINGLE PATIENT: File List ════════════════ */}
      {uploadMode === 'single' && singleWorkflow === 'pipeline' && selectedFiles.length > 0 && (
        <div className={cn("rounded-2xl border overflow-hidden", t.card)}>
          <div className={cn("p-4 border-b flex flex-wrap justify-between items-center gap-3", t.border)}>
            <div className="flex items-center gap-3">
              <FilePlus size={18} className="text-teal-400" />
              <h3 className={cn("font-bold", t.text)}>Selected Patient Files</h3>
              <span className="px-2 py-0.5 bg-teal-500/20 text-teal-400 rounded-full text-xs font-bold">
                {selectedCount} / {selectedFiles.length}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className={cn("text-xs font-medium", t.textMuted)}>📁 Folder:</span>
                <input
                  type="text"
                  placeholder="Enter folder name..."
                  value={detectedFolderName}
                  onChange={(e) => setDetectedFolderName(e.target.value)}
                  className={cn("px-2 py-1 rounded-lg border text-sm outline-none w-40 bg-teal-500/10 border-teal-500/30 text-teal-400 placeholder:text-teal-400/50 focus:border-teal-500", t.bgSecondary)}
                />
              </div>
              <input type="text" placeholder="Filter..." value={filterText} onChange={(e) => setFilterText(e.target.value)} className={cn("px-3 py-1.5 rounded-lg border text-sm outline-none w-32", t.input)} />
              <button onClick={selectAll} className={cn("px-3 py-1.5 rounded-lg text-xs font-bold", t.bgTertiary, t.text)}>All</button>
              <button onClick={deselectAll} className={cn("px-3 py-1.5 rounded-lg text-xs font-bold", t.bgTertiary, t.text)}>None</button>
            </div>
          </div>
          
          <div className="max-h-80 overflow-y-auto custom-scrollbar">
            {filteredFiles.length === 0 ? (
              <div className={cn("p-8 text-center", t.textMuted)}>No files match filter</div>
            ) : (
              filteredFiles.map(file => {
                const { icon: FileIcon, color } = getFileIcon(file.extension);
                return (
                  <div key={file.id} className={cn("flex items-center gap-3 p-3 border-b transition-colors", t.border, file.selected ? t.bgTertiary : '')}>
                    <input type="checkbox" checked={file.selected} onChange={() => toggleFile(file.id)} className="h-4 w-4 rounded border-slate-600 text-teal-500 cursor-pointer" />
                    <FileIcon size={18} className={color} />
                    <div className="flex-1 min-w-0">
                      <div className={cn("text-sm font-medium truncate", t.text)}>{file.name}</div>
                      <div className={cn("text-xs truncate", t.textMuted)}>{file.path}</div>
                    </div>
                    <div className={cn("text-xs font-mono", t.textMuted)}>{formatBytes(file.size)}</div>
                    <button onClick={() => removeFile(file.id)} className="p-1 hover:bg-rose-500/20 rounded text-rose-400"><Trash2 size={14} /></button>
                  </div>
                );
              })
            )}
          </div>
          
        </div>
      )}

      {uploadMode === 'single' && singleWorkflow === 'compass' && (
        <div className={cn("rounded-2xl border p-4", t.card)}>
          <div className={cn("space-y-3")}> 
            <div className={cn("flex items-start gap-2 p-2.5 rounded-lg text-xs leading-relaxed", theme === 'dark' ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' : 'bg-emerald-50 text-emerald-700 border border-emerald-200')}>
              <Info size={14} className="flex-shrink-0 mt-0.5" />
              COMPASS upload page: provide only the gene expression file. Cancer type is optional.
            </div>
            <div>
              <label className={cn("block text-xs font-semibold mb-1 uppercase tracking-wider", t.textMuted)}>Cancer Type (Optional)</label>
              <div className="relative">
                <select value={cancerType} onChange={(e) => setCancerType(e.target.value)}
                  className={cn("w-full p-2.5 rounded-lg border text-sm outline-none appearance-none cursor-pointer pr-8", t.input, 'focus:border-emerald-500')}>
                  <option value="">Auto-detect from file</option>
                  {CANCER_TYPES.map(ct => <option key={ct.code} value={ct.code}>{ct.code} — {ct.name}</option>)}
                </select>
                <ChevronDown size={14} className={cn("absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none", t.textMuted)} />
              </div>
            </div>
            <div>
              <label className={cn("block text-xs font-semibold mb-1 uppercase tracking-wider", t.textMuted)}>Gene Expression File (TSV/CSV) *</label>
              {geneExprFile ? (
                <div className={cn("flex items-center justify-between p-2.5 rounded-lg border", t.bgSecondary, 'border-emerald-500/30')}>
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 bg-emerald-500/20 rounded flex items-center justify-center"><FileText size={12} className="text-emerald-400" /></div>
                    <div><div className={cn("text-sm font-medium", t.text)}>{geneExprFile.name}</div><div className={cn("text-xs", t.textMuted)}>{formatBytes(geneExprFile.size)}</div></div>
                  </div>
                  <button onClick={() => setGeneExprFile(null)} className="p-1 hover:bg-rose-500/20 rounded text-rose-400"><X size={14} /></button>
                </div>
              ) : (
                <button onClick={() => geneExprInputRef.current?.click()} className={cn("w-full p-2.5 border-2 border-dashed rounded-lg text-sm transition-colors flex items-center justify-center gap-2", t.border, t.textMuted, 'hover:border-emerald-500/50 hover:text-emerald-400')}>
                  <FileText size={14} /> Upload gene expression data
                </button>
              )}
            </div>
            {!geneExprFile && (
              <div className="flex items-center gap-1.5 text-xs text-amber-400">
                <AlertTriangle size={12} />
                Upload gene expression file to run COMPASS
              </div>
            )}
          </div>
        </div>
      )}

      {uploadMode === 'single' && singleWorkflow === 'pinnacle' && (
        <div className={cn("rounded-2xl border p-4", t.card)}>
          <div className="space-y-3">
            <div>
              <label className={cn("block text-xs font-semibold mb-1 uppercase tracking-wider", t.textMuted)}>Disease ID *</label>
              <input
                type="text"
                value={pinnacleDiseaseId}
                onChange={(e) => setPinnacleDiseaseId(e.target.value)}
                placeholder="EFO_0000685"
                className={cn("w-full p-2.5 rounded-lg border text-sm outline-none", t.input, 'focus:border-sky-500')}
              />
              <div className={cn("text-[11px] mt-1", t.textMuted)}>
                Examples: EFO_0000685 (RA), EFO_0003767 (IBD)
              </div>
            </div>
            <div>
              <label className={cn("block text-xs font-semibold mb-1 uppercase tracking-wider", t.textMuted)}>Protein Targets (optional, comma-separated)</label>
              <input
                type="text"
                value={pinnacleTargets}
                onChange={(e) => setPinnacleTargets(e.target.value)}
                placeholder="JAK3, IL6R, TNF"
                className={cn("w-full p-2.5 rounded-lg border text-sm outline-none", t.input, 'focus:border-sky-500')}
              />
            </div>
            {!pinnacleDiseaseId && (
              <div className="flex items-center gap-1.5 text-xs text-amber-400">
                <AlertTriangle size={12} />
                Disease ID is required to run target discovery.
              </div>
            )}
          </div>
        </div>
      )}

      {uploadMode === 'single' && singleWorkflow === 'madrigal' && (
        <div className={cn("rounded-2xl border p-4", t.card)}>
          <div className="space-y-3">
            <div className={cn("flex items-start gap-2 p-2.5 rounded-lg text-xs leading-relaxed", theme === 'dark' ? 'bg-rose-500/10 text-rose-300 border border-rose-500/20' : 'bg-rose-50 text-rose-700 border border-rose-200')}>
              <Info size={14} className="flex-shrink-0 mt-0.5" />
              Drug Interaction Analysis: enter medications to run full GPU drug-drug interaction analysis.
            </div>
            <div>
              <label className={cn("block text-xs font-semibold mb-1 uppercase tracking-wider", t.textMuted)}>Medication List (comma-separated) *</label>
              <textarea
                value={madrigalMedList}
                onChange={(e) => setMadrigalMedList(e.target.value)}
                placeholder="metformin, atorvastatin, lisinopril, amlodipine, metoprolol"
                rows={3}
                className={cn("w-full p-2.5 rounded-lg border text-sm outline-none resize-none", t.input, 'focus:border-rose-500')}
              />
              <div className={cn("text-[11px] mt-1", t.textMuted)}>
                Enter generic drug names separated by commas. Example: warfarin, aspirin, omeprazole
              </div>
            </div>
            {!madrigalMedList.trim() && (
              <div className="flex items-center gap-1.5 text-xs text-amber-400">
                <AlertTriangle size={12} />
                At least one medication is required to run Madrigal DDI analysis.
              </div>
            )}
            {madrigalMedList.trim() && (
              <div className={cn("flex items-center gap-2 text-xs", t.textMuted)}>
                <Shield size={12} className="text-rose-400" />
                {madrigalMedList.split(',').filter(s => s.trim()).length} medications detected
              </div>
            )}
          </div>
        </div>
      )}

      {uploadMode === 'single' && (
        <div className={cn("rounded-2xl border p-4", t.card)}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className={t.textSecondary}>
              {singleWorkflow === 'pipeline' && selectedCount > 0 ? (
                <>
                  Total: <span className={cn("font-bold", t.text)}>{formatBytes(totalSize)}</span>
                  <span className="mx-2">•</span>
                  <span className="text-xs">{selectedCount} files selected</span>
                </>
              ) : singleWorkflow === 'pinnacle' ? (
                <span className="text-xs text-sky-300">PINNACLE page: configure disease context and run discovery.</span>
              ) : singleWorkflow === 'madrigal' ? (
                <span className="text-xs text-rose-300">MADRIGAL DDI: enter medications for GPU drug interaction analysis.</span>
              ) : singleWorkflow === 'compass' ? (
                <span className="text-xs text-emerald-300">COMPASS page: upload only the gene expression file.</span>
              ) : (
                <span className="text-xs">Select patient files to run the OG pipeline.</span>
              )}
            </div>
            <button
              onClick={handleSingleUpload}
              disabled={!canSubmitSingle}
              className="px-6 py-2.5 bg-teal-600 hover:bg-teal-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold rounded-xl transition-all flex items-center gap-2"
            >
              {isProcessing ? <Spinner size="sm" /> : <Upload size={18} />}
              {isProcessing ? 'Uploading...' : (
                singleWorkflow === 'pinnacle'
                  ? 'Run Target Discovery'
                  : singleWorkflow === 'compass'
                  ? 'Run Immunotherapy Analysis'
                  : singleWorkflow === 'madrigal'
                  ? 'Run Drug Interaction Analysis'
                  : `Upload ${selectedCount} Patient Files`
              )}
            </button>
          </div>
        </div>
      )}
      
      {/* ════════════════ MULTI-PATIENT: Verification Panel ════════════════ */}
      {uploadMode === 'multi' && multiReady && multiPatients.length > 0 && (
        <div className={cn("rounded-2xl border overflow-hidden", t.card)}>
          <div className={cn("p-4 border-b flex flex-wrap justify-between items-center gap-3", t.border)}>
            <div className="flex items-center gap-3">
              <Users size={18} className="text-indigo-400" />
              <h3 className={cn("font-bold", t.text)}>Detected Patients — Verify Before Upload</h3>
              <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-400 rounded-full text-xs font-bold">
                {multiSelectedCount} patients • {multiTotalFiles} files
              </span>
            </div>
            <button
              onClick={() => { setMultiPatients([]); setMultiReady(false); }}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-bold", t.bgTertiary, t.text)}
            >
              Clear All
            </button>
          </div>
          
          <div className="max-h-96 overflow-y-auto custom-scrollbar divide-y divide-slate-800/50">
            {multiPatients.map((patient, idx) => (
              <div key={patient.folderName} className={cn("p-4 transition-colors", patient.selected ? '' : 'opacity-50')}>
                <div className="flex items-center gap-3 mb-2">
                  <input
                    type="checkbox"
                    checked={patient.selected}
                    onChange={() => togglePatient(idx)}
                    className="h-4 w-4 rounded border-slate-600 text-indigo-500 cursor-pointer"
                  />
                  <Folder size={18} className="text-indigo-400" />
                  <span className={cn("font-bold text-sm", t.text)}>{patient.folderName}</span>
                  <span className={cn("text-xs px-2 py-0.5 rounded-full", t.bgTertiary, t.textMuted)}>
                    {patient.files.length} files • {formatBytes(patient.files.reduce((s, f) => s + (f.size || 0), 0))}
                  </span>
                  <button onClick={() => removePatient(idx)} className="ml-auto p-1 hover:bg-rose-500/20 rounded text-rose-400"><Trash2 size={14} /></button>
                </div>
                <div className={cn("ml-9 flex flex-wrap gap-1.5")}>
                  {patient.files.slice(0, 8).map(f => {
                    const { icon: FIcon, color } = getFileIcon(f.extension);
                    return (
                      <span key={f.id} className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs", t.bgTertiary, t.textMuted)}>
                        <FIcon size={12} className={color} />{f.name}
                      </span>
                    );
                  })}
                  {patient.files.length > 8 && (
                    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs", t.bgTertiary, t.textMuted)}>
                      +{patient.files.length - 8} more
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          <div className={cn("p-4 border-t flex justify-between items-center", t.border, t.bgTertiary)}>
            <div className={t.textSecondary}>
              <span className={cn("font-bold", t.text)}>{multiSelectedCount}</span> patients
              <span className="mx-2">•</span>
              <span className={cn("font-bold", t.text)}>{multiTotalFiles}</span> files
              <span className="mx-2">•</span>
              {formatBytes(multiTotalSize)}
            </div>
            <button
              onClick={handleMultiUpload}
              disabled={multiSelectedCount === 0 || isProcessing}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold rounded-xl transition-all flex items-center gap-2"
            >
              {isProcessing ? <Spinner size="sm" /> : <Upload size={18} />}
              {isProcessing ? 'Uploading...' : `Upload ${multiSelectedCount} Patients`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// PATIENT CASE CARD COMPONENT
// ═══════════════════════════════════════════════════════════════

const getCaseVariant = (caseData) => {
  if (!caseData) return 'pipeline';
  const hasPinnacle = !!(caseData.pinnacleDiscovery || safeGet(caseData, 'dashboard.pinnacle_discovery') || caseData.hasPinnacleDiscovery || safeArray(safeGet(caseData, 'agentOutputs.pinnacle')).length > 0);
  const hasCompass = !!(caseData.compassPrediction || safeGet(caseData, 'dashboard.compass_prediction') || caseData.hasCompassPrediction || safeArray(safeGet(caseData, 'agentOutputs.compass')).length > 0);
  const hasMadrigal = !!(caseData.madrigalDDI || safeGet(caseData, 'dashboard.madrigal_ddi') || caseData.hasMadrigalDDI);
  // CRITICAL: _lazy narrative is just a placeholder marker from polling — not a real narrative
  const hasNarrative = !!caseData.narrative && !caseData.narrative._lazy;
  const hasPinnacleRequest = (caseData.rawFiles || []).some((f) => (f?.name || '').toLowerCase().includes('pinnacle_request'));
  const hasCompassRequest = (caseData.rawFiles || []).some((f) => {
    const name = (f?.name || '').toLowerCase();
    return name.includes('compass_metadata') || name.includes('compass_request');
  });
  const hasMadrigalRequest = (caseData.rawFiles || []).some((f) => {
    const name = (f?.name || '').toLowerCase();
    return name.includes('madrigal_metadata');
  });

  // PINNACLE-only: has pinnacle output and no clinical narrative
  if (hasPinnacle && !hasNarrative && !hasCompass && !hasMadrigal) return 'pinnacle';
  if (hasPinnacleRequest && hasPinnacle && !hasNarrative) return 'pinnacle';
  // COMPASS-only: has compass output and no clinical narrative
  if (hasCompass && !hasNarrative && !hasPinnacle && !hasMadrigal) return 'compass';
  if (hasCompassRequest && hasCompass && !hasNarrative) return 'compass';
  // MADRIGAL-only: has madrigal output and no clinical narrative or other models
  if (hasMadrigal && !hasNarrative && !hasPinnacle && !hasCompass) return 'madrigal';
  if (hasMadrigalRequest && hasMadrigal && !hasNarrative) return 'madrigal';
  return 'pipeline';
};

const PatientCaseCard = ({ caseData, onClick, theme, variant = 'pipeline' }) => {
  const t = getThemeClasses(theme || 'dark');
  const rawCount = (caseData?.rawFiles || []).length;
  const agentCount = Object.keys(caseData?.agentOutputs || {}).length;
  const clinicalAgentCount = CONFIG.agents.filter((a) => a.id !== 'compass' && a.id !== 'pinnacle').length;
  const hasNarrative = !!caseData?.narrative;
  const isPinnacle = variant === 'pinnacle';
  const isCompass = variant === 'compass';
  
  // Extract patient info from narrative if available
  const patientName = safeGet(caseData, 'narrative.patient_info.name') ||
                      safeGet(caseData, 'narrative.patient.name') ||
                      safeGet(caseData, 'narrative.patient_profile.patient_name') || '';
  const patientAge = safeGet(caseData, 'narrative.patient_info.age') ||
                     safeGet(caseData, 'narrative.patient.age') ||
                     safeGet(caseData, 'narrative.patient_profile.age') || '';
  
  const patientNumber = caseData?.patientNumber || '';
  const displayLabel = patientNumber ? `Patient ${patientNumber}` : (caseData?.folderName || caseData?.id || 'Patient');

  const pinnacleData = caseData?.pinnacleDiscovery || caseData?.dashboard?.pinnacle_discovery || {};
  const normalizedPinnacleStatus = safeString(pinnacleData.status || '').trim().toUpperCase();
  const pinnacleReady = isPinnacle && (
    normalizedPinnacleStatus === 'SUCCESS' ||
    !!caseData?.pinnacleDiscovery ||
    !!caseData?.dashboard?.pinnacle_discovery ||
    safeArray(safeGet(caseData, 'agentOutputs.pinnacle')).length > 0
  );
  const pinnacleDisease = safeString(pinnacleData.disease_name || pinnacleData.disease || 'Discovery Case');
  const pinnacleDiseaseId = safeString(pinnacleData.disease_id || 'N/A');
  const pinnacleTargets = safeArray(pinnacleData.nominated_targets || pinnacleData.top_targets || []).length;
  const pinnacleCells = safeArray(pinnacleData.analyzed_cell_types || []).length;

  const cardTone = isPinnacle
    ? {
        base: 'border-sky-500/30 bg-gradient-to-br from-sky-500/10 via-cyan-500/5 to-indigo-500/10',
        hover: 'hover:border-sky-400/60 hover:shadow-sky-500/20',
        iconBg: 'bg-sky-500/20 group-hover:bg-sky-500',
        iconText: 'text-sky-300 group-hover:text-white',
        titleHover: 'group-hover:text-sky-300',
      }
    : isCompass
    ? {
        base: 'border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-cyan-500/10',
        hover: 'hover:border-emerald-400/60 hover:shadow-emerald-500/20',
        iconBg: 'bg-emerald-500/20 group-hover:bg-emerald-500',
        iconText: 'text-emerald-300 group-hover:text-white',
        titleHover: 'group-hover:text-emerald-300',
      }
    : {
        base: t.card,
        hover: 'hover:border-teal-500/50 hover:shadow-xl',
        iconBg: cn(t.bgTertiary, 'group-hover:bg-teal-600'),
        iconText: cn(t.textSecondary, 'group-hover:text-white'),
        titleHover: 'group-hover:text-teal-400',
      };
  
  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-2xl border p-6 cursor-pointer transition-all group hover-lift-card mac-glass-panel",
        cardTone.base,
        cardTone.hover
      )}
    >
      <div className="flex justify-between items-start mb-4">
        <div className={cn("p-3 rounded-xl transition-all", cardTone.iconBg)}>
          {isPinnacle ? (
            <LineChart size={24} className={cn("transition-colors", cardTone.iconText)} />
          ) : isCompass ? (
            <Target size={24} className={cn("transition-colors", cardTone.iconText)} />
          ) : (
            <Stethoscope size={24} className={cn("transition-colors", cardTone.iconText)} />
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isPinnacle && (
            <span className="px-2.5 py-1 bg-sky-500/20 text-sky-300 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 border border-sky-500/30 shadow-sm shadow-sky-500/10">
              <LineChart size={11} />
              PINNACLE
            </span>
          )}
          {isCompass && (
            <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 border border-emerald-500/30 shadow-sm shadow-emerald-500/10">
              <Target size={11} />
              COMPASS
            </span>
          )}
          {!isPinnacle && !isCompass && (
            <span className="px-2.5 py-1 bg-teal-500/15 text-teal-300 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 border border-teal-500/25">
              <Stethoscope size={11} />
              CLINICAL
            </span>
          )}
          {hasNarrative && (
            <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-xs font-bold flex items-center gap-1">
              <CheckCircle size={12} />
              Complete
            </span>
          )}
          {pinnacleReady && (
            <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-xs font-bold flex items-center gap-1 border border-emerald-500/30">
              <CheckCircle size={12} />
              READY
            </span>
          )}
          {isCompass && !!(caseData?.compassPrediction || caseData?.hasCompassPrediction || safeArray(safeGet(caseData, 'agentOutputs.compass')).length > 0) && (
            <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-xs font-bold flex items-center gap-1 border border-emerald-500/30">
              <CheckCircle size={12} />
              READY
            </span>
          )}
          {!isPinnacle && !isCompass && agentCount > 0 && !hasNarrative && (
            <span className="px-2 py-1 bg-amber-500/20 text-amber-400 rounded-full text-xs font-bold flex items-center gap-1">
              <Loader2 size={12} className="animate-spin" />
              Processing
            </span>
          )}
        </div>
      </div>
      
      <div className="flex items-baseline gap-2 mb-0.5">
              <h3 className={cn("text-xl font-bold truncate", t.text, cardTone.titleHover)}>
          {displayLabel}
        </h3>
        {caseData?.folderName && (
          <span className={cn("text-[10px] font-mono opacity-50 truncate max-w-[120px]", t.textMuted)} title={caseData.folderName}>{caseData.folderName}</span>
        )}
      </div>
      {isPinnacle ? (
        <p className={cn("text-sm mt-0.5", t.textSecondary)}>{pinnacleDisease} {pinnacleDiseaseId !== 'N/A' ? `• ${pinnacleDiseaseId}` : ''}</p>
      ) : isCompass ? (
        <p className={cn("text-sm mt-0.5", t.textSecondary)}>
          {safeString(safeGet(caseData, 'compassPrediction.cancer_name') || safeGet(caseData, 'compassPrediction.cancer_type') || safeGet(caseData, 'dashboard.compass_prediction.cancer_name') || 'Immunotherapy Discovery')}
        </p>
      ) : (
        patientName && (
          <p className={cn("text-sm mt-0.5", t.textSecondary)}>{patientName} {patientAge ? `• Age ${patientAge}` : ''}</p>
        )
      )}
      <p className={cn("text-xs mb-4 mt-1", t.textMuted)}>
        {safeFormatDistance(caseData?.lastModified)}
      </p>
      
      <div className="grid grid-cols-2 gap-2">
        <div className={cn("p-2 rounded-lg text-center", t.bgTertiary)}>
          <div className={cn("text-xs uppercase", t.textMuted)}>{isPinnacle ? 'Targets' : isCompass ? 'Patients' : 'Files'}</div>
          <div className={cn("text-lg font-bold", isPinnacle ? 'text-sky-400' : isCompass ? 'text-emerald-400' : 'text-teal-400')}>
            {isPinnacle ? pinnacleTargets : isCompass ? (safeGet(caseData, 'compassPrediction.patients_analyzed') || safeArray(safeGet(caseData, 'compassPrediction.predictions') || []).length || 0) : rawCount}
          </div>
        </div>
        <div className={cn("p-2 rounded-lg text-center", t.bgTertiary)}>
          <div className={cn("text-xs uppercase", t.textMuted)}>{isPinnacle ? 'Cell Types' : isCompass ? 'Response' : 'Pipeline'}</div>
          <div className={cn("text-lg font-bold", isPinnacle ? 'text-indigo-300' : isCompass ? 'text-cyan-300' : 'text-cyan-400')}>
            {isPinnacle ? pinnacleCells : isCompass ? `${((safeGet(caseData, 'compassPrediction.response_rate') || 0) * 100).toFixed(1)}%` : `${agentCount}/${clinicalAgentCount}`}
          </div>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// DASHBOARD METRICS - REAL DATA ONLY
// ═══════════════════════════════════════════════════════════════

const ClinicalDashboardMetrics = ({ cases, theme }) => {
  const t = getThemeClasses(theme || 'dark');
  
  const totalPatients = Object.keys(cases || {}).length;
  const completedPatients = Object.values(cases || {}).filter(c => c?.narrative).length;
  const processingPatients = Object.values(cases || {}).filter(c => !c?.narrative && Object.keys(c?.agentOutputs || {}).length > 0).length;
  const totalRawFiles = Object.values(cases || {}).reduce((sum, c) => sum + (c?.rawFiles?.length || 0), 0);
  
  const metrics = [
    { label: 'Total Patients', value: totalPatients, icon: Users, color: 'teal' },
    { label: 'Completed', value: completedPatients, icon: FileCheck, color: 'emerald' },
    { label: 'Processing', value: processingPatients, icon: Cpu, color: 'amber' }
  ];
  
  return (
    <div className="grid grid-cols-3 gap-4">
      {metrics.map((m, idx) => (
        <MedicalBadge key={idx} label={m.label} value={m.value} icon={m.icon} color={m.color} theme={theme} />
      ))}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// SYSTEM STATUS PANEL
// ═══════════════════════════════════════════════════════════════

const SystemStatusPanel = ({ s3Client, theme }) => {
  const t = getThemeClasses(theme || 'dark');
  const [bucketStatus, setBucketStatus] = useState({});
  const [checking, setChecking] = useState(false);
  
  const checkBuckets = useCallback(async () => {
    if (!s3Client || checking) return;
    setChecking(true);
    
    const status = {};
    for (const [key, bucket] of Object.entries(CONFIG.buckets)) {
      try {
        const resp = await s3Client.send(new ListObjectsV2Command({ Bucket: bucket, MaxKeys: 1 }));
        status[key] = { online: true, count: resp.KeyCount || 0 };
      } catch {
        status[key] = { online: false, count: 0 };
      }
    }
    
    setBucketStatus(status);
    setChecking(false);
  }, [s3Client, checking]);
  
  useEffect(() => {
    if (s3Client) checkBuckets();
  }, [s3Client]);
  
  const bucketLabels = {
    RAW: 'Patient Uploads',
    STAGING: 'Staging',
    PROCESSED: 'Processed',
    CURATED: 'Curated',
    QUARANTINE: 'Quarantine'
  };
  
  return (
    <div className={cn("rounded-xl border", t.card)}>
      <div className={cn("p-4 border-b flex items-center gap-3", t.border)}>
        <div className="flex items-center gap-3">
          <Server size={18} className="text-teal-400" />
          <h3 className={cn("font-bold", t.text)}>System Status</h3>
        </div>
        <button onClick={checkBuckets} disabled={checking} className={cn("p-1.5 rounded-lg", t.bgTertiary, t.bgHover)}>
          <RefreshCw size={14} className={cn(checking && "animate-spin", t.textMuted)} />
        </button>
      </div>
      <div className="p-4 space-y-3">
        {Object.entries(bucketLabels).map(([key, label]) => {
          const status = bucketStatus[key];
          return (
            <div key={key} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PulsingDot color={status?.online ? 'emerald' : status === undefined ? 'amber' : 'rose'} size="sm" />
                <span className={cn("text-sm", t.text)}>{label}</span>
              </div>
              <span className={cn("text-xs font-mono", t.textMuted)}>
                {status?.online ? 'Online' : status === undefined ? 'Checking...' : 'Offline'}
              </span>
            </div>
          );
        })}
        
        <div className={cn("pt-3 border-t flex items-center justify-between", t.border)}>
          <div className="flex items-center gap-2">
            <Cloud size={14} className="text-teal-400" />
            <span className={cn("text-xs", t.textMuted)}>Region: {CONFIG.region}</span>
          </div>
          <div className="flex items-center gap-2">
            <Shield size={14} className="text-emerald-400" />
            <span className={cn("text-xs", t.textMuted)}>Encrypted</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// RECENT ACTIVITY FEED
// ═══════════════════════════════════════════════════════════════

const RecentActivityFeed = ({ cases, theme, onSelectCase }) => {
  const t = getThemeClasses(theme || 'dark');
  
  const activities = useMemo(() => {
    try {
      const acts = [];
      Object.values(cases || {}).forEach(c => {
        if (!c) return;
        if (c.lastModified) {
          acts.push({
            type: c.narrative ? 'completed' : 'processing',
            caseId: c.id,
            folderName: c.folderName || c.id,
            patientLabel: c.patientLabel || '',
            date: c.lastModified,
            caseData: c
          });
        }
      });
      return acts.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)).slice(0, 8);
    } catch {
      return [];
    }
  }, [cases]);
  
  if (activities.length === 0) return null;
  
  return (
    <div className={cn("rounded-xl border", t.card)}>
      <div className={cn("p-4 border-b flex items-center gap-3", t.border)}>
        <Activity size={18} className="text-teal-400" />
        <h3 className={cn("font-bold", t.text)}>Recent Activity</h3>
      </div>
      <div className={cn("divide-y", t.border)}>
        {activities.map((act, idx) => (
          <button
            key={idx}
            onClick={() => onSelectCase?.(act.caseData)}
            className={cn("w-full text-left p-4 flex items-center gap-3 transition-all", t.bgHover)}
          >
            {act.type === 'completed' ? (
              <CheckCircle size={18} className="text-emerald-500 flex-shrink-0" />
            ) : (
              <Loader2 size={18} className="text-amber-400 flex-shrink-0 animate-spin" />
            )}
            <div className="flex-1 min-w-0">
              <div className={cn("font-medium text-sm truncate", t.text)}>
                {act.folderName}{act.patientLabel ? ` (${act.patientLabel})` : ''}
              </div>
              <div className={cn("text-xs", t.textMuted)}>
                {act.type === 'completed' ? 'Narrative generated' : 'Processing by AI agents'}
                {' • '}
                {safeFormatDistance(act.date)}
              </div>
            </div>
            <ChevronRight size={16} className={t.textMuted} />
          </button>
        ))}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// MAIN APPLICATION COMPONENT
// ═══════════════════════════════════════════════════════════════

function AppContent() {
  const { theme } = useTheme();
  const t = getThemeClasses(theme);
  
    const [creds, setCreds] = useState({ accessKey: '', secretKey: '' });
  const [auth, setAuth] = useState(false);
  const [s3, setS3] = useState(null);
  const [view, setView] = useState('DASHBOARD');
  const [currentPipeline, setCurrentPipeline] = useState('clinical');
  const [cases, setCases] = useState({});
  const [selectedCase, setSelectedCase] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [toast, setToast] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [patientSortBy, setPatientSortBy] = useState('newest');
  const [isPolling, setIsPolling] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [uiTilt, setUiTilt] = useState({ x: 0, y: 0 });
  const [isHydratingCase, setIsHydratingCase] = useState(false);
  const parallaxRafRef = useRef(null);
  const parallaxTargetRef = useRef({ x: 0, y: 0 });
  const prefersReducedMotionRef = useRef(false);
  const selectedCaseIdRef = useRef(null);
  const isPollingRef = useRef(false);
  const s3Ref = useRef(null);

  const animateParallax = useCallback(() => {
    parallaxRafRef.current = null;
    setUiTilt(prev => {
      const nextX = prev.x + (parallaxTargetRef.current.x - prev.x) * 0.14;
      const nextY = prev.y + (parallaxTargetRef.current.y - prev.y) * 0.14;
      const needsMoreFrames = Math.abs(nextX - parallaxTargetRef.current.x) > 0.05 || Math.abs(nextY - parallaxTargetRef.current.y) > 0.05;
      if (needsMoreFrames) {
        parallaxRafRef.current = requestAnimationFrame(animateParallax);
      }
      return { x: nextX, y: nextY };
    });
  }, []);

  const queueParallaxFrame = useCallback(() => {
    if (parallaxRafRef.current || prefersReducedMotionRef.current) return;
    parallaxRafRef.current = requestAnimationFrame(animateParallax);
  }, [animateParallax]);

  const handleParallaxMove = useCallback((e) => {
    if (prefersReducedMotionRef.current) return;
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return;
    const width = window.innerWidth || 1;
    const height = window.innerHeight || 1;
    const nx = (e.clientX / width - 0.5) * 2;
    const ny = (e.clientY / height - 0.5) * 2;
    parallaxTargetRef.current = {
      x: nx * 10,
      y: ny * 8
    };
    queueParallaxFrame();
  }, [queueParallaxFrame]);

  const handleParallaxLeave = useCallback(() => {
    parallaxTargetRef.current = { x: 0, y: 0 };
    queueParallaxFrame();
  }, [queueParallaxFrame]);

  const loginCardStyle = useMemo(() => ({
    transform: `perspective(1400px) rotateX(${(-uiTilt.y * 0.22).toFixed(2)}deg) rotateY(${(uiTilt.x * 0.24).toFixed(2)}deg) translate3d(${(uiTilt.x * 0.8).toFixed(2)}px, ${(uiTilt.y * 0.8).toFixed(2)}px, 0)`
  }), [uiTilt]);

  const heroCardStyle = useMemo(() => ({
    transform: `perspective(1400px) rotateX(${(-uiTilt.y * 0.14).toFixed(2)}deg) rotateY(${(uiTilt.x * 0.16).toFixed(2)}deg) translate3d(${(uiTilt.x * 0.45).toFixed(2)}px, ${(uiTilt.y * 0.45).toFixed(2)}px, 0)`
  }), [uiTilt]);

  // Update clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Respect reduced-motion user preference for custom parallax interactions
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => {
      prefersReducedMotionRef.current = media.matches;
      if (media.matches) {
        parallaxTargetRef.current = { x: 0, y: 0 };
        setUiTilt({ x: 0, y: 0 });
      }
    };
    updatePreference();
    if (media.addEventListener) media.addEventListener('change', updatePreference);
    else media.addListener(updatePreference);
    return () => {
      if (media.removeEventListener) media.removeEventListener('change', updatePreference);
      else media.removeListener(updatePreference);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (parallaxRafRef.current) cancelAnimationFrame(parallaxRafRef.current);
    };
  }, []);

  // Initialize from localStorage (JWT minted by the Secure Clinical Login)
  useEffect(() => {
    try {
      const saved = localStorage.getItem('mevreon_v7_auth');
      if (saved) {
        const c = JSON.parse(saved);
        if (c.accessToken) {
          setCreds(c);
          initS3(c, true);
        }
      }
    } catch (e) {
      console.error('Init error:', e);
    }
  }, []);

  // Load patient counter
  useEffect(() => {
    try {
      const stored = localStorage.getItem('mevreon_patient_counter');
      if (stored) patientCounter = parseInt(stored) || 0;
    } catch {}
  }, []);

  const initS3 = (c, silent = false) => {
    try {
      const client = new S3Client({
        region: CONFIG.region,
        credentials: { accessKeyId: c.accessKey || '', secretAccessKey: c.secretKey || '' }
      });
      s3Ref.current = client;
      setS3(client);
      setAuth(true);
      localStorage.setItem('mevreon_v7_auth', JSON.stringify(c));
      if (!silent) showToast('Connected to Mevreon GCP backend — Medical Pipeline Online', 'success');
    } catch (e) {
      showToast('Connection failed: ' + (e.message || 'Unknown error'), 'error');
    }
  };

  const showToast = (message, type = 'info') => {
    setToast({ message, type, id: Date.now() });
  };

  const getRawFileCount = useCallback((caseData) => getCaseRawFileCount(caseData), []);

  // Poll for data from all buckets
  const pollData = useCallback(async () => {
    // Use ref for s3 client to avoid stale closure — s3 state may not be set yet when this runs
    const s3Client = s3Ref.current || s3;
    if (!s3Client || isPollingRef.current) return;
    isPollingRef.current = true;
    setIsPolling(true);
    
    try {
      // Use functional form to get latest cases state, avoiding stale closure issues
      let prevCases = {};
      setCases(prev => { prevCases = prev; return prev; });
      const newCases = { ...prevCases };
      
      // Use s3Client (from ref) for all S3 operations in this poll cycle
      const s3 = s3Client;
      
      // Load folder-to-patient mapping
      let folderMapping = {};
      try {
        const stored = localStorage.getItem('mevreon_folder_mapping');
        if (stored) folderMapping = JSON.parse(stored);
      } catch {}
      
      // 1. Scan RAW bucket for case folders (paginated)
      const rawCommonPrefixes = [];
      let rawListingSucceeded = false;
      try {
        let rawToken;
        do {
          const rawResponse = await s3.send(new ListObjectsV2Command({
            Bucket: CONFIG.buckets.RAW,
            Delimiter: '/',
            ContinuationToken: rawToken
          }));
          rawCommonPrefixes.push(...(rawResponse.CommonPrefixes || []));
          rawToken = rawResponse.IsTruncated ? rawResponse.NextContinuationToken : undefined;
        } while (rawToken);
        rawListingSucceeded = true;
        console.log(`[POLL] RAW bucket: found ${rawCommonPrefixes.length} case folders`);
      } catch (rawErr) {
        console.error('[POLL] ✗ RAW bucket listing FAILED:', rawErr?.message || rawErr);
      }
      
      // Normalize: decode URL-encoding (%2B → +, %20 → space) then replace spaces with '+'
      const normalizeCaseId = (id) => {
        try { id = decodeURIComponent(id || ''); } catch { /* already decoded */ }
        return id.replace(/ /g, '+');
      };
      const displayName = (id) => {
        try { id = decodeURIComponent(id || ''); } catch {}
        return id.replace(/\+/g, ' ');
      };
      
      const caseFolders = rawCommonPrefixes
        .map(p => normalizeCaseId((p.Prefix || '').replace('/', '')))
        .filter(id => id && id.length > 0);
      
      // Prune stale folder mappings for cases no longer in RAW bucket
      // CRITICAL: Only prune if RAW listing succeeded — a failed listing must NOT wipe all cases
      const activeCaseSet = new Set(caseFolders);
      if (rawListingSucceeded && caseFolders.length > 0) {
        const staleKeys = Object.keys(folderMapping).filter(k => !activeCaseSet.has(k) && !activeCaseSet.has(normalizeCaseId(k)));
        for (const k of staleKeys) delete folderMapping[k];
        
        // Also remove stale cases from newCases — but preserve cases that have CURATED data
        for (const k of Object.keys(newCases)) {
          if (!activeCaseSet.has(k) && !activeCaseSet.has(normalizeCaseId(k))) {
            // Don't prune cases that have pipeline outputs or narrative — they may only exist in CURATED
            const c = newCases[k];
            const hasOutputs = c && (c.narrative || c.hasDashboard || c.hasCompassPrediction || c.hasPinnacleDiscovery || c.hasMadrigalDDI || Object.keys(c.agentOutputs || {}).length > 0);
            if (!hasOutputs) {
              delete newCases[k];
            }
          }
        }
      } else if (!rawListingSucceeded) {
        console.warn('[POLL] Skipping case pruning — RAW bucket listing failed, keeping existing cases');
      }
      
      // Reset patient counter based on existing mappings so numbering restarts after bucket wipe
      const existingNumbers = Object.values(folderMapping).map(m => m.patientNumber || 0);
      patientCounter = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
      try { localStorage.setItem('mevreon_patient_counter', String(patientCounter)); } catch {}
      
      // Step 1: Build case entries (no S3 calls yet)
      for (const caseId of caseFolders) {
        if (!newCases[caseId]) {
          if (!folderMapping[caseId]) {
            folderMapping[caseId] = {
              patientNumber: getPatientNumber(),
              folderName: displayName(caseId)
            };
          }
          newCases[caseId] = {
            id: caseId,
            folderName: folderMapping[caseId].folderName || displayName(caseId),
            patientNumber: folderMapping[caseId].patientNumber,
            patientLabel: `Patient ${folderMapping[caseId].patientNumber}`,
            files: {},
            agentOutputs: {},
            rawFiles: [],
            runs: {}
          };
        }
        if (!newCases[caseId].folderName) newCases[caseId].folderName = folderMapping[caseId]?.folderName || displayName(caseId);
        if (!newCases[caseId].patientLabel && folderMapping[caseId]) {
          newCases[caseId].patientNumber = folderMapping[caseId].patientNumber;
          newCases[caseId].patientLabel = `Patient ${folderMapping[caseId].patientNumber}`;
        }
      }
      
      // Step 2: Load raw files in batches of 6 to avoid ERR_INSUFFICIENT_RESOURCES
      const RAW_FILE_BATCH_SIZE = 6;
      const loadRawFilesForCase = async (caseId) => {
        const rawPrefix = caseId.replace(/\+/g, ' ');
        try {
          let rawFiles = await s3.send(new ListObjectsV2Command({
            Bucket: CONFIG.buckets.RAW,
            Prefix: `${caseId}/`
          }));
          let contents = rawFiles.Contents || [];
          if (contents.length === 0 && rawPrefix !== caseId) {
            rawFiles = await s3.send(new ListObjectsV2Command({
              Bucket: CONFIG.buckets.RAW,
              Prefix: `${rawPrefix}/`
            }));
            contents = rawFiles.Contents || [];
          }
          const seenRaw = new Set();
          const filteredRawFiles = contents
            .filter(obj => {
              const name = (obj.Key || '').split('/').pop() || obj.Key;
              return name && name !== '__PROCESS__' && !name.startsWith('__PROCESS');
            })
            .filter(obj => {
              // Dedupe duplicate uploads (same file name + size appearing in
              // nested folders, e.g. NEUROLOGY/ and NEUROLOGY/NEUROLOGY/)
              const dedupeKey = `${(obj.Key || '').split('/').pop()}|${obj.Size || 0}`;
              if (seenRaw.has(dedupeKey)) return false;
              seenRaw.add(dedupeKey);
              return true;
            })
            .map(obj => ({
              key: obj.Key,
              name: (obj.Key || '').split('/').pop() || obj.Key,
              size: obj.Size || 0,
              lastModified: obj.LastModified,
              bucket: CONFIG.buckets.RAW
            }));
          newCases[caseId].rawFileCount = filteredRawFiles.length;
          newCases[caseId].rawFiles = filteredRawFiles;
        } catch {
          if (!newCases[caseId].rawFiles) newCases[caseId].rawFiles = [];
          if (newCases[caseId].rawFileCount === undefined) newCases[caseId].rawFileCount = 0;
        }
      };
      for (let i = 0; i < caseFolders.length; i += RAW_FILE_BATCH_SIZE) {
        const batch = caseFolders.slice(i, i + RAW_FILE_BATCH_SIZE);
        await Promise.all(batch.map(loadRawFilesForCase));
      }
      
      // Save folder mapping
      try {
        localStorage.setItem('mevreon_folder_mapping', JSON.stringify(folderMapping));
      } catch {}
      
      // 2. Scan CURATED bucket for narratives/results (paginated)
      let curatedListingSucceeded = false;
      try {
        const curatedObjects = [];
        let curatedToken;
        do {
          const curatedResponse = await s3.send(new ListObjectsV2Command({
            Bucket: CONFIG.buckets.CURATED,
            Prefix: 'cases/',
            ContinuationToken: curatedToken
          }));
          curatedObjects.push(...(curatedResponse.Contents || []));
          curatedToken = curatedResponse.IsTruncated ? curatedResponse.NextContinuationToken : undefined;
        } while (curatedToken);

        for (const obj of curatedObjects) {
          if (!obj.Key) continue;
          
          if (obj.Key.endsWith('LONGITUDINAL_PATIENT_NARRATIVE.json')) {
            const parts = obj.Key.split('/');
            const rawCaseId = parts[1];
            if (!rawCaseId) continue;
            // Normalize to match RAW bucket caseId format
            const caseId = normalizeCaseId(rawCaseId);
            
            if (!newCases[caseId]) {
              if (!folderMapping[caseId]) {
                folderMapping[caseId] = { patientNumber: getPatientNumber(), folderName: displayName(caseId) };
              }
              newCases[caseId] = {
                id: caseId,
                folderName: displayName(caseId),
                patientNumber: folderMapping[caseId].patientNumber,
                patientLabel: `Patient ${folderMapping[caseId].patientNumber}`,
                files: {},
                agentOutputs: {},
                rawFiles: [],
                runs: {}
              };
            }
            
            newCases[caseId].lastModified = obj.LastModified?.toISOString();
            const shouldHydrateNarrative = selectedCase?.id === caseId;
            if (!shouldHydrateNarrative && !newCases[caseId].narrative) {
              // Lightweight marker so dashboard can render quickly without pulling large JSON for every case.
              newCases[caseId].narrative = { _lazy: true };
            }
            if (shouldHydrateNarrative) {
              try {
                const data = await s3.send(new GetObjectCommand({
                  Bucket: CONFIG.buckets.CURATED,
                  Key: obj.Key
                }));
                const content = await data.Body.transformToString();
                const rawNarrative = safeParseJSON(content, null);
                newCases[caseId].narrative = parseNarrativeData(rawNarrative);
              } catch (e) {
                console.warn('Failed to load narrative for', caseId);
              }
            }
            // Mark feature agent as complete since narrative exists in CURATED
            if (!newCases[caseId].agentOutputs.feature) newCases[caseId].agentOutputs.feature = [];
            if (!newCases[caseId].agentOutputs.feature.find(x => x.key === obj.Key)) {
              newCases[caseId].agentOutputs.feature.push({
                key: obj.Key, size: obj.Size, lastModified: obj.LastModified,
                name: obj.Key.split('/').pop(), bucket: CONFIG.buckets.CURATED, sourceFileName: ''
              });
            }
          }
          
          // Load judge report from CURATED (lazy — only fetch content for selected case)
          if (obj.Key.includes('JUDGE_REPORT.json') || obj.Key.includes('06_JUDGE_REPORT.json') || obj.Key.includes('JUDGE_REPORT_COMPARE.json')) {
            const parts = obj.Key.split('/');
            const rawCaseId = parts[1];
            if (!rawCaseId) continue;
            const caseId = normalizeCaseId(rawCaseId);
            
            if (newCases[caseId]) {
              const isCompare = obj.Key.includes('JUDGE_REPORT_COMPARE.json');
              let runId = null;
              if (parts[2] === 'runs' && parts.length >= 5) runId = parts[3];

              // Mark agent output exists (lightweight — no download)
              if (!isCompare && !runId) {
                if (!newCases[caseId].agentOutputs.judge) newCases[caseId].agentOutputs.judge = [];
                if (!newCases[caseId].agentOutputs.judge.find(x => x.key === obj.Key)) {
                  newCases[caseId].agentOutputs.judge.push({
                    key: obj.Key, size: obj.Size, lastModified: obj.LastModified,
                    name: obj.Key.split('/').pop(), bucket: CONFIG.buckets.CURATED, sourceFileName: ''
                  });
                }
              }

              // Only download full content for the selected case
              if (selectedCase?.id === caseId) {
                try {
                  const data = await s3.send(new GetObjectCommand({ Bucket: CONFIG.buckets.CURATED, Key: obj.Key }));
                  const content = await data.Body.transformToString();
                  const judgeContent = safeParseJSON(content, null);
                  if (runId) {
                    if (!newCases[caseId].runs) newCases[caseId].runs = {};
                    if (!newCases[caseId].runs[runId]) newCases[caseId].runs[runId] = {};
                    if (isCompare) newCases[caseId].runs[runId].judgeReportCompare = judgeContent;
                    else newCases[caseId].runs[runId].judgeReport = judgeContent;
                  } else if (!isCompare) {
                    newCases[caseId].judgeReport = judgeContent;
                  }
                } catch (e) {
                  console.warn('Failed to load judge report for', caseId, e);
                }
              }
            }
          }
          
          // Load DASHBOARD.json from CURATED (lazy — only fetch content for selected case)
          if (obj.Key.endsWith('DASHBOARD.json')) {
            const parts = obj.Key.split('/');
            const rawCaseId = parts[1];
            if (!rawCaseId) continue;
            const caseId = normalizeCaseId(rawCaseId);
            
            if (newCases[caseId]) {
              newCases[caseId].hasDashboard = true;
              let runId = null;
              if (parts[2] === 'runs' && parts.length >= 5) runId = parts[3];

              // Only download full content for the selected case
              if (selectedCase?.id === caseId) {
                try {
                  const data = await s3.send(new GetObjectCommand({ Bucket: CONFIG.buckets.CURATED, Key: obj.Key }));
                  const content = await data.Body.transformToString();
                  const dashboardContent = safeParseJSON(content, null);
                  if (runId) {
                    if (!newCases[caseId].runs) newCases[caseId].runs = {};
                    if (!newCases[caseId].runs[runId]) newCases[caseId].runs[runId] = {};
                    newCases[caseId].runs[runId].dashboard = dashboardContent;
                    newCases[caseId].runs[runId].timestamp = obj.LastModified;
                  } else {
                    newCases[caseId].dashboard = dashboardContent;
                  }
                } catch {}
              }
            }
          }
          
          // Load COMPASS_PREDICTION.json from CURATED (lazy)
          if (obj.Key.endsWith('COMPASS_PREDICTION.json')) {
            const parts = obj.Key.split('/');
            const rawCaseId = parts[1];
            if (!rawCaseId) continue;
            const caseId = normalizeCaseId(rawCaseId);
            
            if (newCases[caseId]) {
              newCases[caseId].hasCompassPrediction = true;
              if (!newCases[caseId].agentOutputs.compass) newCases[caseId].agentOutputs.compass = [];
              if (!newCases[caseId].agentOutputs.compass.find(x => x.key === obj.Key)) {
                newCases[caseId].agentOutputs.compass.push({
                  key: obj.Key, size: obj.Size, lastModified: obj.LastModified,
                  name: obj.Key.split('/').pop(), bucket: CONFIG.buckets.CURATED, sourceFileName: ''
                });
              }
              if (selectedCase?.id === caseId) {
                try {
                  const data = await s3.send(new GetObjectCommand({ Bucket: CONFIG.buckets.CURATED, Key: obj.Key }));
                  const content = await data.Body.transformToString();
                  newCases[caseId].compassPrediction = safeParseJSON(content, null);
                } catch {}
              }
            }
          }
          
          // Load MADRIGAL_DDI.json from CURATED (lazy)
          if (obj.Key.endsWith('MADRIGAL_DDI.json')) {
            const parts = obj.Key.split('/');
            const rawCaseId = parts[1];
            if (!rawCaseId) continue;
            const caseId = normalizeCaseId(rawCaseId);
            
            if (newCases[caseId]) {
              newCases[caseId].hasMadrigalDDI = true;
              if (!newCases[caseId].agentOutputs.madrigal) newCases[caseId].agentOutputs.madrigal = [];
              if (!newCases[caseId].agentOutputs.madrigal.find(x => x.key === obj.Key)) {
                newCases[caseId].agentOutputs.madrigal.push({
                  key: obj.Key, size: obj.Size, lastModified: obj.LastModified,
                  name: obj.Key.split('/').pop(), bucket: CONFIG.buckets.CURATED, sourceFileName: ''
                });
              }
              if (selectedCase?.id === caseId) {
                try {
                  const data = await s3.send(new GetObjectCommand({ Bucket: CONFIG.buckets.CURATED, Key: obj.Key }));
                  const content = await data.Body.transformToString();
                  newCases[caseId].madrigalDDI = safeParseJSON(content, null);
                } catch {}
              }
            }
          }

          // Load PINNACLE_DISCOVERY.json from CURATED (lazy)
          if (obj.Key.endsWith('PINNACLE_DISCOVERY.json')) {
            const parts = obj.Key.split('/');
            const rawCaseId = parts[1];
            if (!rawCaseId) continue;
            const caseId = normalizeCaseId(rawCaseId);

            if (newCases[caseId]) {
              newCases[caseId].hasPinnacleDiscovery = true;
              if (!newCases[caseId].agentOutputs.pinnacle) newCases[caseId].agentOutputs.pinnacle = [];
              if (!newCases[caseId].agentOutputs.pinnacle.find(x => x.key === obj.Key)) {
                newCases[caseId].agentOutputs.pinnacle.push({
                  key: obj.Key, size: obj.Size, lastModified: obj.LastModified,
                  name: obj.Key.split('/').pop(), bucket: CONFIG.buckets.CURATED, sourceFileName: ''
                });
              }
              if (selectedCase?.id === caseId) {
                try {
                  const data = await s3.send(new GetObjectCommand({ Bucket: CONFIG.buckets.CURATED, Key: obj.Key }));
                  const content = await data.Body.transformToString();
                  newCases[caseId].pinnacleDiscovery = safeParseJSON(content, null);
                } catch {}
              }
            }
          }
          // Load PDF report manifest from CURATED
          if (obj.Key.endsWith('reports/MANIFEST.json')) {
            const parts = obj.Key.split('/');
            const rawCaseId = parts[1];
            if (!rawCaseId) continue;
            const caseId = normalizeCaseId(rawCaseId);
            
            if (newCases[caseId]) {
              try {
                const data = await s3.send(new GetObjectCommand({
                  Bucket: CONFIG.buckets.CURATED,
                  Key: obj.Key
                }));
                const content = await data.Body.transformToString();
                newCases[caseId].pdfManifest = safeParseJSON(content, null);
              } catch {}
            }
          }

          // Load encounter files
          if (obj.Key.includes('/encounters/')) {
            const parts = obj.Key.split('/');
            const rawCaseId = parts[1];
            const caseId = normalizeCaseId(rawCaseId);
            if (newCases[caseId]) {
              const fname = (obj.Key || '').split('/').pop();
              if (fname) {
                const fParts = fname.split('__');
                if (fParts.length >= 2) {
                  const runId = fParts[0];
                  newCases[caseId].files[runId] = {
                    runId,
                    filename: fParts.slice(1).join('__').replace('.json', ''),
                    size: obj.Size,
                    timestamp: obj.LastModified,
                    key: obj.Key,
                    bucket: CONFIG.buckets.CURATED,
                    name: fname
                  };
                }
              }
            }
          }
        }
        curatedListingSucceeded = true;
        console.log(`[POLL] CURATED bucket: scanned ${curatedObjects.length} objects`);
      } catch (curatedErr) {
        console.error('[POLL] ✗ CURATED bucket listing FAILED:', curatedErr?.message || curatedErr);
      }

      // ── Infer upstream agent completion from downstream outputs ──
      // If feature (narrative) exists, the entire ingestion→cleaning→validation pipeline completed.
      // If judge exists, ALL stages completed. Mark them so the pipeline progress bar renders correctly.
      for (const caseId of Object.keys(newCases)) {
        const c = newCases[caseId];
        if (!c?.agentOutputs) continue;
        const ao = c.agentOutputs;

        // Feature agent means ingestion+cleaning+validation all finished
        if (ao.feature && ao.feature.length > 0) {
          if (!ao.ingestion || ao.ingestion.length === 0) ao.ingestion = [{ key: '_inferred_', name: 'ingestion_complete', bucket: CONFIG.buckets.STAGING, _inferred: true }];
          if (!ao.cleaning || ao.cleaning.length === 0) ao.cleaning = [{ key: '_inferred_', name: 'cleaning_complete', bucket: CONFIG.buckets.PROCESSED, _inferred: true }];
          if (!ao.validation || ao.validation.length === 0) ao.validation = [{ key: '_inferred_', name: 'validation_complete', bucket: CONFIG.buckets.PROCESSED, _inferred: true }];
        }
        // Judge means everything ran
        if (ao.judge && ao.judge.length > 0) {
          if (!ao.ingestion || ao.ingestion.length === 0) ao.ingestion = [{ key: '_inferred_', name: 'ingestion_complete', bucket: CONFIG.buckets.STAGING, _inferred: true }];
          if (!ao.cleaning || ao.cleaning.length === 0) ao.cleaning = [{ key: '_inferred_', name: 'cleaning_complete', bucket: CONFIG.buckets.PROCESSED, _inferred: true }];
          if (!ao.validation || ao.validation.length === 0) ao.validation = [{ key: '_inferred_', name: 'validation_complete', bucket: CONFIG.buckets.PROCESSED, _inferred: true }];
          if (!ao.feature || ao.feature.length === 0) ao.feature = [{ key: '_inferred_', name: 'feature_complete', bucket: CONFIG.buckets.CURATED, _inferred: true }];
        }
      }

      // 3. Scan STAGING + PROCESSED buckets for pipeline outputs under runs/ prefix
      // Disabled in normal polling to keep first-load performance fast on fresh machines.
      const runDeepOutputScan = false;
      if (runDeepOutputScan) {
      // Backend stores:
      //   Per-file: runs/{run_id}__{case}__{filename}/01_INGESTION.json (STAGING + MEMORY)
      //   Combined: runs/{run_id}__{case}/02_BATCH_CLEANING.json (PROCESSED)
      //   Per-file: runs/{run_id}__{case}__{filename}/02_BATCH_CLEANING.json (PROCESSED)
      //   Combined: runs/{run_id}__{case}/03_BATCH_VALIDATION.json (PROCESSED)
      //   Per-file: runs/{run_id}__{case}__{filename}/03_BATCH_VALIDATION.json (PROCESSED)
      const safeFileName = (name) => (name || '').replace(/[^a-zA-Z0-9._-]/g, '_');
      
      const agentFileMap = {
        '01_INGESTION.json': { id: 'ingestion', bucket: CONFIG.buckets.STAGING },
        'ingestion_output.json': { id: 'ingestion', bucket: CONFIG.buckets.STAGING },
        '02_BATCH_CLEANING.json': { id: 'cleaning', bucket: CONFIG.buckets.PROCESSED },
        '02_CLEANING.json': { id: 'cleaning', bucket: CONFIG.buckets.PROCESSED },
        'cleaning_output.json': { id: 'cleaning', bucket: CONFIG.buckets.PROCESSED },
        'batch_cleaning_output.json': { id: 'cleaning', bucket: CONFIG.buckets.PROCESSED },
        '03_BATCH_VALIDATION.json': { id: 'validation', bucket: CONFIG.buckets.PROCESSED },
        '03_VALIDATION.json': { id: 'validation', bucket: CONFIG.buckets.PROCESSED },
        'validation_output.json': { id: 'validation', bucket: CONFIG.buckets.PROCESSED },
        'batch_validation_output.json': { id: 'validation', bucket: CONFIG.buckets.PROCESSED },
        '04_LONGITUDINAL_NARRATIVE.json': { id: 'feature', bucket: CONFIG.buckets.MEMORY },
        'feature_output.json': { id: 'feature', bucket: CONFIG.buckets.MEMORY },
        'PINNACLE_DISCOVERY.json': { id: 'pinnacle', bucket: CONFIG.buckets.CURATED },
        '06_JUDGE_REPORT.json': { id: 'judge', bucket: CONFIG.buckets.MEMORY },
        'JUDGE_REPORT.json': { id: 'judge', bucket: CONFIG.buckets.CURATED }
      };
      
      // Helper to list all objects under runs/ in a bucket
      const listRunObjects = async (bucket) => {
        const all = [];
        let cToken;
        try {
          do {
            const resp = await s3.send(new ListObjectsV2Command({
              Bucket: bucket,
              Prefix: 'runs/',
              ContinuationToken: cToken
            }));
            all.push(...(resp.Contents || []));
            cToken = resp.IsTruncated ? resp.NextContinuationToken : undefined;
          } while (cToken);
        } catch {}
        return all;
      };

      // Build a lookup of safe filenames AND safe case_ids to caseIds
      // Path pattern: runs/{run_id}__{case}__{filename}/... or runs/{run_id}__{case}/...
      // Special cases: runs/{run_id}__{case}__unknown/ (feature) or runs/{run_id}__{case}____PROCESS__/ (judge)
      const safeToCaseMap = {};
      const safeCaseIdMap = {};
      for (const caseId of Object.keys(newCases)) {
        // Map safe case_id to original case_id
        const safeCaseId = safeFileName(caseId);
        if (safeCaseId) safeCaseIdMap[safeCaseId] = caseId;
        // Also map safe filenames to case_id for per-file matching
        for (const rf of (newCases[caseId].rawFiles || [])) {
          const safe = safeFileName(rf.name);
          if (safe) safeToCaseMap[safe] = caseId;
        }
      }

      // Helper to extract case_id from folder pattern:
      // {run_id}__{case} (combined output)
      // {run_id}__{case}__{filename} (per-file output)
      // {run_id}__{case}__unknown (feature narrative)
      // {run_id}__{case}____PROCESS__ (judge report - note 4 underscores)
      const extractCaseFromFolder = (runFolder) => {
        const dunderIdx = runFolder.indexOf('__');
        if (dunderIdx < 0) return { caseId: null, sourceFile: '' };
        
        // Everything after first __ is {case} or {case}__{filename}
        const afterRunId = runFolder.substring(dunderIdx + 2);
        const secondDunder = afterRunId.indexOf('__');
        
        if (secondDunder < 0) {
          // It's {run_id}__{case} (combined output)
          const safeCaseId = afterRunId;
          const matchedCaseId = safeCaseIdMap[safeCaseId] || null;
          return { caseId: matchedCaseId, sourceFile: '' };
        } else {
          // It's {run_id}__{case}__{filename} (per-file output)
          // or {run_id}__{case}__unknown (feature)
          // or {run_id}__{case}____PROCESS__ (judge)
          const safeCaseId = afterRunId.substring(0, secondDunder);
          const safeFilename = afterRunId.substring(secondDunder + 2);
          const matchedCaseId = safeCaseIdMap[safeCaseId] || null;
          return { caseId: matchedCaseId, sourceFile: safeFilename };
        }
      };
      
      // Scan STAGING bucket
      const stagingObjs = await listRunObjects(CONFIG.buckets.STAGING);
      for (const obj of stagingObjs) {
        const key = obj.Key || '';
        const fname = key.split('/').pop();
        const agentInfo = agentFileMap[fname];
        if (!agentInfo || agentInfo.id !== 'ingestion') continue;
        
        // Extract case_id from path: runs/{run_id}__{case}__{filename}/01_INGESTION.json
        const parts = key.split('/');
        if (parts.length < 3) continue;
        const runFolder = parts[1] || '';
        const { caseId: matchedCaseId, sourceFile } = extractCaseFromFolder(runFolder);
        
        if (matchedCaseId && newCases[matchedCaseId]) {
          if (!newCases[matchedCaseId].agentOutputs.ingestion) newCases[matchedCaseId].agentOutputs.ingestion = [];
          // Avoid duplicates
          if (!newCases[matchedCaseId].agentOutputs.ingestion.find(x => x.key === key)) {
            newCases[matchedCaseId].agentOutputs.ingestion.push({
              key, size: obj.Size, lastModified: obj.LastModified,
              name: fname, bucket: CONFIG.buckets.STAGING, sourceFileName: sourceFile
            });
          }
        }
      }
      
      // Scan PROCESSED bucket (cleaning + validation)
      const processedObjs = await listRunObjects(CONFIG.buckets.PROCESSED);
      for (const obj of processedObjs) {
        const key = obj.Key || '';
        const fname = key.split('/').pop();
        const agentInfo = agentFileMap[fname];
        if (!agentInfo || agentInfo.id === 'ingestion' || agentInfo.id === 'feature') continue;
        
        // Extract case_id from path: runs/{run_id}__{case}/02_BATCH_CLEANING.json or runs/{run_id}__{case}__{filename}/...
        const parts = key.split('/');
        if (parts.length < 3) continue;
        const runFolder = parts[1] || '';
        const { caseId: matchedCaseId, sourceFile } = extractCaseFromFolder(runFolder);
        
        if (matchedCaseId && newCases[matchedCaseId]) {
          const agentId = agentInfo.id;
          if (!newCases[matchedCaseId].agentOutputs[agentId]) newCases[matchedCaseId].agentOutputs[agentId] = [];
          if (!newCases[matchedCaseId].agentOutputs[agentId].find(x => x.key === key)) {
            newCases[matchedCaseId].agentOutputs[agentId].push({
              key, size: obj.Size, lastModified: obj.LastModified,
              name: fname, bucket: CONFIG.buckets.PROCESSED, sourceFileName: sourceFile
            });
          }
        }
      }

      // Scan MEMORY bucket (all agent outputs including ingestion, cleaning, validation, feature, judge)
      const memoryBucket = CONFIG.buckets.MEMORY;
      const memoryObjs = await listRunObjects(memoryBucket);
      for (const obj of memoryObjs) {
        const key = obj.Key || '';
        const fname = key.split('/').pop();
        const agentInfo = agentFileMap[fname];
        if (!agentInfo) continue;

        // Extract case_id from path: runs/{run_id}__{case}__{filename}/... or runs/{run_id}__{case}/...
        const parts = key.split('/');
        if (parts.length < 3) continue;
        const runFolder = parts[1] || '';
        const { caseId: matchedCaseId, sourceFile } = extractCaseFromFolder(runFolder);

        if (matchedCaseId && newCases[matchedCaseId]) {
          const agentId = agentInfo.id;
          
          // For judge reports, load and parse the actual content
          if (agentId === 'judge' && !newCases[matchedCaseId].judgeReport) {
            try {
              const data = await s3.send(new GetObjectCommand({
                Bucket: memoryBucket,
                Key: key
              }));
              const content = await data.Body.transformToString();
              const judgeContent = safeParseJSON(content, null);
              newCases[matchedCaseId].judgeReport = judgeContent;
              
              if (!newCases[matchedCaseId].agentOutputs[agentId]) newCases[matchedCaseId].agentOutputs[agentId] = [];
              if (!newCases[matchedCaseId].agentOutputs[agentId].find(x => x.key === key)) {
                newCases[matchedCaseId].agentOutputs[agentId].push({
                  key, size: obj.Size, lastModified: obj.LastModified,
                  name: fname, bucket: memoryBucket, sourceFileName: sourceFile,
                  data: judgeContent
                });
              }
            } catch (e) {
              console.warn('Failed to load judge from memory bucket:', e);
            }
          } else {
            if (!newCases[matchedCaseId].agentOutputs[agentId]) newCases[matchedCaseId].agentOutputs[agentId] = [];
            if (!newCases[matchedCaseId].agentOutputs[agentId].find(x => x.key === key)) {
              newCases[matchedCaseId].agentOutputs[agentId].push({
                key, size: obj.Size, lastModified: obj.LastModified,
                name: fname, bucket: memoryBucket, sourceFileName: sourceFile
              });
            }
          }
        }
      }
      
      }

      // Keep patient numbers stable once assigned.
      const currentNumbers = Object.values(folderMapping).map(m => Number(m?.patientNumber) || 0);
      patientCounter = currentNumbers.length > 0 ? Math.max(...currentNumbers) : 0;
      try { localStorage.setItem('mevreon_patient_counter', String(patientCounter)); } catch {}

      // Save updated mapping
      try {
        localStorage.setItem('mevreon_folder_mapping', JSON.stringify(folderMapping));
      } catch {}

      // ── Preserve hydrated data for the selected case ──
      // The hydrateSelectedCase effect does deep S3 fetches (runs/, STAGING, PROCESSED) that
      // populate agentOutputs, narrative, dashboard, etc. Polling must NOT clobber those.
      const currentSelectedId = selectedCaseIdRef.current;
      if (currentSelectedId && newCases[currentSelectedId]) {
        // Use functional setState to get the latest cases state atomically
        setCases(prev => {
          const prevSelected = prev[currentSelectedId];
          if (prevSelected) {
            // Deep-merge agentOutputs: keep hydrated outputs, add any new poll-discovered ones
            const mergedOutputs = { ...(prevSelected.agentOutputs || {}) };
            const pollOutputs = newCases[currentSelectedId].agentOutputs || {};
            for (const [agentId, pollFiles] of Object.entries(pollOutputs)) {
              if (!mergedOutputs[agentId]) {
                mergedOutputs[agentId] = pollFiles;
              } else {
                // Merge: add any files from poll that aren't already present
                const existingKeys = new Set(mergedOutputs[agentId].map(f => f.key));
                for (const pf of pollFiles) {
                  if (!existingKeys.has(pf.key)) mergedOutputs[agentId].push(pf);
                }
              }
            }
            newCases[currentSelectedId] = {
              ...newCases[currentSelectedId],
              // Preserve deep-hydrated fields
              narrative: prevSelected.narrative && !prevSelected.narrative._lazy ? prevSelected.narrative : newCases[currentSelectedId].narrative,
              dashboard: prevSelected.dashboard || newCases[currentSelectedId].dashboard,
              judgeReport: prevSelected.judgeReport || newCases[currentSelectedId].judgeReport,
              compassPrediction: prevSelected.compassPrediction || newCases[currentSelectedId].compassPrediction,
              madrigalDDI: prevSelected.madrigalDDI || newCases[currentSelectedId].madrigalDDI,
              pinnacleDiscovery: prevSelected.pinnacleDiscovery || newCases[currentSelectedId].pinnacleDiscovery,
              rawFiles: (prevSelected.rawFiles?.length || 0) >= (newCases[currentSelectedId].rawFiles?.length || 0) ? prevSelected.rawFiles : newCases[currentSelectedId].rawFiles,
              rawFileCount: Math.max(prevSelected.rawFileCount || 0, newCases[currentSelectedId].rawFileCount || 0),
              agentOutputs: mergedOutputs,
              runs: { ...(prevSelected.runs || {}), ...(newCases[currentSelectedId].runs || {}) },
            };
          }
          return { ...prev, ...newCases };
        });
      } else {
        setCases(newCases);
      }
      console.log(`[POLL] ✓ Complete — ${Object.keys(newCases).length} cases loaded`);
    } catch (e) {
      console.error('[POLL] ✗ CRITICAL poll error:', e);
    }
    
    setIsPolling(false);
    isPollingRef.current = false;
  }, [s3, selectedCase?.id]);

  // Auto-poll — include pollData in deps so effect re-runs when s3 client changes
  useEffect(() => {
    if (auth) {
      pollData();
      const interval = setInterval(pollData, CONFIG.pollInterval);
      return () => clearInterval(interval);
    }
  }, [auth, pollData]);

  useEffect(() => {
    if (auth && selectedCase?.id) {
      pollData();
    }
  }, [auth, selectedCase?.id]);

  // ── Hydrate selected case: fetch full data directly when a patient is clicked ──
  // Uses Promise.all for PARALLEL fetches — all S3 calls fire simultaneously for instant loading.
  useEffect(() => {
    if (!s3 || !selectedCase?.id) return;
    const caseId = selectedCase.id;
    // Track this case in a ref so pollData can avoid clobbering it
    selectedCaseIdRef.current = caseId;
    let cancelled = false;
    
    setIsHydratingCase(true);

    const hydrateSelectedCase = async () => {
      console.log(`[HYDRATE] Fetching full data for case: ${caseId}`);
      const curatedBucket = CONFIG.buckets.CURATED;
      const rawBucket = CONFIG.buckets.RAW;

      const makeCaseIdVariants = (id) => {
        const out = [];
        const push = (v) => {
          if (!v || typeof v !== 'string') return;
          if (!out.includes(v)) out.push(v);
        };
        push(id);
        push(id.replace(/\+/g, ' '));
        try { push(decodeURIComponent(id)); } catch {}
        try { push(decodeURIComponent(id).replace(/\+/g, ' ')); } catch {}
        return out;
      };

      const caseIdVariants = makeCaseIdVariants(caseId);
      const safeCaseIdVariants = caseIdVariants.map((v) => v.replace(/[^a-zA-Z0-9._-]/g, '_'));

      // Helper: try to fetch and parse JSON from S3 with case-id variants.
      const fetchCaseScopedJSON = async (bucket, keyBuilder) => {
        for (const cid of caseIdVariants) {
          const key = keyBuilder(cid);
          try {
            const resp = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
            const content = await resp.Body.transformToString();
            return { data: safeParseJSON(content, null), key };
          } catch {
            // try next variant
          }
        }
        return { data: null, key: null };
      };

      // Helper: list objects under a prefix
      const listObjects = async (bucket, prefix) => {
        const all = [];
        let token;
        try {
          do {
            const resp = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token }));
            all.push(...(resp.Contents || []));
            token = resp.IsTruncated ? resp.NextContinuationToken : undefined;
          } while (token);
        } catch {}
        return all;
      };

      // ═══ FIRE ALL S3 FETCHES IN PARALLEL — this is the key speed optimization ═══
      const [narrativeResp, dashboardResp, judgeResp, compassResp, madrigalResp, pinnacleResp, rawObjects] = await Promise.all([
        // 1. Narrative
        fetchCaseScopedJSON(curatedBucket, (cid) => `cases/${cid}/LONGITUDINAL_PATIENT_NARRATIVE.json`),
        // 2. Dashboard
        fetchCaseScopedJSON(curatedBucket, (cid) => `cases/${cid}/DASHBOARD.json`),
        // 3. Judge report
        fetchCaseScopedJSON(curatedBucket, (cid) => `cases/${cid}/JUDGE_REPORT.json`),
        // 4. COMPASS prediction
        fetchCaseScopedJSON(curatedBucket, (cid) => `cases/${cid}/COMPASS_PREDICTION.json`),
        // 5. Madrigal DDI
        fetchCaseScopedJSON(curatedBucket, (cid) => `cases/${cid}/MADRIGAL_DDI.json`),
        // 6. PINNACLE discovery
        fetchCaseScopedJSON(curatedBucket, (cid) => `cases/${cid}/PINNACLE_DISCOVERY.json`),
        // 7. Raw files listing (try each variant until one works)
        (async () => {
          for (const cid of caseIdVariants) {
            const listed = await listObjects(rawBucket, `${cid}/`);
            if (listed.length > 0) return listed;
          }
          return [];
        })()
      ]);

      if (cancelled) return;

      // ═══ Build updates object from parallel results ═══
      const updates = {};
      if (!updates.agentOutputs) updates.agentOutputs = {};

      if (narrativeResp.data) {
        updates.narrative = parseNarrativeData(narrativeResp.data);
        updates.agentOutputs.feature = [{ key: narrativeResp.key, name: 'LONGITUDINAL_PATIENT_NARRATIVE.json', bucket: curatedBucket }];
      }
      if (dashboardResp.data) {
        updates.dashboard = dashboardResp.data;
        updates.hasDashboard = true;
      }
      if (judgeResp.data) {
        updates.judgeReport = judgeResp.data;
        updates.agentOutputs.judge = [{ key: judgeResp.key, name: 'JUDGE_REPORT.json', bucket: curatedBucket, data: judgeResp.data }];
      }
      if (compassResp.data) {
        updates.compassPrediction = compassResp.data;
        updates.hasCompassPrediction = true;
        updates.agentOutputs.compass = [{ key: compassResp.key, name: 'COMPASS_PREDICTION.json', bucket: curatedBucket }];
      }
      if (madrigalResp.data) {
        updates.madrigalDDI = madrigalResp.data;
        updates.hasMadrigalDDI = true;
        updates.agentOutputs.madrigal = [{ key: madrigalResp.key, name: 'MADRIGAL_DDI.json', bucket: curatedBucket }];
      }
      if (pinnacleResp.data) {
        updates.pinnacleDiscovery = pinnacleResp.data;
        updates.hasPinnacleDiscovery = true;
        updates.agentOutputs.pinnacle = [{ key: pinnacleResp.key, name: 'PINNACLE_DISCOVERY.json', bucket: curatedBucket }];
      }
      if (rawObjects.length > 0) {
        const seenRaw2 = new Set();
        updates.rawFiles = rawObjects
          .filter(obj => {
            const name = (obj.Key || '').split('/').pop();
            return name && name !== '__PROCESS__' && !name.startsWith('__PROCESS');
          })
          .filter(obj => {
            // Dedupe duplicate uploads (same file name + size in nested folders)
            const dedupeKey = `${(obj.Key || '').split('/').pop()}|${obj.Size || 0}`;
            if (seenRaw2.has(dedupeKey)) return false;
            seenRaw2.add(dedupeKey);
            return true;
          })
          .map(obj => ({
            key: obj.Key, name: (obj.Key || '').split('/').pop(),
            size: obj.Size || 0, lastModified: obj.LastModified, bucket: rawBucket
          }));
        updates.rawFileCount = updates.rawFiles.length;
      }

      // ── Infer upstream agent completion from what we found ──
      // If feature (narrative) exists, ingestion→cleaning→validation all completed.
      if (updates.agentOutputs.feature) {
        if (!updates.agentOutputs.ingestion) updates.agentOutputs.ingestion = [{ key: '_inferred_', name: 'ingestion_complete', bucket: CONFIG.buckets.STAGING, _inferred: true }];
        if (!updates.agentOutputs.cleaning) updates.agentOutputs.cleaning = [{ key: '_inferred_', name: 'cleaning_complete', bucket: CONFIG.buckets.PROCESSED, _inferred: true }];
        if (!updates.agentOutputs.validation) updates.agentOutputs.validation = [{ key: '_inferred_', name: 'validation_complete', bucket: CONFIG.buckets.PROCESSED, _inferred: true }];
      }

      // 8. Scan runs/ in STAGING, PROCESSED, MEMORY and CURATED for per-stage outputs (PARALLEL)
      const runBuckets = [CONFIG.buckets.STAGING, CONFIG.buckets.PROCESSED, CONFIG.buckets.MEMORY, CONFIG.buckets.CURATED];
      if (!cancelled) {
        const agentFileMap = {
          '01_INGESTION.json': 'ingestion',
          'ingestion_output.json': 'ingestion',
          '02_BATCH_CLEANING.json': 'cleaning',
          '02_CLEANING.json': 'cleaning',
          'cleaning_output.json': 'cleaning',
          'batch_cleaning_output.json': 'cleaning',
          '03_BATCH_VALIDATION.json': 'validation',
          '03_VALIDATION.json': 'validation',
          'validation_output.json': 'validation',
          'batch_validation_output.json': 'validation',
          '04_LONGITUDINAL_NARRATIVE.json': 'feature',
          'feature_output.json': 'feature',
          'LONGITUDINAL_PATIENT_NARRATIVE.json': 'feature',
          '06_JUDGE_REPORT.json': 'judge',
          'JUDGE_REPORT.json': 'judge',
        };
        const agentOutputs = { ...(updates.agentOutputs || {}) };

        const runFolderBelongsToCase = (runFolder) => {
          if (!runFolder || !runFolder.includes('__')) return false;
          const afterRunId = runFolder.split('__').slice(1).join('__');
          const normalizeForMatch = (s) => {
            try { s = decodeURIComponent(s); } catch {}
            return (s || '').replace(/[\s+]/g, '_').replace(/[^a-zA-Z0-9._-]/g, '_').toLowerCase();
          };
          const normAfter = normalizeForMatch(afterRunId);
          for (const safeCaseId of safeCaseIdVariants) {
            if (afterRunId === safeCaseId || afterRunId.startsWith(`${safeCaseId}__`)) return true;
            const normSafe = normalizeForMatch(safeCaseId);
            if (normAfter === normSafe || normAfter.startsWith(`${normSafe}__`)) return true;
          }
          for (const cid of caseIdVariants) {
            if (afterRunId === cid || afterRunId.startsWith(`${cid}__`)) return true;
            const normCid = normalizeForMatch(cid);
            if (normAfter === normCid || normAfter.startsWith(`${normCid}__`)) return true;
            try {
              const decoded = decodeURIComponent(afterRunId);
              if (decoded === cid || decoded.startsWith(`${cid}__`)) return true;
            } catch {}
          }
          return false;
        };

        const extractSourceFileName = (runFolder) => {
          const afterRunId = runFolder.split('__').slice(1).join('__');
          const secondDelimiter = afterRunId.indexOf('__');
          if (secondDelimiter < 0) return '';
          return afterRunId.substring(secondDelimiter + 2);
        };

        // Fire all run bucket scans in PARALLEL
        const allRunResults = await Promise.all(
          runBuckets.map(bucket => listObjects(bucket, 'runs/').then(objs => ({ bucket, objs })))
        );

        for (const { bucket, objs } of allRunResults) {
          for (const obj of objs) {
            if (!obj.Key) continue;
            const keyParts = obj.Key.split('/');
            if (keyParts.length < 3) continue;
            const runFolder = keyParts[1] || '';
            if (!runFolderBelongsToCase(runFolder)) continue;

            const fname = keyParts[keyParts.length - 1];
            const agentId = agentFileMap[fname];
            if (!agentId) continue;

            if (!agentOutputs[agentId]) agentOutputs[agentId] = [];
            if (!agentOutputs[agentId].find((x) => x.key === obj.Key)) {
              agentOutputs[agentId].push({
                key: obj.Key,
                size: obj.Size,
                lastModified: obj.LastModified,
                name: fname,
                bucket,
                sourceFileName: extractSourceFileName(runFolder),
              });
            }
          }
        }
        updates.agentOutputs = agentOutputs;
      }

      if (cancelled) return;

      // Merge updates into cases state
      setCases(prev => {
        const existing = prev[caseId] || {};
        const mergedOutputs = { ...(existing.agentOutputs || {}), ...(updates.agentOutputs || {}) };
        const merged = {
          ...existing,
          ...updates,
          agentOutputs: mergedOutputs
        };
        // Also update selectedCase so UI re-renders immediately
        setSelectedCase(merged);
        return { ...prev, [caseId]: merged };
      });
      console.log(`[HYDRATE] ✓ Done for ${caseId}`, Object.keys(updates));
    };

    hydrateSelectedCase().finally(() => {
      if (!cancelled) setIsHydratingCase(false);
    });
    return () => { cancelled = true; selectedCaseIdRef.current = null; setIsHydratingCase(false); };
  }, [s3, selectedCase?.id]);

  // Keep selectedCase in sync with latest polled data so live tracking works.
  // CRITICAL: Deep-merge agentOutputs instead of overwriting to preserve hydrated data.
  useEffect(() => {
    if (selectedCase && cases[selectedCase.id]) {
      const latest = cases[selectedCase.id];
      // Only update if data actually changed (shallow check on key fields + output counts)
      const outputsSignature = (outputs) => Object.entries(outputs || {})
        .map(([k, v]) => `${k}:${Array.isArray(v) ? v.length : 0}`)
        .sort()
        .join('|');
      const prevOutputSignature = outputsSignature(selectedCase.agentOutputs);
      const newOutputSignature = outputsSignature(latest.agentOutputs);
      const prevRawCount = (selectedCase.rawFiles || []).length;
      const newRawCount = (latest.rawFiles || []).length;
      const prevNarr = !!selectedCase.narrative && !selectedCase.narrative._lazy;
      const newNarr = !!latest.narrative && !latest.narrative._lazy;
      const prevRuns = Object.keys(selectedCase.runs || {}).sort().join(',');
      const newRuns = Object.keys(latest.runs || {}).sort().join(',');

      if (prevOutputSignature !== newOutputSignature || prevRawCount !== newRawCount || (!prevNarr && newNarr) || prevRuns !== newRuns) {
        // Deep-merge: keep the richer version of each field
        const mergedOutputs = { ...(selectedCase.agentOutputs || {}) };
        for (const [agentId, files] of Object.entries(latest.agentOutputs || {})) {
          if (!mergedOutputs[agentId]) {
            mergedOutputs[agentId] = files;
          } else {
            const existingKeys = new Set(mergedOutputs[agentId].map(f => f.key));
            for (const f of (files || [])) {
              if (!existingKeys.has(f.key)) mergedOutputs[agentId].push(f);
            }
          }
        }
        setSelectedCase({
          ...selectedCase,
          ...latest,
          // Prefer non-lazy, non-null versions
          narrative: (selectedCase.narrative && !selectedCase.narrative._lazy) ? selectedCase.narrative : latest.narrative,
          dashboard: selectedCase.dashboard || latest.dashboard,
          judgeReport: selectedCase.judgeReport || latest.judgeReport,
          compassPrediction: selectedCase.compassPrediction || latest.compassPrediction,
          madrigalDDI: selectedCase.madrigalDDI || latest.madrigalDDI,
          pinnacleDiscovery: selectedCase.pinnacleDiscovery || latest.pinnacleDiscovery,
          rawFiles: (selectedCase.rawFiles?.length || 0) >= (latest.rawFiles?.length || 0) ? selectedCase.rawFiles : latest.rawFiles,
          agentOutputs: mergedOutputs,
          runs: { ...(selectedCase.runs || {}), ...(latest.runs || {}) },
        });
      }
    }
  }, [cases]);

  // Keep view state safe so main panel never goes blank on refresh or stale selection
  useEffect(() => {
    const validViews = new Set(['DASHBOARD', 'UPLOAD', 'CASE', 'SUMMARY', 'HISTORY']);
    if (!validViews.has(view)) {
      setView('DASHBOARD');
      return;
    }
    if ((view === 'CASE' || view === 'SUMMARY') && !selectedCase) {
      setView('DASHBOARD');
    }
  }, [view, selectedCase]);

  // Upload handler - uses folder name
  const normalizeUploadFolderName = (name) => safeString(name).trim().replace(/\s+/g, ' ');
  const getExistingUploadFolderNames = () => {
    const names = new Set();
    try {
      Object.values(cases || {}).forEach((c) => {
        const folder = normalizeUploadFolderName(c?.folderName || '');
        if (folder) names.add(folder.toLowerCase());
      });
    } catch {}
    try {
      const mapping = JSON.parse(localStorage.getItem('mevreon_folder_mapping') || '{}');
      Object.values(mapping || {}).forEach((item) => {
        const folder = normalizeUploadFolderName(item?.folderName || '');
        if (folder) names.add(folder.toLowerCase());
      });
    } catch {}
    return names;
  };
  const getUniqueUploadFolderName = (desiredName, reservedNames = new Set()) => {
    const baseName = normalizeUploadFolderName(desiredName);
    if (!baseName) return baseName;

    const usedNames = new Set([
      ...getExistingUploadFolderNames(),
      ...Array.from(reservedNames).map((name) => normalizeUploadFolderName(name).toLowerCase()).filter(Boolean),
    ]);
    const baseKey = baseName.toLowerCase();
    if (!usedNames.has(baseKey)) return baseName;

    let suffix = 1;
    while (usedNames.has(`${baseKey}${suffix}`)) suffix++;
    return `${baseName}${suffix}`;
  };

  const handleUpload = async (filesToUpload, folderName, immunotherapyMeta, pinnacleMeta, madrigalMeta) => {
    const isPinnacleOnly = Boolean(pinnacleMeta?.enabled);
    const isCompassOnly = Boolean(immunotherapyMeta?.enabled && immunotherapyMeta?.discovery_only);
    const isMadrigalOnly = Boolean(madrigalMeta?.enabled && madrigalMeta?.discovery_only);
    if (!s3 || !filesToUpload || (filesToUpload.length === 0 && !isPinnacleOnly && !isCompassOnly && !isMadrigalOnly)) {
      showToast('No files to upload', 'warning');
      return;
    }
    
    setIsUploading(true);
    setUploadProgress(0);
    
    try {
      // Normalize folder name: replace spaces with '+' to match backend S3 key encoding
      const fallbackName = isPinnacleOnly
        ? `PINNACLE_${(pinnacleMeta?.disease_id || 'DISCOVERY').replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}`
        : isMadrigalOnly
        ? `MADRIGAL_DDI_${Date.now()}`
        : `Patient_${Date.now()}`;
      const displayFolderName = getUniqueUploadFolderName(folderName || fallbackName);
      const baseName = displayFolderName.replace(/ /g, '+');
      let caseId = baseName;
      
      // Check if this folder already exists — check React state, localStorage mapping, AND the RAW bucket
      let folderExists = !!cases[caseId];
      if (!folderExists) {
        try {
          const mapping = JSON.parse(localStorage.getItem('mevreon_folder_mapping') || '{}');
          folderExists = !!mapping[caseId];
        } catch {}
      }
      if (!folderExists) {
        try {
          const probe = await s3.send(new ListObjectsV2Command({
            Bucket: CONFIG.buckets.RAW,
            Prefix: `${caseId}/`,
            MaxKeys: 1
          }));
          folderExists = (probe.Contents || []).length > 0;
        } catch {}
      }
      if (folderExists) {
        // Same folder name already exists — append short timestamp to create a unique S3 prefix
        caseId = `${baseName}_${Date.now().toString(36)}`;
      }
      let uploaded = 0;
      let failed = 0;
      
      for (const fileObj of filesToUpload) {
        try {
          const file = fileObj.file;
          if (!file) { failed++; continue; }
          
          const arrayBuffer = await file.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);
          const key = `${caseId}/${fileObj.name}`;
          
          await s3.send(new PutObjectCommand({
            Bucket: CONFIG.buckets.RAW,
            Key: key,
            Body: uint8Array,
            ContentType: file.type || 'application/octet-stream'
          }));
          
          uploaded++;
          setUploadProgress(Math.floor((uploaded / filesToUpload.length) * 100));
        } catch (fileError) {
          console.error('Failed:', fileObj.name, fileError);
          failed++;
        }
      }

      // ── Upload optional agent inputs, then drop pipeline marker ──
      if (uploaded > 0 || isPinnacleOnly || isCompassOnly || isMadrigalOnly) {
        if (immunotherapyMeta && immunotherapyMeta.enabled) {
          try {
            if (immunotherapyMeta.gene_expression_file) {
              const geneFile = immunotherapyMeta.gene_expression_file;
              const geneExt = geneFile.name.split('.').pop().toLowerCase();
              const geneArrayBuffer = await geneFile.arrayBuffer();
              await s3.send(new PutObjectCommand({
                Bucket: CONFIG.buckets.RAW,
                Key: `${caseId}/compass_input.${geneExt}`,
                Body: new Uint8Array(geneArrayBuffer),
                ContentType: geneExt === 'tsv' ? 'text/tab-separated-values' : 'text/csv'
              }));
              console.log(`[UPLOAD] ✓ COMPASS gene expression file uploaded: compass_input.${geneExt}`);
            }

            const compassMeta = JSON.stringify({
              cancer_type: immunotherapyMeta.cancer_type,
              enabled: true,
              discovery_only: !!immunotherapyMeta.discovery_only,
              uploaded_at: new Date().toISOString(),
              gene_file: immunotherapyMeta.gene_expression_file?.name || 'unknown'
            });
            await s3.send(new PutObjectCommand({
              Bucket: CONFIG.buckets.RAW,
              Key: `${caseId}/compass_metadata.json`,
              Body: new TextEncoder().encode(compassMeta),
              ContentType: 'application/json'
            }));
            console.log(`[UPLOAD] ✓ COMPASS metadata uploaded: cancer_type=${immunotherapyMeta.cancer_type || 'AUTO'}`);
            showToast(
              immunotherapyMeta.cancer_type
                ? `Immunotherapy analysis enabled (${immunotherapyMeta.cancer_type})`
                : 'Immunotherapy analysis enabled (cancer type auto-detect)',
              'success'
            );
          } catch (compassErr) {
            console.error('[UPLOAD] ✗ Failed to upload COMPASS data:', compassErr);
            showToast('COMPASS data upload failed — immunotherapy analysis may not run', 'warning');
          }
        }

        if (pinnacleMeta && pinnacleMeta.enabled) {
          try {
            const pinnaclePayload = JSON.stringify({
              enabled: true,
              discovery_only: true,
              disease_id: pinnacleMeta.disease_id,
              protein_targets: pinnacleMeta.protein_targets || [],
              uploaded_at: new Date().toISOString()
            });
            await s3.send(new PutObjectCommand({
              Bucket: CONFIG.buckets.RAW,
              Key: `${caseId}/pinnacle_request.json`,
              Body: new TextEncoder().encode(pinnaclePayload),
              ContentType: 'application/json'
            }));
            console.log(`[UPLOAD] ✓ PINNACLE request uploaded: disease_id=${pinnacleMeta.disease_id}`);
            showToast(`PINNACLE discovery enabled (${pinnacleMeta.disease_id})`, 'success');
          } catch (pinnacleErr) {
            console.error('[UPLOAD] ✗ Failed to upload PINNACLE request:', pinnacleErr);
            showToast('PINNACLE request upload failed — discovery may not run', 'warning');
          }
        }

        if (madrigalMeta && madrigalMeta.enabled) {
          try {
            const madrigalPayload = JSON.stringify({
              enabled: true,
              discovery_only: true,
              medications: madrigalMeta.medications || [],
              uploaded_at: new Date().toISOString()
            });
            await s3.send(new PutObjectCommand({
              Bucket: CONFIG.buckets.RAW,
              Key: `${caseId}/madrigal_metadata.json`,
              Body: new TextEncoder().encode(madrigalPayload),
              ContentType: 'application/json'
            }));
            console.log(`[UPLOAD] ✓ MADRIGAL metadata uploaded: ${madrigalMeta.medications.length} medications`);
            showToast(`MADRIGAL DDI analysis submitted (${madrigalMeta.medications.length} medications)`, 'success');
          } catch (madrigalErr) {
            console.error('[UPLOAD] ✗ Failed to upload MADRIGAL metadata:', madrigalErr);
            showToast('MADRIGAL metadata upload failed — DDI analysis may not run', 'warning');
          }
        }
        try {
          const markerKey = isPinnacleOnly
            ? `${caseId}/PINNACLE/__PROCESS__`
            : isCompassOnly
            ? `${caseId}/COMPASS/__PROCESS__`
            : isMadrigalOnly
            ? `${caseId}/MADRIGAL/__PROCESS__`
            : `${caseId}/__PROCESS__`;
          await s3.send(new PutObjectCommand({
            Bucket: CONFIG.buckets.RAW,
            Key: markerKey,
            Body: new Uint8Array(0),
            ContentType: 'application/octet-stream'
          }));
          console.log(`[UPLOAD] ✓ __PROCESS__ marker created for ${markerKey} → pipeline triggered`);
        } catch (markerErr) {
          console.error('[UPLOAD] ✗ Failed to create __PROCESS__ marker:', markerErr);
          showToast('Files uploaded but pipeline trigger failed — contact admin', 'warning');
        }
      }

      // Save folder mapping
      try {
        let mapping = {};
        try { mapping = JSON.parse(localStorage.getItem('mevreon_folder_mapping') || '{}'); } catch {}
        if (!mapping[caseId]) {
          mapping[caseId] = { patientNumber: getPatientNumber(), folderName: displayFolderName };
        }
        localStorage.setItem('mevreon_folder_mapping', JSON.stringify(mapping));
      } catch {}
      
      if (uploaded > 0 || isPinnacleOnly || isCompassOnly || isMadrigalOnly) {
        showToast(
          isPinnacleOnly
            ? `PINNACLE discovery submitted for ${displayFolderName}`
            : isCompassOnly
            ? `COMPASS discovery submitted for ${displayFolderName}`
            : isMadrigalOnly
            ? `MADRIGAL DDI submitted for ${displayFolderName}`
            : `Uploaded ${uploaded} files for ${displayFolderName}${failed > 0 ? ` (${failed} failed)` : ''}`,
          isPinnacleOnly || isCompassOnly || isMadrigalOnly || uploaded === filesToUpload.length ? 'success' : 'warning'
        );
        // Auto-open the patient dashboard after upload
        await pollData();
        const uploadedCase = Object.values(cases).find(c => c?.id === caseId) || {
          id: caseId,
          folderName: displayFolderName,
          patientLabel: `Patient`,
          files: {},
          agentOutputs: {},
          rawFiles: filesToUpload.map(f => ({ name: f.name, size: f.file?.size || 0 }))
        };
        setSelectedCase(uploadedCase);
        setView('CASE');
      } else {
        showToast('Failed to upload any files', 'error');
      }
    } catch (e) {
      console.error('Upload error:', e);
      showToast('Upload failed: ' + (e.message || 'Unknown error'), 'error');
    }
    
    setIsUploading(false);
    setUploadProgress(0);
  };

  // ── Multi-Patient Upload: iterates through patient groups sequentially ──
  const handleMultiPatientUpload = async (patients) => {
    if (!s3 || !patients || patients.length === 0) {
      showToast('No patients to upload', 'warning');
      return;
    }
    setIsUploading(true);
    setUploadProgress(0);
    let totalPatients = patients.length;
    let successCount = 0;
    let failCount = 0;
    const reservedFolderNames = new Set();

    for (let pi = 0; pi < patients.length; pi++) {
      const patient = patients[pi];
      const filesToUpload = patient.files.filter(f => f.selected !== false);
      if (filesToUpload.length === 0) continue;

      try {
        const displayFolderName = getUniqueUploadFolderName(patient.folderName || `Patient_${Date.now()}`, reservedFolderNames);
        reservedFolderNames.add(displayFolderName.toLowerCase());
        const baseName = displayFolderName.replace(/ /g, '+');
        let caseId = baseName;

        // Check for duplicates
        let folderExists = !!cases[caseId];
        if (!folderExists) {
          try { const m = JSON.parse(localStorage.getItem('mevreon_folder_mapping') || '{}'); folderExists = !!m[caseId]; } catch {}
        }
        if (!folderExists) {
          try {
            const probe = await s3.send(new ListObjectsV2Command({ Bucket: CONFIG.buckets.RAW, Prefix: `${caseId}/`, MaxKeys: 1 }));
            folderExists = (probe.Contents || []).length > 0;
          } catch {}
        }
        if (folderExists) caseId = `${baseName}_${Date.now().toString(36)}`;

        let uploaded = 0;
        for (const fileObj of filesToUpload) {
          try {
            const file = fileObj.file;
            if (!file) continue;
            const arrayBuffer = await file.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            // Preserve internal folder structure: strip root + patient folder prefix to keep subfolder paths
            let fileKey = fileObj.name;
            if (fileObj.path) {
              const parts = fileObj.path.split('/');
              // parts: [root, patientFolder, ...rest] — keep rest as path
              if (parts.length > 2) fileKey = parts.slice(2).join('/');
            }
            await s3.send(new PutObjectCommand({
              Bucket: CONFIG.buckets.RAW,
              Key: `${caseId}/${fileKey}`,
              Body: uint8Array,
              ContentType: file.type || 'application/octet-stream'
            }));
            uploaded++;
          } catch (fileError) {
            console.error('Failed:', fileObj.name, fileError);
          }
        }

        if (uploaded > 0) {
          try {
            await s3.send(new PutObjectCommand({
              Bucket: CONFIG.buckets.RAW,
              Key: `${caseId}/__PROCESS__`,
              Body: new Uint8Array(0),
              ContentType: 'application/octet-stream'
            }));
          } catch (markerErr) {
            console.error('[MULTI-UPLOAD] __PROCESS__ marker failed for', caseId, markerErr);
          }

          try {
            let mapping = {};
            try { mapping = JSON.parse(localStorage.getItem('mevreon_folder_mapping') || '{}'); } catch {}
            if (!mapping[caseId]) mapping[caseId] = { patientNumber: getPatientNumber(), folderName: displayFolderName };
            localStorage.setItem('mevreon_folder_mapping', JSON.stringify(mapping));
          } catch {}

          successCount++;
        } else {
          failCount++;
        }
      } catch (e) {
        console.error('Multi-upload error for', patient.folderName, e);
        failCount++;
      }

      setUploadProgress(Math.floor(((pi + 1) / totalPatients) * 100));
    }

    if (successCount > 0) {
      showToast(
        `Uploaded ${successCount} patient${successCount > 1 ? 's' : ''}${failCount > 0 ? ` (${failCount} failed)` : ''} — pipeline triggered`,
        failCount > 0 ? 'warning' : 'success'
      );
      await pollData();
      setView('DASHBOARD');
    } else {
      showToast('Failed to upload any patients', 'error');
    }

    setIsUploading(false);
    setUploadProgress(0);
  };

  // Filter cases
  const filteredCases = useMemo(() => {
    try {
      return Object.values(cases || {}).filter(c => {
        if (!c) return false;
        if (!searchTerm) return true;
        const search = searchTerm.toLowerCase();
        return (c.id || '').toLowerCase().includes(search) ||
               (c.folderName || '').toLowerCase().includes(search) ||
               (c.patientLabel || '').toLowerCase().includes(search);
      }).sort((a, b) => {
        switch (patientSortBy) {
          case 'oldest': {
            const dateA = safeDate(a?.lastModified) || new Date(0);
            const dateB = safeDate(b?.lastModified) || new Date(0);
            return dateA - dateB;
          }
          case 'name-asc':
            return (a?.folderName || '').localeCompare(b?.folderName || '');
          case 'name-desc':
            return (b?.folderName || '').localeCompare(a?.folderName || '');
          case 'status': {
            const aCompleted = Object.keys(a?.agentOutputs || {}).length;
            const bCompleted = Object.keys(b?.agentOutputs || {}).length;
            return bCompleted - aCompleted;
          }
          case 'files': {
            const aFiles = (a?.rawFiles?.length || 0);
            const bFiles = (b?.rawFiles?.length || 0);
            return bFiles - aFiles;
          }
          case 'patient-asc': {
            const aNum = Number(a?.patientNumber) || 0;
            const bNum = Number(b?.patientNumber) || 0;
            return aNum - bNum;
          }
          case 'patient-desc': {
            const aNum = Number(a?.patientNumber) || 0;
            const bNum = Number(b?.patientNumber) || 0;
            return bNum - aNum;
          }
          case 'newest':
          default: {
            const dateA = safeDate(a?.lastModified) || new Date(0);
            const dateB = safeDate(b?.lastModified) || new Date(0);
            return dateB - dateA;
          }
        }
      });
    } catch {
      return [];
    }
  }, [cases, searchTerm, patientSortBy]);

  const { pinnacleCases, compassCases, madrigalCases, pipelineCases } = useMemo(() => {
    const pinnacle = [];
    const compass = [];
    const madrigal = [];
    const pipeline = [];
    // Filter by selected pipeline
    const casesToShow = currentPipeline ? filteredCases.filter(c => {
      const variant = getCaseVariant(c);
      const id = (c?.id || '').toUpperCase();
      switch (currentPipeline) {
        case 'clinical': return variant === 'pipeline' && !id.startsWith('MADRIGAL_DDI_');
        case 'immunotherapy': return variant === 'compass' || id.includes('COMPASS_');
        case 'discovery': return variant === 'pinnacle' || id.startsWith('PINNACLE_');
        case 'ddi': return variant === 'madrigal' || id.startsWith('MADRIGAL_DDI_');
        default: return true;
      }
    }) : filteredCases;
    casesToShow.forEach((c) => {
      const variant = getCaseVariant(c);
      if (variant === 'pinnacle') pinnacle.push(c);
      else if (variant === 'compass') compass.push(c);
      else if (variant === 'madrigal') madrigal.push(c);
      else pipeline.push(c);
    });
    return { pinnacleCases: pinnacle, compassCases: compass, madrigalCases: madrigal, pipelineCases: pipeline };
  }, [filteredCases, currentPipeline]);

  const { sidebarPinnacleCases, sidebarCompassCases, sidebarMadrigalCases, sidebarPipelineCases } = useMemo(() => {
    const allCases = Object.values(cases || {}).filter(Boolean).sort((a, b) => {
      const aNum = Number(a?.patientNumber) || 0;
      const bNum = Number(b?.patientNumber) || 0;
      return aNum - bNum;
    });

    const pinnacle = [];
    const compass = [];
    const madrigal = [];
    const pipeline = [];
    // Filter sidebar by current pipeline
    const casesToShow = currentPipeline ? allCases.filter(c => {
      const variant = getCaseVariant(c);
      const id = (c?.id || '').toUpperCase();
      switch (currentPipeline) {
        case 'clinical': return variant === 'pipeline' && !id.startsWith('MADRIGAL_DDI_');
        case 'immunotherapy': return variant === 'compass' || id.includes('COMPASS_');
        case 'discovery': return variant === 'pinnacle' || id.startsWith('PINNACLE_');
        case 'ddi': return variant === 'madrigal' || id.startsWith('MADRIGAL_DDI_');
        default: return true;
      }
    }) : allCases;
    casesToShow.forEach((c) => {
      const variant = getCaseVariant(c);
      if (variant === 'pinnacle') pinnacle.push(c);
      else if (variant === 'compass') compass.push(c);
      else if (variant === 'madrigal') madrigal.push(c);
      else pipeline.push(c);
    });

    return {
      sidebarPinnacleCases: pinnacle.slice(0, 12),
      sidebarCompassCases: compass.slice(0, 12),
      sidebarMadrigalCases: madrigal.slice(0, 12),
      sidebarPipelineCases: pipeline.slice(0, 12),
    };
  }, [cases, currentPipeline]);

  // ═══════════════════════════════════════════════════════════
  // LOGIN SCREEN
  // ═══════════════════════════════════════════════════════════

  if (!auth) {
    return (
      <div
        className={cn("min-h-screen flex items-center justify-center p-6 relative overflow-hidden cinematic-bg", t.bg, theme === 'dark' ? 'theme-dark' : 'theme-light')}
        onMouseMove={handleParallaxMove}
        onMouseLeave={handleParallaxLeave}
      >
        {/* Background Medical Animation */}
        <div className="absolute inset-0 opacity-5">
          <HeartbeatLine className="absolute top-1/4 left-0 w-full text-teal-500" />
          <HeartbeatLine className="absolute top-2/4 left-0 w-full text-cyan-500" style={{ animationDelay: '1s' }} />
          <HeartbeatLine className="absolute top-3/4 left-0 w-full text-indigo-500" style={{ animationDelay: '2s' }} />
        </div>
        
        <div className="w-full max-w-md relative z-10">
          <div className={cn("rounded-3xl border shadow-2xl p-8 mac-glass-panel float-in parallax-surface", t.card)} style={loginCardStyle}>
            <div className="flex justify-center mb-6">
              <StethoscopePulse />
            </div>
            
            <h1 className={cn("text-4xl font-black text-center mb-1", t.text)}>
              <span className="bg-gradient-to-r from-teal-400 via-cyan-400 to-indigo-400 bg-clip-text text-transparent">
                Medical AI
              </span>
            </h1>
            <h2 className={cn("text-3xl font-black text-center mb-2", t.text)}>
              <span className="bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">
                Command Center
              </span>
            </h2>
            <p className={cn("text-center mb-1 text-sm font-bold", t.textSecondary)}>
              Mevreon Multimodal Medical AI Agentic Platform
            </p>
            <div className="flex items-center justify-center gap-2 mb-6">
              <DNAHelixAnimation className="text-teal-400 opacity-50" />
              <p className={cn("text-center text-xs", t.textMuted)}>
                Longitudinal Patient Narrative Engine v7.0
              </p>
              <DNAHelixAnimation className="text-cyan-400 opacity-50" />
            </div>
            
            <div className="space-y-4">
              <div className={cn("p-3 rounded-lg border-l-4 border-amber-500 text-xs", t.bgTertiary, t.textSecondary)}>
                <p className="font-bold mb-1">Mevreon GCP Credentials Required</p>
                <p>Enter your Mevreon access keys to reach the medical records buckets and the agentic pipeline. If you don't have credentials, contact your system administrator.</p>
              </div>
              
              <div>
                <label className={cn("block text-xs font-bold uppercase mb-2", t.textSecondary)}>
                  Access Key ID
                </label>
                <input
                  className={cn("w-full p-3 rounded-xl border outline-none focus:border-teal-500 transition-colors", t.input)}
                  placeholder="MEVREON-GCP-ACCESS-...."
                  value={creds.accessKey}
                  onChange={e => setCreds({ ...creds, accessKey: e.target.value })}
                  autoComplete="off"
                />
                <p className={cn("text-xs mt-1", t.textMuted)}>Issued by your Mevreon administrator (API_ACCESS_KEY)</p>
              </div>
              
              <div>
                <label className={cn("block text-xs font-bold uppercase mb-2", t.textSecondary)}>
                  Secret Access Key
                </label>
                <input
                  className={cn("w-full p-3 rounded-xl border outline-none focus:border-teal-500 transition-colors", t.input)}
                  type="password"
                  placeholder="••••••••••••••••••••"
                  value={creds.secretKey}
                  onChange={e => setCreds({ ...creds, secretKey: e.target.value })}
                  autoComplete="off"
                />
                <p className={cn("text-xs mt-1", t.textMuted)}>Keep this secret — never share this key</p>
              </div>
              
              <button
                onClick={async () => {
                  const base = import.meta.env.VITE_API_BASE || '';
                  try {
                    const r = await fetch(`${base}/api/auth/key`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ accessKeyId: creds.accessKey, secretAccessKey: creds.secretKey })
                    });
                    if (r.ok) {
                      const j = await r.json();
                      initS3({ accessToken: j.accessToken });
                    } else {
                      showToast('Login failed: ' + ((await r.text()) || 'Invalid access keys'), 'error');
                    }
                  } catch (err) {
                    showToast('Connection failed: ' + (err.message || 'Unknown error'), 'error');
                  }
                }}
                disabled={!creds.accessKey || !creds.secretKey}
                className="w-full bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 disabled:from-slate-700 disabled:to-slate-700 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-teal-500/20"
              >
                <Lock size={18} />
                Secure Clinical Login
              </button>
            </div>
            
            <div className={cn("mt-6 p-4 rounded-xl", t.bgTertiary)}>
              <div className="flex items-center justify-center gap-4 mb-2">
                <MedicalShieldBadge label="HIPAA" theme={theme} />
                <MedicalShieldBadge label="SOC 2" theme={theme} />
                <MedicalShieldBadge label="HL7" theme={theme} />
              </div>
              <p className={cn("text-xs text-center", t.textMuted)}>
                Credentials stored locally only • AES-256 encrypted • PHI protected
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // MAIN INTERFACE
  // ═══════════════════════════════════════════════════════════

  return (
    <div
      className={cn("flex h-screen overflow-hidden app-shell cinematic-bg futuristic-grid", t.bg, t.text, theme === 'dark' ? 'theme-dark' : 'theme-light')}
      onMouseMove={handleParallaxMove}
      onMouseLeave={handleParallaxLeave}
    >
      {/* Sidebar */}
      <div className={cn("w-72 flex flex-col flex-shrink-0 border-r mac-glass-panel mac-sidebar", t.bgSecondary, t.border)}>
        {/* Logo */}
        <div className={cn("h-16 flex items-center px-6 border-b gap-3", t.border)}>
          <div className="h-10 w-10 bg-gradient-to-br from-teal-600 to-cyan-600 rounded-xl flex items-center justify-center">
            <Stethoscope size={20} className="text-white" />
          </div>
          <div>
            <span className={cn("font-bold text-lg", t.text)}>Mevreon</span>
            <div className={cn("text-[10px] font-mono", t.textMuted)}>Multimodal Medical AI</div>
          </div>
        </div>
        
        {/* Navigation */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          <button
            onClick={() => setView('UPLOAD')}
            disabled={isUploading}
            className={cn(
              "w-full bg-gradient-to-r from-teal-600 to-cyan-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-teal-500/10 neon-interactive pulse-border",
              isUploading && "opacity-50"
            )}
          >
            {isUploading ? <Spinner size="sm" /> : <FolderOpen size={18} />}
            {isUploading ? `${uploadProgress}%` : 'Upload Patient Files'}
          </button>
          
          <div className="space-y-1">
            {[
              { id: 'PIPELINE_HOME', icon: Home, label: 'All Pipelines', action: () => { setCurrentPipeline(null); setView('DASHBOARD'); setSelectedCase(null); } },
              { id: 'DASHBOARD', icon: LayoutDashboard, label: currentPipeline === 'clinical' ? 'Clinical Dashboard' : currentPipeline === 'immunotherapy' ? 'Immunotherapy' : currentPipeline === 'discovery' ? 'Target Discovery' : currentPipeline === 'ddi' ? 'Drug Interactions' : 'Dashboard', action: () => { setCurrentPipeline('clinical'); setView('DASHBOARD'); } },
              { id: 'HISTORY', icon: History, label: 'History' }
            ].map(item => (
              <button
                key={item.id}
                onClick={() => { if (item.action) { item.action(); } else { setView(item.id); setSelectedCase(null); } }}
                className={cn(
                  "w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-3 transition-all neon-interactive",
                  view === item.id ? "bg-teal-600 text-white" : cn(t.text, t.bgHover)
                )}
              >
                <item.icon size={18} />
                <span className="font-medium">{item.label}</span>
              </button>
            ))}
          </div>
          
          {/* Patient Cases */}
          <div>
            <div className={cn("px-3 text-xs font-bold uppercase mb-2 flex justify-between", t.textMuted)}>
              <span>Patients</span>
              <span className={cn("px-2 py-0.5 rounded-full", t.bgTertiary)}>{Object.keys(cases).length}</span>
            </div>
            
            <div className="space-y-1 max-h-80 overflow-y-auto custom-scrollbar">
              {Object.values(cases).length === 0 ? (
                <p className={cn("px-3 py-4 text-sm text-center", t.textMuted)}>No patients yet</p>
              ) : (
                <>
                  {sidebarPinnacleCases.length > 0 && (
                    <div className="pt-1 pb-1">
                      <div className={cn("px-3 mb-1 text-[10px] uppercase font-bold tracking-wider text-sky-400/90")}>Target Discovery</div>
                      {sidebarPinnacleCases.map(c => {
                        if (!c) return null;
                        return (
                          <button
                            key={c.id}
                            onClick={() => { setSelectedCase(c); setView('CASE'); }}
                            className={cn(
                              "w-full text-left px-3 py-2 rounded-lg transition-all neon-interactive",
                              selectedCase?.id === c.id ? "bg-sky-600 text-white" : cn('text-sky-100', t.bgHover)
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <LineChart size={14} className={selectedCase?.id === c.id ? 'text-white' : 'text-sky-300'} />
                              <div className="flex-1">
                                <span className="text-sm font-medium truncate block">{c.patientNumber ? `Patient ${c.patientNumber}` : (c.folderName || c.id)}</span>
                                <span className={cn("text-[10px] inline-flex items-center mt-0.5 px-1.5 py-0.5 rounded-full font-bold border", selectedCase?.id === c.id ? "bg-white/20 text-white border-white/30" : "bg-sky-500/15 text-sky-300 border-sky-500/25")}>DISCOVERY</span>
                              </div>
                              {c.pinnacleDiscovery && (
                                <CheckCircle size={12} className={selectedCase?.id === c.id ? 'text-white' : 'text-sky-300'} />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {sidebarCompassCases.length > 0 && (
                    <div className="pt-1 pb-1">
                      <div className={cn("px-3 mb-1 text-[10px] uppercase font-bold tracking-wider text-emerald-400/90")}>Immunotherapy</div>
                      {sidebarCompassCases.map(c => {
                        if (!c) return null;
                        return (
                          <button
                            key={c.id}
                            onClick={() => { setSelectedCase(c); setView('CASE'); }}
                            className={cn(
                              "w-full text-left px-3 py-2 rounded-lg transition-all neon-interactive",
                              selectedCase?.id === c.id ? "bg-emerald-600 text-white" : cn('text-emerald-100', t.bgHover)
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <Target size={14} className={selectedCase?.id === c.id ? 'text-white' : 'text-emerald-300'} />
                              <div className="flex-1">
                                <span className="text-sm font-medium truncate block">{c.patientNumber ? `Patient ${c.patientNumber}` : (c.folderName || c.id)}</span>
                                <span className={cn("text-[10px] inline-flex items-center mt-0.5 px-1.5 py-0.5 rounded-full font-bold border", selectedCase?.id === c.id ? "bg-white/20 text-white border-white/30" : "bg-emerald-500/15 text-emerald-300 border-emerald-500/25")}>IMMUNO</span>
                              </div>
                              {c.compassPrediction && (
                                <CheckCircle size={12} className={selectedCase?.id === c.id ? 'text-white' : 'text-emerald-300'} />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {sidebarMadrigalCases.length > 0 && (
                    <div className="pt-1 pb-1">
                      <div className={cn("px-3 mb-1 text-[10px] uppercase font-bold tracking-wider text-rose-400/90")}>Drug Interactions</div>
                      {sidebarMadrigalCases.map(c => {
                        if (!c) return null;
                        return (
                          <button
                            key={c.id}
                            onClick={() => { setSelectedCase(c); setView('CASE'); }}
                            className={cn(
                              "w-full text-left px-3 py-2 rounded-lg transition-all neon-interactive",
                              selectedCase?.id === c.id ? "bg-rose-600 text-white" : cn('text-rose-100', t.bgHover)
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <Shield size={14} className={selectedCase?.id === c.id ? 'text-white' : 'text-rose-300'} />
                              <div className="flex-1">
                                <span className="text-sm font-medium truncate block">{c.patientNumber ? `Patient ${c.patientNumber}` : (c.folderName || c.id)}</span>
                                <span className={cn("text-[10px] inline-flex items-center mt-0.5 px-1.5 py-0.5 rounded-full font-bold border", selectedCase?.id === c.id ? "bg-white/20 text-white border-white/30" : "bg-rose-500/15 text-rose-300 border-rose-500/25")}>DDI</span>
                              </div>
                              {c.madrigalDDI && (
                                <CheckCircle size={12} className={selectedCase?.id === c.id ? 'text-white' : 'text-rose-300'} />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {sidebarPipelineCases.length > 0 && (
                    <div className="pt-1 pb-1">
                      <div className={cn("px-3 mb-1 text-[10px] uppercase font-bold tracking-wider", t.textMuted)}>Clinical Pipeline</div>
                      {sidebarPipelineCases.map(c => {
                        if (!c) return null;
                        return (
                          <button
                            key={c.id}
                            onClick={() => { setSelectedCase(c); setView('CASE'); }}
                            className={cn(
                              "w-full text-left px-3 py-2 rounded-lg transition-all neon-interactive",
                              selectedCase?.id === c.id ? "bg-teal-600 text-white" : cn(t.text, t.bgHover)
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <Stethoscope size={14} />
                              <div className="flex-1">
                                <span className="text-sm font-medium truncate block">{c.patientNumber ? `Patient ${c.patientNumber}` : (c.folderName || c.id)}</span>
                                <span className={cn("text-[10px] inline-flex items-center mt-0.5 px-1.5 py-0.5 rounded-full font-bold border", selectedCase?.id === c.id ? "bg-white/20 text-white border-white/30" : "bg-teal-500/15 text-teal-300 border-teal-500/25")}>CLINICAL</span>
                              </div>
                              {c.narrative && <CheckCircle size={12} className={selectedCase?.id === c.id ? 'text-white' : 'text-emerald-400'} />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          
          {/* Quick Stats */}
          <div>
            <div className={cn("px-3 text-xs font-bold uppercase mb-2", t.textMuted)}>Pipeline Status</div>
            <div className="space-y-1 px-3">
              <div className={cn("flex items-center justify-between py-1", t.textSecondary)}>
                <span className="text-xs flex items-center gap-2"><Database size={12} /> Agents</span>
                <span className="text-xs font-mono font-bold text-teal-400">{CONFIG.agents.length} stages</span>
              </div>
              <div className={cn("flex items-center justify-between py-1", t.textSecondary)}>
                <span className="text-xs flex items-center gap-2"><Users size={12} /> Patients</span>
                <span className="text-xs font-mono font-bold text-teal-400">{Object.keys(cases).length}</span>
              </div>
              <div className={cn("flex items-center justify-between py-1", t.textSecondary)}>
                <span className="text-xs flex items-center gap-2"><CheckCircle size={12} /> Complete</span>
                <span className="text-xs font-mono font-bold text-emerald-400">{Object.values(cases).filter(c => c?.narrative).length}</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className={cn("p-4 border-t", t.border)}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <PulsingDot color="emerald" />
              <span className={cn("text-xs", t.textSecondary)}>Online</span>
            </div>
            <ThemeToggle />
          </div>
          <button
            onClick={() => {
              setAuth(false);
              try {
                localStorage.removeItem('mevreon_v7_auth');
              } catch {}
            }}
            className={cn("w-full px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2", t.bgTertiary, t.text, t.bgHover)}
          >
            <Unlock size={14} />
            Sign Out
          </button>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className={cn("h-16 border-b flex items-center justify-between px-6 mac-glass-panel", t.bgSecondary, t.border)}>
          <div className="flex items-center gap-4">
            {(view === 'CASE' || view === 'SUMMARY') && (
              <button onClick={() => setView('DASHBOARD')} className={cn("p-2 rounded-lg", t.bgTertiary, t.bgHover)}>
                <ArrowLeft size={18} className={t.textSecondary} />
              </button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h2 className={cn("text-lg font-bold", t.text)}>
                  {view === 'DASHBOARD' && !currentPipeline && 'Select Pipeline'}
                  {view === 'DASHBOARD' && currentPipeline === 'clinical' && 'Clinical Analysis'}
                  {view === 'DASHBOARD' && currentPipeline === 'immunotherapy' && 'Immunotherapy Response'}
                  {view === 'DASHBOARD' && currentPipeline === 'discovery' && 'Target Discovery'}
                  {view === 'DASHBOARD' && currentPipeline === 'ddi' && 'Drug Interactions'}
                  {view === 'UPLOAD' && 'Upload Patient Files'}
                  {view === 'HISTORY' && 'History'}
                  {view === 'CASE' && (selectedCase?.patientNumber ? `Patient ${selectedCase.patientNumber}` : (selectedCase?.folderName || selectedCase?.id || 'Patient'))}
                  {view === 'SUMMARY' && 'Patient Summary'}
                </h2>
                {view === 'CASE' && selectedCase && (() => {
                  const v = getCaseVariant(selectedCase);
                  if (v === 'pinnacle') return <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-sky-500/15 text-sky-300 border border-sky-500/25">DISCOVERY</span>;
                  if (v === 'compass') return <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">IMMUNOTHERAPY</span>;
                  if (v === 'madrigal') return <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-rose-500/15 text-rose-300 border border-rose-500/25">DDI</span>;
                  return <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-teal-500/15 text-teal-300 border border-teal-500/25">CLINICAL</span>;
                })()}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button onClick={pollData} disabled={isPolling} className={cn("p-2 rounded-lg", t.bgTertiary, t.bgHover)}>
              <RefreshCw size={18} className={cn(isPolling && "animate-spin", t.textSecondary)} />
            </button>
            <div className={cn("px-3 py-1.5 rounded-lg text-xs font-mono", t.bgTertiary, t.textSecondary)}>
              {(() => { try { return format(currentTime, 'HH:mm:ss'); } catch { return '--:--:--'; } })()}
            </div>
          </div>
        </header>
        
        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {view === 'DASHBOARD' && !currentPipeline && (
            <PipelineLanding
              onSelectPipeline={(id) => { setCurrentPipeline(id); }}
              cases={cases}
              theme={theme}
            />
          )}

          {/* FILTERED DASHBOARD */}
          {view === 'DASHBOARD' && currentPipeline && (
            <div className="space-y-6 spring-stack">
              {/* Welcome Banner with Medical Animation */}
              <div className="relative overflow-hidden p-6 rounded-2xl bg-gradient-to-r from-teal-600/20 via-cyan-600/15 to-indigo-600/20 border border-teal-500/20 hero-future parallax-surface spring-in" style={heroCardStyle}>
                <HeartbeatLine className="absolute inset-0 text-teal-500 opacity-10" />
                <div className="relative z-10 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <MedicalCrossLogo size={32} className="text-teal-400" />
                      <h1 className={cn("text-3xl font-black", t.text)}>
                        <span className="bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">
                          Mevreon AI Platform
                        </span>
                      </h1>
                    </div>
                    <p className={t.textSecondary}>
                      Multimodal Medical AI Agentic Platform — 5-stage intelligent pipeline for clinical data processing
                    </p>
                    <div className="flex items-center gap-3 mt-3">
                      <MedicalShieldBadge label="HIPAA Compliant" theme={theme} />
                      <MedicalShieldBadge label="HL7 FHIR Ready" theme={theme} />
                      <DNAHelixAnimation className="text-teal-400 opacity-40 ml-2" />
                    </div>
                  </div>
                  <StethoscopePulse className="hidden md:flex" />
                </div>
              </div>
              
              <ClinicalDashboardMetrics cases={cases} theme={theme} />
              
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Search className={cn("absolute left-4 top-1/2 -translate-y-1/2", t.textMuted)} size={18} />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search patients by name or folder..."
                    className={cn("w-full pl-12 pr-4 py-3 rounded-xl border outline-none focus:border-teal-500", t.input)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <ArrowUpDown className={cn("shrink-0", t.textMuted)} size={16} />
                  <select
                    value={patientSortBy}
                    onChange={(e) => setPatientSortBy(e.target.value)}
                    className={cn("px-3 py-3 rounded-xl border outline-none focus:border-teal-500 text-sm font-medium", t.input)}
                  >
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                    <option value="name-asc">Name A–Z</option>
                    <option value="name-desc">Name Z–A</option>
                    <option value="status">By Status</option>
                    <option value="files">Most Files</option>
                    <option value="patient-asc">Patient No. ↑</option>
                    <option value="patient-desc">Patient No. ↓</option>
                  </select>
                </div>
              </div>
              
              <div>
                  {filteredCases.length === 0 ? (
                    <EmptyState
                      icon={Stethoscope}
                      title="No Patients Found"
                      description="Upload a patient folder to begin AI-powered medical data processing"
                      action={
                        <button onClick={() => setView('UPLOAD')} className="px-6 py-2.5 bg-teal-600 text-white font-bold rounded-xl flex items-center gap-2">
                          <FolderOpen size={18} />
                          Upload Patient Files
                        </button>
                      }
                      theme={theme}
                    />
                  ) : (
                    <div className="space-y-7 spring-stack">
                      {pinnacleCases.length > 0 && (
                        <section className={cn("rounded-2xl border p-4 md:p-5", t.card, 'border-sky-500/30 bg-gradient-to-r from-sky-500/10 via-cyan-500/5 to-transparent')}>
                          <div className="flex items-center justify-between mb-4">
                            <div>
                              <h3 className={cn("text-lg font-bold flex items-center gap-2", t.text)}>
                                <LineChart size={18} className="text-sky-300" />
                                Target Discovery Dashboard
                              </h3>
                              <p className={cn("text-xs mt-1", t.textMuted)}>Target discovery and cell-context prioritization cases</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs px-2.5 py-1 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30 font-bold">
                                {pinnacleCases.length} case{pinnacleCases.length !== 1 ? 's' : ''}
                              </span>
                              <button
                                onClick={() => setView('UPLOAD')}
                                className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all shadow-sm shadow-sky-500/20"
                              >
                                <Upload size={13} />
                                New Discovery
                              </button>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            {pinnacleCases.map(c => (
                              <PatientCaseCard
                                key={c.id}
                                caseData={c}
                                variant="pinnacle"
                                onClick={() => { setSelectedCase(c); setView('CASE'); }}
                                theme={theme}
                              />
                            ))}
                          </div>
                        </section>
                      )}

                      {compassCases.length > 0 && (
                        <section className={cn("rounded-2xl border p-4 md:p-5", t.card, 'border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent')}>
                          <div className="flex items-center justify-between mb-4">
                            <div>
                              <h3 className={cn("text-lg font-bold flex items-center gap-2", t.text)}>
                                <Target size={18} className="text-emerald-300" />
                                Immunotherapy Response Dashboard
                              </h3>
                              <p className={cn("text-xs mt-1", t.textMuted)}>Immunotherapy response prediction and biomarker ranking cases</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                                {compassCases.length} case{compassCases.length !== 1 ? 's' : ''}
                              </span>
                              <button
                                onClick={() => setView('UPLOAD')}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all shadow-sm shadow-emerald-500/20"
                              >
                                <Upload size={13} />
                                New Immunotherapy
                              </button>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            {compassCases.map(c => (
                              <PatientCaseCard
                                key={c.id}
                                caseData={c}
                                variant="compass"
                                onClick={() => { setSelectedCase(c); setView('CASE'); }}
                                theme={theme}
                              />
                            ))}
                          </div>
                        </section>
                      )}

                      {madrigalCases.length > 0 && (
                        <section className={cn("rounded-2xl border p-4 md:p-5", t.card, 'border-rose-500/30 bg-gradient-to-r from-rose-500/10 via-pink-500/5 to-transparent')}>
                          <div className="flex items-center justify-between mb-4">
                            <div>
                              <h3 className={cn("text-lg font-bold flex items-center gap-2", t.text)}>
                                <Shield size={18} className="text-rose-300" />
                                Drug Interaction Dashboard
                              </h3>
                              <p className={cn("text-xs mt-1", t.textMuted)}>Drug-drug interaction analysis and polypharmacy risk assessment</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold">
                                {madrigalCases.length} case{madrigalCases.length !== 1 ? 's' : ''}
                              </span>
                              <button
                                onClick={() => setView('UPLOAD')}
                                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all shadow-sm shadow-rose-500/20"
                              >
                                <Upload size={13} />
                                New DDI Analysis
                              </button>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            {madrigalCases.map(c => (
                              <PatientCaseCard
                                key={c.id}
                                caseData={c}
                                variant="madrigal"
                                onClick={() => { setSelectedCase(c); setView('CASE'); }}
                                theme={theme}
                              />
                            ))}
                          </div>
                        </section>
                      )}

                      {pipelineCases.length > 0 && (
                        <section className={cn("rounded-2xl border p-4 md:p-5", t.card)}>
                          <div className="flex items-center justify-between mb-4">
                            <div>
                              <h3 className={cn("text-lg font-bold flex items-center gap-2", t.text)}>
                                <Workflow size={18} className="text-teal-400" />
                                Clinical Pipeline Dashboard
                              </h3>
                              <p className={cn("text-xs mt-1", t.textMuted)}>Ingestion, cleaning, validation, narrative and specialist-agent workflow</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={cn("text-xs px-2.5 py-1 rounded-full font-bold", t.bgTertiary, t.textSecondary)}>
                                {pipelineCases.length} case{pipelineCases.length !== 1 ? 's' : ''}
                              </span>
                              <button
                                onClick={() => setView('UPLOAD')}
                                className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all shadow-sm shadow-teal-500/20"
                              >
                                <Upload size={13} />
                                New Clinical
                              </button>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            {pipelineCases.map(c => (
                              <PatientCaseCard
                                key={c.id}
                                caseData={c}
                                variant="pipeline"
                                onClick={() => { setSelectedCase(c); setView('CASE'); }}
                                theme={theme}
                              />
                            ))}
                          </div>
                        </section>
                      )}
                    </div>
                  )}
              </div>
            </div>
          )}
          
          {/* UPLOAD */}
          {view === 'UPLOAD' && (
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="p-6 rounded-2xl bg-gradient-to-r from-teal-600/10 to-cyan-600/10 border border-teal-500/20">
                <h2 className={cn("text-xl font-bold mb-2 flex items-center gap-3", t.text)}>
                  <Stethoscope className="text-teal-400" size={24} />
                  Upload Patient Files
                </h2>
                <p className={t.textSecondary}>
                  Upload a single patient folder or a multi-patient folder where each subfolder is a separate patient.
                  Files will be processed through our 5-stage AI agent pipeline.
                </p>
              </div>
              
              {/* Centered Upload Progress */}
              {isUploading && (
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                  <div className="relative">
                    <div className="w-32 h-32 rounded-full border-4 border-slate-700/50 bg-slate-800/50 flex items-center justify-center">
                      <span className="text-4xl font-bold text-teal-400">{uploadProgress}%</span>
                    </div>
                    <svg className="absolute top-0 left-0 w-32 h-32 -rotate-90">
                      <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="none" className="text-slate-700/30" />
                      <circle 
                        cx="64" cy="64" r="58" 
                        stroke="currentColor" strokeWidth="8" fill="none" 
                        className="text-teal-500" 
                        strokeDasharray={`${2 * Math.PI * 58}`}
                        strokeDashoffset={`${2 * Math.PI * 58 * (1 - uploadProgress / 100)}`}
                        strokeLinecap="round"
                        style={{ transition: 'stroke-dashoffset 0.3s ease' }}
                      />
                    </svg>
                  </div>
                  <div className={cn("text-lg font-medium", t.text)}>Uploading Files...</div>
                  <div className={cn("text-sm", t.textMuted)}>Please wait while files are being uploaded to S3</div>
                </div>
              )}
              
              {!isUploading && <FileUploadZone onFilesSelected={handleUpload} onMultiPatientUpload={handleMultiPatientUpload} isProcessing={isUploading} theme={theme} />}
              
              {/* Pipeline info */}
              <div className={cn("rounded-xl border p-6", t.card)}>
                <h3 className={cn("font-bold mb-4 flex items-center gap-2", t.text)}>
                  <Workflow size={18} className="text-teal-400" />
                  AI Processing Pipeline
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {CONFIG.agents.map(agent => {
                    const Icon = agent.icon || Database;
                    return (
                      <div key={agent.id} className={cn("p-3 rounded-lg flex items-start gap-3", t.bgTertiary)}>
                        <div className="p-2 bg-teal-500/10 rounded-lg flex-shrink-0">
                          <Icon size={16} className="text-teal-400" />
                        </div>
                        <div>
                          <div className={cn("text-sm font-bold", t.text)}>Step {agent.step}: {agent.name}</div>
                          <div className={cn("text-xs mt-0.5", t.textMuted)}>{agent.description}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          
          {/* CASE DETAIL - INTEGRATED PATIENT VIEW WITH INSTANT NARRATIVE */}
          {view === 'CASE' && selectedCase && (
            <PatientSummaryPage
              narrative={selectedCase.narrative}
              caseData={selectedCase}
              s3Client={s3}
              theme={theme}
              isLoading={isHydratingCase}
              onBack={() => { setView('DASHBOARD'); setSelectedCase(null); }}
            />
          )}

          {/* CASE/SUMMARY FALLBACK - prevents blank panel on refresh when selected case is unavailable */}
          {(view === 'CASE' || view === 'SUMMARY') && !selectedCase && (
            <div className="max-w-3xl mx-auto">
              <EmptyState
                icon={FileText}
                title="No Patient Selected"
                description="The previous patient context is no longer available after refresh. Return to Dashboard and select a patient again."
                action={
                  <button
                    onClick={() => setView('DASHBOARD')}
                    className="px-6 py-2.5 bg-teal-600 text-white font-bold rounded-xl flex items-center gap-2 hover:bg-teal-500 transition-all"
                  >
                    <LayoutDashboard size={16} />
                    Go To Dashboard
                  </button>
                }
                theme={theme}
              />
            </div>
          )}
          
          {/* SUMMARY - Fallback integrated page with file preview */}
          {view === 'SUMMARY' && selectedCase && (
            <PatientSummaryPage
              narrative={selectedCase.narrative}
              caseData={selectedCase}
              s3Client={s3}
              theme={theme}
              isLoading={isHydratingCase}
              onBack={() => { setView('DASHBOARD'); setSelectedCase(null); }}
            />
          )}
          
          {/* HISTORY */}
          {view === 'HISTORY' && (
            <div className="space-y-6">
              <div className="p-6 rounded-2xl bg-gradient-to-r from-teal-600/10 to-cyan-600/10 border border-teal-500/20">
                <h2 className={cn("text-xl font-bold flex items-center gap-3", t.text)}>
                  <History className="text-teal-400" size={24} />
                  Patient Processing History
                </h2>
                <p className={t.textSecondary}>Complete history of patient data processing through the AI pipeline</p>
              </div>
              
              <div className={cn("rounded-xl border", t.card)}>
                <div className={cn("divide-y", t.border)}>
                  {Object.values(cases).length === 0 ? (
                    <EmptyState icon={History} title="No History" description="No patient records processed yet" theme={theme} />
                  ) : (
                    Object.values(cases).slice(0, 30).map((c, idx) => {
                      if (!c) return null;
                      return (
                        <div key={idx} className={cn("p-4 flex items-center justify-between", t.bgHover)}>
                          <div className="flex items-center gap-3">
                            {c.narrative ? (
                              <CheckCircle className="text-emerald-500" size={20} />
                            ) : (
                              <Loader2 className="text-amber-400 animate-spin" size={20} />
                            )}
                            <div>
                              <div className={cn("font-medium", t.text)}>
                                {c.patientNumber ? `Patient ${c.patientNumber}` : (c.folderName || c.id)}
                                <span className={cn("ml-2 text-xs", t.textMuted)}>({c.folderName || c.id})</span>
                              </div>
                              <div className={cn("text-xs flex gap-3", t.textMuted)}>
                                <span>{safeFormatDistance(c.lastModified)}</span>
                                <span>{c.rawFiles?.length || 0} files</span>
                                <span>{Object.keys(c.agentOutputs || {}).length}/{CONFIG.agents.length} agents</span>
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => { setSelectedCase(c); setView('CASE'); }}
                            className="px-4 py-1.5 bg-teal-600 text-white text-xs font-bold rounded-lg hover:bg-teal-500 transition-colors"
                          >
                            View Patient
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Unknown view fallback */}
          {!['DASHBOARD', 'UPLOAD', 'CASE', 'SUMMARY', 'HISTORY'].includes(view) && (
            <div className="max-w-3xl mx-auto">
              <EmptyState
                icon={AlertTriangle}
                title="Invalid View State"
                description="A navigation state became invalid. Resetting to dashboard recovers the interface."
                action={
                  <button
                    onClick={() => setView('DASHBOARD')}
                    className="px-6 py-2.5 bg-teal-600 text-white font-bold rounded-xl flex items-center gap-2 hover:bg-teal-500 transition-all"
                  >
                    <LayoutDashboard size={16} />
                    Reset To Dashboard
                  </button>
                }
                theme={theme}
              />
            </div>
          )}
        </main>
      </div>
      
      {/* Toast */}
      {toast && <Toast {...toast} theme={theme} onClose={() => setToast(null)} />}
      
      {/* Scrollbar Styles */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: ${theme === 'dark' ? '#0f172a' : '#f1f5f9'}; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: ${theme === 'dark' ? '#334155' : '#cbd5e1'}; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: ${theme === 'dark' ? '#475569' : '#94a3b8'}; }
        
        @keyframes slide-in-from-top {
          from { transform: translateY(-100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        
        /* Medical Heartbeat ECG Line Animation */
        .heartbeat-line-animate {
          stroke-dasharray: 2000;
          stroke-dashoffset: 2000;
          animation: heartbeat-draw 3s linear infinite;
        }
        @keyframes heartbeat-draw {
          0% { stroke-dashoffset: 2000; opacity: 0.3; }
          50% { opacity: 1; }
          100% { stroke-dashoffset: 0; opacity: 0.3; }
        }
        
        /* DNA Strand Wave Animation */
        .dna-strand-animate {
          animation: dna-wave 1.8s ease-in-out infinite;
        }
        @keyframes dna-wave {
          0%, 100% { transform: scaleY(0.4); opacity: 0.3; }
          50% { transform: scaleY(1.2); opacity: 1; }
        }
        
        /* Medical Pulse Glow */
        @keyframes medical-pulse-glow {
          0%, 100% { box-shadow: 0 0 5px rgba(20, 184, 166, 0.2); }
          50% { box-shadow: 0 0 20px rgba(20, 184, 166, 0.6), 0 0 40px rgba(20, 184, 166, 0.3); }
        }
        
        /* Narrative Content Styling */
        .narrative-content strong { font-weight: 700; }
        .narrative-content code { font-size: 0.75rem; }
        .narrative-content h2 { scroll-margin-top: 1rem; }
        .narrative-content h3 { scroll-margin-top: 0.75rem; }
        
        /* Medical Cross Rotating Animation */
        @keyframes medical-cross-rotate {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        /* Stethoscope Bounce */
        @keyframes stethoscope-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ROOT APPLICATION WITH PROVIDERS & ERROR BOUNDARY
// ═══════════════════════════════════════════════════════════════

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </ErrorBoundary>
  );
}