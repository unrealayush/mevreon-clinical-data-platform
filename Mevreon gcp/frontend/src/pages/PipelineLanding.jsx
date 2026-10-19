import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Stethoscope, ArrowRight, Activity, Users, CheckCircle, Sparkles, Zap,
  Database, FileText, ShieldCheck, BrainCircuit, Scan, Dna, Lock,
  ChevronDown, Layers, Server, GitBranch, Eye, ArrowUp, CheckCircle2,
  AlertTriangle, Shield, Cpu, RefreshCw, Terminal, Check
} from 'lucide-react';
import HeroDemo from '../components/HeroDemo.jsx';

/* ═══════════════════════════════════════════════════════════════════
 * MEVREON PLATFORM LANDING PAGE v8.2
 * Smooth scrollspy navigation, reading progress tracking,
 * interactive agent showcases, and clinical safety architecture.
 * ═══════════════════════════════════════════════════════════════════ */

const AGENTS = [
  {
    id: 'agent-ingestion',
    navKey: 'ingestion',
    step: '01',
    name: 'Ingestion Agent',
    tagline: 'Every format medicine produces',
    icon: Database,
    accentColor: 'sky',
    gradient: 'from-sky-600/20 via-blue-600/15 to-indigo-600/10',
    borderGlow: 'border-sky-500/30 hover:border-sky-400/60',
    description: 'The front door of clinical data processing. Traverses raw patient buckets, automatically classifies multi-modal medical files, and executes layout-aware extraction across unstructured clinical documents, DICOM imaging series, and genomic variants.',
    features: [
      { icon: FileText, label: 'Unstructured Documents', detail: 'PDF, DOCX, TXT, and scanned notes with layout-aware optical extraction.' },
      { icon: Scan, label: 'Imaging & DICOM', detail: 'DICOM series parsed with study metadata, modality tags, and pixel matrices.' },
      { icon: Dna, label: 'Genomics & Interchange', detail: 'VCF variant annotations, HL7 messages, and structured tabular CSV/TSV/JSON.' },
      { icon: Activity, label: 'Observation Streams', detail: 'Vitals and bedside lab telemetry normalized into discrete clinical observations.' },
    ],
    sampleWidget: {
      type: 'ingestion',
      title: 'Multimodal Parser Matrix',
      items: [
        { name: 'discharge_summary.pdf', status: 'Layout Analyzed', meta: '8,420 tokens extracted' },
        { name: 'ct_chest_axial.dcm', status: 'DICOM Header Parsed', meta: '512×512 matrix · 120 kVp' },
        { name: 'oncology_panel.vcf', status: 'Variants Indexed', meta: '1,420 genomic loci' },
        { name: 'metabolic_panel.csv', status: 'Observations Built', meta: '24 lab records with units' }
      ]
    }
  },
  {
    id: 'agent-cleaning',
    navKey: 'cleaning',
    step: '02',
    name: 'Cleaning Agent',
    tagline: 'One universal vocabulary across hospital silos',
    icon: Sparkles,
    accentColor: 'cyan',
    gradient: 'from-cyan-600/20 via-teal-600/15 to-emerald-600/10',
    borderGlow: 'border-cyan-500/30 hover:border-cyan-400/60',
    description: 'Raw clinical data is fragmented and noisy—synonymous drug brands, conflicting measurement units, and duplicate encounter notes. The Cleaning Agent harmonizes everything into standardized clinical ontologies with complete provenance tracking.',
    features: [
      { icon: Layers, label: 'Ontology Mapping', detail: 'Medications to RxNorm, lab observations to LOINC, and conditions to ICD-10 & SNOMED CT.' },
      { icon: GitBranch, label: 'Temporal Deduplication', detail: 'Identical tests from disparate electronic health records are merged with source provenance.' },
      { icon: Activity, label: 'Unit Reconciliation', detail: 'Converts mg/dL vs mmol/L with explicit conversion formulas and audit logs.' },
      { icon: Eye, label: 'Data-Loss Accounting', detail: 'Every altered, trimmed, or merged record is documented in a cryptographic data-loss audit.' },
    ],
    sampleWidget: {
      type: 'cleaning',
      title: 'Standardization & Deduplication Preview',
      before: 'tylenol 500 mg tab po q6h prn (Hosp A)',
      after: 'RxNorm: 209459 Acetaminophen 500 MG Oral Tablet [Merged: 2 records]',
      conversions: [
        { from: 'Glucose: 7.2 mmol/L', to: '129.7 mg/dL (LOINC: 2345-7)' },
        { from: 'BP: 138/86 mmHg', to: 'Systolic: 138 | Diastolic: 86 (LOINC: 85354-9)' }
      ]
    }
  },
  {
    id: 'agent-validation',
    navKey: 'validation',
    step: '03',
    name: 'Validation Agent',
    tagline: 'Clinical safety verification before intelligence',
    icon: ShieldCheck,
    accentColor: 'emerald',
    gradient: 'from-emerald-600/20 via-teal-600/15 to-cyan-600/10',
    borderGlow: 'border-emerald-500/30 hover:border-emerald-400/60',
    description: 'A clinical safety barrier. Physiologically impossible vitals, sudden trajectory anomalies, drug-drug contraindications, and critical lab values are audited here. Erroneous records are quarantined into an auditable review lane—never silently altered.',
    features: [
      { icon: ShieldCheck, label: 'Physiological Bounds', detail: 'Quarantines physiologically impossible vitals (e.g. pulse 340 bpm) with clinical rationale.' },
      { icon: Activity, label: 'Clinical Trajectories', detail: 'Identifies acute deterioration flags, sudden renal decline, and critical-lab alerts.' },
      { icon: Lock, label: 'Zero-Tolerance Quarantine', detail: 'Isolates suspect data into an immutable quarantine bucket with full investigator reasons.' },
      { icon: Eye, label: 'Downstream Quality Scoring', detail: 'Assigns quality and confidence scores that carry through to the synthesis narrative.' },
    ],
    sampleWidget: {
      type: 'validation',
      title: 'Clinical Safety Verification Gate',
      checks: [
        { name: 'Physiological Range Filter', status: 'PASSED', detail: '100% within human plausible limits' },
        { name: 'Polypharmacy / DDI Check', status: 'VERIFIED', detail: 'Zero severe contraindications' },
        { name: 'Quarantine Isolation Lane', status: 'CLEAN', detail: '0 records quarantined' },
        { name: 'Cohort Confidence Score', status: '99.8%', detail: 'High-fidelity clinical grade' }
      ]
    }
  },
  {
    id: 'agent-narrative',
    navKey: 'narrative',
    step: '04',
    name: 'Synthesis & Dashboard Agent',
    tagline: 'The complete patient story, fully grounded in evidence',
    icon: BrainCircuit,
    accentColor: 'indigo',
    gradient: 'from-indigo-600/20 via-purple-600/15 to-teal-600/10',
    borderGlow: 'border-indigo-500/30 hover:border-indigo-400/60',
    description: 'The cognitive synthesis layer powered by Gemini 2.5 Pro on Vertex AI. Fuses cleaned clinical observations, imaging metadata, and genomic profiles into a coherent longitudinal timeline where every clinical assertion is linked back to an exact source document anchor.',
    features: [
      { icon: FileText, label: 'Longitudinal Narrative', detail: 'A chronological, comprehensive medical history synthesizing encounters across years.' },
      { icon: Activity, label: 'Interactive Dashboard', detail: 'Structured problem lists, active medications, vital trends, and readmission risk markers.' },
      { icon: ShieldCheck, label: 'Anti-Hallucination Engine', detail: 'Automated evidence index matches each sentence with verified source file coordinates.' },
      { icon: Dna, label: 'Multimodal Fusion', detail: 'CT radiology findings, pathology notes, and lab trajectories united in a single state.' },
    ],
    sampleWidget: {
      type: 'narrative',
      title: 'Grounded Claim Inspector',
      claim: 'Patient responded favorably to high-dose steroid therapy with resolution of dyspnea.',
      citation: 'Source: discharge_summary.pdf · Section 3.2 · Line 44',
      confidence: 'Grounded match: 100% · Hallucination risk: 0.0%'
    }
  },
];

