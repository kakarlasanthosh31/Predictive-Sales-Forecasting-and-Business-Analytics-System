export function parseCSV(text) {
  const clean = String(text ?? '').replace(/^\uFEFF/, '').trim();
  if (!clean) throw new Error('This file is empty. Please choose a CSV with sales records.');
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (ch === '"' && quoted && clean[i + 1] === '"') { field += '"'; i++; }
    else if (ch === '"') quoted = !quoted;
    else if (ch === ',' && !quoted) { row.push(field); field = ''; }
    else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && clean[i + 1] === '\n') i++;
      row.push(field); if (row.some(v => v.trim())) rows.push(row); row = []; field = '';
    } else field += ch;
  }
  row.push(field); if (row.some(v => v.trim())) rows.push(row);
  if (rows.length < 2) throw new Error('I found a header but no sales rows. Add at least one record.');
  const headers = rows.shift().map(h => h.trim().replace(/^\uFEFF/, '').toLowerCase().replace(/[\s-]+/g, '_'));
  const idx = (...names) => names.map(n => headers.indexOf(n)).find(i => i >= 0) ?? -1;
  const dateI = idx('date','order_date','sale_date','month');
  const productI = idx('product','product_name','item','sku');
  const categoryI = idx('category','product_category','department');
  const unitsI = idx('units_sold','units','quantity','qty');
  const priceI = idx('unit_price','price','selling_price','price_per_unit');
  const revenueI = idx('revenue','sales','total_sales','sales_amount','amount');
  const regionI = idx('region','location','market','state');
  const spendI = idx('marketing_spend','marketing','ad_spend');
  const missing = [['date',dateI],['product',productI],['units_sold',unitsI]].filter(([,i])=>i<0).map(([n])=>n);
  if (missing.length) throw new Error(`I couldn't identify these required columns: ${missing.join(', ')}. Please include date, product, and units_sold (or quantity). CSV is the most reliable format.`);
  if (priceI < 0 && revenueI < 0) throw new Error('I found the sales quantity but no unit_price or revenue column. Add unit_price or revenue so the dashboard can calculate meaningful sales totals instead of showing zero.');
  const records = [], rejected = [];
  rows.forEach((r, n) => {
    const date = (r[dateI] || '').trim();
    const product = (r[productI] || '').trim();
    const units = Number((r[unitsI] || '').replace(/[,₹$ ]/g,''));
    const priceRaw = priceI >= 0 ? (r[priceI] || '').replace(/[,₹$ ]/g,'') : '';
    const revenueRaw = revenueI >= 0 ? (r[revenueI] || '').replace(/[,₹$ ]/g,'') : '';
    const price = priceRaw === '' ? 0 : Number(priceRaw);
    const revenue = revenueRaw === '' ? (priceI >= 0 ? units * price : 0) : Number(revenueRaw);
    const parsedDate = new Date(date);
    if (!date || Number.isNaN(parsedDate.getTime()) || !product || !Number.isFinite(units) || units < 0 || (priceRaw !== '' && (!Number.isFinite(price) || price < 0)) || (revenueRaw !== '' && (!Number.isFinite(revenue) || revenue < 0))) {
      rejected.push({ row: n + 2, reason: 'Missing or invalid date, product, units, price, or revenue' }); return;
    }
    records.push({ date: parsedDate.toISOString().slice(0,10), product, category: categoryI >= 0 && r[categoryI]?.trim() ? r[categoryI].trim() : 'Uncategorised', units_sold: units, unit_price: price, revenue: revenue || (price * units), region: regionI >= 0 && r[regionI]?.trim() ? r[regionI].trim() : 'Unspecified', marketing_spend: spendI >= 0 ? Number((r[spendI] || '0').replace(/[,₹$ ]/g,'')) || 0 : 0 });
  });
  if (!records.length) throw new Error(`No usable sales rows were found. ${rejected.length} row(s) were rejected. Check the date format and required columns.`);
  return { records, rejected };
}

export function summarize(records) {
  const revenue = records.reduce((s,r)=>s + Number(r.revenue || 0),0);
  const units = records.reduce((s,r)=>s + Number(r.units_sold || 0),0);
  const products = new Set(records.map(r=>r.product)).size;
  const monthlyMap = new Map();
  for (const r of records) {
    const month = String(r.date).slice(0,7);
    if (!/^\d{4}-\d{2}$/.test(month)) continue;
    const m = monthlyMap.get(month) || { month, revenue: 0, units: 0, orders: 0 };
    m.revenue += Number(r.revenue || 0); m.units += Number(r.units_sold || 0); m.orders += 1; monthlyMap.set(month,m);
  }
  const monthly = [...monthlyMap.values()].sort((a,b)=>a.month.localeCompare(b.month));
  const productMap = new Map();
  records.forEach(r=>{const p=productMap.get(r.product)||{product:r.product,revenue:0,units:0};p.revenue+=Number(r.revenue||0);p.units+=Number(r.units_sold||0);productMap.set(r.product,p)});
  const categoriesMap = new Map(); records.forEach(r=>categoriesMap.set(r.category,(categoriesMap.get(r.category)||0)+Number(r.revenue||0)));
  return { metrics: { revenue, units, products, records: records.length, avgOrderValue: records.length ? revenue / records.length : 0 }, monthly, topProducts: [...productMap.values()].sort((a,b)=>b.revenue-a.revenue).slice(0,8), categories: [...categoriesMap].map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value), dateRange: monthly.length ? {start:monthly[0].month,end:monthly.at(-1).month} : null };
}

export function forecast(records, horizon = 6) {
  const summary = summarize(records), history = summary.monthly;
  if (!history.length) throw new Error('There are no dated sales records to forecast.');
  const n = Math.max(1, Math.min(12, Number(horizon) || 6));
  const values = history.map(x=>x.revenue);
  const tail = values.slice(-Math.min(6, values.length));
  const average = tail.reduce((a,b)=>a+b,0)/tail.length;
  const trend = values.length > 1 ? (values.at(-1)-values[Math.max(0,values.length-4)]) / Math.min(3, values.length-1) : 0;
  const start = new Date(`${history.at(-1).month}-01T00:00:00Z`);
  const projected = Array.from({length:n},(_,i)=>{
    const d = new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+i+1,1));
    const trendEstimate = Math.max(0, values.at(-1) + trend*(i+1));
    const blended = Math.max(0, average*0.65 + trendEstimate*0.35);
    return { month: `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`, revenue: blended, lower: blended*0.86, upper: blended*1.14 };
  });
  const errors = [];
  if (values.length >= 4) for(let i=Math.max(2,values.length-6);i<values.length;i++){const pred=(values[i-1]+values[i-2])/2;errors.push({actual:values[i],pred});}
  const mae=errors.length?errors.reduce((s,e)=>s+Math.abs(e.actual-e.pred),0)/errors.length:null;
  const rmse=errors.length?Math.sqrt(errors.reduce((s,e)=>s+(e.actual-e.pred)**2,0)/errors.length):null;
  return { horizon:n, projected, history, totalForecast:projected.reduce((s,p)=>s+p.revenue,0), monthlyRunRate:projected[0]?.revenue||0, mae, rmse, note: values.length < 4 ? 'There are only a few historical months. Treat this as an early planning estimate.' : 'A lightweight trend and recent-average blend is used. Forecasts are estimates, not guarantees.', method:'Trend + recent-average blend' };
}
