const express  = require('express');
const cors     = require('cors');
require('dotenv').config();

const pool        = require('./db');
const logger      = require('./logger');
const { authenticate, authorize } = require('./auth');
const authRouter    = require('./routes.auth');
const clientsRouter = require('./routes.clients');

const app  = express();
const PORT = process.env.PORT || 3003;

app.use(cors());
app.use(express.json());
app.use(logger.httpMiddleware);
const path = require('path');

app.use('/assets', express.static(
  path.join('/opt/applications/applications/sim-manager/sim-manager-docker/assets')
));
// ── PUBLIC ────────────────────────────────────────────
app.use('/api/auth', authRouter);

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected', time: new Date().toISOString() });
  } catch (e) { res.status(500).json({ status: 'error', db: 'disconnected', error: e.message }); }
});

// ── CLIENTS ───────────────────────────────────────────
app.use('/api/clients', clientsRouter);

// ── STATS ─────────────────────────────────────────────
app.get('/api/stats', authenticate, authorize('stats:read'), async (req, res) => {
  try {
    const [total, dispo, livre, nbLiv, parOp, nbClients] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM sim_cards'),
      pool.query("SELECT COUNT(*) FROM sim_cards WHERE status='disponible'"),
      pool.query("SELECT COUNT(*) FROM sim_cards WHERE status='livre'"),
      pool.query('SELECT COUNT(*) FROM livraisons'),
      pool.query(`SELECT
        CASE
          WHEN LOWER(operateur) IN ('tt','tunisie telecom','tunisietelecom') THEN 'Tunisie Telecom'
          WHEN LOWER(operateur) IN ('orange','orange telecom','orangetelecom') THEN 'Orange Telecom'
          WHEN LOWER(operateur) IN ('ooredoo') THEN 'Ooredoo'
          ELSE operateur
        END AS operateur,
        COUNT(*) AS total,
        SUM(CASE WHEN status='disponible' THEN 1 ELSE 0 END) AS disponible,
        SUM(CASE WHEN status='livre' THEN 1 ELSE 0 END) AS livre
        FROM sim_cards
        GROUP BY 1 ORDER BY 1`),
      pool.query("SELECT COUNT(*) FROM clients WHERE is_active=TRUE"),
    ]);
    res.json({
      total: parseInt(total.rows[0].count),
      disponible: parseInt(dispo.rows[0].count),
      livre: parseInt(livre.rows[0].count),
      livraisons: parseInt(nbLiv.rows[0].count),
      clients: parseInt(nbClients.rows[0].count),
      parOperateur: parOp.rows
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── SIMS GET ──────────────────────────────────────────
app.get('/api/sims', authenticate, authorize('stock:read'), async (req, res) => {
  try {
    const { operateur, status, search, limit = 200, offset = 0 } = req.query;
    let q = 'SELECT * FROM sim_cards WHERE 1=1';
    const v = []; let i = 1;
    if (operateur) { q += ` AND operateur=$${i++}`; v.push(operateur); }
    if (status)    { q += ` AND status=$${i++}`;    v.push(status); }
    if (search)    { q += ` AND iccid ILIKE $${i++}`; v.push(`%${search}%`); }
    q += ` ORDER BY created_at DESC LIMIT $${i++} OFFSET $${i++}`;
    v.push(parseInt(limit), parseInt(offset));
    res.json((await pool.query(q, v)).rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── SIMS ADD LOT ──────────────────────────────────────
app.post('/api/sims/lot', authenticate, authorize('stock:write'), async (req, res) => {
  const { operateur, lot, iccids } = req.body;
  if (!operateur || !lot || !iccids?.length)
    return res.status(400).json({ error: 'Champs manquants' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let added = 0, skipped = 0;
    for (const iccid of iccids) {
      const clean = iccid.trim(); if (!clean) continue;
      try { await client.query(`INSERT INTO sim_cards(iccid,operateur,lot,date_entree,status) VALUES($1,$2,$3,CURRENT_DATE,'disponible')`, [clean, operateur, lot]); added++; }
      catch { skipped++; }
    }
    await client.query('COMMIT');
    logger.info('Lot ajouté', { by: req.user.username, operateur, lot, added, skipped });
    res.json({ success: true, added, skipped });
  } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); }
  finally { client.release(); }
});

// ── SIMS DELETE ───────────────────────────────────────
app.delete('/api/sims/:iccid', authenticate, authorize('stock:write'), async (req, res) => {
  try {
    await pool.query('DELETE FROM sim_cards WHERE iccid=$1', [req.params.iccid]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── SIMS RESILIER ─────────────────────────────────────
app.patch('/api/sims/:iccid/resilier', authenticate, authorize('stock:write'), async (req, res) => {
  try {
    const result = await pool.query(
      "UPDATE sim_cards SET status='resiliee' WHERE iccid=$1 RETURNING *",
      [req.params.iccid]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'SIM non trouvée' });
    logger.info('SIM résiliée', { by: req.user.username, iccid: req.params.iccid });
    res.json({ success: true, sim: result.rows[0] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── LIVRAISONS GET ALL ────────────────────────────────
app.get('/api/livraisons', authenticate, authorize('livraison:read'), async (req, res) => {
  try {
    const { client_id } = req.query;

    let q = `
      SELECT
        l.*,
        COALESCE(c.nom, l.client_nom, 'CLIENT INCONNU') AS client_nom_complet,
        c.adresse AS client_adresse
      FROM livraisons l
      LEFT JOIN clients c ON l.client_id = c.id
      WHERE 1=1
    `;

    const v = [];
    let i = 1;

    if (client_id) {
      q += ` AND l.client_id = $${i++}`;
      v.push(client_id);
    }

    q += ' ORDER BY l.created_at DESC';

    const livs = await pool.query(q, v);

    const result = await Promise.all(
      livs.rows.map(async (l) => {
        const sims = await pool.query(
          'SELECT iccid FROM livraison_sims WHERE livraison_ref=$1',
          [l.ref]
        );

        return {
          ...l,
          sims: sims.rows.map(r => r.iccid)
        };
      })
    );

    res.json(result);

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── LIVRAISONS GET ONE ────────────────────────────────
app.get('/api/livraisons/:ref', authenticate, authorize('livraison:read'), async (req, res) => {
  try {
    const liv = await pool.query(
      `SELECT l.*, c.adresse as client_adresse FROM livraisons l
       LEFT JOIN clients c ON l.client_id=c.id WHERE l.ref=$1`, [req.params.ref]
    );
    if (!liv.rows.length) return res.status(404).json({ error: 'Non trouvé' });
    const sims = await pool.query('SELECT iccid FROM livraison_sims WHERE livraison_ref=$1', [req.params.ref]);
    res.json({ ...liv.rows[0], sims: sims.rows.map(r => r.iccid) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── LIVRAISONS CREATE ─────────────────────────────────
app.post('/api/livraisons', authenticate, authorize('livraison:write'), async (req, res) => {
  const { ref, client_id, client_nom, operateur, date_livraison, iccids } = req.body;

  const safeIccids = Array.isArray(iccids) ? iccids : [];

  // ✅ Validation
  if (!ref || !client_nom || !operateur || !date_livraison || !safeIccids.length) {
    return res.status(400).json({ error: 'Champs manquants' });
  }

  const dbClient = await pool.connect();

  try {
    await dbClient.query('BEGIN');

    // ✅ Vérifier disponibilité des SIMs
    const ph = safeIccids.map((_, i) => `$${i + 1}`).join(',');

    const check = await dbClient.query(
      `SELECT iccid FROM sim_cards 
       WHERE iccid IN (${ph}) 
       AND status != 'disponible'`,
      safeIccids
    );

    if (check.rows.length) {
      await dbClient.query('ROLLBACK');
      return res.status(409).json({
        error: 'Certaines puces ne sont plus disponibles',
        iccids: check.rows.map(r => r.iccid)
      });
    }

    // ✅ Vérifier doublon ref
    const exist = await dbClient.query(
      `SELECT ref FROM livraisons WHERE ref = $1`,
      [ref]
    );

    if (exist.rows.length) {
      await dbClient.query('ROLLBACK');
      return res.status(409).json({ error: 'Référence déjà utilisée' });
    }

    // ✅ INSERT livraison
    await dbClient.query(
      `INSERT INTO livraisons(
        ref, client, client_id, client_nom, operateur, date_livraison, quantite, created_by
      )
      VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        ref,
        client_nom,                 // colonne client (NOT NULL)
        client_id || null,
        client_nom,
        operateur,
        date_livraison,
        safeIccids.length,
        req.user.username
      ]
    );

    // ✅ INSERT + UPDATE en batch (plus propre que boucle)
    for (const iccid of safeIccids) {
      await dbClient.query(
        `INSERT INTO livraison_sims(livraison_ref, iccid)
         VALUES($1, $2)`,
        [ref, iccid]
      );
    }

    await dbClient.query(
      `UPDATE sim_cards 
       SET status = 'livre', livraison_ref = $1 
       WHERE iccid = ANY($2::text[])`,
      [ref, safeIccids]
    );

    await dbClient.query('COMMIT');

    logger.info('Livraison créée', {
      by: req.user.username,
      ref,
      client_nom,
      quantite: safeIccids.length
    });

    res.json({
      success: true,
      ref,
      quantite: safeIccids.length
    });

  } catch (e) {
    await dbClient.query('ROLLBACK');
    console.error('LIVRAISON ERROR:', e);
    res.status(500).json({ error: e.message });

  } finally {
    dbClient.release();
  }
});
// ── LIVRAISONS DELETE ─────────────────────────────────
app.delete('/api/livraisons/:ref', authenticate, authorize('*'), async (req, res) => {
  const dbClient = await pool.connect();
  try {
    await dbClient.query('BEGIN');
    await dbClient.query("UPDATE sim_cards SET status='disponible',livraison_ref=NULL WHERE livraison_ref=$1", [req.params.ref]);
    await dbClient.query('DELETE FROM livraisons WHERE ref=$1', [req.params.ref]);
    await dbClient.query('COMMIT');
    logger.info('Livraison supprimée', { by: req.user.username, ref: req.params.ref });
    res.json({ success: true });
  } catch (e) { await dbClient.query('ROLLBACK'); res.status(500).json({ error: e.message }); }
  finally { dbClient.release(); }
});

// KPI chart FULL
app.get('/api/kpi/charts/full', authenticate, async (req, res) => {
  const { start, end } = req.query;

  try {
    const r = await pool.query(`
      SELECT client_nom AS client, operateur, SUM(quantite) AS total
      FROM livraisons
      WHERE ($1::date IS NULL OR date_livraison >= $1)
        AND ($2::date IS NULL OR date_livraison <= $2)
      GROUP BY client_nom, operateur
      ORDER BY client_nom
    `, [start || null, end || null]);

    res.json(r.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.get('/api/stats/clients', authenticate, async (req, res) => {
  try {
    const { from, to } = req.query;

    const query = `
      SELECT 
        COALESCE(c.nom, l.client_nom, 'UNKNOWN') AS nom,

        COUNT(*) FILTER (WHERE LOWER(sc.operateur) IN ('tt','tunisie telecom','tunisietelecom'))::int AS tt,
        COUNT(*) FILTER (WHERE LOWER(sc.operateur) IN ('orange','orange telecom','orangetelecom'))::int AS orange,
        COUNT(*) FILTER (WHERE LOWER(sc.operateur) IN ('ooredoo'))::int AS ooredoo

      FROM sim_cards sc
      LEFT JOIN livraisons l ON sc.livraison_ref = l.ref
      LEFT JOIN clients c ON l.client_id = c.id

      WHERE sc.status = 'livre'
        AND ($1::date IS NULL OR l.date_livraison >= $1)
        AND ($2::date IS NULL OR l.date_livraison <= $2)

      GROUP BY COALESCE(c.nom, l.client_nom, 'UNKNOWN')
      ORDER BY nom
    `;

    // 🔥 FIX CRITIQUE
    const values = [from || null, to || null];

    const result = await pool.query(query, values);

    res.json(result.rows);

  } catch (e) {
    console.error('ERROR /stats/clients:', e);
    res.status(500).json({ error: e.message });
  }
});
// TOP CLIENTS
app.get('/api/kpi/top-clients', authenticate, async (req, res) => {
  const r = await pool.query(`
    SELECT client_nom AS client, SUM(quantite) AS total
    FROM livraisons
    GROUP BY client_nom
    ORDER BY total DESC
    LIMIT 5
  `);
  res.json(r.rows);
});


// ── STATS : Disponibilité par opérateur ──────────────
app.get('/api/stats/disponibilite', authenticate, async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT
        operateur_label AS operateur,
        COUNT(*) AS total,
        SUM(CASE WHEN status='disponible' THEN 1 ELSE 0 END) AS disponible,
        SUM(CASE WHEN status='livre' THEN 1 ELSE 0 END) AS livre,
        ROUND(
          SUM(CASE WHEN status='disponible' THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*),0),
          1
        ) AS pct_disponible
      FROM (
        SELECT
          CASE
            WHEN LOWER(operateur) IN ('tt','tunisie telecom','tunisietelecom') THEN 'Tunisie Telecom'
            WHEN LOWER(operateur) IN ('orange','orange telecom','orangetelecom') THEN 'Orange Telecom'
            WHEN LOWER(operateur) IN ('ooredoo') THEN 'Ooredoo'
            ELSE operateur
          END AS operateur_label,
          status
        FROM sim_cards
) s
GROUP BY operateur_label
ORDER BY operateur_label;
    `);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── STATS : Livraisons par mois ───────────────────────
app.get('/api/stats/par-mois', authenticate, async (req, res) => {
  try {
    const { annee } = req.query;
    const year = annee || new Date().getFullYear();
    const r = await pool.query(`
      SELECT
        TO_CHAR(date_livraison, 'YYYY-MM') AS mois,
        TO_CHAR(date_livraison, 'Mon YYYY') AS mois_label,
        CASE
          WHEN LOWER(operateur) IN ('tt','tunisie telecom','tunisietelecom') THEN 'Tunisie Telecom'
          WHEN LOWER(operateur) IN ('orange','orange telecom','orangetelecom') THEN 'Orange Telecom'
          WHEN LOWER(operateur) IN ('ooredoo') THEN 'Ooredoo'
          ELSE operateur
        END AS operateur,
        COUNT(*) AS nb_livraisons,
        SUM(quantite) AS nb_sims
      FROM livraisons
      WHERE EXTRACT(YEAR FROM date_livraison) = $1
      GROUP BY mois, mois_label, 3
      ORDER BY mois, 3
    `, [year]);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── STATS : Livraisons par client ─────────────────────
app.get('/api/stats/par-client', authenticate, async (req, res) => {
  try {
    const { from, to } = req.query;

    let q = `
      SELECT
          COALESCE(c.nom, 'Inconnu') AS client_nom,
          COUNT(*) AS nb_livraisons,
          SUM(l.quantite) AS nb_sims,
          COUNT(DISTINCT l.operateur) AS nb_operateurs
      FROM livraisons l
      LEFT JOIN clients c ON c.id = l.client_id
      WHERE 1=1
    `;

    const v = [];
    let i = 1;

    if (from) { q += ` AND l.date_livraison >= $${i++}`; v.push(from); }
    if (to)   { q += ` AND l.date_livraison <= $${i++}`; v.push(to); }

    q += `
      GROUP BY c.nom
      ORDER BY nb_livraisons DESC;
    `;

    const r = await pool.query(q, v);
    res.json(r.rows);

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── STATS : Top clients ───────────────────────────────
app.get('/api/stats/top-clients', authenticate, async (req, res) => {
  try {
    const { from, to, limit = 10 } = req.query;

    let q = `
      SELECT
        c.nom AS client_nom,
        COUNT(*) AS nb_livraisons,
        SUM(l.quantite) AS nb_sims,
        COUNT(DISTINCT l.operateur) AS nb_operateurs
      FROM livraisons l
      JOIN clients c ON c.id = l.client_id
      WHERE 1=1
    `;

    const v = [];
    let i = 1;

    if (from) {
      q += ` AND l.date_livraison >= $${i++}`;
      v.push(from);
    }

    if (to) {
      q += ` AND l.date_livraison <= $${i++}`;
      v.push(to);
    }

    q += ` GROUP BY c.nom ORDER BY nb_sims DESC LIMIT $${i++}`;
    v.push(parseInt(limit));

    const r = await pool.query(q, v);
    res.json(r.rows);

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── STATS : Tableau récapitulatif ─────────────────────
// ── STATS : Total puces par client (dashboard temps réel) ──
app.get('/api/stats/puces-par-client', authenticate, async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT 
        COALESCE(client_nom, client)  AS client,
        SUM(quantite)                 AS total_general
      FROM livraisons
      WHERE quantite > 0
      GROUP BY COALESCE(client_nom, client)
      ORDER BY COALESCE(client_nom, client) ASC
    `);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/stats/recap', authenticate, async (req, res) => {
  try {
    const { from, to } = req.query;

    let q = `
      SELECT
        COALESCE(c.nom, 'Inconnu') AS client_nom,
        l.operateur,
        COUNT(*) AS nb_livraisons,
        COALESCE(SUM(l.quantite), 0) AS nb_sims,
        MIN(l.date_livraison) AS premiere_livraison,
        MAX(l.date_livraison) AS derniere_livraison
      FROM livraisons l
      LEFT JOIN clients c ON c.id = l.client_id
      WHERE 1=1
    `;

    const v = [];
    let i = 1;

    if (from) { q += ` AND l.date_livraison >= $${i++}`; v.push(from); }
    if (to)   { q += ` AND l.date_livraison <= $${i++}`; v.push(to); }

    q += `
      GROUP BY c.nom, l.operateur
      ORDER BY c.nom, nb_sims DESC
    `;

    const r = await pool.query(q, v);
    res.json(r.rows);

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


// ── STATS : Détail livraisons par client/opérateur/dates ──
app.get('/api/stats/client-detail', authenticate, async (req, res) => {
  try {
    const { client_id, operateur, from, to } = req.query;
    let q = `
      SELECT
        l.ref, l.client_nom, l.operateur,
        l.date_livraison, l.quantite, l.created_by,
        c.adresse as client_adresse
      FROM livraisons l
      LEFT JOIN clients c ON l.client_id = c.id
      WHERE 1=1
    `;
    const v = []; let i = 1;
    if (client_id && client_id !== 'all') { q += ` AND l.client_id=$${i++}`; v.push(client_id); }
    //if (operateur && operateur !== 'all')  { q += ` AND l.operateur=$${i++}`;  v.push(operateur); }
    if (operateur && operateur !== 'all') {
      // Chercher toutes les variantes de l'opérateur sélectionné
      const opLower = operateur.toLowerCase();
      let opVariants = [];
      if (['tt','tunisie telecom','tunisietelecom'].some(x => opLower.includes(x.split(' ')[0]))) {
        opVariants = ['TT', 'Tunisie Telecom', 'tunisie telecom'];
      } else if (opLower.includes('orange')) {
        opVariants = ['Orange', 'Orange Telecom', 'orange telecom'];
      } else if (opLower.includes('ooredoo')) {
        opVariants = ['Ooredoo'];
      } else {
        opVariants = [operateur];
      }
      const ph = opVariants.map((_, idx) => `$${i + idx}`).join(',');
      q += ` AND LOWER(l.operateur) IN (${opVariants.map(o => `'${o.toLowerCase()}'`).join(',')})`;
      // pas besoin de pousser dans v car on utilise les valeurs directement
    }
    if (from) { q += ` AND l.date_livraison >= $${i++}`; v.push(from); }
    if (to)   { q += ` AND l.date_livraison <= $${i++}`; v.push(to); }
    q += ' ORDER BY l.date_livraison DESC';

    const rows = await pool.query(q, v);

    // Totaux agrégés
    const totaux = { total_sims: 0, total_livraisons: rows.rows.length };
    rows.rows.forEach(r => totaux.total_sims += parseInt(r.quantite) || 0);

    // Par opérateur (normalisé)
    const normalizeOp = (op) => {
      const l = (op||'').toLowerCase();
      if (['tt','tunisie telecom','tunisietelecom'].includes(l)) return 'Tunisie Telecom';
      if (['orange','orange telecom','orangetelecom'].includes(l)) return 'Orange Telecom';
      if (l === 'ooredoo') return 'Ooredoo';
      return op;
    };
    const parOp = {};
    rows.rows.forEach(r => {
      const opKey = normalizeOp(r.operateur);
      if (!parOp[opKey]) parOp[opKey] = { livraisons: 0, sims: 0 };
      parOp[opKey].livraisons++;
      parOp[opKey].sims += parseInt(r.quantite) || 0;
    });

    res.json({ livraisons: rows.rows, totaux, parOperateur: parOp });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.listen(PORT, '0.0.0.0', () => {
  logger.info('SIM Manager API démarrée', { port: PORT, env: process.env.NODE_ENV });
});
process.on('uncaughtException',  e => logger.error('uncaughtException',  { error: e.message }));
process.on('unhandledRejection', e => logger.error('unhandledRejection', { error: String(e) }));

// ── STATS : SIM par mois / client / opérateur ────────
app.get('/api/stats/par-mois-client', authenticate, async (req, res) => {
  try {
    const { annee } = req.query;
    const year = annee || new Date().getFullYear();
    const r = await pool.query(`
      SELECT
        TO_CHAR(l.date_livraison, 'YYYY-MM')  AS mois,
        TO_CHAR(l.date_livraison, 'Mon YYYY') AS mois_label,
        COALESCE(c.nom, l.client_nom, 'Inconnu') AS client_nom,
        CASE
          WHEN LOWER(l.operateur) IN ('tt','tunisie telecom','tunisietelecom') THEN 'Tunisie Telecom'
          WHEN LOWER(l.operateur) IN ('orange','orange telecom','orangetelecom') THEN 'Orange Telecom'
          WHEN LOWER(l.operateur) IN ('ooredoo') THEN 'Ooredoo'
          ELSE l.operateur
        END AS operateur,
        SUM(l.quantite)::int AS nb_sims
      FROM livraisons l
      LEFT JOIN clients c ON c.id = l.client_id
      WHERE EXTRACT(YEAR FROM l.date_livraison) = $1
      GROUP BY mois, mois_label, COALESCE(c.nom, l.client_nom, 'Inconnu'), 4
      ORDER BY mois, client_nom, 4
    `, [year]);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/stats/total-par-operateur', authenticate, async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT
        CASE
          WHEN LOWER(operateur) IN ('tt','tunisie telecom','tunisietelecom') THEN 'Tunisie Telecom'
          WHEN LOWER(operateur) IN ('orange','orange telecom','orangetelecom') THEN 'Orange Telecom'
          WHEN LOWER(operateur) IN ('ooredoo') THEN 'Ooredoo'
          ELSE operateur
        END AS operateur,
        SUM(quantite) AS total_livre_general
      FROM livraisons WHERE quantite > 0
      GROUP BY 1 ORDER BY 1
    `);
    res.json(r.rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});
