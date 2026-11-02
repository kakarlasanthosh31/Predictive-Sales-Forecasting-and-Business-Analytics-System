import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import mammoth from 'mammoth';
import { parseCSV, summarize, forecast } from './analytics.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const app = express();
const PORT = Number(process.env.PORT || 4000);
app.use(cors());
app.use(express.json({ limit: '2mb' }));
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 }, fileFilter: (_req,file,cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (['.csv','.txt','.pdf','.docx','.doc'].includes(ext)) cb(null,true);
  else cb(new Error('Unsupported file type. Please upload CSV, TXT, PDF, DOCX, or DOC.'));
} });

function loadDemo() {
  const p = path.join(root,'data','demo_sales.csv');
  const { records } = parseCSV(fs.readFileSync(p,'utf8'));
  return records;
}
let records = loadDemo();
let datasetName = 'Forma sample retail dataset';
let lastImport = { accepted: records.length, rejected: 0, fileName: datasetName };

function parseStructuredText(text) {
  let t = String(text || '').replace(/^\uFEFF/, '').trim();
  if (!t) throw new Error('I could not find readable text in this document. If it is a scanned PDF, run OCR first or upload a CSV.');
  const lines = t.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  const candidates = lines.filter(line => /[,\t|;]/.test(line));
  if (candidates.length < 2) throw new Error('I could read this document, but could not find a structured sales table. For best results, upload a CSV with date, product, units_sold, unit_price, and region columns.');
  const delimiter = candidates[0].includes('\t') ? '\t' : candidates[0].includes('|') ? '|' : candidates[0].includes(';') ? ';' : ',';
  const csv = candidates.map(line => line.split(delimiter).map(cell => cell.trim()).join(',')).join('\n');
  return parseCSV(csv);
}
app.get('/api/health', (_req,res)=>res.json({ ok:true, service:'forma-sales-forecast-api', version:'3.0.0', records:records.length, dataset:datasetName }));
app.get('/api/data', (_req,res)=>{ try { res.json({ ok:true, datasetName, ...summarize(records), importInfo:lastImport }); } catch(e) { res.status(500).json({ ok:false, error:e.message }); } });
app.get('/api/transactions', (req,res)=>{
  const search=String(req.query.search||'').toLowerCase(), region=String(req.query.region||'All'), category=String(req.query.category||'All');
  const filtered=records.filter(r=>(!search||`${r.product} ${r.category} ${r.region}`.toLowerCase().includes(search))&&(region==='All'||r.region===region)&&(category==='All'||r.category===category));
  res.json({ ok:true, total:filtered.length, records:filtered });
});
app.post('/api/upload', upload.single('file'), async (req,res)=>{
  if (!req.file) return res.status(400).json({ ok:false, error:'Choose a file first, then click Generate forecast.' });
  const ext=path.extname(req.file.originalname).toLowerCase();
  try {
    let parsed;
    if (ext === '.csv' || ext === '.txt') parsed=parseCSV(req.file.buffer.toString('utf8'));
    else if (ext === '.pdf') { const data=await pdfParse(req.file.buffer); parsed=parseStructuredText(data.text); }
    else if (ext === '.docx') { const data=await mammoth.extractRawText({ buffer:req.file.buffer }); parsed=parseStructuredText(data.value); }
    else if (ext === '.doc') return res.status(415).json({ ok:false, error:'Legacy .doc files are not reliably supported. Please open the file in Word and Save As .docx or export the table to CSV.' });
    if (!parsed.records.length) throw new Error('No valid sales records were found in this file.');
    records=parsed.records; datasetName=req.file.originalname; lastImport={ accepted:records.length, rejected:parsed.rejected.length, fileName:req.file.originalname, rejectedRows:parsed.rejected.slice(0,20) };
    res.json({ ok:true, message:`Imported ${records.length} sales records from ${req.file.originalname}.`, accepted:records.length, rejected:parsed.rejected.length, rejectedRows:parsed.rejected.slice(0,20), datasetName, ...summarize(records) });
  } catch(err) { res.status(400).json({ ok:false, error:err.message || 'Could not read this file. Please check its format and try again.' }); }
});
app.post('/api/reset', (_req,res)=>{ try { records=loadDemo(); datasetName='Forma sample retail dataset'; lastImport={accepted:records.length,rejected:0,fileName:datasetName}; res.json({ok:true,message:'Sample dataset restored.',datasetName,...summarize(records)}); } catch(e) { res.status(500).json({ok:false,error:e.message}); } });
app.get('/api/forecast', (req,res)=>{ try { res.json({ok:true,...forecast(records,req.query.horizon)}); } catch(e) { res.status(400).json({ok:false,error:e.message}); } });
app.get('/api/export.csv', (req,res)=>{
  const fields=['date','product','category','units_sold','unit_price','revenue','region','marketing_spend'];
  const esc=v=>{const s=String(v??'');return /[",\r\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;};
  const csv=[fields.join(','),...records.map(r=>fields.map(f=>esc(r[f])).join(','))].join('\r\n');
  res.setHeader('Content-Type','text/csv; charset=utf-8'); res.setHeader('Content-Disposition','attachment; filename="forma-sales-export.csv"'); res.send('\uFEFF'+csv);
});
app.use('/demo-data',express.static(path.join(root,'public','demo-data')));
if (fs.existsSync(path.join(root,'dist'))) { app.use(express.static(path.join(root,'dist'))); app.get('*',(req,res)=>res.sendFile(path.join(root,'dist','index.html'))); }
app.use((err,_req,res,_next)=>{ const status=err instanceof multer.MulterError ? 400 : 500; res.status(status).json({ok:false,error:err.message||'Unexpected server error'}); });
app.listen(PORT,()=>console.log(`Forma API ready at http://localhost:${PORT} (${records.length} sample records loaded)`));
