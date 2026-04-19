import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { num, firm, cust, status, signedBy, total } = req.body;
  const isAccepted = status === "akseptert";
  const emoji = isAccepted ? "✅" : "❌";

  // 1. Oppdater status i Supabase
  try {
    await supabase
      .from("quotes")
      .update({
        status,
        signed_by: signedBy || null,
        responded_at: new Date().toISOString(),
      })
      .eq("num", num);
  } catch (e) {
    console.error("Supabase update feil:", e.message);
  }

  // 2. Send varsling til håndverker
  const nok = n => new Intl.NumberFormat("nb-NO", { style: "currency", currency: "NOK", maximumFractionDigits: 0 }).format(Number(n) || 0);
  const bg = isAccepted ? "#f0fdf4" : "#fef2f2";
  const color = isAccepted ? "#166534" : "#991b1b";

  const html = `<!DOCTYPE html>
<html lang="no"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f7f9fc;font-family:system-ui,sans-serif;">
<div style="max-width:480px;margin:40px auto;padding:0 16px;">
<div style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
  <div style="background:#0f1f3d;padding:22px 28px;">
    <div style="font-size:17px;font-weight:800;color:#fff;">Mesterbud – Varsling</div>
  </div>
  <div style="padding:28px;">
    <div style="background:${bg};border-radius:10px;padding:18px;text-align:center;margin-bottom:22px;">
      <div style="font-size:38px;margin-bottom:6px;">${emoji}</div>
      <div style="font-size:18px;font-weight:800;color:${color};">Tilbud ${status}!</div>
    </div>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      <tr><td style="padding:8px 0;border-bottom:1px solid #dde3ef;font-size:14px;color:#6b7a99;">Tilbudsnr</td><td style="padding:8px 0;border-bottom:1px solid #dde3ef;font-size:14px;font-weight:600;color:#0f1f3d;text-align:right;">${num}</td></tr>
      <tr><td style="padding:8px 0;border-bottom:1px solid #dde3ef;font-size:14px;color:#6b7a99;">Kunde</td><td style="padding:8px 0;border-bottom:1px solid #dde3ef;font-size:14px;font-weight:600;color:#0f1f3d;text-align:right;">${cust}</td></tr>
      ${signedBy ? `<tr><td style="padding:8px 0;border-bottom:1px solid #dde3ef;font-size:14px;color:#6b7a99;">Signert av</td><td style="padding:8px 0;border-bottom:1px solid #dde3ef;font-size:14px;font-weight:600;color:#0f1f3d;text-align:right;">${signedBy}</td></tr>` : ""}
      <tr><td style="padding:10px 0 0;font-size:16px;font-weight:800;color:#0f1f3d;">Totalbeløp</td><td style="padding:10px 0 0;font-size:16px;font-weight:800;color:#0f1f3d;text-align:right;">${nok(total)}</td></tr>
    </table>
    <p style="font-size:12px;color:#6b7a99;margin-top:18px;">Tidspunkt: ${new Date().toLocaleString("nb-NO")}</p>
  </div>
</div>
</div>
</body></html>`;

  try {
    await resend.emails.send({
      from: `Mesterbud <varsling@${process.env.SEND_DOMAIN}>`,
      to: process.env.NOTIFY_EMAIL,
      subject: `${emoji} Tilbud ${num} ${status} av ${cust}`,
      html,
    });
  } catch (e) {
    console.error("Varsling feil:", e.message);
  }

  return res.status(200).json({ ok: true });
}
