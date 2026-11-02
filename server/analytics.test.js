import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCSV, summarize, forecast } from './analytics.js';
const sample='date,product,category,units_sold,unit_price,region\n2024-01-01,Widget,Home,10,20,South\n2024-02-01,Widget,Home,12,20,South\n2024-03-01,Gadget,Tech,5,100,North\n2024-04-01,Widget,Home,15,20,South';
test('CSV parser normalizes BOM and calculates revenue',()=>{const d=parseCSV('\uFEFF'+sample);assert.equal(d.records.length,4);assert.equal(d.records[0].revenue,200);assert.equal(d.rejected.length,0)});
test('CSV parser returns readable error for missing required columns',()=>{assert.throws(()=>parseCSV('name,qty\nWidget,4'),/required columns/i)});
test('summary produces non-zero business metrics',()=>{const s=summarize(parseCSV(sample).records);assert.equal(s.metrics.revenue,1240);assert.equal(s.metrics.units,42);assert.equal(s.metrics.products,2);assert.equal(s.monthly.length,4)});
test('forecast returns requested horizon and non-negative estimates',()=>{const f=forecast(parseCSV(sample).records,3);assert.equal(f.projected.length,3);assert.ok(f.totalForecast>0);assert.ok(f.projected.every(p=>p.revenue>=0&&p.upper>p.lower))});
