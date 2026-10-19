import React, { useState, useEffect, useRef } from 'react';
import { X, FileText, Loader2, Image as ImageIcon, AlertTriangle, ExternalLink } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { GetObjectCommand, ListObjectsV2Command } from '../lib/gcpStorage';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

/* ═══════════════════════════════════════════════════════════════════
 * EVIDENCE VIEWER — the "show me the receipt" moment.
 * Given a claim's evidence {document, page, source_sentence}, opens the
 * original PDF from the RAW bucket, finds the page containing the
 * sentence, renders it and overlays highlight boxes on the matching
 * text. Falls back to inline image / text for non-PDF sources.
 * ═══════════════════════════════════════════════════════════════════ */

const norm = (s) => (s || '').toLowerCase().replace(/\s+/g, ' ').replace(/[^a-z0-9 ]/g, '').trim();

const EvidenceViewer = ({ open, onClose, evidence, caseId, s3Client }) => {
  const [status, setStatus] = useState('idle'); // idle|loading|ready|error
  const [error, setError] = useState('');
  const [resolvedKey, setResolvedKey] = useState(null);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [pageNum, setPageNum] = useState(1);
  const [foundPage, setFoundPage] = useState(null);
  const [highlights, setHighlights] = useState([]);
  const [imgUrl, setImgUrl] = useState(null);
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);

  const doc = evidence?.document || '';
  const sentence = evidence?.source_sentence || evidence?.location || '';
  const isPdf = doc.toLowerCase().endsWith('.pdf');
  const isImg = /\.(jpe?g|png|gif|bmp|webp|tiff?)$/i.test(doc);

  // Resolve the RAW key for this document
  useEffect(() => {
    if (!open || !evidence || !s3Client) return;
    let cancelled = false;
    setStatus('loading'); setError(''); setResolvedKey(null); setPdfDoc(null);
    setHighlights([]); setFoundPage(null); setImgUrl(null); setPageNum(1);
    (async () => {
      try {
        let key = `${caseId}/${doc}`;
        let probe = await s3Client.send(new GetObjectCommand({ Bucket: 'mevreon-raw-gcp', Key: key })).catch(() => null);
        if (!probe || !probe.ContentLength) {
          // exact-name miss → suffix search under the case folder
          const listing = await s3Client.send(new ListObjectsV2Command({ Bucket: 'mevreon-raw-gcp', Prefix: `${caseId}/` }));
          const match = (listing?.Contents || []).find((o) => (o.Key || '').endsWith(doc));
          if (!match) throw new Error(`Could not find "${doc}" in the raw bucket`);
          key = match.Key;
        }
        if (cancelled) return;
        setResolvedKey(key);
        if (isPdf) await loadPdf(key);
        else if (isImg) await loadImage(key);
        else setStatus('ready');
      } catch (e) {
        if (!cancelled) { setStatus('error'); setError(e?.message || String(e)); }
      }
    })();
    return () => { cancelled = true; };
  }, [open, evidence?.document]);

  async function fetchBytes(key) {
    const resp = await s3Client.send(new GetObjectCommand({ Bucket: 'mevreon-raw-gcp', Key: key }));
    return resp.Body.transformToByteArray();
  }

  async function loadImage(key) {
    const bytes = await fetchBytes(key);
    const blob = new Blob([bytes], { type: 'image/jpeg' });
    setImgUrl(URL.createObjectURL(blob));
    setStatus('ready');
  }

  async function loadPdf(key) {
    const bytes = await fetchBytes(key);
    const doc = await pdfjsLib.getDocument({ data: bytes }).promise;
    setPdfDoc(doc);

    // Find the page containing the evidence sentence (normalized substring match)
    const needle = norm(sentence).slice(0, 60);
    let target = evidence?.page > 0 ? evidence.page : null;
    let matchedItems = [];
    if (needle.length >= 8) {
      for (let p = 1; p <= doc.numPages; p++) {
        const page = await doc.getPage(p);
        const tc = await page.getTextContent();
        const items = tc.items.filter((it) => it.str && it.str.trim());
        const pageText = norm(items.map((it) => it.str).join(' '));
        if (pageText.includes(needle)) { target = p; matchedItems = items; break; }
      }
    }
    if (!target) target = 1;
    setFoundPage(target);
    setPageNum(target);
    await renderPage(doc, target, matchedItems, needle);
    setStatus('ready');
  }

  async function renderPage(doc, p, items, needle) {
    const page = await doc.getPage(p);
    const viewport = page.getViewport({ scale: 1.6 });
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;

    // Highlight text items that participate in the matched sentence
    if (!needle || needle.length < 8 || !items.length) { setHighlights([]); return; }
    const slice = needle.slice(0, 24);
    const boxes = [];
    let buffer = '', bufStart = -1;
    const flush = (endIdx) => {
      if (bufStart >= 0 && norm(buffer).includes(slice)) {
        const a = items[bufStart], b = items[Math.min(endIdx, items.length - 1)];
        const group = items.slice(bufStart, endIdx + 1);
        const x1 = Math.min(...group.map((it) => it.transform[4]));
        const x2 = Math.max(...group.map((it) => it.transform[4] + (it.width || 0)));
        const y1 = Math.min(...group.map((it) => it.transform[5]));
        const y2 = Math.max(...group.map((it) => it.transform[5]));
        boxes.push({ left: x1, top: y1 - 2, width: Math.max(30, x2 - x1), height: Math.max(14, y2 - y1 + (group[0].height || 10) + 4) });
      }
      buffer = ''; bufStart = -1;
    };
    for (let i = 0; i < items.length; i++) {
      const combined = norm(buffer + ' ' + items[i].str);
      if (slice && combined.includes(slice)) {
        if (bufStart < 0) bufStart = Math.max(0, i - 1);
        buffer += ' ' + items[i].str;
        if (norm(buffer).length >= needle.length) flush(i);
      } else if (bufStart >= 0 && norm(buffer).includes(slice)) {
        flush(i - 1);
      }
    }
    setHighlights(boxes);
  }

  const gotoPage = async (p) => {
    if (!pdfDoc || p < 1 || p > pdfDoc.numPages) return;
    setPageNum(p);
    setStatus('loading');
    await renderPage(pdfDoc, p, [], '');
    setStatus('ready');
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl border border-white/10 bg-slate-900 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}>
        {/* header */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-white/10">
          {isPdf ? <FileText size={18} className="text-rose-400" /> : <ImageIcon size={18} className="text-cyan-400" />}
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-white truncate">{doc}</div>
            <div className="text-[11px] text-slate-400">Evidence source{foundPage ? ` · page ${foundPage}` : ''}</div>
          </div>
          {resolvedKey && (
            <a href={`/api/storage/get?bucket=mevreon-raw-gcp&key=${encodeURIComponent(resolvedKey)}`}
              target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-200 bg-white/5 hover:bg-white/10 transition-colors">
              <ExternalLink size={13} /> Open original
            </a>
          )}
          <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* highlighted claim banner */}
        {sentence && (
          <div className="px-5 py-2.5 bg-amber-400/10 border-b border-amber-400/25">
            <div className="text-[10px] font-black uppercase tracking-wider text-amber-300 mb-0.5">Highlighted claim</div>
            <div className="text-sm text-amber-100">“{sentence.length > 260 ? sentence.slice(0, 260) + '…' : sentence}”</div>
          </div>
        )}

        {/* body */}
        <div className="relative flex-1 overflow-auto bg-slate-950 p-4 custom-scrollbar">
          {status === 'loading' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 size={32} className="animate-spin text-teal-400" />
              <span className="text-sm">Locating the source page…</span>
            </div>
          )}
          {status === 'error' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-400 px-8 text-center">
              <AlertTriangle size={32} className="text-amber-400" />
              <span className="text-sm">{error}</span>
            </div>
          )}
          {isPdf && (
            <div className="relative mx-auto w-fit">
              <canvas ref={canvasRef} className="rounded-lg shadow-xl" />
              {highlights.map((h, i) => (
                <div key={i} className="absolute bg-amber-400/35 border border-amber-300/70 rounded-sm pointer-events-none"
                  style={{ left: `${h.left}px`, top: `${h.top}px`, width: `${h.width}px`, height: `${h.height}px`, mixBlendMode: 'multiply' }} />
              ))}
            </div>
          )}
          {!isPdf && imgUrl && (
            <div className="relative mx-auto w-fit">
              <img src={imgUrl} alt={doc} className="max-h-[60vh] rounded-lg shadow-xl" />
              <div className="absolute inset-0 ring-4 ring-amber-400/40 rounded-lg pointer-events-none" />
            </div>
          )}
          {!isPdf && !isImg && status === 'ready' && (
            <div className="mx-auto max-w-2xl rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
              {sentence || 'No inline preview for this source type — use “Open original” above.'}
            </div>
          )}
        </div>

        {/* footer page nav */}
        {isPdf && pdfDoc && (
          <div className="flex items-center justify-center gap-4 px-5 py-2.5 border-t border-white/10 text-xs text-slate-300">
            <button onClick={() => gotoPage(pageNum - 1)} disabled={pageNum <= 1}
              className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-40 font-bold">← Prev</button>
            <span>Page <b className="text-white">{pageNum}</b> / {pdfDoc.numPages}
              {foundPage === pageNum && <span className="ml-2 text-amber-300 font-bold">· evidence here</span>}</span>
            <button onClick={() => gotoPage(pageNum + 1)} disabled={pageNum >= pdfDoc.numPages}
              className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-40 font-bold">Next →</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default EvidenceViewer;
