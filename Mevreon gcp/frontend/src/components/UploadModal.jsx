import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  X,
  FileText,
  FolderOpen,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  CloudUpload,
  Zap,
  Info,
  ChevronDown,
  Target,
  LineChart
} from 'lucide-react';
import { cn } from '../utils/cn';

// ═══════════════════════════════════════════════════════════════
// COMPASS CANCER TYPES (TCGA codes)
// ═══════════════════════════════════════════════════════════════
const CANCER_TYPES = [
  { code: "ACC", name: "Adrenocortical Carcinoma" },
  { code: "BLCA", name: "Bladder Urothelial Carcinoma" },
  { code: "BRCA", name: "Breast Invasive Carcinoma" },
  { code: "CESC", name: "Cervical Squamous Cell Carcinoma" },
  { code: "CHOL", name: "Cholangiocarcinoma" },
  { code: "COAD", name: "Colon Adenocarcinoma" },
  { code: "DLBC", name: "Diffuse Large B-Cell Lymphoma" },
  { code: "ESCA", name: "Esophageal Carcinoma" },
  { code: "GBM", name: "Glioblastoma Multiforme" },
  { code: "HNSC", name: "Head and Neck Squamous Cell" },
  { code: "KICH", name: "Kidney Chromophobe" },
  { code: "KIRC", name: "Kidney Renal Clear Cell" },
  { code: "KIRP", name: "Kidney Renal Papillary Cell" },
  { code: "LAML", name: "Acute Myeloid Leukemia" },
  { code: "LGG", name: "Brain Lower Grade Glioma" },
  { code: "LIHC", name: "Liver Hepatocellular Carcinoma" },
  { code: "LUAD", name: "Lung Adenocarcinoma" },
  { code: "LUSC", name: "Lung Squamous Cell Carcinoma" },
  { code: "MESO", name: "Mesothelioma" },
  { code: "OV", name: "Ovarian Serous Cystadenocarcinoma" },
  { code: "PAAD", name: "Pancreatic Adenocarcinoma" },
  { code: "PCPG", name: "Pheochromocytoma / Paraganglioma" },
  { code: "PRAD", name: "Prostate Adenocarcinoma" },
  { code: "READ", name: "Rectum Adenocarcinoma" },
  { code: "SARC", name: "Sarcoma" },
  { code: "SKCM", name: "Skin Cutaneous Melanoma" },
  { code: "STAD", name: "Stomach Adenocarcinoma" },
  { code: "TGCT", name: "Testicular Germ Cell Tumors" },
  { code: "THCA", name: "Thyroid Carcinoma" },
  { code: "THYM", name: "Thymoma" },
  { code: "UCEC", name: "Uterine Corpus Endometrial" },
  { code: "UCS", name: "Uterine Carcinosarcoma" },
  { code: "UVM", name: "Uveal Melanoma" },
];

