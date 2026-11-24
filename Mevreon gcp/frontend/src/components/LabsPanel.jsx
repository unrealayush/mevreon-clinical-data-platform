import React, { useState, useEffect, useMemo } from 'react';
import {
  TestTube, AlertTriangle, ShieldCheck, Search, Filter,
  ArrowUpDown, ExternalLink, Activity, Info, CheckCircle2,
  AlertCircle, Eye, ChevronDown, ChevronUp, BarChart2
} from 'lucide-react';
import { GetObjectCommand, ListObjectsV2Command } from '../lib/gcpStorage';

/* ═══════════════════════════════════════════════════════════════════
 * LABS PANEL — Comprehensive Laboratory Biomarkers & Diagnostics
 * Extracts lab tests from all pipeline stages (curated dashboard,
 * validated entities, per-file ingestion) with:
 * - Interactive panel categorisation (CBC, Glycemic, Renal, Hepatic, Urine, Lipids, Vitamins)
 * - Biological reference range horizontal visual gauges
 * - Abnormal / Critical high/low color-coded status badges
 * - Instant search and 'Abnormal Only' quick filter
 * - Direct click-to-evidence highlighting via EvidenceViewer
 * ═══════════════════════════════════════════════════════════════════ */

const CATEGORIES = [
  { id: 'all', label: 'All Biomarkers' },
  { id: 'abnormal', label: 'Abnormal Only' },
  { id: 'hematology', label: 'Hematology / CBC' },
  { id: 'glycemic', label: 'Diabetes & Glycemic' },
  { id: 'lipids', label: 'Lipid Profile' },
  { id: 'vitamins', label: 'Vitamins & Minerals' },
  { id: 'renal', label: 'Renal & Kidney' },
  { id: 'hepatic', label: 'Hepatic & Liver' },
  { id: 'urine', label: 'Urinalysis' },
  { id: 'other', label: 'Other Tests' }
];

function classifyTest(name = '') {
  const n = (name || '').toLowerCase();
  if (/haemo|hemo|rbc|wbc|pcv|mcv|mch|mchc|rdw|platelet|plt|erythrocyte|leukocyte|pdw|blood count|esr|neutrophil|lymphocyte|monocyte|eosinophil|basophil/.test(n)) {
    return 'hematology';
  }
  if (/hba1c|glucose|glycated|eag|sugar|insulin|fructosamine|diabetes|post prandial|fasting glucose/.test(n)) {
    return 'glycemic';
  }
  if (/cholesterol|triglyceride|lipid|hdl|ldl|vldl/.test(n)) {
    return 'lipids';
  }
  if (/vitamin|b12|d3|folate|iron|ferritin|tibc|calcium|phosphorus/.test(n)) {
    return 'vitamins';
  }
  if (/creatinine|bun|urea|uric|gfr|egfr|kidney|microalbumin|cystatin/.test(n)) {
    return 'renal';
  }
  if (/bilirubin|sgot|sgpt|ast|alt|alkaline phosphatase|alp|protein|albumin|globulin|ggt|liver|gamma gt/.test(n)) {
    return 'hepatic';
  }
  if (/urine|pus cells|epithelial|casts|crystals|urobilinogen|nitrite|bacteria|specific gravity|leukocyte esterase|ketones|mucus/.test(n)) {
    return 'urine';
  }
  return 'other';
}

function parseRange(refRangeStr) {
  if (!refRangeStr || typeof refRangeStr !== 'string') return null;
  const s = refRangeStr.trim();
  // e.g. "14-18", "70-99", "11.5 - 14.0", "0-5"
  const m = s.match(/([0-9.]+)\s*[-–—to]+\s*([0-9.]+)/i);
  if (m) {
    const min = parseFloat(m[1]);
    const max = parseFloat(m[2]);
    if (!isNaN(min) && !isNaN(max) && max > min) {
      return { min, max };
    }
  }
  // e.g. "<= 5.6", "< 6.5"
  const mLess = s.match(/(?:<=?|<)\s*([0-9.]+)/);
  if (mLess) {
    const max = parseFloat(mLess[1]);
    if (!isNaN(max)) return { min: 0, max };
  }
  // e.g. ">= 60", "> 50"
  const mGreater = s.match(/(?:>=?|>)\s*([0-9.]+)/);
  if (mGreater) {
    const min = parseFloat(mGreater[1]);
    if (!isNaN(min)) return { min, max: min * 2 };
  }
  return null;
}

