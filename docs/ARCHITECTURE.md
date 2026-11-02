# Architecture overview

```text
Browser (React + Vite, port 5173)
  ├─ Welcome screen / single scroll dashboard
  ├─ File dropzone + Generate forecast workflow
  ├─ Metrics, historical/forecast chart, business signals
  └─ Architecture & technical details modal
             │ HTTP / JSON + multipart upload
             ▼
Express API (Node.js, port 4000)
  ├─ /api/health and /api/data
  ├─ /api/upload → CSV/TXT, PDF text extraction, DOCX text extraction
  ├─ /api/forecast → recent-average + trend blend
  ├─ /api/export.csv
  └─ /api/reset → synthetic sample dataset
             │
             ▼
In-memory validated records → summaries → forecast
```

Uploaded records live in process memory only. No database or cloud service is required for local demonstration.