const FLOW_STEPS = [
  { step: '01', name: 'Raw Ingestion', detail: 'Multi-tenant landing in GCS', color: 'text-slate-300', badge: 'GCS Raw' },
  { step: '02', name: 'Extraction & OCR', detail: 'Layout-aware multimodal parsing', color: 'text-sky-400', badge: 'Agent 01' },
  { step: '03', name: 'Standardization', detail: 'RxNorm, LOINC & deduplication', color: 'text-cyan-400', badge: 'Agent 02' },
  { step: '04', name: 'Clinical Safety', detail: 'Physiological checks & quarantine', color: 'text-emerald-400', badge: 'Agent 03' },
  { step: '05', name: 'Synthesis', detail: 'Grounded longitudinal narrative', color: 'text-indigo-400', badge: 'Agent 04' },
];

const TRUST_POINTS = [
  {
    icon: ShieldCheck,
    title: 'Zero Hallucinated Claims',
    badge: 'Anti-Hallucination Engine',
    text: 'Every single generated statement in the longitudinal summary is cross-referenced with source documents. Unverifiable assertions are isolated in an audit report rather than disguised.'
  },
  {
    icon: Eye,
    title: 'Total Data-Loss Accountability',
    badge: '100% Provenance',
    text: 'Clinical records never disappear silently. All merged duplicates, out-of-range trims, and unit conversions are permanently recorded in a data-loss log.'
  },
  {
    icon: Lock,
    title: 'Private by Architecture',
    badge: 'VPC Tenancy',
    text: 'Runs entirely inside your own Google Cloud project VPC. Protected by Cloud IAM and CMEK encryption. Patient PHI never leaves your institutional boundary.'
  },
  {
    icon: Server,
    title: 'Serverless Autoscaling',
    badge: 'Cloud Run Jobs',
    text: 'The 4-agent pipeline executes via serverless Cloud Run jobs that scale from a single emergency case to hospital-wide cohorts—costing zero while idle.'
  },
];