const UploadModal = ({ isOpen, onClose, onUpload, isUploading, uploadProgress, theme, isPage = false }) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [caseId, setCaseId] = useState('');
  const fileInputRef = useRef(null);

  // ── Immunotherapy (COMPASS) state ──
  const [compassEnabled, setCompassEnabled] = useState(false);
  const [cancerType, setCancerType] = useState('');
  const [geneExprFile, setGeneExprFile] = useState(null);
  const geneExprInputRef = useRef(null);

  // ── Target Discovery (PINNACLE) state ──
  const [pinnacleEnabled, setPinnacleEnabled] = useState(false);
  const [pinnacleDiseaseId, setPinnacleDiseaseId] = useState('');
  const [pinnacleTargets, setPinnacleTargets] = useState('');

  const t = {
    bg: theme === 'dark' ? 'bg-slate-900' : 'bg-white',
    bgSecondary: theme === 'dark' ? 'bg-slate-950' : 'bg-gray-50',
    border: theme === 'dark' ? 'border-slate-800' : 'border-gray-200',
    text: theme === 'dark' ? 'text-slate-200' : 'text-gray-800',
    textMuted: theme === 'dark' ? 'text-slate-500' : 'text-gray-500',
    input: theme === 'dark' ? 'bg-slate-950 border-slate-700' : 'bg-white border-gray-300',
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files) {
      setSelectedFiles(Array.from(e.target.files));
    }
  };

  const handleGeneExprSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const ext = file.name.split('.').pop().toLowerCase();
      if (!['tsv', 'csv', 'txt'].includes(ext)) {
        alert('Please select a TSV or CSV file containing gene expression data.');
        return;
      }
      setGeneExprFile(file);
    }
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0 && !compassEnabled && !pinnacleEnabled) return;
    const finalCaseId = caseId.trim() || `CASE_${Date.now()}`;
    
    const compassMeta = compassEnabled ? {
      enabled: true,
      cancer_type: cancerType,
      gene_expression_file: geneExprFile,
    } : null;

    const pinnacleMeta = pinnacleEnabled ? {
        enabled: true,
        discovery_only: true,
        disease_id: pinnacleDiseaseId,
        protein_targets: pinnacleTargets.split(',').map(s => s.trim()).filter(Boolean)
    } : null;

    await onUpload(selectedFiles, finalCaseId, compassMeta, pinnacleMeta);
    
    // Reset state
    setSelectedFiles([]);
    setCaseId('');
    setCompassEnabled(false);
    setCancerType('');
    setGeneExprFile(null);
    setPinnacleEnabled(false);
    setPinnacleDiseaseId('');
    setPinnacleTargets('');
  };

  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (!isOpen) return null;

  const canSubmit = (selectedFiles.length > 0 || compassEnabled || pinnacleEnabled) && !isUploading &&
    (!compassEnabled || geneExprFile) &&
    (!pinnacleEnabled || pinnacleDiseaseId);

  const AnalysisToggleSection = ({ enabled, setEnabled, title, icon: Icon, color, children }) => {
    // ... (rest of the component is unchanged)
    const colorClasses = {
      emerald: { border: 'border-emerald-500/40', bg: 'bg-emerald-500/5', text: 'text-emerald-300' },
      sky: { border: 'border-sky-500/40', bg: 'bg-sky-500/5', text: 'text-sky-300' },
    };
    const c = colorClasses[color] || colorClasses.emerald;

    return (
      <div className={cn(
        "rounded-xl border transition-all",
        enabled ? c.border + ' ' + c.bg : t.border + ' ' + t.bgSecondary
      )}>
        <label className="flex items-center gap-3 p-4 cursor-pointer select-none">
          <div className="relative">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="sr-only" />
            <div className={cn("w-11 h-6 rounded-full transition-colors", enabled ? `bg-${color}-500` : 'bg-slate-700')}>
              <div className={cn("w-5 h-5 bg-white rounded-full shadow transition-transform mt-0.5", enabled ? "translate-x-[22px]" : "translate-x-0.5")} />
            </div>
          </div>
          <div className="flex items-center gap-2 flex-1">
            <Icon size={18} className={enabled ? c.text : t.textMuted} />
            <span className={cn("font-semibold text-sm", enabled ? c.text : t.textMuted)}>
              {title}
            </span>
          </div>
        </label>

        <AnimatePresence>
          {enabled && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className={`px-4 pb-4 space-y-4 border-t pt-4 ${c.border}`}>
                {children}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const ModalContent = (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
      className={cn(
        "w-full rounded-2xl border shadow-2xl overflow-hidden flex flex-col",
        isPage ? "max-w-3xl border-none shadow-none bg-transparent" : `max-w-2xl max-h-[90vh] ${t.bg} ${t.border}`
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className={`h-16 border-b flex items-center justify-between px-6 flex-shrink-0 ${t.border} ${isPage ? t.bg : t.bgSecondary}`}>
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <CloudUpload size={18} className="text-white" />
          </div>
          <h3 className={`font-bold text-lg ${t.text}`}>Upload Patient Folder</h3>
        </div>
        <button onClick={onClose} className={`p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white`}>
          <X size={20} />
        </button>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6 overflow-y-auto">
        {/* Case ID */}
        <div>
          <label className={`block text-sm font-medium mb-2 ${t.textMuted}`}>Case ID (Optional)</label>
          <input
            type="text"
            value={caseId}
            onChange={(e) => setCaseId(e.target.value)}
            placeholder="e.g., P-12345 or leave blank"
            className={`w-full p-3 rounded-lg text-white focus:border-indigo-500 outline-none ${t.input}`}
          />
        </div>

        {/* Upload Area */}
        <div
          className={cn(
            "border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer",
            dragActive ? "border-indigo-500 bg-indigo-500/10" : `${t.border} hover:border-slate-600 ${t.bgSecondary}`
          )}
          onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input ref={fileInputRef} type="file" multiple webkitdirectory="" className="hidden" onChange={handleFileSelect} />
          <div className="space-y-4">
            <div className={`mx-auto h-16 w-16 rounded-2xl flex items-center justify-center ${theme === 'dark' ? 'bg-slate-800' : 'bg-gray-200'}`}>
              <FolderOpen size={32} className={t.textMuted} />
            </div>
            <div>
              <h4 className={`text-lg font-semibold mb-2 ${t.text}`}>Drop patient folder here</h4>
              <p className={`${t.textMuted} mb-4`}>Select a folder containing medical documents</p>
              <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition-colors">Browse Files</button>
            </div>
          </div>
        </div>

        {/* Selected Files */}
        {selectedFiles.length > 0 && (
          <div className="space-y-3">
            <h4 className={`font-semibold flex items-center gap-2 ${t.text}`}>
              <FileText size={18} />
              Selected Files ({selectedFiles.length})
            </h4>
            <div className="max-h-48 overflow-y-auto space-y-2 custom-scrollbar p-1">
              {selectedFiles.map((file, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`flex items-center justify-between p-3 rounded-lg border ${t.bgSecondary} ${t.border}`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`h-8 w-8 rounded flex items-center justify-center flex-shrink-0 ${theme === 'dark' ? 'bg-slate-700' : 'bg-gray-200'}`}>
                      <FileText size={14} className={t.textMuted} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={`text-sm font-medium truncate ${t.text}`}>{file.name}</div>
                      <div className={`text-xs ${t.textMuted}`}>{formatFileSize(file.size)}</div>
                    </div>
                  </div>
                  <button onClick={() => removeFile(index)} className={`p-1 hover:bg-slate-700 rounded text-slate-500 hover:text-rose-400 transition-colors`}>
                    <X size={16} />
                  </button>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Analysis Sections */}
        <div className="space-y-4">
          <AnalysisToggleSection enabled={compassEnabled} setEnabled={setCompassEnabled} title="Immunotherapy Analysis" icon={Target} color="emerald">
            {/* COMPASS Content */}
            <div>
              <label className={`block text-xs font-semibold mb-1.5 uppercase tracking-wider ${t.textMuted}`}>Cancer Type (Optional)</label>
              <div className="relative">
                <select value={cancerType} onChange={(e) => setCancerType(e.target.value)}
                  className={`w-full p-3 rounded-lg text-white focus:border-emerald-500 outline-none appearance-none cursor-pointer text-sm pr-10 ${t.input}`}>
                  <option value="">Select cancer type...</option>
                  {CANCER_TYPES.map(ct => <option key={ct.code} value={ct.code}>{ct.code} — {ct.name}</option>)}
                </select>
                <ChevronDown size={16} className={`absolute right-3 top-1/2 -translate-y-1/2 ${t.textMuted} pointer-events-none`} />
              </div>
            </div>
            <div>
              <label className={`block text-xs font-semibold mb-1.5 uppercase tracking-wider ${t.textMuted}`}>Gene Expression File (TSV/CSV) *</label>
              <input ref={geneExprInputRef} type="file" accept=".tsv,.csv,.txt" className="hidden" onChange={handleGeneExprSelect} />
              {geneExprFile ? (
                <div className={`flex items-center justify-between p-3 rounded-lg border border-emerald-500/30 ${t.bgSecondary}`}>
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 bg-emerald-500/20 rounded flex items-center justify-center"><FileText size={14} className="text-emerald-400" /></div>
                    <div>
                      <div className={`text-sm font-medium ${t.text}`}>{geneExprFile.name}</div>
                      <div className={`text-xs ${t.textMuted}`}>{formatFileSize(geneExprFile.size)}</div>
                    </div>
                  </div>
                  <button onClick={() => setGeneExprFile(null)} className="p-1 hover:bg-slate-700 rounded text-slate-500 hover:text-rose-400"><X size={16} /></button>
                </div>
              ) : (
                <button onClick={() => geneExprInputRef.current?.click()} className={`w-full p-3 border-2 border-dashed rounded-lg text-sm transition-colors flex items-center justify-center gap-2 ${t.border} hover:border-emerald-500/50 text-slate-400 hover:text-emerald-300`}>
                  <FileText size={16} /> Upload gene expression data
                </button>
              )}
            </div>
          </AnalysisToggleSection>

          <AnalysisToggleSection enabled={pinnacleEnabled} setEnabled={setPinnacleEnabled} title="Target Discovery" icon={LineChart} color="sky">
            {/* PINNACLE Content */}
            <div>
              <label className={`block text-xs font-semibold mb-1.5 uppercase tracking-wider ${t.textMuted}`}>Disease ID (MONDO, etc.) *</label>
              <input type="text" value={pinnacleDiseaseId} onChange={(e) => setPinnacleDiseaseId(e.target.value)} placeholder="e.g., MONDO:0005027" className={`w-full p-3 rounded-lg text-white focus:border-sky-500 outline-none ${t.input}`} />
            </div>
            <div>
              <label className={`block text-xs font-semibold mb-1.5 uppercase tracking-wider ${t.textMuted}`}>Protein Targets (Optional, comma-separated)</label>
              <input type="text" value={pinnacleTargets} onChange={(e) => setPinnacleTargets(e.target.value)} placeholder="e.g., P00533, P04637" className={`w-full p-3 rounded-lg text-white focus:border-sky-500 outline-none ${t.input}`} />
            </div>
          </AnalysisToggleSection>
        </div>

        {/* Upload Progress */}
        {isUploading && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className={`text-sm font-medium ${t.textMuted}`}>Uploading files...</span>
              <span className={`text-sm ${t.textMuted}`}>{uploadProgress}%</span>
            </div>
            <div className={`w-full rounded-full h-2 ${theme === 'dark' ? 'bg-slate-800' : 'bg-gray-200'}`}>
              <motion.div className="bg-indigo-500 h-2 rounded-full" initial={{ width: 0 }} animate={{ width: `${uploadProgress}%` }} transition={{ duration: 0.5 }} />
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className={`border-t p-6 flex justify-end gap-3 flex-shrink-0 ${t.border} ${isPage ? t.bg : t.bg}`}>
        <button onClick={onClose} className={`px-4 py-2 transition-colors ${t.textMuted} hover:text-white`}>Cancel</button>
        <button
          onClick={handleUpload}
          disabled={!canSubmit}
          className={cn(
            "px-6 py-2 font-medium rounded-lg transition-all flex items-center gap-2",
            canSubmit ? "bg-indigo-600 hover:bg-indigo-500 text-white" : "bg-slate-700 text-slate-500 cursor-not-allowed"
          )}
        >
          {isUploading ? (<><Loader2 className="animate-spin" size={16} />Uploading...</>) : (<><Upload size={16} />Start Pipeline</>)}
        </button>
      </div>
    </motion.div>
  );

  if (isPage) {
    return ModalContent;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      >
        {ModalContent}
      </motion.div>
    </AnimatePresence>
  );
};

export default UploadModal;


