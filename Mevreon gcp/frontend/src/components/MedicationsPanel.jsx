import React, { useMemo } from 'react';
import { Pill, ShieldCheck, AlertTriangle, Eye, History, Search } from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════════
 * MEDICATIONS PANEL — dedicated tab for the medication regimen.
 * Pulls meds from every source the pipeline produced (narrative,
 * dashboard, per-file ingestion outputs) and groups them into
 * Current / Prescribed / Discontinued. Every med carries its
 * evidence, so a doctor can click "View evidence" and jump straight
 * to the highlighted source document (PDF/image).
 * ═══════════════════════════════════════════════════════════════════ */

const normName = (s) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim();

const gather = (narrative, caseData) => {
  const meds = { current: [], prescribed: [], discontinued: [], pending: [], other: [] };
  const seen = new Set();
  const push = (m, bucket) => {
    if (!m || typeof m !== 'object') return;
    const name = m.name || m.medicine_name || m.medication || m.drug_name || m.drug;
    if (!name) return;
    const k = normName(name);
    if (seen.has(k)) return;
    seen.add(k);
    meds[bucket].push(m);
  };
  const fromList = (list, bucket) => (Array.isArray(list) ? list : []).forEach((m) => push(m, bucket));
  const fromDict = (d, bucket) => {
    if (!d || typeof d !== 'object') return;
    if (Array.isArray(d)) return fromList(d, bucket);
    for (const k of ['current', 'current_regimen', 'prescribed', 'active', 'advice']) {
      if (Array.isArray(d[k])) fromList(d[k], bucket === 'other' ? 'current' : bucket);
    }
    for (const k of ['discontinued', 'stopped', 'past']) if (Array.isArray(d[k])) fromList(d[k], 'discontinued');
    for (const k of ['pending', 'planned']) if (Array.isArray(d[k])) fromList(d[k], 'pending');
  };

  const narrMeds = narrative?.medications;
  fromDict(narrMeds, 'current');
  if (Array.isArray(narrative?.medication_list)) fromList(narrative.medication_list, 'current');

  const dash = caseData?.dashboard;
  fromDict(dash?.medications, 'current');

  const ingestion = caseData?.agentOutputs?.ingestion || [];
  for (const f of ingestion) {
    const d = f.data || f;
    if (d && typeof d === 'object' && Array.isArray(d.medications)) fromList(d.medications, 'current');
    if (d && typeof d === 'object' && d.per_file_extractions) {
      for (const pf of d.per_file_extractions) {
        if (Array.isArray(pf?.medications)) fromList(pf.medications, 'current');
      }
    }
  }

  const allergies = (() => {
    const a = narrative?.allergies || dash?.allergies || [];
    return Array.isArray(a) ? a : [];
  })();

  return { meds, allergies };
};

const STATUS_META = [
  { key: 'current', label: 'Current Regimen', icon: ShieldCheck, color: 'text-emerald-400' },
  { key: 'prescribed', label: 'Prescribed', icon: Pill, color: 'text-teal-400' },
  { key: 'pending', label: 'Pending / Planned', icon: Search, color: 'text-amber-400' },
  { key: 'discontinued', label: 'Discontinued', icon: History, color: 'text-slate-400' },
];

const evidenceFor = (m) => {
  const ev = m.evidence && typeof m.evidence === 'object' ? m.evidence : {};
  const doc = ev.document || m.document || (Array.isArray(m.source_files) && m.source_files[0]) || '';
  const src = ev.source_sentence || ev.source_text || ev.sentence || '';
  return { document: doc, source_sentence: src, page: ev.page };
};