const ARCHITECTURE_SERVICES = [
  {
    title: 'Google Cloud Storage',
    category: 'Data Lakehouse',
    accent: 'text-sky-400',
    detail: 'Tiered architecture with raw/, staging/, processed/, curated/, and an isolated quarantine/ bucket for audit-compliant data lineage.'
  },
  {
    title: 'Cloud Run Serverless Jobs',
    category: 'Compute Orchestration',
    accent: 'text-cyan-400',
    detail: 'Containers orchestrate the multi-agent pipeline with deterministic retries, isolated memory, and horizontal parallelism for batch cohorts.'
  },
  {
    title: 'Vertex AI · Gemini 2.5 Pro',
    category: 'Clinical Synthesis',
    accent: 'text-indigo-400',
    detail: 'State-of-the-art multimodal clinical reasoning with source citation grounding, zero-shot entity extraction, and strict hallucination auditing.'
  },
];

const NAV_SECTIONS = [
  { id: 'flow', label: 'Flow', step: '01' },
  { id: 'agent-ingestion', label: 'Ingestion', step: '02' },
  { id: 'agent-cleaning', label: 'Cleaning', step: '03' },
  { id: 'agent-validation', label: 'Validation', step: '04' },
  { id: 'agent-narrative', label: 'Synthesis', step: '05' },
  { id: 'trust', label: 'Trust & Safety', step: '06' },
  { id: 'architecture', label: 'Architecture', step: '07' },
];

