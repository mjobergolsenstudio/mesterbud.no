// lib/supabase.js
// Legg denne filen i /lib/supabase.js i prosjektet ditt

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

// ── PROFIL ──
export async function getProfile() {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1)
    .single();
  if (error && error.code !== "PGRST116") console.error(error);
  return data || null;
}

export async function saveProfile(profile) {
  if (profile.id) {
    const { data, error } = await supabase
      .from("profiles")
      .update(profile)
      .eq("id", profile.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await supabase
      .from("profiles")
      .insert(profile)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}

// ── TILBUD ──
export async function getQuotes(profileId) {
  const { data, error } = await supabase
    .from("quotes")
    .select("*")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function saveQuote(quote) {
  const row = {
    profile_id: quote.profileId,
    num: quote.num,
    firm: quote.firm,
    trade: quote.trade,
    cust: quote.cust,
    addr: quote.addr,
    summary: quote.summary,
    line_items: quote.lineItems,
    sub: quote.sub,
    mva: quote.mva,
    total: quote.total,
    payment_terms: quote.paymentTerms,
    valid_days: quote.validDays,
    warranty: quote.warranty,
    notes: quote.notes,
    status: quote.status || "kladd",
    sent_at: quote.sentAt || null,
    sent_to: quote.sentTo || null,
  };

  if (quote.dbId) {
    const { data, error } = await supabase
      .from("quotes")
      .update(row)
      .eq("id", quote.dbId)
      .select()
      .single();
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await supabase
      .from("quotes")
      .insert(row)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}

export async function updateQuoteStatus(num, status, extra = {}) {
  const { data, error } = await supabase
    .from("quotes")
    .update({ status, ...extra })
    .eq("num", num)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getQuoteByNum(num) {
  const { data, error } = await supabase
    .from("quotes")
    .select("*")
    .eq("num", num)
    .single();
  if (error) throw error;
  return data;
}
