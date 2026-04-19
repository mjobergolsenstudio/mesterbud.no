import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { to, quote } = req.body;
  if (!to || !quote) return res.status(400).json({ error: "Mangler data" });

  const baseUrl = process.env.BASE_URL || "https://mesterbud.no";
  const acceptUrl = `${baseUrl}/aksepter?data=${encodeURIComponent(JSON.stringify({
    num: quote.num, firm: quote.firm, cust: quote.cust, summary: quote.summary,
    total: quote.total, paymentTerms: quote.paymentTerms, validDays: quote.validDays,
    lineItems: quote.lineItems, warranty: quote.warranty,
  }))}`;

  const nok = n => new Intl.NumberFormat("nb-NO", { style: "currency", currency: "NOK", maximumFractionDigits: 0 }).format(Number(n) || 0);

  const rows = (quote.lineItems || []).map(l => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#0f1f3d;">${l.desc}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#6b7a99;">${l.qty} ${l.unit}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:14px;text-align:right;font-weight:600;color:#0f1f3d;">${nok(l.total)}</td>
    </tr>`).join("");

  const html = `<!DOCTYPE html>
<html lang="no"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f7f9fc;font-family:system-ui,sans-serif;">
<div style="max-width:580px;margin:40px auto;padding:0 16px;">
<div style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

  <div style="background:#0f1f3d;padding:30px 34px;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      ${quote.logo ? `<td width="68"><img src="${quote.logo}" width="52" height="52" style="border-radius:8px;background:#fff;object-fit:contain;display:block;"></td>` : ""}
      <td style="padding-left:${quote.logo ? "14px" : "0"};">
        <div style="font-size:21px;font-weight:800;color:#fff;">${quote.firm}</div>
        <div style="font-size:12px;color:#8fa3c8;margin-top:3px;">Tilbudsnr: ${quote.num} · ${new Date().toLocaleDateString("nb-NO")}</div>
      </td>
    </tr></table>
  </div>

  <div style="padding:34px;">
    <p style="font-size:16px;font-weight:600;color:#0f1f3d;margin:0 0 6px;">Hei ${quote.cust},</p>
    <p style="font-size:14px;color:#6b7a99;margin:0 0 26px;line-height:1.7;">Vi sender herved tilbud på det avtalte oppdraget.</p>

    <div style="background:#e8eef8;border-radius:10px;padding:15px 17px;margin-bottom:22px;">
      <div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#6b7a99;margin-bottom:5px;">Oppdrag</div>
      <div style="font-size:14px;color:#1a3260;line-height:1.6;">${quote.summary}</div>
    </div>

    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:18px;">
      <thead><tr style="background:#f7f9fc;">
        <th style="text-align:left;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#6b7a99;padding:8px 12px;">Beskrivelse</th>
        <th style="text-align:left;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#6b7a99;padding:8px 12px;">Ant.</th>
        <th style="text-align:right;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#6b7a99;padding:8px 12px;">Sum</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>

    <div style="background:#f7f9fc;border:1px solid #dde3ef;border-radius:10px;padding:15px 17px;margin-bottom:30px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="font-size:14px;color:#6b7a99;padding:3px 0;">Subtotal eks. MVA</td><td style="font-size:14px;color:#6b7a99;text-align:right;">${nok(quote.sub)}</td></tr>
        <tr><td style="font-size:14px;color:#6b7a99;padding:3px 0;">MVA 25%</td><td style="font-size:14px;color:#6b7a99;text-align:right;">${nok(quote.mva)}</td></tr>
        <tr><td colspan="2" style="padding:10px 0 0;border-top:2px solid #dde3ef;margin-top:8px;"></td></tr>
        <tr><td style="font-size:19px;font-weight:800;color:#0f1f3d;">Totalt inkl. MVA</td><td style="font-size:19px;font-weight:800;color:#0f1f3d;text-align:right;">${nok(quote.total)}</td></tr>
      </table>
      <div style="font-size:12px;color:#6b7a99;margin-top:9px;">Betaling: ${quote.paymentTerms} · Gyldig: ${quote.validDays} dager</div>
    </div>

    <div style="text-align:center;margin-bottom:30px;">
      <a href="${acceptUrl}" style="display:inline-block;background:#3b6fd4;color:#fff;font-size:15px;font-weight:700;padding:15px 38px;border-radius:12px;text-decoration:none;">✅ &nbsp;Aksepter tilbud</a>
      <div style="font-size:12px;color:#6b7a99;margin-top:10px;">Trykk for å akseptere eller avslå digitalt</div>
    </div>

    <hr style="border:none;border-top:1px solid #dde3ef;margin-bottom:18px;">
    <p style="font-size:13px;color:#6b7a99;margin:0;line-height:1.7;">
      Med vennlig hilsen<br>
      <strong style="color:#0f1f3d;">${quote.firm}</strong><br>
      ${quote.fromEmail ? `<a href="mailto:${quote.fromEmail}" style="color:#3b6fd4;">${quote.fromEmail}</a>` : ""}
      ${quote.phone ? ` · ${quote.phone}` : ""}
    </p>
  </div>
</div>
<div style="text-align:center;padding:18px;font-size:11px;color:#94a3b8;">Sendt via Mesterbud</div>
</div>
</body></html>`;

  try {
    const { error } = await resend.emails.send({
      from: `${quote.firm} <kontakt@${process.env.SEND_DOMAIN}>`,
      to,
      subject: `Tilbud ${quote.num} fra ${quote.firm}`,
      html,
      reply_to: quote.fromEmail || undefined,
    });
    if (error) throw new Error(error.message);
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Resend feil:", err);
    return res.status(500).json({ error: err.message });
  }
}