const PipelineLanding = ({ onSelectPipeline, cases = {}, theme = 'dark' }) => {
  const isDark = theme === 'dark';
  const containerRef = useRef(null);
  const [visible, setVisible] = useState({ flow: true, hero: true });
  const [activeSection, setActiveSection] = useState('flow');
  const [scrollProgress, setScrollProgress] = useState(0);
  const [showBackToTop, setShowBackToTop] = useState(false);

  // Compute case stats
  const caseList = Object.values(cases || {});
  const totalCases = caseList.length;
  const completedCases = caseList.filter((c) => c?.narrative || c?.dashboard).length;

  // Theme styles
  const t = {
    text: isDark ? 'text-white' : 'text-slate-900',
    textSecondary: isDark ? 'text-slate-300' : 'text-slate-600',
    textMuted: isDark ? 'text-slate-400' : 'text-slate-500',
    card: isDark ? 'bg-slate-900/70 border-slate-800 backdrop-blur-xl' : 'bg-white/90 border-slate-200 backdrop-blur-xl',
    cardSecondary: isDark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-slate-50/80 border-slate-200',
    chip: isDark ? 'bg-slate-800/60 border-slate-700/60 text-slate-200' : 'bg-slate-100 border-slate-200 text-slate-800',
  };

  // Helper to get scrolling container
  const getScrollContainer = useCallback(() => {
    return containerRef.current?.closest('main') || window;
  }, []);

  // Smooth scroll to a target section
  const scrollToSection = (id) => {
    const targetEl = document.getElementById(id);
    if (!targetEl) return;

    const scrollContainer = getScrollContainer();
    if (scrollContainer && scrollContainer !== window) {
      const containerRect = scrollContainer.getBoundingClientRect();
      const targetRect = targetEl.getBoundingClientRect();
      const headerOffset = 72; // sticky nav bar clearance
      const targetScrollTop = scrollContainer.scrollTop + (targetRect.top - containerRect.top) - headerOffset;

      scrollContainer.scrollTo({
        top: Math.max(0, targetScrollTop),
        behavior: 'smooth'
      });
    } else {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    setActiveSection(id);
  };

  // ScrollSpy & Progress listener
  useEffect(() => {
    const scrollContainer = getScrollContainer();
    if (!scrollContainer) return;

    let ticking = false;

    const handleScroll = () => {
      if (ticking) return;
      ticking = true;

      window.requestAnimationFrame(() => {
        const isWin = scrollContainer === window;
        const scrollTop = isWin ? window.scrollY : scrollContainer.scrollTop;
        const scrollHeight = isWin ? document.documentElement.scrollHeight : scrollContainer.scrollHeight;
        const clientHeight = isWin ? window.innerHeight : scrollContainer.clientHeight;

        // Calculate progress 0..100
        const totalScroll = scrollHeight - clientHeight;
        const progress = totalScroll > 0 ? Math.min(100, Math.max(0, (scrollTop / totalScroll) * 100)) : 0;
        setScrollProgress(progress);
        setShowBackToTop(scrollTop > 450);

        // Determine active section and reveal elements in view
        const sectionIds = ['hero', ...NAV_SECTIONS.map((s) => s.id)];
        const containerTop = isWin ? 0 : scrollContainer.getBoundingClientRect().top;
        const viewportHeight = isWin ? window.innerHeight : clientHeight;

        let currentActive = activeSection;
        let minDistance = Infinity;

        sectionIds.forEach((id) => {
          const el = document.getElementById(id);
          if (!el) return;

          const rect = el.getBoundingClientRect();
          const relativeTop = rect.top - containerTop;

          // Mark visible if entered the lower 85% of screen
          if (relativeTop < viewportHeight * 0.88) {
            setVisible((prev) => (prev[id] ? prev : { ...prev, [id]: true }));
          }

          // Active section is closest to top offset (60px - 180px)
          const distance = Math.abs(relativeTop - 110);
          if (relativeTop <= viewportHeight * 0.5 && distance < minDistance) {
            minDistance = distance;
            currentActive = id;
          }
        });

        if (currentActive && currentActive !== 'hero') {
          setActiveSection(currentActive);
        }

        ticking = false;
      });
    };

    // Initial check on mount
    handleScroll();

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, [getScrollContainer, activeSection]);

  // Section reveal wrapper with smooth entrance
  const Reveal = ({ id, children, className = '' }) => {
    const isVisible = visible[id];
    return (
      <div
        id={id}
        data-landing-section
        className={`scroll-mt-24 transition-all duration-700 ease-out ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        } ${className}`}
      >
        {children}
      </div>
    );
  };

  // Primary Call to Action Button
  const CTA = ({ label = 'Launch Patient Dashboard', showBadge = true }) => (
    <button
      onClick={() => onSelectPipeline && onSelectPipeline('clinical')}
      className="group inline-flex items-center gap-2.5 bg-gradient-to-r from-teal-500 via-cyan-500 to-indigo-600 hover:from-teal-400 hover:via-cyan-400 hover:to-indigo-500 text-white font-bold px-7 py-3.5 rounded-2xl transition-all duration-300 shadow-xl shadow-teal-500/25 hover:shadow-teal-500/40 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
    >
      <span>{label}</span>
      <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
      {showBadge && totalCases > 0 && (
        <span className="ml-1 px-2 py-0.5 rounded-full text-[11px] font-mono bg-white/20 text-white font-bold">
          {totalCases} Cases
        </span>
      )}
    </button>
  );

  return (
    <div ref={containerRef} className="max-w-6xl mx-auto pb-24 relative">
      
      {/* Sticky ScrollSpy Command Bar with Glow Progress Bar */}
      <div className={`sticky top-0 z-30 mb-8 rounded-2xl border transition-all duration-300 shadow-xl ${t.card}`}>
        {/* Glowing Scroll Progress Bar */}
        <div className="absolute top-0 inset-x-0 h-1 bg-slate-800/40 rounded-t-2xl overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-teal-400 via-cyan-400 to-indigo-500 transition-all duration-150"
            style={{ width: `${scrollProgress}%` }}
          />
        </div>

        <div className="flex items-center justify-between p-2 gap-2">
          {/* Scrollable Navigation Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar py-0.5 px-1">
            {NAV_SECTIONS.map((s) => {
              const isActive = activeSection === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => scrollToSection(s.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-gradient-to-r from-teal-500 to-cyan-600 text-white shadow-md shadow-teal-500/20 scale-[1.02]'
                      : isDark
                      ? 'text-slate-300 hover:text-white hover:bg-white/10'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
                  }`}
                >
                  <span className={`text-[10px] font-mono opacity-60`}>{s.step}</span>
                  <span>{s.label}</span>
                </button>
              );
            })}
          </div>

          {/* Quick Launch Cohort Button */}
          <button
            onClick={() => onSelectPipeline && onSelectPipeline('clinical')}
            className="ml-auto hidden sm:inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-black bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-400 hover:to-cyan-500 text-white whitespace-nowrap shadow-md shadow-teal-500/20 transition-all cursor-pointer shrink-0"
          >
            <span>Patient Cohort</span>
            <span className="px-1.5 py-0.5 rounded-md text-[10px] bg-white/25 text-white font-mono">
              {totalCases}
            </span>
            <ArrowRight size={13} />
          </button>
        </div>
      </div>

      {/* Hero Section */}
      <section id="hero" className="text-center space-y-6 pt-4 pb-14 relative">
        {/* Futuristic Radar Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-semibold backdrop-blur-md bg-teal-500/10 border-teal-500/30 text-teal-300 shadow-sm animate-pulse-glow">
          <span className="w-2 h-2 rounded-full bg-teal-400 animate-ping" />
          <span className="font-mono tracking-wide uppercase text-[11px]">
            MEVREON AGENTIC DATA ENGINE · CLINICAL SUITE v8.2
          </span>
        </div>

        {/* Hero Headline */}
        <div className="space-y-3 max-w-4xl mx-auto">
          <h1 className={`text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-tight ${t.text}`}>
            Turn Fragmented Medical Records Into{' '}
            <span className="bg-gradient-to-r from-teal-400 via-cyan-400 to-indigo-400 bg-clip-text text-transparent">
              Source-Grounded Intelligence
            </span>
          </h1>
          <p className={`text-base sm:text-lg max-w-2xl mx-auto leading-relaxed ${t.textSecondary}`}>
            An autonomous 4-agent clinical data pipeline. Ingests raw PDFs, DICOM imaging, and genomic VCFs, standardizes records to clinical ontologies, enforces medical safety, and synthesizes 100% evidence-grounded patient narratives.
          </p>
        </div>

        {/* Metric Badges */}
        <div className="flex items-center justify-center gap-3 pt-1 flex-wrap">
          <div className={`flex items-center gap-2.5 px-4 py-2 rounded-xl border ${t.chip}`}>
            <Users size={16} className="text-teal-400" />
            <span className={`text-sm font-black ${t.text}`}>{totalCases}</span>
            <span className={`text-xs ${t.textMuted}`}>Active Patients</span>
          </div>
          <div className={`flex items-center gap-2.5 px-4 py-2 rounded-xl border ${t.chip}`}>
            <CheckCircle2 size={16} className="text-emerald-400" />
            <span className={`text-sm font-black ${t.text}`}>{completedCases}</span>
            <span className={`text-xs ${t.textMuted}`}>Grounded Syntheses</span>
          </div>
          <div className={`flex items-center gap-2.5 px-4 py-2 rounded-xl border ${t.chip}`}>
            <Zap size={16} className="text-amber-400" />
            <span className={`text-sm font-black ${t.text}`}>4</span>
            <span className={`text-xs ${t.textMuted}`}>Specialized Agents</span>
          </div>
          <div className={`flex items-center gap-2.5 px-4 py-2 rounded-xl border ${t.chip}`}>
            <ShieldCheck size={16} className="text-sky-400" />
            <span className={`text-sm font-black ${t.text}`}>100%</span>
            <span className={`text-xs ${t.textMuted}`}>Evidence Grounded</span>
          </div>
        </div>

        {/* Call to Actions */}
        <div className="pt-2 flex items-center justify-center gap-3 flex-wrap">
          <CTA />
          <button
            onClick={() => scrollToSection('flow')}
            className={`inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl border font-bold text-sm transition-all duration-200 cursor-pointer ${
              isDark
                ? 'bg-slate-800/60 border-slate-700 text-slate-200 hover:bg-slate-700/80 hover:text-white'
                : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <span>Explore Pipeline Tour</span>
            <ChevronDown size={16} />
          </button>
        </div>

        {/* Interactive Hero Simulation Playground */}
        <div className="pt-6">
          <HeroDemo isDark={isDark} />
        </div>

        {/* Bouncing Scroll Cue */}
        <div className="flex justify-center pt-6">
          <button
            onClick={() => scrollToSection('flow')}
            className="text-slate-500 hover:text-teal-400 transition-colors p-2 cursor-pointer"
            aria-label="Scroll down to flow"
          >
            <ChevronDown size={22} className="animate-bounce" />
          </button>
        </div>
      </section>

      {/* Section 01: 5-Stage Interactive Flow */}
      <Reveal id="flow" className="mb-16">
        <div className={`rounded-3xl border p-6 sm:p-8 shadow-xl relative overflow-hidden ${t.card}`}>
          <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono font-bold text-teal-400 uppercase tracking-wider">Pipeline Flow</span>
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                <span className="text-xs text-slate-400">Zero Silent Drops</span>
              </div>
              <h2 className={`text-2xl font-black ${t.text}`}>From Raw Patient Intake to Grounded Care Plan</h2>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-teal-500/15 text-teal-300 border border-teal-500/30">
              End-to-End Orchestrated
            </span>
          </div>

          {/* Stepper Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {FLOW_STEPS.map((s, i) => (
              <div
                key={s.name}
                className={`rounded-2xl border p-4 transition-all duration-300 relative group hover:scale-[1.02] ${t.cardSecondary}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono font-bold text-slate-400">{s.step}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/5 border border-white/10 ${s.color}`}>
                    {s.badge}
                  </span>
                </div>
                <h4 className={`text-sm font-bold mt-1 ${t.text}`}>{s.name}</h4>
                <p className={`text-xs mt-1 leading-relaxed ${t.textMuted}`}>{s.detail}</p>
                {i < FLOW_STEPS.length - 1 && (
                  <div className="hidden lg:block absolute -right-2 top-1/2 -translate-y-1/2 z-10 text-slate-600">
                    <ArrowRight size={14} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </Reveal>

      {/* Agent Detail Cards */}
      <div className="space-y-10">
        {AGENTS.map((agent) => (
          <Reveal key={agent.id} id={agent.id}>
            <div className={`rounded-3xl border overflow-hidden transition-all duration-500 shadow-xl ${t.card} ${agent.borderGlow}`}>
              <div className="flex flex-col lg:flex-row">
                {/* Left Agent Hero Strip */}
                <div className={`lg:w-1/3 p-8 bg-gradient-to-br ${agent.gradient} flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-white/10 relative overflow-hidden`}>
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-5xl font-black text-white/30 font-mono">{agent.step}</span>
                      <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15">
                        <agent.icon size={28} className="text-white" />
                      </div>
                    </div>
                    <h3 className="text-2xl font-black text-white">{agent.name}</h3>
                    <p className="text-sm text-white/80 mt-1 font-medium leading-relaxed">{agent.tagline}</p>
                  </div>

                  <div className="relative z-10 mt-6 pt-6 border-t border-white/10 flex items-center justify-between text-xs text-white/70">
                    <span className="font-mono">TENANCY: ISOLATED</span>
                    <span className="flex items-center gap-1 font-bold text-teal-300">
                      <CheckCircle size={13} /> AUDITED
                    </span>
                  </div>
                </div>

                {/* Right Agent Details & Sample Preview */}
                <div className="lg:w-2/3 p-7 sm:p-9 space-y-6">
                  <div>
                    <h4 className={`text-xs font-mono font-bold uppercase tracking-wider text-teal-400 mb-2`}>
                      Architecture & Execution
                    </h4>
                    <p className={`${t.textSecondary} leading-relaxed text-sm sm:text-base`}>
                      {agent.description}
                    </p>
                  </div>

                  {/* Feature Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {agent.features.map((f) => (
                      <div key={f.label} className={`flex gap-3 p-3 rounded-xl border transition-all ${t.cardSecondary}`}>
                        <f.icon size={18} className="text-teal-400 shrink-0 mt-0.5" />
                        <div>
                          <p className={`text-xs font-bold ${t.text}`}>{f.label}</p>
                          <p className={`text-[11px] mt-0.5 leading-relaxed ${t.textMuted}`}>{f.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Interactive Live Sample Widget */}
                  <div className={`rounded-2xl border p-4 ${isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-100/70 border-slate-200'}`}>
                    <div className="flex items-center justify-between mb-3 text-xs">
                      <div className="flex items-center gap-2">
                        <Terminal size={14} className="text-teal-400" />
                        <span className={`font-mono font-bold ${t.text}`}>{agent.sampleWidget.title}</span>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-teal-500/10 text-teal-400 border border-teal-500/20">
                        LIVE SPEC
                      </span>
                    </div>

                    {/* Ingestion Spec */}
                    {agent.sampleWidget.type === 'ingestion' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                        {agent.sampleWidget.items.map((item) => (
                          <div key={item.name} className={`p-2 rounded-lg border flex flex-col justify-between ${isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'}`}>
                            <div className="flex items-center justify-between">
                              <span className="truncate text-teal-300 font-bold">{item.name}</span>
                              <Check size={12} className="text-emerald-400 shrink-0 ml-1" />
                            </div>
                            <span className={`text-[10px] mt-1 ${t.textMuted}`}>{item.meta}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Cleaning Spec */}
                    {agent.sampleWidget.type === 'cleaning' && (
                      <div className="space-y-2 text-xs font-mono">
                        <div className={`p-2.5 rounded-lg border ${isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'}`}>
                          <span className="text-rose-400 text-[10px] block mb-0.5">RAW HOSPITAL STRING:</span>
                          <p className="text-slate-300 truncate">{agent.sampleWidget.before}</p>
                          <span className="text-emerald-400 text-[10px] block mt-2 mb-0.5">STANDARDIZED &amp; DEDUPLICATED:</span>
                          <p className="text-teal-300 font-bold">{agent.sampleWidget.after}</p>
                        </div>
                      </div>
                    )}

                    {/* Validation Spec */}
                    {agent.sampleWidget.type === 'validation' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                        {agent.sampleWidget.checks.map((chk) => (
                          <div key={chk.name} className={`p-2.5 rounded-lg border ${isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'}`}>
                            <div className="flex items-center justify-between">
                              <span className={t.text}>{chk.name}</span>
                              <span className="font-bold text-emerald-400 text-[11px]">{chk.status}</span>
                            </div>
                            <span className={`text-[10px] block mt-1 ${t.textMuted}`}>{chk.detail}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Synthesis Spec */}
                    {agent.sampleWidget.type === 'narrative' && (
                      <div className={`p-3 rounded-lg border space-y-2 text-xs font-mono ${isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'}`}>
                        <p className={`italic ${t.text}`}>"{agent.sampleWidget.claim}"</p>
                        <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[11px]">
                          <span className="text-amber-300 font-bold">{agent.sampleWidget.citation}</span>
                          <span className="text-emerald-400 font-bold">{agent.sampleWidget.confidence}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        ))}
      </div>

      {/* Section: Clinical Trust & Integrity */}
      <Reveal id="trust" className="mt-16">
        <div className="text-center mb-10 space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <ShieldCheck size={14} />
            <span>CLINICAL GOVERNANCE &amp; ACCURACY</span>
          </div>
          <h2 className={`text-3xl font-black ${t.text}`}>Trust, Engineered From Ground Zero</h2>
          <p className={`mt-2 max-w-2xl mx-auto leading-relaxed ${t.textSecondary}`}>
            Generative AI in healthcare is hazardous when unverified. Mevreon replaces black-box guessing with cryptographic provenance, deterministic validation, and strict hallucination auditing.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {TRUST_POINTS.map((p) => (
            <div key={p.title} className={`rounded-3xl border p-7 transition-all duration-300 hover:scale-[1.01] ${t.card}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                  <p.icon size={24} className="text-emerald-400" />
                </div>
                <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-emerald-300">
                  {p.badge}
                </span>
              </div>
              <h4 className={`text-lg font-bold mb-2 ${t.text}`}>{p.title}</h4>
              <p className={`text-sm leading-relaxed ${t.textSecondary}`}>{p.text}</p>
            </div>
          ))}
        </div>
      </Reveal>

      {/* Section: Cloud Architecture */}
      <Reveal id="architecture" className="mt-16">
        <div className={`rounded-3xl border p-8 sm:p-10 shadow-xl relative overflow-hidden ${t.card}`}>
          <div className="flex items-center justify-between gap-4 mb-8 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/20">
                <Server size={26} className="text-cyan-400" />
              </div>
              <div>
                <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider">Infrastructure</span>
                <h3 className={`text-2xl font-black ${t.text}`}>Native Google Cloud Architecture</h3>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-mono bg-white/5 border border-white/10 text-slate-300">
                HIPAA / BAA Ready
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {ARCHITECTURE_SERVICES.map((s) => (
              <div key={s.title} className={`rounded-2xl p-6 border transition-all ${t.cardSecondary}`}>
                <span className={`text-[10px] font-mono font-bold uppercase tracking-wider ${s.accent}`}>
                  {s.category}
                </span>
                <h4 className={`text-base font-bold mt-1.5 mb-2 ${t.text}`}>{s.title}</h4>
                <p className={`text-xs leading-relaxed ${t.textSecondary}`}>{s.detail}</p>
              </div>
            ))}
          </div>

          {/* Infrastructure Metrics Banner */}
          <div className={`mt-6 pt-6 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center`}>
            <div>
              <span className="text-xs font-mono text-slate-400">DEPLOYMENT</span>
              <p className={`text-sm font-bold mt-0.5 ${t.text}`}>Terraform / IaC</p>
            </div>
            <div>
              <span className="text-xs font-mono text-slate-400">ENCRYPTION</span>
              <p className={`text-sm font-bold mt-0.5 ${t.text}`}>CMEK at Rest &amp; Transit</p>
            </div>
            <div>
              <span className="text-xs font-mono text-slate-400">SCALING</span>
              <p className={`text-sm font-bold mt-0.5 ${t.text}`}>0 to 1,000+ Concurrent</p>
            </div>
            <div>
              <span className="text-xs font-mono text-slate-400">TENANCY</span>
              <p className={`text-sm font-bold mt-0.5 ${t.text}`}>Customer Project VPC</p>
            </div>
          </div>
        </div>
      </Reveal>

      {/* Bottom CTA Banner */}
      <Reveal id="cta" className="mt-16 text-center">
        <div className={`rounded-3xl border p-10 sm:p-14 relative overflow-hidden ${t.card}`}>
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-2xl mx-auto space-y-4">
            <h3 className={`text-3xl sm:text-4xl font-black ${t.text}`}>
              Ready to process patient cohorts?
            </h3>
            <p className={`text-base leading-relaxed ${t.textSecondary}`}>
              Upload raw case folders into GCS—the 4-agent autonomous pipeline orchestrates the rest, producing grounded longitudinal summaries and clinical dashboards.
            </p>
            <div className="pt-3">
              <CTA label="Open Patient Dashboard" />
            </div>
            <p className={`text-xs mt-6 font-mono ${t.textMuted}`}>
              Multimodal Ingestion · RxNorm/LOINC Cleaning · Safety Gate Quarantine · Grounded Synthesis
            </p>
          </div>
        </div>
      </Reveal>

      {/* Floating Back to Top Button */}
      {showBackToTop && (
        <button
          onClick={() => {
            const scrollContainer = getScrollContainer();
            if (scrollContainer && scrollContainer !== window) {
              scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }
          }}
          className="fixed bottom-6 right-6 z-40 p-3 rounded-2xl bg-teal-600 hover:bg-teal-500 text-white shadow-2xl shadow-teal-500/40 border border-teal-400/40 transition-all duration-300 hover:scale-110 active:scale-95 cursor-pointer"
          title="Back to Top"
          aria-label="Back to top"
        >
          <ArrowUp size={18} />
        </button>
      )}
    </div>
  );
};

export default PipelineLanding;
