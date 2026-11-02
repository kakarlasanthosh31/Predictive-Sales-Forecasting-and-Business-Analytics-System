# Forma — Sales Intelligence (v3)

A local-first, single-dashboard sales analysis and forecasting demo for the academic project **Predictive Sales Forecasting and Business Analytics System**.

## Run locally

Requirements: Node.js 20+ (Node.js 22 LTS recommended).

```powershell
npm install
npm run dev
```

Open http://localhost:5173. Keep the terminal running. The API listens at http://localhost:4000.

To run tests: `npm test`. To create a production frontend build: `npm run build`. For local production preview, build first and then run `npm start` (serves the built frontend and API on port 4000).

## User flow

1. Welcome screen → open workspace or explore sample data.
2. Upload a CSV/TXT, text-based PDF, DOCX or legacy DOC file. Files are limited to 15 MB.
3. Click **Generate forecast**. The app validates/imports records, refreshes metrics, computes the forecast and scrolls to results.
4. Explore the historical/projected revenue chart, metrics, business signals and export sales records to CSV.
5. Click the always-visible floating **Architecture & technical details** button at the bottom-right (also available in the footer) for a technical pop-up.

## Data format

CSV is recommended. Required columns: `date`, `product`, and `units_sold` (aliases such as `order_date`, `product_name`, `quantity` are recognized). Optional columns: `category`, `unit_price`, `revenue`, `region`, `marketing_spend`. Dates should be parseable by JavaScript, preferably `YYYY-MM-DD`. Example:

```csv
date,product,category,units_sold,unit_price,region
2025-01-01,Laptop,Electronics,10,55000,South
2025-02-01,Phone,Electronics,25,20000,North
```

PDF/DOCX import is best-effort text extraction: documents need a readable, structured table with comma-, tab-, or pipe-separated fields and a header. Scanned PDFs require OCR before upload. Legacy `.doc` is accepted by the picker but currently returns a clear message to convert it to `.docx` or CSV. A document's layout may not preserve table boundaries reliably; export to CSV for best results.

## Demo data

- `data/demo_sales.csv` is loaded on startup.
- `public/demo-data/retail_demo.csv`, `electronics_demo.csv`, and `grocery_demo.csv` are included as separate examples.
- The datasets are synthetic and should be labelled as demo data in presentations, not real business data.

## Architecture

- React 18 + Vite frontend (`src/`), served on port 5173 during development.
- Express API (`server/index.js`) on port 4000.
- CSV parser, summary aggregation and forecast logic (`server/analytics.js`).
- `multer` handles in-memory uploads, `pdf-parse` extracts PDF text, and `mammoth` extracts DOCX text.
- Endpoints: `GET /api/health`, `GET /api/data`, `GET /api/transactions`, `POST /api/upload`, `POST /api/reset`, `GET /api/forecast?horizon=6`, and `GET /api/export.csv`.

## Forecasting caveats

The demo forecast is an explainable lightweight blend of a recent-average baseline and a simple trend estimate, not a trained machine-learning model such as Random Forest, XGBoost or Prophet. MAE/RMSE are calculated from a small trailing holdout-style comparison when enough monthly history exists. The ±14% band is illustrative only and is **not** a statistically estimated confidence interval. Validate results with domain knowledge before business use.

## Limitations and production checklist

- Uploaded data is held in server memory only; restarting the API restores the sample dataset.
- No database, user accounts, authentication, role permissions, or durable file storage.
- Document extraction is best effort, not a universal table parser. Use CSV for consistent results.
- Before global deployment, add authentication, database persistence, upload scanning, stronger validation, request limits, audit logging, backups, monitoring, and secure hosting configuration.

## v6 visual and reporting update
- Added a theme picker with Silver Glass, Arctic Blue, Sage Glass, Champagne, and Midnight palettes. The selection is saved in browser local storage.
- Added an Analysis Report section with monthly revenue bars, top-product revenue ranking, plain-English summary, forecast outlook, and print/save-to-PDF support through the browser print dialog.
- Expanded responsive and print styles for report output.
- The Architecture & Technical Details popup remains available from the floating button and footer.

To save the report as a PDF, generate a forecast, scroll to **Your Analysis Report**, and choose **Print / save report**. In the browser print dialog select **Save as PDF**.


## v7 interaction and visualization update

- Replaced the main column/bar chart with a responsive SVG time-series graph. Historical revenue is shown as a smoothed visual line with a shaded area; forecast periods use a distinct dashed line and separate point markers. Tooltips identify each month and value.
- Added cursor-proximity scaling to glass cards, buttons, theme controls, metric icons, and the upload area, inspired by the macOS Dock. Nearby elements magnify subtly as the pointer moves.
- Added gentle press wobble and soft card buoyancy effects, with reduced-motion support for accessibility.
- Chart accent colours follow the active glass theme.

The chart is built from the current dataset and forecast response; it does not fabricate additional data points. Run `npm test` to execute the backend tests. Install dependencies with `npm install` before `npm run build` or `npm run dev`.

## v8 visual polish
- The default Silver Glass palette now uses a slightly darker brushed-silver/pearl-grey base instead of near-white surfaces.
- Dock-style pointer magnification now includes decorative hero orbs and orbit rings, heading labels, icon tiles, report graph marks, product-ranking rows, and individual cards inside the Architecture & Technical Details modal.
- Architecture modal cards now have glass depth, hover lift, a restrained liquid pulse, and magnified technical index badges. Reduced-motion preferences are respected.
- These are presentation improvements; the application remains a local-first academic demo and still needs a full browser build/test in the target environment before production deployment.
