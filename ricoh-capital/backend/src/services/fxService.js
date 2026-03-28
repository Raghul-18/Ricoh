import { env } from '../config/env.js';

function getFrankfurterBaseUrl() {
  const raw = String(env.fx.apiBaseUrl || '').trim().replace(/\/$/, '');
  if (!raw) return 'https://api.frankfurter.dev/v1';
  if (raw.includes('frankfurter.app')) {
    return raw.replace('api.frankfurter.app', 'api.frankfurter.dev/v1');
  }
  if (raw.includes('frankfurter.dev') && !raw.endsWith('/v1')) {
    return `${raw}/v1`;
  }
  return raw;
}

function buildUrl(baseCurrency, targetCurrency) {
  const url = new URL(`${getFrankfurterBaseUrl()}/latest`);
  url.searchParams.set('base', String(baseCurrency || env.fx.baseCurrency).toUpperCase());
  url.searchParams.set('symbols', String(targetCurrency).toUpperCase());
  if (env.fx.apiKey) {
    url.searchParams.set('api_key', env.fx.apiKey);
  }
  return url.toString();
}

export async function getFxRate(baseCurrency, targetCurrency) {
  const from = String(baseCurrency || env.fx.baseCurrency).toUpperCase();
  const to = String(targetCurrency || '').toUpperCase();

  if (!to) throw new Error('Target currency is required');
  if (from === to) {
    return {
      baseCurrency: from,
      targetCurrency: to,
      rate: 1,
      fetchedAt: new Date().toISOString(),
      source: env.fx.sourceName,
    };
  }

  const response = await fetch(buildUrl(from, to));
  if (!response.ok) {
    let details = '';
    try {
      details = await response.text();
    } catch {
      details = '';
    }
    throw new Error(`FX provider request failed: ${response.status}${details ? ` - ${details}` : ''}`);
  }

  const payload = await response.json();
  const rate = Number(payload?.rates?.[to]);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error('FX provider did not return a valid rate');
  }

  return {
    baseCurrency: from,
    targetCurrency: to,
    rate,
    fetchedAt: payload?.date ? new Date(`${payload.date}T00:00:00.000Z`).toISOString() : new Date().toISOString(),
    source: env.fx.sourceName,
  };
}

export async function convertAmount(amount, baseCurrency, targetCurrency) {
  const numericAmount = Number(amount || 0);
  if (!Number.isFinite(numericAmount)) throw new Error('Amount must be numeric');

  const fx = await getFxRate(baseCurrency, targetCurrency);
  return {
    ...fx,
    amount: numericAmount,
    convertedAmount: Math.round(numericAmount * fx.rate * 100) / 100,
  };
}