export default function LabsPanel({ caseData, narrative, s3Client, theme = 'dark', onOpenEvidence }) {
  const [selectedCat, setSelectedCat] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('name'); // 'name' | 'severity'
  const [remoteLabs, setRemoteLabs] = useState([]);

  const isDark = theme === 'dark';

  // Asynchronously scan encounters from CURATED bucket if needed
  useEffect(() => {
    if (!s3Client) return;
    const cid = caseData?.id || caseData?.case_id;
    if (!cid) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await s3Client.send(new ListObjectsV2Command({
          Bucket: 'mevreon-curated-gcp',
          Prefix: `cases/${cid}/encounters/`
        }));
        const contents = res?.Contents || [];
        const loaded = [];
        for (const obj of contents) {
          if (obj.Key && obj.Key.endsWith('.json')) {
            try {
              const fileRes = await s3Client.send(new GetObjectCommand({
                Bucket: 'mevreon-curated-gcp',
                Key: obj.Key
              }));
              const text = await fileRes.Body.transformToString();
              const json = JSON.parse(text);
              const tests = json?.validated_data?.lab_tests;
              if (Array.isArray(tests)) {
                loaded.push(...tests);
              }
            } catch (err) {
              console.warn('[LabsPanel] failed to load encounter', obj.Key, err);
            }
          }
        }
        if (!cancelled && loaded.length > 0) {
          setRemoteLabs(loaded);
        }
      } catch (e) {
        console.warn('[LabsPanel] encounter scan failed', e);
      }
    })();

    return () => { cancelled = true; };
  }, [s3Client, caseData?.id, caseData?.case_id]);

  // Harvest lab tests from all available pipeline sources
  const allLabs = useMemo(() => {
    const collected = [];
    const seen = new Set();

    const addLab = (lab, sourceName) => {
      if (!lab || typeof lab !== 'object') return;
      const rawTest = lab.test || lab.test_name || lab.standard_name || lab.original_name || lab.name || '';
      const testName = typeof rawTest === 'string' ? rawTest.trim() : (typeof rawTest === 'object' ? JSON.stringify(rawTest) : String(rawTest || ''));
      if (!testName) return;

      const rawVal = lab.value != null ? lab.value : '';
      const val = typeof rawVal === 'string' ? rawVal.trim() : (typeof rawVal === 'object' ? JSON.stringify(rawVal) : String(rawVal));
      const key = `${testName.toLowerCase()}::${val.toLowerCase()}`;
      if (seen.has(key)) return;
      seen.add(key);

      const units = String(lab.units || '');
      const rawRef = lab.ref_range || lab.reference_interval || lab.biological_reference_interval || '';
      const refRange = typeof rawRef === 'string' ? rawRef : (typeof rawRef === 'object' ? JSON.stringify(rawRef) : String(rawRef));
      const abnormal = String(lab.abnormal || lab.status || '').toUpperCase();
      const numVal = parseFloat(val.replace(/[^0-9.-]/g, ''));

      let status = 'NORMAL';
      if (/^H|^HH|HIGH|CRITICAL_HIGH|ABOVE/.test(abnormal)) status = 'HIGH';
      else if (/^L|^LL|LOW|CRITICAL_LOW|BELOW/.test(abnormal)) status = 'LOW';
      else if (/POSITIVE|REACTIVE|PRESENT|DETECTED/i.test(val) && /negative|absent|normal/i.test(refRange)) status = 'HIGH';

      // Check numeric bounds if range known and status still normal
      const range = parseRange(refRange);
      if (range && !isNaN(numVal)) {
        if (numVal > range.max) status = 'HIGH';
        else if (numVal < range.min) status = 'LOW';
      }

      collected.push({
        id: key,
        testName,
        value: val,
        numValue: isNaN(numVal) ? null : numVal,
        units,
        refRange,
        range,
        status,
        date: lab.date ? String(lab.date) : null,
        evidence: lab.evidence || null,
        category: classifyTest(testName),
        source: String(sourceName || 'Laboratory')
      });
    };

    // 1. From curated DASHBOARD
    const dash = caseData?.dashboard;
    if (dash) {
      if (Array.isArray(dash.lab_tests)) dash.lab_tests.forEach(l => addLab(l, 'Laboratory Panel'));
      if (Array.isArray(dash.key_lab_values)) dash.key_lab_values.forEach(l => addLab(l, 'Key Finding'));
      if (Array.isArray(dash.critical_lab_values)) dash.critical_lab_values.forEach(l => addLab(l, 'Critical Alert'));
      if (Array.isArray(dash.trending_abnormal_labs)) dash.trending_abnormal_labs.forEach(l => addLab(l, 'Trend'));
    }

    // 2. From caseData & narrative objects
    if (Array.isArray(caseData?.lab_tests)) caseData.lab_tests.forEach(l => addLab(l, 'Patient Laboratory'));
    if (Array.isArray(narrative?.lab_tests)) narrative.lab_tests.forEach(l => addLab(l, 'Clinical Narrative'));
    if (Array.isArray(narrative?.laboratory_summary?.key_values)) {
      narrative.laboratory_summary.key_values.forEach(l => addLab(l, 'Narrative Lab Summary'));
    }
    if (Array.isArray(narrative?.laboratory_summary?.critical_values)) {
      narrative.laboratory_summary.critical_values.forEach(l => addLab(l, 'Narrative Critical Alert'));
    }

    // 3. From validated encounters
    const encounters = caseData?.encounters || [];
    encounters.forEach(enc => {
      const vd = enc.validated_data || enc.data?.validated_data;
      if (vd && Array.isArray(vd.lab_tests)) {
        vd.lab_tests.forEach(l => addLab(l, 'Validated Encounter'));
      }
    });

    // 4. From remote encounter scan
    if (Array.isArray(remoteLabs) && remoteLabs.length > 0) {
      remoteLabs.forEach(l => addLab(l, 'Clinical Encounter Panel'));
    }

    // 5. From per-file ingestion extractions
    const ingestion = caseData?.agentOutputs?.ingestion || [];
    ingestion.forEach(item => {
      const d = item.data || item;
      if (d && Array.isArray(d.lab_tests)) {
        d.lab_tests.forEach(l => addLab(l, item.filename || 'Ingestion'));
      }
      if (d && Array.isArray(d.per_file_extractions)) {
        d.per_file_extractions.forEach(pf => {
          if (Array.isArray(pf.lab_tests)) {
            pf.lab_tests.forEach(l => addLab(l, pf.filename || 'Lab Report'));
          }
        });
      }
    });

    return collected;
  }, [caseData, narrative, remoteLabs]);

  // Filter and sort
  const filteredLabs = useMemo(() => {
    let result = allLabs;

    if (selectedCat === 'abnormal') {
      result = result.filter(l => l.status === 'HIGH' || l.status === 'LOW');
    } else if (selectedCat !== 'all') {
      result = result.filter(l => l.category === selectedCat);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(l =>
        l.testName.toLowerCase().includes(q) ||
        l.value.toLowerCase().includes(q) ||
        l.units.toLowerCase().includes(q)
      );
    }

    return result.sort((a, b) => {
      if (sortBy === 'severity') {
        const score = s => (s === 'HIGH' || s === 'LOW' ? 2 : 1);
        return score(b.status) - score(a.status);
      }
      return a.testName.localeCompare(b.testName);
    });
  }, [allLabs, selectedCat, searchQuery, sortBy]);

  // Statistics
  const stats = useMemo(() => {
    const total = allLabs.length;
    const abnormal = allLabs.filter(l => l.status === 'HIGH' || l.status === 'LOW').length;
    const normal = total - abnormal;
    const passRate = total > 0 ? Math.round((normal / total) * 100) : 100;
    return { total, abnormal, normal, passRate };
  }, [allLabs]);

  return (
    <div className="space-y-6">
      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className={`p-4 rounded-xl border ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center gap-2 mb-1">
            <TestTube size={16} className="text-teal-400" />
            <span className={`text-xs uppercase font-bold tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Total Analytes</span>
          </div>
          <div className="text-2xl font-black">{stats.total}</div>
          <p className={`text-[11px] mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Extracted across panels</p>
        </div>

        <div className={`p-4 rounded-xl border ${isDark ? 'bg-rose-950/20 border-rose-900/40' : 'bg-rose-50 border-rose-200'}`}>
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={16} className="text-rose-400" />
            <span className={`text-xs uppercase font-bold tracking-wider ${isDark ? 'text-rose-400' : 'text-rose-600'}`}>Abnormal Out of Range</span>
          </div>
          <div className="text-2xl font-black text-rose-500">{stats.abnormal}</div>
          <p className={`text-[11px] mt-1 ${isDark ? 'text-rose-400/70' : 'text-rose-600/70'}`}>Requires clinical attention</p>
        </div>

        <div className={`p-4 rounded-xl border ${isDark ? 'bg-emerald-950/20 border-emerald-900/40' : 'bg-emerald-50 border-emerald-200'}`}>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck size={16} className="text-emerald-400" />
            <span className={`text-xs uppercase font-bold tracking-wider ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>Within Range</span>
          </div>
          <div className="text-2xl font-black text-emerald-500">{stats.normal}</div>
          <p className={`text-[11px] mt-1 ${isDark ? 'text-emerald-400/70' : 'text-emerald-600/70'}`}>Optimal biological bounds</p>
        </div>

        <div className={`p-4 rounded-xl border ${isDark ? 'bg-indigo-950/20 border-indigo-900/40' : 'bg-indigo-50 border-indigo-200'}`}>
          <div className="flex items-center gap-2 mb-1">
            <Activity size={16} className="text-indigo-400" />
            <span className={`text-xs uppercase font-bold tracking-wider ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>Panel Pass Rate</span>
          </div>
          <div className="text-2xl font-black text-indigo-400">{stats.passRate}%</div>
          <p className={`text-[11px] mt-1 ${isDark ? 'text-indigo-400/70' : 'text-indigo-600/70'}`}>Reference concordance</p>
        </div>
      </div>

      {/* Control Bar: Categories & Search */}
      <div className={`p-4 rounded-xl border space-y-3 ${isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search size={16} className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
            <input
              type="text"
              placeholder="Search tests (e.g. HbA1c, Haemoglobin, Glucose, Nitrite)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-9 pr-3 py-2 text-sm rounded-lg border outline-none transition-colors ${
                isDark
                  ? 'bg-slate-950 border-slate-800 text-white focus:border-teal-500'
                  : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-teal-600'
              }`}
            />
          </div>

          {/* Sort button */}
          <button
            onClick={() => setSortBy(s => (s === 'name' ? 'severity' : 'name'))}
            className={`px-3 py-2 text-xs font-bold rounded-lg border flex items-center gap-2 transition-all ${
              sortBy === 'severity'
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                : isDark ? 'border-slate-800 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <ArrowUpDown size={14} />
            <span>Sort: {sortBy === 'severity' ? 'Abnormal First' : 'A-Z'}</span>
          </button>
        </div>

        {/* Category Pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {CATEGORIES.map(cat => {
            const active = selectedCat === cat.id;
            const count = cat.id === 'all'
              ? allLabs.length
              : cat.id === 'abnormal'
              ? stats.abnormal
              : allLabs.filter(l => l.category === cat.id).length;

            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCat(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  active
                    ? 'bg-teal-600 text-white shadow-lg shadow-teal-500/20'
                    : isDark
                    ? 'bg-slate-800/60 text-slate-400 hover:bg-slate-800 hover:text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>{cat.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  active ? 'bg-white/20 text-white' : isDark ? 'bg-slate-900 text-slate-400' : 'bg-slate-200 text-slate-700'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Lab Results Grid */}
      {filteredLabs.length === 0 ? (
        <div className={`p-12 text-center rounded-2xl border ${isDark ? 'bg-slate-900/20 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
          <TestTube size={48} className="mx-auto mb-3 opacity-40" />
          <h4 className="text-base font-bold mb-1">No laboratory tests match this filter</h4>
          <p className="text-xs">Try selecting 'All Biomarkers' or clearing your search term.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredLabs.map(lab => {
            const isAbnormal = lab.status === 'HIGH' || lab.status === 'LOW';

            // Calculate gauge marker percentage
            let markerPct = 50;
            if (lab.range && lab.numValue !== null) {
              const span = lab.range.max - lab.range.min;
              if (span > 0) {
                const pos = (lab.numValue - lab.range.min) / span;
                // clamp 0% to 100%
                markerPct = Math.max(5, Math.min(95, Math.round(pos * 100)));
              }
            } else if (lab.status === 'HIGH') {
              markerPct = 85;
            } else if (lab.status === 'LOW') {
              markerPct = 15;
            }

            return (
              <div
                key={lab.id}
                className={`p-4 rounded-xl border transition-all hover:shadow-lg flex flex-col justify-between ${
                  isAbnormal
                    ? isDark
                      ? 'bg-rose-950/15 border-rose-800/40 hover:border-rose-700'
                      : 'bg-rose-50/40 border-rose-200 hover:border-rose-300'
                    : isDark
                    ? 'bg-slate-900/40 border-slate-800/80 hover:border-slate-700'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div>
                  {/* Top Bar: Title & Status Badge */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-sm truncate" title={lab.testName}>
                        {lab.testName}
                      </h4>
                      <span className={`text-[10px] font-mono uppercase ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                        {lab.category}
                      </span>
                    </div>

                    <span
                      className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full whitespace-nowrap tracking-wider flex items-center gap-1 ${
                        lab.status === 'HIGH'
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          : lab.status === 'LOW'
                          ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                          : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      }`}
                    >
                      {isAbnormal ? <AlertTriangle size={10} /> : <CheckCircle2 size={10} />}
                      {lab.status}
                    </span>
                  </div>

                  {/* Value & Units */}
                  <div className="my-3 flex items-baseline gap-2">
                    <span className={`text-2xl font-black ${
                      lab.status === 'HIGH'
                        ? 'text-rose-400'
                        : lab.status === 'LOW'
                        ? 'text-sky-400'
                        : isDark ? 'text-white' : 'text-slate-900'
                    }`}>
                      {lab.value}
                    </span>
                    {lab.units && (
                      <span className={`text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {lab.units}
                      </span>
                    )}
                  </div>

                  {/* Visual Reference Gauge (when bounds exist) */}
                  {lab.range ? (
                    <div className="mb-3 space-y-1">
                      <div className="flex justify-between text-[10px] text-slate-500">
                        <span>Low: {lab.range.min}</span>
                        <span className="font-medium text-slate-400">Target Range</span>
                        <span>High: {lab.range.max}</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-800 relative overflow-hidden flex">
                        <div className="h-full w-1/4 bg-sky-500/30" />
                        <div className="h-full w-1/2 bg-emerald-500/30" />
                        <div className="h-full w-1/4 bg-rose-500/30" />
                        <div
                          className="absolute top-0 bottom-0 w-1.5 bg-white rounded-full shadow-lg -translate-x-1/2"
                          style={{ left: `${markerPct}%` }}
                        />
                      </div>
                    </div>
                  ) : lab.refRange ? (
                    <div className={`text-xs p-2 rounded-lg mb-3 flex items-center justify-between ${isDark ? 'bg-slate-950/60 text-slate-400' : 'bg-slate-100 text-slate-600'}`}>
                      <span className="text-[11px] font-medium">Ref Interval:</span>
                      <span className="font-mono text-[11px] font-bold">{lab.refRange}</span>
                    </div>
                  ) : null}
                </div>

                {/* Footer: Evidence & Source Document */}
                <div className={`pt-2 border-t flex items-center justify-between text-[11px] ${isDark ? 'border-slate-800/80 text-slate-500' : 'border-slate-100 text-slate-400'}`}>
                  <span className="truncate max-w-[140px]" title={lab.source}>
                    {lab.source}
                  </span>

                  {lab.evidence && onOpenEvidence && (
                    <button
                      onClick={() => onOpenEvidence(lab.evidence)}
                      className="text-teal-400 hover:text-teal-300 font-bold flex items-center gap-1 transition-colors group"
                      title="Inspect PDF evidence bounding box"
                    >
                      <span>Receipt</span>
                      <ExternalLink size={11} className="group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