const MedicationGroups = ({ groups, meds, t, onOpenEvidence }) => (
  <div className="space-y-5">
    {groups.map((s) => (
      <div key={s.key}>
        <div className="flex items-center gap-2 mb-3">
          <s.icon size={16} className={s.color} />
          <h4 className={`text-sm font-black uppercase tracking-wider ${t.textSecondary}`}>{s.label}</h4>
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${t.textMuted}`}>{meds[s.key].length}</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {meds[s.key].map((m, i) => {
            const ev = evidenceFor(m);
            const name = m.name || m.medicine_name || m.medication || m.drug_name || m.drug;
            const dose = m.dose || m.strength || m.dosage_strength || '';
            const freq = m.frequency || m.dosage || m.freq || m.schedule || '';
            const route = m.route || m.administration_route || '';
            const indication = m.indication || m.purpose || '';
            return (
              <div key={`${name}-${i}`} className={`rounded-xl border p-4 transition-all hover:translate-y-[-2px] ${t.card}`}>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 p-2 rounded-lg bg-gradient-to-br from-teal-500/20 to-cyan-500/10 border border-teal-500/20">
                    <Pill size={16} className="text-teal-300" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={`font-bold ${t.text}`}>{name}</div>
                    <div className={`text-xs mt-0.5 ${t.textSecondary}`}>
                      {[dose, freq, route].filter(Boolean).join(' · ') || 'Dose not specified'}
                    </div>
                    {indication && <div className={`text-xs mt-1 italic ${t.textMuted}`}>for {indication}</div>}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {m.confidence != null && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${Number(m.confidence) >= 0.8 ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10' : 'border-amber-500/30 text-amber-400 bg-amber-500/10'}`}>
                          conf {(Number(m.confidence) * 100).toFixed(0)}%
                        </span>
                      )}
                      {Array.isArray(m.source_files) && m.source_files.length > 1 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-white/10 text-slate-400">
                          {m.source_files.length} sources
                        </span>
                      )}
                      {ev.document && (
                        <button
                          onClick={() => onOpenEvidence && onOpenEvidence(ev)}
                          className="ml-auto flex items-center gap-1 text-[11px] font-bold text-teal-400 hover:text-teal-300 transition-colors">
                          <Eye size={12} /> View evidence
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    ))}
  </div>
);

const MedicationsPanel = ({ narrative, caseData, theme, onOpenEvidence }) => {
  const { meds, allergies } = useMemo(() => gather(narrative, caseData), [narrative, caseData]);
  const total = Object.values(meds).reduce((n, l) => n + l.length, 0);
  const t = {
    card: theme === 'dark' ? 'bg-slate-900/60 border-white/10' : 'bg-white border-slate-200',
    text: theme === 'dark' ? 'text-white' : 'text-slate-900',
    textSecondary: theme === 'dark' ? 'text-slate-400' : 'text-slate-600',
    textMuted: theme === 'dark' ? 'text-slate-500' : 'text-slate-400',
  };

  if (total === 0) {
    return (
      <div className={`rounded-2xl border p-10 text-center ${t.card}`}>
        <Pill size={44} className="mx-auto text-slate-500 mb-4" />
        <h3 className={`text-lg font-bold mb-2 ${t.text}`}>No medications recorded</h3>
        <p className={`text-sm max-w-md mx-auto ${t.textSecondary}`}>
          This patient's records did not surface a structured medication list in the
          narrative or dashboard outputs. Check the Files &amp; Pipeline tab for the raw extraction.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className={`rounded-xl border p-4 ${t.card}`}>
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-emerald-400" />
            <span className={`text-xs uppercase font-bold ${t.textMuted}`}>Active medications</span>
          </div>
          <div className={`text-2xl font-black mt-1 ${t.text}`}>{meds.current.length + meds.prescribed.length}</div>
        </div>
        <div className={`rounded-xl border p-4 ${t.card}`}>
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-400" />
            <span className={`text-xs uppercase font-bold ${t.textMuted}`}>Total captured</span>
          </div>
          <div className={`text-2xl font-black mt-1 ${t.text}`}>{total}</div>
        </div>
        <div className={`rounded-xl border p-4 ${t.card}`}>
          <div className="flex items-center gap-2">
            <Eye size={16} className="text-teal-400" />
            <span className={`text-xs uppercase font-bold ${t.textMuted}`}>Allergies</span>
          </div>
          <div className={`text-2xl font-black mt-1 ${t.text}`}>{allergies.length}</div>
        </div>
      </div>

      {/* Allergies */}
      {allergies.length > 0 && (
        <div className={`rounded-xl border p-4 ${t.card}`}>
          <div className="text-xs font-black uppercase tracking-wider text-rose-400 mb-2">Allergies / Intolerances</div>
          <div className="flex flex-wrap gap-2">
            {allergies.map((a, i) => (
              <span key={i} className="px-3 py-1 rounded-full text-xs font-bold border border-rose-500/30 bg-rose-500/10 text-rose-300">
                {a.allergen || (typeof a === 'string' ? a : 'Unknown')}
                {a.reaction && <span className="text-rose-400/70"> — {a.reaction}</span>}
              </span>
            ))}
          </div>
        </div>
      )}

      <MedicationGroups groups={STATUS_META.filter((s) => meds[s.key].length > 0)} meds={meds} t={t} onOpenEvidence={onOpenEvidence} />

      <div className={`text-[11px] ${t.textMuted} border-t border-white/5 pt-3`}>
        Medications are pulled from the longitudinal narrative, clinical dashboard, and per-file
        ingestion outputs — deduplicated by name. “View evidence” opens the source document
        highlighted at the exact sentence.
      </div>
    </div>
  );
};

export default MedicationsPanel;