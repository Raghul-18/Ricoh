import { Router } from 'express';
import crypto from 'node:crypto';
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
  contract_signatures: 'contract_signatures',
  contract_closure_requests: 'contract_closure_requests',
  customer_access_credentials: 'customer_access_credentials',
};

const referencePrefixes = {
  deals: 'DEAL',
  quotes: 'QUO',
  contracts: 'CON',
};

const ADMIN_ONLY_TABLES = new Set(['audit_logs']);
const CUSTOMER_TABLES = new Set(['contracts', 'payment_schedule', 'notifications', 'contract_signatures', 'contract_closure_requests']);

function isAdmin(req) {
  return req.user?.role === 'admin';
}

function isOriginator(req) {
  return req.user?.role === 'originator';
}

function isCustomer(req) {
  return req.user?.role === 'customer';
}

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
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
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

function ensureSafeDelete(filters = []) {
  if (!filters.length) throw new Error('Delete requires at least one filter');
}

function addConstraintFilter(filters, column, value) {
  if (value == null) return filters;
  const hasFilter = filters.some((filter) => filter.column === column && filter.op === 'eq' && filter.value === value);
  if (hasFilter) return filters;
  return [...filters, { op: 'eq', column, value }];
}

async function getUserContractIds(conn, userId, role) {
  let sql = 'SELECT id FROM contracts WHERE ';
  if (role === 'originator') sql += 'originator_id = HEXTORAW(:id)';
  else if (role === 'customer') sql += 'customer_id = HEXTORAW(:id)';
  else return [];
  const result = await conn.execute(sql, { id: userId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
  return (result.rows || []).map((row) => row.ID.toString('hex'));
}

async function authorizeRequest(conn, req, table, action, filters, values) {
  if (!req.user) throw new Error('Missing user');
  if (ADMIN_ONLY_TABLES.has(table) && !isAdmin(req)) {
    throw new Error('Forbidden');
  }

  if (isAdmin(req)) return { filters, values };

  if (isOriginator(req)) {
    switch (table) {
      case 'profiles':
        return { filters: addConstraintFilter(filters, 'id', req.user.id), values };
      case 'originator_applications':
        return {
          filters: addConstraintFilter(filters, 'user_id', req.user.id),
          values: action === 'insert' ? { ...values, user_id: req.user.id } : values,
        };
      case 'originator_documents': {
        const appResult = await conn.execute(
          'SELECT id FROM originator_applications WHERE user_id = HEXTORAW(:id)',
          { id: req.user.id },
          { outFormat: oracledb.OUT_FORMAT_OBJECT },
        );
        const appIds = (appResult.rows || []).map((row) => row.ID.toString('hex'));
        if (action === 'insert') {
          const rows = Array.isArray(values) ? values : [values];
          rows.forEach((row) => {
            if (!appIds.includes(row.application_id)) throw new Error('Forbidden');
          });
          return { filters, values };
        }
        return {
          filters: appIds.length ? [...filters, { op: 'in', column: 'application_id', value: appIds }] : [...filters, { op: 'eq', column: 'application_id', value: '00000000000000000000000000000000' }],
          values,
        };
      }
      case 'verification_checks': {
        const appResult = await conn.execute(
          'SELECT id FROM originator_applications WHERE user_id = HEXTORAW(:id)',
          { id: req.user.id },
          { outFormat: oracledb.OUT_FORMAT_OBJECT },
        );
        const appIds = (appResult.rows || []).map((row) => row.ID.toString('hex'));
        return {
          filters: appIds.length ? [...filters, { op: 'in', column: 'application_id', value: appIds }] : [...filters],
          values,
        };
      }
      case 'deals':
        return {
          filters: addConstraintFilter(filters, 'originator_id', req.user.id),
          values: action === 'insert' ? { ...values, originator_id: req.user.id } : values,
        };
      case 'contracts':
        return { filters: addConstraintFilter(filters, 'originator_id', req.user.id), values };
      case 'payment_schedule': {
        const contractIds = await getUserContractIds(conn, req.user.id, 'originator');
        return {
          filters: contractIds.length ? [...filters, { op: 'in', column: 'contract_id', value: contractIds }] : [...filters],
          values,
        };
      }
      case 'contract_signatures':
      case 'contract_closure_requests': {
        const contractIds = await getUserContractIds(conn, req.user.id, 'originator');
        return {
          filters: contractIds.length ? [...filters, { op: 'in', column: 'contract_id', value: contractIds }] : [...filters],
          values,
        };
      }
      case 'prospects':
      case 'quotes':
        return {
          filters: addConstraintFilter(filters, 'originator_id', req.user.id),
          values: action === 'insert' ? { ...values, originator_id: req.user.id } : values,
        };
      case 'prospect_activities': {
        const prospectResult = await conn.execute(
          'SELECT id FROM prospects WHERE originator_id = HEXTORAW(:id)',
          { id: req.user.id },
          { outFormat: oracledb.OUT_FORMAT_OBJECT },
        );
        const prospectIds = (prospectResult.rows || []).map((row) => row.ID.toString('hex'));
        return {
          filters: prospectIds.length ? [...filters, { op: 'in', column: 'prospect_id', value: prospectIds }] : [...filters],
          values: action === 'insert' ? { ...values, created_by: req.user.id } : values,
        };
      }
      case 'notifications':
        return { filters: addConstraintFilter(filters, 'user_id', req.user.id), values };
      case 'deal_amendments':
        {
          const result = await conn.execute(
            'SELECT id FROM deals WHERE originator_id = HEXTORAW(:user_id)',
            { user_id: req.user.id },
            { outFormat: oracledb.OUT_FORMAT_OBJECT },
          );
          const ownDealIds = (result.rows || []).map((row) => row.ID.toString('hex'));
          if (action === 'insert') {
            const rows = Array.isArray(values) ? values : [values];
            rows.forEach((row) => {
              if (!ownDealIds.includes(row.deal_id)) throw new Error('Forbidden');
            });
            return { filters, values };
          }
          return {
            filters: ownDealIds.length ? [...filters, { op: 'in', column: 'deal_id', value: ownDealIds }] : [...filters],
            values,
          };
        }
      default:
        throw new Error('Forbidden');
    }
  }

  if (isCustomer(req)) {
    switch (table) {
      case 'profiles':
        return { filters: addConstraintFilter(filters, 'id', req.user.id), values };
      case 'contracts':
        return { filters: addConstraintFilter(filters, 'customer_id', req.user.id), values };
      case 'payment_schedule': {
        const contractIds = await getUserContractIds(conn, req.user.id, 'customer');
        return {
          filters: contractIds.length ? [...filters, { op: 'in', column: 'contract_id', value: contractIds }] : [...filters],
          values,
        };
      }
      case 'notifications':
        return { filters: addConstraintFilter(filters, 'user_id', req.user.id), values };
      case 'contract_signatures':
      case 'contract_closure_requests': {
        const contractIds = await getUserContractIds(conn, req.user.id, 'customer');
        if (action === 'insert') {
          const rows = Array.isArray(values) ? values : [values];
          rows.forEach((row) => {
            if (!contractIds.includes(row.contract_id)) throw new Error('Forbidden');
          });
        }
        return {
          filters: contractIds.length ? [...filters, { op: 'in', column: 'contract_id', value: contractIds }] : [...filters],
          values,
        };
      }
      default:
        throw new Error('Forbidden');
    }
  }

  throw new Error('Forbidden');
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
      const authorized = await authorizeRequest(conn, req, table, action, filters, values);
      const safeFilters = authorized.filters || [];
      const safeValues = authorized.values ?? values;
      const binds = {};

      if (action === 'select') {
        return runSelect(conn, mapped, { select, filters: safeFilters, orderBy, single, maybeSingle });
      }

      if (action === 'insert') {
        const rows = Array.isArray(safeValues) ? safeValues : [safeValues];
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
            filters: [{ op: 'in', column: 'id', value: inserted.map((row) => row.id).filter(Boolean) }, ...safeFilters],
            single,
            maybeSingle,
          });
        }
        return Array.isArray(safeValues) ? inserted : inserted[0];
      }

      if (action === 'update') {
        const cols = Object.keys(safeValues).map((k) => colExpr(k)).filter(Boolean);
        cols.forEach((c) => {
          binds[`u_${c}`] = buildBind(c, safeValues[c]);
        });
        let sql = `UPDATE ${mapped} SET ${cols.map((c) => `${c} = :u_${c}`).join(', ')}`;
        sql += buildWhereClause(safeFilters, binds);
        await conn.execute(sql, binds);
        await conn.commit();
        if (select || single || maybeSingle) {
          return runSelect(conn, mapped, { select, filters: safeFilters, orderBy, single, maybeSingle });
        }
        return { success: true };
      }

      if (action === 'delete') {
        ensureSafeDelete(safeFilters);
        let sql = `DELETE FROM ${mapped}`;
        if (safeFilters.length) {
          sql +=
            ' WHERE ' +
            safeFilters
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
