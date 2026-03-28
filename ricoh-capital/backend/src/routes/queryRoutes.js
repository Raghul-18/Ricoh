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

const referencePrefixes = {
  deals: 'DEAL',
  quotes: 'QUO',
  contracts: 'CON',
};

function toCamelRows(rows) {
  return rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([k, v]) => [k.toLowerCase(), normalizeValue(v)]),
    ),
  );
}

function normalizeValue(value) {
  if (Buffer.isBuffer(value)) return value.toString('hex');
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        return JSON.parse(trimmed);
      } catch {
        return value;
      }
    }
  }
  return value;
}

function normalizeBindValue(value) {
  if (Array.isArray(value) || (value && typeof value === 'object' && !(value instanceof Date) && !Buffer.isBuffer(value))) {
    return JSON.stringify(value);
  }
  return value;
}

function isIsoDateString(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value);
}

function isDateOnlyString(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function shouldBindAsDate(column, value) {
  if (value == null) return false;
  return (
    value instanceof Date ||
    ((isIsoDateString(value) || isDateOnlyString(value)) && (
      column.endsWith('_at') ||
      column.endsWith('_date') ||
      column === 'checked_at' ||
      column === 'reviewed_at' ||
      column === 'created_at' ||
      column === 'updated_at'
    ))
  );
}

function buildBind(column, value) {
  if (shouldBindAsDate(column, value)) {
    return {
      val: value instanceof Date ? value : new Date(isDateOnlyString(value) ? `${value}T00:00:00` : value),
      type: oracledb.DATE,
    };
  }
  return normalizeBindValue(value);
}

function colExpr(name) {
  return /^[a-zA-Z0-9_]+$/.test(name) ? name : null;
}

function parseSelectColumns(select) {
  if (!select || select === '*') return '*';

  const tokens = [];
  let current = '';
  let depth = 0;

  for (const char of String(select)) {
    if (char === '(') {
      depth += 1;
      current += char;
      continue;
    }
    if (char === ')') {
      depth = Math.max(0, depth - 1);
      current += char;
      continue;
    }
    if (char === ',' && depth === 0) {
      tokens.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }

  if (current.trim()) tokens.push(current.trim());

  if (tokens.includes('*')) return '*';

  const columns = tokens
    .map((token) => token.split(':')[0]?.trim())
    .map(colExpr)
    .filter(Boolean);

  if (!columns.length) return '*';
  return [...new Set(columns)].join(', ');
}

function isHexId(value) {
  return typeof value === 'string' && /^[a-fA-F0-9]{32}$/.test(value);
}

function comparisonSql({ col, op, bindKey, value }) {
  const rhs = isHexId(value) && (col === 'id' || col.endsWith('_id')) ? `HEXTORAW(:${bindKey})` : `:${bindKey}`;
  if (op === 'neq') return `${col} <> ${rhs}`;
  return `${col} = ${rhs}`;
}

function makeReference(prefix) {
  const year = new Date().getFullYear();
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${year}-${rand}`;
}

function enrichInsertRow(mapped, row) {
  const next = { ...row };
  if (referencePrefixes[mapped] && !next.reference_number) {
    next.reference_number = makeReference(referencePrefixes[mapped]);
  }
  return next;
}

function buildWhereClause(filters = [], binds = {}) {
  if (!filters.length) return '';
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

  filters.forEach((f, i) => {
    if (f.op === 'in' && Array.isArray(f.value)) {
      f.value.forEach((v, ix) => {
        binds[`f${i}_${ix}`] = v;
      });
      delete binds[`f${i}`];
    }
  });

  return ` WHERE ${where}`;
}

async function runSelect(conn, mapped, { select, filters = [], orderBy, single, maybeSingle }) {
  const binds = {};
  const columns = parseSelectColumns(select);
  let sql = `SELECT ${columns} FROM ${mapped}`;
  sql += buildWhereClause(filters, binds);
  if (orderBy?.column) {
    const col = colExpr(orderBy.column);
    if (col) sql += ` ORDER BY ${col} ${orderBy.ascending === false ? 'DESC' : 'ASC'}`;
  }
  const rawRows =
    (await conn.execute(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT })).rows || [];
  const rows = toCamelRows(rawRows);
  if (single || maybeSingle) return rows[0] || null;
  return rows;
}

router.post('/query', requireAuth, async (req, res) => {
  const { table, action, select, values, filters = [], orderBy, single, maybeSingle } = req.body;
  const mapped = tableMap[table];
  if (!mapped) return res.status(400).json({ error: 'Unknown table' });

  try {
    const result = await withConnection(async (conn) => {
      const binds = {};

      if (action === 'select') {
        return runSelect(conn, mapped, { select, filters, orderBy, single, maybeSingle });
      }

      if (action === 'insert') {
        const rows = Array.isArray(values) ? values : [values];
        const inserted = [];
        for (const row of rows) {
          const enriched = enrichInsertRow(mapped, row);
          const keys = Object.keys(enriched);
          const cols = keys.map((k) => colExpr(k)).filter(Boolean);
          const hasIdColumn = !cols.includes('id');
          const valueExpr = cols.map((c) => {
            const v = enriched[c];
            if (isHexId(v) && (c === 'id' || c.endsWith('_id'))) return `HEXTORAW(:${c})`;
            return `:${c}`;
          });
          let sql = `INSERT INTO ${mapped} (${cols.join(',')}) VALUES (${valueExpr.join(',')})`;
          const bindRow = Object.fromEntries(cols.map((c) => [c, buildBind(c, enriched[c])]));

          if (hasIdColumn) {
            sql += ' RETURNING id INTO :out_id';
            bindRow.out_id = { dir: oracledb.BIND_OUT, type: oracledb.BUFFER };
          }

          const result = await conn.execute(sql, bindRow);
          inserted.push({
            ...enriched,
            ...(hasIdColumn ? { id: normalizeValue(result.outBinds.out_id[0]) } : {}),
          });
        }
        await conn.commit();
        if (select || single || maybeSingle) {
          return runSelect(conn, mapped, {
            select,
            filters: [{ op: 'in', column: 'id', value: inserted.map((row) => row.id).filter(Boolean) }],
            single,
            maybeSingle,
          });
        }
        return Array.isArray(values) ? inserted : inserted[0];
      }

      if (action === 'update') {
        const cols = Object.keys(values).map((k) => colExpr(k)).filter(Boolean);
        cols.forEach((c) => {
          binds[`u_${c}`] = buildBind(c, values[c]);
        });
        let sql = `UPDATE ${mapped} SET ${cols.map((c) => `${c} = :u_${c}`).join(', ')}`;
        sql += buildWhereClause(filters, binds);
        await conn.execute(sql, binds);
        await conn.commit();
        if (select || single || maybeSingle) {
          return runSelect(conn, mapped, { select, filters, orderBy, single, maybeSingle });
        }
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
