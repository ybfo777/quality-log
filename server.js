'use strict';
const express = require('express');
const Database = require('better-sqlite3');
const path    = require('path');
const crypto  = require('crypto');
const fs      = require('fs');

const DATA_DIR = process.env.DATA_DIR || '/var/data';
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'incidents.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS incidents (
    id          TEXT PRIMARY KEY,
    date        TEXT NOT NULL,
    machine     TEXT,
    type        TEXT,
    criticality TEXT,
    description TEXT,
    cause       TEXT,
    detected_by TEXT,
    resolution  TEXT,
    resolved    INTEGER DEFAULT 0,
    images      TEXT    DEFAULT '[]',
    created_at  TEXT    DEFAULT (datetime('now'))
  )
`);

// Seed initial incidents from the PDF on first run
if (db.prepare('SELECT COUNT(*) as n FROM incidents').get().n === 0) {
  const ins = db.prepare(`
    INSERT INTO incidents (id, date, machine, type, criticality, description, cause, detected_by, resolution)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  db.transaction(() => {
    [
      ['2026-06-01','Washing', 'Mechanical',          'Abnormal','Blue paint in the soap',                         'Paint peeling off the machine',  'NSS','Clean area and change the soap'],
      ['2026-06-02','Drawing', 'Out of specification','Normal',  'Scratched cable',                                'Copper chunk in drawing 5',       'ZLS','Drawing in drawing 4'],
      ['2026-06-05','Drawing', 'Out of specification','Normal',  'Contaminated antioxidant',                       'Copper dust',                     'ZLS','Stop sanding the cable'],
      ['2026-06-08','Drawing', 'Mechanical',          'Normal',  'Water leak',                                     'Machine malfunction',             'NSS','Clean and repair the leak'],
      ['2026-06-09','Washing', 'Mechanical',          'Normal',  'The cable gets caught on the motor and damaged', 'Disc wear',                       'ZLS','Change the disc'],
      ['2026-06-09','Cladding','Mechanical',          'Normal',  'Two damaged cable turns',                        'The tip became rounded',          'ZLS','Change the tip'],
      ['2026-06-11','Cladding','Out of specification','Normal',  'Cable breaks in drawing machine 2',              'Bad welding',                     'ZLS','Cut and joint'],
    ].forEach(r => ins.run(crypto.randomUUID(), ...r));
  })();
  console.log('Seeded 7 initial incidents.');
}

const app = express();
app.use(express.json({ limit: '20mb' }));
app.get('/', (_req, res) => res.sendFile(path.join(__dirname, 'index.html')));

function toJson(r) {
  return {
    id: r.id, date: r.date, machine: r.machine, type: r.type,
    criticality: r.criticality, description: r.description, cause: r.cause,
    detectedBy: r.detected_by, resolution: r.resolution,
    resolved: !!r.resolved,
    images: JSON.parse(r.images || '[]'),
  };
}

app.get('/api/incidents', (_req, res) => {
  res.json(db.prepare('SELECT * FROM incidents ORDER BY date ASC, created_at ASC').all().map(toJson));
});

app.post('/api/incidents', (req, res) => {
  const { date, machine, type, criticality, description, cause, detectedBy, resolution, resolved, images } = req.body;
  const id = crypto.randomUUID();
  db.prepare(`INSERT INTO incidents
    (id, date, machine, type, criticality, description, cause, detected_by, resolution, resolved, images)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, date, machine, type, criticality, description, cause, detectedBy, resolution, resolved ? 1 : 0, JSON.stringify(images || []));
  res.json({ id });
});

app.put('/api/incidents/:id', (req, res) => {
  const { date, machine, type, criticality, description, cause, detectedBy, resolution, resolved, images } = req.body;
  db.prepare(`UPDATE incidents
    SET date=?, machine=?, type=?, criticality=?, description=?, cause=?,
        detected_by=?, resolution=?, resolved=?, images=?
    WHERE id=?`)
    .run(date, machine, type, criticality, description, cause, detectedBy, resolution, resolved ? 1 : 0, JSON.stringify(images || []), req.params.id);
  res.json({ ok: true });
});

app.delete('/api/incidents/:id', (req, res) => {
  db.prepare('DELETE FROM incidents WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Quality Log running on :${PORT}`));
