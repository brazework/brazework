// Connects the app to Supabase. Supabase's code is loaded directly from a CDN,
// so there is nothing to install.
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";
import { supabaseConfig } from "./supabase-config.js";

export const isConfigured = !!supabaseConfig.url && !String(supabaseConfig.url).startsWith("PASTE")
  && !!supabaseConfig.anonKey && !String(supabaseConfig.anonKey).startsWith("PASTE");

export const sb = isConfigured
  ? createClient(supabaseConfig.url, supabaseConfig.anonKey, {
      auth: { flowType: "pkce", detectSessionInUrl: true, persistSession: true, autoRefreshToken: true }
    })
  : null;

// The database uses snake_case; the app uses camelCase.
const camel = s => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
export function row(r) {
  if (!r || typeof r !== "object") return r;
  const o = {};
  for (const k in r) o[camel(k)] = r[k];
  return o;
}
export const rows = list => (list || []).map(row);

// Runs a query and throws its error, so callers can use try/catch.
export async function run(q) {
  const { data, error } = await q;
  if (error) throw error;
  return data;
}
export const many = async q => rows(await run(q));
export const one = async q => row(await run(q.maybeSingle()));
export async function count(q) {
  const { count: n, error } = await q;
  if (error) throw error;
  return n || 0;
}
// For updates and deletes: row-level security skips rows you can't change without an error,
// so this turns "nothing changed" into a permission error.
export async function changed(q) {
  const data = await run(q.select());
  if (!data || !data.length) throw Object.assign(new Error("You don't have permission to do that."), { code: "permission-denied" });
  return data;
}

// Runs load() now and again whenever one of the tables changes, then hands the result to onData.
// Returns a function that stops listening.
export function live(tables, load, onData, onError) {
  let stopped = false, timer = null, seq = 0;
  const go = async () => {
    const mine = ++seq;
    try { const d = await load(); if (!stopped && mine === seq) onData(d); }
    catch (e) { if (!stopped && mine === seq) { if (onError) onError(e); else console.error(e); } }
  };
  go();
  const ch = sb.channel("live-" + Math.random().toString(36).slice(2));
  tables.forEach(table => ch.on("postgres_changes", { event: "*", schema: "public", table }, () => {
    clearTimeout(timer); timer = setTimeout(go, 150);
  }));
  ch.subscribe();
  return () => { stopped = true; clearTimeout(timer); sb.removeChannel(ch); };
}

// The signed-in person, in the shape the app uses.
export const toUser = u => u ? { uid: u.id, email: u.email, emailVerified: !!u.email_confirmed_at } : null;

// Profile fields members can see (birthdays stay private).
export const PROFILE_COLS = "id, first_name, last_name, account_type, headline, bio, field, interests, onboarded, created_at";
