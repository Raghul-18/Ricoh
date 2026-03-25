import { Router } from 'express';
import oracledb from 'oracledb';
import { withConnection } from '../db/oracle.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const tableMap = {
  profiles: 'users',
  originator_applications: 'originator_applications',
  originator_documents: 'originator_documents',
  verification_checks: 'verification_checks',
  deals: 'deals',
  contracts: 'contracts',
  payment_schedule: 'payment_schedule',
  prospects: 'prospects',
  prospect_activities: 'prospect_activities',
  quotes: 'quotes',
  notifications: 'notifications',
  audit_logs: 'audit_logs',
  deal_amendments: 'deal_amendments',
};

function toCamelRows(rows) {
  return rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([k, v]) => [k.toLowerCase(), Buffer.isBuffer(v) ? v.toString('hex') : v]),
    ),
  );
}

function colExpr(name) {
  return /^[a-zA-Z0-9_]+$/.test(name) ? name : null;
}

function isHexId(value) {
  return typeof value === 'string' && /^[a-fA-F0-9]{32}$/.test(value);
}

function comparisonSql({ col, op, bindKey, value }) {
  const rhs = isHexId(value) && (col === 'id' || col.endsWith('_id')) ? `HEXTORAW(:${bindKey})` : `:${bindKey}`;
  if (op === 'neq') return `${col} <> ${rhs}`;
  return `${col} = ${rhs}`;
}

router.post('/query', requireAuth, async (req, res) => {
  const { table, action, select, values, filters = [], orderBy, single, maybeSingle } = req.body;
  const mapped = tableMap[table];
  if (!mapped) return res.status(400).json({ error: 'Unknown table' });

  try {
    const result = await withConnection(async (conn) => {
      const binds = {};

      if (action === 'select') {
        const columns = select === '*' || !select ? '*' : '*';
        let sql = `SELECT ${columns} FROM ${mapped}`;
        if (filters.length) {
          const where = filters
            .map((f, i) => {
              const col = colExpr(f.column);
              if (!col) throw new Error(`Invalid column: ${f.column}`);
              const bindKey = `f${i}`;
              binds[bindKey] = f.value;
              if (f.op === 'neq') return comparisonSql({ col, op: 'neq', bindKey, value: f.value });
              if (f.op === 'in') {
                return `${col} IN (${(f.value || [])
                  .map((v, ix) =>
                    isHexId(v) && (col === 'id' || col.endsWith('_id'))
                      ? `HEXTORAW(:${bindKey}_${ix})`
                      : `:${bindKey}_${ix}`,
                  )
                  .join(',')})`;
              }
              if (f.op === 'eq') return comparisonSql({ col, op: 'eq', bindKey, value: f.value });
              throw new Error(`Unsupported operator: ${f.op}`);
            })
            .join(' AND ');
          sql += ` WHERE ${where}`;
          filters.forEach((f, i) => {
            if (f.op === 'in' && Array.isArray(f.value)) {
              f.value.forEach((v, ix) => {
                binds[`f${i}_${ix}`] = v;
              });
              delete binds[`f${i}`];
            }
          });
        }
        if (orderBy?.column) {
          const col = colExpr(orderBy.column);
          if (col) sql += ` ORDER BY ${col} ${orderBy.ascending === false ? 'DESC' : 'ASC'}`;
        }
        const rawRows =
          (await conn.execute(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT })).rows || [];
        const rows = toCamelRows(rawRows);
        if (single) return rows[0] || null;
        if (maybeSingle) return rows[0] || null;
        return rows;
      }

      if (action === 'insert') {
        const rows = Array.isArray(values) ? values : [values];
        const inserted = [];
        for (const row of rows) {
          const keys = Object.keys(row);
          const cols = keys.map((k) => colExpr(k)).filter(Boolean);
          const valueExpr = cols.map((c) => {
            const v = row[c];
            if (isHexId(v) && (c === 'id' || c.endsWith('_id'))) return `HEXTORAW(:${c})`;
            return `:${c}`;
          });
          const sql = `INSERT INTO ${mapped} (${cols.join(',')}) VALUES (${valueExpr.join(',')})`;
          const bindRow = Object.fromEntries(cols.map((c) => [c, row[c]]));
          await conn.execute(sql, bindRow);
          inserted.push(row);
        }
        await conn.commit();
        return Array.isArray(values) ? inserted : inserted[0];
      }

      if (action === 'update') {
        const cols = Object.keys(values).map((k) => colExpr(k)).filter(Boolean);
        cols.forEach((c) => {
          binds[`u_${c}`] = values[c];
        });
        let sql = `UPDATE ${mapped} SET ${cols.map((c) => `${c} = :u_${c}`).join(', ')}`;
        if (filters.length) {
          sql +=
            ' WHERE ' +
            filters
              .map((f, i) => {
                const col = colExpr(f.column);
                const key = `f${i}`;
                binds[key] = f.value;
                return comparisonSql({ col, op: f.op, bindKey: key, value: f.value });
              })
              .join(' AND ');
        }
        await conn.execute(sql, binds);
        await conn.commit();
        return { success: true };
      }

      if (action === 'delete') {
        let sql = `DELETE FROM ${mapped}`;
        if (filters.length) {
          sql +=
            ' WHERE ' +
            filters
              .map((f, i) => {
                const col = colExpr(f.column);
                const key = `f${i}`;
                binds[key] = f.value;
                return comparisonSql({ col, op: 'eq', bindKey: key, value: f.value });
              })
              .join(' AND ');
        }
        await conn.execute(sql, binds);
        await conn.commit();
        return { success: true };
      }

      throw new Error('Unsupported action');
    });

    return res.json({ data: result, error: null });
  } catch (error) {
    return res.status(400).json({ data: null, error: { message: error.message } });
  }
});

export default router;
