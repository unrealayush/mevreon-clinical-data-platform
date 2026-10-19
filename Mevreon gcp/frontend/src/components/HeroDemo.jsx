import React, { useState, useEffect } from 'react';
import {
  FolderOpen, FileText, Scan, Dna, Activity, BrainCircuit,
  ScanSearch, ShieldCheck, Quote, CheckCircle2, Sparkles,
  Play, Pause, SkipForward, Terminal, ArrowRight, Check
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════════
 * HERO DEMO — Interactive Multi-Agent Pipeline Simulator
 * Raw Patient Files → Laser OCR/Parser → 4 Specialized AI Agents → Grounded Claim
 * ═══════════════════════════════════════════════════════════════════ */

const AGENT_DEMO = [
  { id: 'ingest', step: '01', name: 'Ingestion', icon: ScanSearch, color: 'text-sky-400', ring: 'ring-sky-400/60', border: 'border-sky-500/30', bg: 'bg-sky-500/10', dot: 'bg-sky-400' },
  { id: 'clean', step: '02', name: 'Cleaning', icon: Sparkles, color: 'text-cyan-400', ring: 'ring-cyan-400/60', border: 'border-cyan-500/30', bg: 'bg-cyan-500/10', dot: 'bg-cyan-400' },
  { id: 'valid', step: '03', name: 'Validation', icon: ShieldCheck, color: 'text-emerald-400', ring: 'ring-emerald-400/60', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10', dot: 'bg-emerald-400' },
  { id: 'narr', step: '04', name: 'Synthesis', icon: BrainCircuit, color: 'text-indigo-400', ring: 'ring-indigo-400/60', border: 'border-indigo-500/30', bg: 'bg-indigo-500/10', dot: 'bg-indigo-400' },
];

const FILES = [
  { icon: FileText, label: 'discharge_summary.pdf', size: '1.4 MB', type: 'Clinical Note' },
  { icon: Scan, label: 'ct_chest_axial.dcm', size: '24.2 MB', type: 'DICOM Series' },
  { icon: Dna, label: 'oncogenomic_panel.vcf', size: '4.8 MB', type: 'Genomic VCF' },
  { icon: Activity, label: 'metabolic_labs.csv', size: '320 KB', type: 'Observation' },
  { icon: FileText, label: 'physician_note.jpg', size: '2.1 MB', type: 'Handwritten Rx' },
];

const LOGS = [
  { stepRange: [0, 5], text: 'IngestionAgent: Watching GCS raw/ bucket. Unpacking 5 multimodal patient files.' },
  { stepRange: [6, 9], text: 'IngestionAgent: Layout-aware OCR complete. Extracted 8,420 tokens, 1 DICOM series, 1 VCF.' },
  { stepRange: [10, 14], text: 'CleaningAgent: Normalizing 18 meds to RxNorm. Labs mapped to LOINC codes. Deduplicated 3 records.' },
  { stepRange: [15, 18], text: 'CleaningAgent: Unit reconciliation (mmol/L → mg/dL). 0 data loss reported in quarantine audit.' },
  { stepRange: [19, 23], text: 'ValidationAgent: Verifying physiological ranges. Drug-drug interaction risk matrix checked.' },
  { stepRange: [24, 29], text: 'NarrativeAgent (Gemini 2.5 Pro): Longitudinal narrative synthesized with 100% source citations.' },
];

const TICK = 550;          // ms per step
const STEPS_PER_LOOP = 30; // ~16.5s loop

const HeroDemo = ({ isDark }) => {
  const [step, setStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  useEffect(() => {
    if (!isPlaying) return;
    const iv = setInterval(() => setStep((s) => (s + 1) % STEPS_PER_LOOP), TICK);
    return () => clearInterval(iv);
  }, [isPlaying]);

  const s = step;
  const scanning = s >= 2 && s < 7;
  const fanOut = s >= 6;
  const agentActive = (i) => s >= 8 + i * 3 && s < 28;
  const agentDone = (i) => s >= 11 + i * 3;
  const claimVisible = s >= 18;
  const verified = s >= 23;
  const highlightOn = s >= 21;

  // Jump to specific agent phase
  const jumpToAgent = (index) => {
    setIsPlaying(false);
    setStep(8 + index * 4);
  };

  const currentLog = LOGS.find((l) => s >= l.stepRange[0] && s <= l.stepRange[1])?.text || LOGS[0].text;

  const card = isDark ? 'bg-slate-900/80 border-slate-800 backdrop-blur-xl' : 'bg-white/90 border-slate-200 backdrop-blur-xl';
  const soft = isDark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-slate-50/80 border-slate-200';
  const text = isDark ? 'text-white' : 'text-slate-900';
  const muted = isDark ? 'text-slate-400' : 'text-slate-500';

  return (
    <div className={`relative mx-auto max-w-4xl rounded-3xl border overflow-hidden shadow-2xl transition-all duration-300 ${card}`}>
      {/* Background glow and subtle grid */}
      <div className="absolute inset-0 opacity-[0.2] hero-demo-grid pointer-events-none" />
      <div className="absolute top-0 right-1/4 w-72 h-72 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Window Bar */}
      <div className={`relative px-5 py-3 border-b flex items-center justify-between text-xs ${isDark ? 'border-slate-800 bg-slate-900/60' : 'border-slate-200 bg-slate-100/70'}`}>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 mr-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
          </div>
          <span className={`font-mono font-bold tracking-wider text-[11px] ${isDark ? 'text-teal-400' : 'text-teal-700'}`}>
            SIMULATION // PATIENT PIPELINE ENGINE
          </span>
          <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-500/15 text-teal-300 border border-teal-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-ping mr-0.5" />
            LIVE
          </span>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`p-1.5 rounded-lg border transition-all ${isDark ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'}`}
            title={isPlaying ? 'Pause Simulation' : 'Resume Simulation'}
          >
            {isPlaying ? <Pause size={13} /> : <Play size={13} className="text-teal-400" />}
          </button>
          <button
            onClick={() => setStep((s) => (s + 3) % STEPS_PER_LOOP)}
            className={`p-1.5 rounded-lg border transition-all ${isDark ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'}`}
            title="Step Forward"
          >
            <SkipForward size={13} />
          </button>
          <span className="font-mono text-[11px] text-slate-400 ml-1">
            {Math.floor((s / STEPS_PER_LOOP) * 100)}%
          </span>
        </div>
      </div>

      {/* Main Interactive Workspace */}
      <div className="relative p-5 md:p-7 grid grid-cols-1 md:grid-cols-[210px_1fr] gap-6 items-start">
        
        {/* Left: Patient Folder with Laser Scan */}
        <div className="space-y-3">
          <div className={`relative rounded-2xl border p-3.5 transition-all duration-500 ${scanning ? 'ring-2 ring-teal-400/80 shadow-lg shadow-teal-500/20' : ''} ${soft}`}>
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/5">
              <div className="flex items-center gap-2">
                <FolderOpen size={16} className="text-teal-400" />
                <span className={`text-xs font-bold font-mono ${text}`}>patient_1042/</span>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${isDark ? 'bg-teal-500/15 text-teal-300' : 'bg-teal-100 text-teal-800'}`}>
                {FILES.length} files
              </span>
            </div>

            {/* File items */}
            <div className="space-y-1.5 relative overflow-hidden">
              {FILES.map((f, i) => (
                <div
                  key={f.label}
                  className={`flex items-center justify-between rounded-lg px-2 py-1.5 transition-all duration-500 ${scanning ? 'bg-teal-500/10 translate-x-1' : (isDark ? 'bg-slate-900/40' : 'bg-white')} ${fanOut ? 'opacity-30' : 'opacity-90'}`}
                  style={{ transitionDelay: `${i * 45}ms` }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <f.icon size={13} className="text-teal-400 shrink-0" />
                    <span className={`text-[11px] font-mono truncate ${muted}`}>{f.label}</span>
                  </div>
                  <span className="text-[9px] font-mono text-slate-500 shrink-0 ml-1">{f.size}</span>
                </div>
              ))}

              {/* Animated Laser Scanning Bar */}
              {scanning && (
                <div 
                  className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-teal-300 to-transparent shadow-[0_0_8px_rgba(45,212,191,0.8)] transition-all duration-300 pointer-events-none"
                  style={{ top: `${15 + ((s - 2) % 5) * 18}%` }}
                />
              )}
            </div>

            {/* Scan State Label */}
            <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between text-[10px]">
              <span className={muted}>Status:</span>
              <span className={`font-mono font-bold ${scanning ? 'text-teal-400 animate-pulse' : (fanOut ? 'text-emerald-400' : muted)}`}>
                {scanning ? 'SCANNING LAYOUT...' : fanOut ? 'DISPATCHED →' : 'QUEUED'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 px-2 text-[11px] text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Multi-tenant GCS isolation</span>
          </div>
        </div>

        {/* Right: 4 Autonomous Agents + Grounded Result */}
        <div className="space-y-4">
          {/* Agent Phase Tabs (Clickable to jump) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {AGENT_DEMO.map((a, i) => {
              const active = agentActive(i);
              const done = agentDone(i);
              return (
                <button
                  key={a.id}
                  onClick={() => jumpToAgent(i)}
                  className={`rounded-xl border p-2.5 text-left transition-all duration-300 relative group cursor-pointer ${soft} ${
                    active 
                      ? `ring-2 ${a.ring} ${a.bg} scale-[1.02] shadow-lg` 
                      : done 
                        ? 'border-emerald-500/40 bg-emerald-500/5' 
                        : 'opacity-60 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold opacity-50">{a.step}</span>
                    {done ? (
                      <Check size={12} className="text-emerald-400" />
                    ) : (
                      <span className={`h-1.5 w-1.5 rounded-full ${active ? `${a.dot} animate-ping` : 'bg-slate-600'}`} />
                    )}
                  </div>
                  <a.icon size={17} className={`mt-1.5 ${active ? a.color : done ? 'text-emerald-400' : muted}`} />
                  <div className={`text-[11px] font-bold mt-1 ${active ? text : done ? text : muted}`}>
                    {a.name}
                  </div>
                  <div className="text-[9px] text-slate-400 truncate">
                    {done ? 'Completed' : active ? 'Processing...' : 'Standby'}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Connected Neon Stream */}
          <div className="relative h-1.5 w-full rounded-full bg-slate-800/80 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-teal-400 via-cyan-400 to-indigo-400 transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(8, (s / STEPS_PER_LOOP) * 100))}%` }}
            />
          </div>

          {/* Grounded Claim Synthesis Card */}
          <div className={`rounded-2xl border p-4 sm:p-5 transition-all duration-700 relative overflow-hidden ${soft} ${claimVisible ? 'opacity-100 translate-y-0 shadow-xl' : 'opacity-40 translate-y-2'}`}>
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <Quote size={14} className="text-indigo-400" />
                <span className={`text-[11px] font-black uppercase tracking-wider ${muted}`}>
                  Longitudinal Grounded Synthesis
                </span>
              </div>
              {verified ? (
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 animate-pulse">
                  <CheckCircle2 size={12} /> EVIDENCE VERIFIED (100%)
                </span>
              ) : (
                <span className="text-[10px] font-mono text-slate-400">Auditing claims...</span>
              )}
            </div>

            {/* Grounded narrative snippet */}
            <p className={`text-sm leading-relaxed ${text}`}>
              Patient history notable for hypertension and hypothyroidism. Currently maintained on{' '}
              <span className={`mx-0.5 px-1.5 py-0.5 rounded font-bold transition-all duration-500 ${highlightOn ? 'bg-amber-400/25 text-amber-300 border border-amber-400/40 shadow-sm' : 'bg-white/5'}`}>
                T. Thyrox 125 mcg OD
              </span>{' '}
              and managed clinically on{' '}
              <span className={`mx-0.5 px-1.5 py-0.5 rounded font-bold transition-all duration-500 ${highlightOn ? 'bg-amber-400/25 text-amber-300 border border-amber-400/40 shadow-sm' : 'bg-white/5'}`}>
                Telmikind Trio 6.25 mg
              </span>
              . Renal panel confirmed stable eGFR &gt; 60 mL/min.
            </p>

            {/* Clickable / Inspectable Evidence Source Citation */}
            <div className={`mt-3.5 rounded-xl border p-3 transition-all duration-500 ${highlightOn ? 'border-amber-400/40 bg-amber-400/10' : 'border-slate-800/40 bg-slate-900/20'}`}>
              <div className="flex items-center justify-between text-[10px] mb-1">
                <span className={`font-mono font-black uppercase tracking-wider ${highlightOn ? 'text-amber-300' : muted}`}>
                  Source Grounding Anchor · physician_note.jpg §1.4
                </span>
                <span className="font-mono text-[9px] text-teal-400 font-bold">MATCH CONFIDENCE: 99.4%</span>
              </div>
              <p className={`text-xs font-mono ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                "Rx: Tab Thyrox 125 mcg OD, Tab Telmikind Trio 6.25 mg OD, Tab Cilacar 10 mg OD, Advised follow up 3m."
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Live Terminal Telemetry Feed */}
      <div className={`px-5 py-3 border-t flex items-center gap-3 text-xs font-mono ${isDark ? 'border-slate-800 bg-slate-950/80 text-slate-400' : 'border-slate-200 bg-slate-100 text-slate-600'}`}>
        <Terminal size={14} className="text-teal-400 shrink-0" />
        <span className="truncate flex-1">
          {currentLog}
        </span>
        <div className="flex items-center gap-1 shrink-0 text-[10px] text-slate-500">
          <span>CYCLE</span>
          <span className="font-bold text-teal-400">{Math.floor(s / 5) + 1}/6</span>
        </div>
      </div>
    </div>
  );
};

export default HeroDemo;