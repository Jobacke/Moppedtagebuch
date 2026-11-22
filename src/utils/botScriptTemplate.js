export function generateBotScriptWithToken({ refreshToken, uid, email, currentKm, nextServiceDue, licensePlate }) {
  const safeToken = refreshToken || '';
  const safeUid = uid || '';
  const safeEmail = email || 'backhaus.johannes@gmail.com';
  const safeKm = parseInt(String(currentKm || '38865').replace(/\D/g, ''), 10) || 38865;
  const safeService = parseInt(String(nextServiceDue || '52000').replace(/\D/g, ''), 10) || 52000;
  const safePlate = licensePlate || 'M-N 594';

  return `/**
 * ============================================================================
 * 🏍️ MOPPEDTAGEBUCH – E-MAIL-BOT, TANKRECHNUNGEN & RIDELINK-WEBHOOK (iPhone)
 * ============================================================================
 * ✅ AUTOMATISCH MIT DEINEM MOPPEDTAGEBUCH-ACCOUNT VERKNÜPFT!
 *
 * 1) E-Mail-Antwort auf die tägliche Mail:
 *    - Tankrechnung: "36,48, 19.10. Avia" oder "45,15, 30.08.2026, Shell Himmelkron"
 *    - Nur KM-Stand: "39250" oder "+180"
 *    - Kombi:        "39250, 36,48, 19.10. Avia"
 *
 * 2) RideLink iPhone-Kurzbefehl (Variante B – lautlos im Hintergrund):
 *    - Einmalig in Google Apps Script oben rechts auf "Bereitstellen" ->
 *      "Neue Bereitstellung" -> Typ "Web-App" -> Ausführen als "Ich" ->
 *      Zugriff "Jeder" -> Bereitstellen klicken und die Web-App-URL kopieren.
 *    - Der iPhone-Kurzbefehl sendet den OCR-Text aus dem RideLink-Screenshot
 *      per POST (JSON: { token, ocrText }) direkt an diese URL.
 *
 * Einfach speichern (Cmd + S) und oben auf "▷ Ausführen" klicken!
 */

const CONFIG = {
  RECIPIENT_EMAIL: "${safeEmail}",
  APP_URL: "https://tagebuch.vjbackhaus.de",
  BIKE_NAME: "Versys 1000 SE",
  LICENSE_PLATE: "${safePlate}",
  DEFAULT_KM: ${safeKm},
  DEFAULT_NEXT_SERVICE: ${safeService},
  REMINDER_HOUR: 19, // Täglich um 19:00 Uhr abends

  FIREBASE_PROJECT_ID: "moppedtagebuch",
  FIREBASE_API_KEY: "AIzaSyCU4b7reiVNHjqvuEM7cXSLGilCmZ5YYlM",
  FIREBASE_UID: "${safeUid}",
  FIREBASE_REFRESH_TOKEN: "${safeToken}",

  // Geheim-Token für den RideLink iPhone-Kurzbefehl (Webhook)
  WEBHOOK_SECRET: "RL-7vK9mP4xN2qW8zB5cH3jF",
  RIDELINK_MAX_SINGLE_JUMP_KM: 15000
};

/**
 * 🚀 EINMALIG AUSFÜHREN (oder zum manuellen Testen):
 */
function setupTwoDayMoppedBot() {
  const props = PropertiesService.getScriptProperties();
  if (CONFIG.FIREBASE_REFRESH_TOKEN) {
    props.setProperty("SAVED_REFRESH_TOKEN", CONFIG.FIREBASE_REFRESH_TOKEN);
  }
  if (CONFIG.FIREBASE_UID) {
    props.setProperty("SAVED_UID", CONFIG.FIREBASE_UID);
  }

  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => {
    const fn = t.getHandlerFunction();
    if (fn === "sendTwoDayMoppedReminder" || fn === "sendDailyMoppedReminder" || fn === "checkMoppedEmailReplies") {
      ScriptApp.deleteTrigger(t);
    }
  });

  // 1. TÄGLICH um 19:00 Uhr erinnern
  ScriptApp.newTrigger("sendTwoDayMoppedReminder")
    .timeBased()
    .everyDays(1)
    .atHour(CONFIG.REMINDER_HOUR)
    .create();

  // 2. Jede Minute prüfen, ob du auf eine Bot-Mail geantwortet hast
  ScriptApp.newTrigger("checkMoppedEmailReplies")
    .timeBased()
    .everyMinutes(1)
    .create();

  const auth = getFirebaseAuth();
  if (auth) {
    Logger.log("✅ Firebase-Datenbank erfolgreich verbunden (UID: " + auth.uid + ")!");
  } else {
    Logger.log("❌ Verbindung fehlgeschlagen – bitte den Bot-Code erneut aus der Moppedtagebuch-App kopieren.");
    return;
  }

  // Zuerst die allerneueste E-Mail-Antwort auswerten und direkt in Firestore schreiben
  checkMoppedEmailReplies();

  // Danach den aktuellen Stand aus Firestore holen und im Protokoll anzeigen
  const currentState = getCurrentBikeState();
  Logger.log("📊 Aktueller KM-Stand in der Cloud-Datenbank: " + currentState.currentKm + " km");

  // Tägliche Erinnerungs-Mail mit dem aktuellen Stand senden
  sendTwoDayMoppedReminder();
}

/**
 * 📩 Sendet die tägliche Erinnerung mit Tankrechnungs- & KM-Antwortfunktion
 */
function sendTwoDayMoppedReminder() {
  const state = getCurrentBikeState();
  const currentKm = parseInt(state.currentKm || CONFIG.DEFAULT_KM, 10);
  const nextService = parseInt(state.nextServiceDue || CONFIG.DEFAULT_NEXT_SERVICE, 10);
  const kmToService = Math.max(0, nextService - currentKm);
  const dateStr = Utilities.formatDate(new Date(), "Europe/Berlin", "dd.MM.yyyy");

  const subject = \`🏍️ Mopped-Check (\${dateStr}): \${CONFIG.BIKE_NAME} steht bei \${currentKm.toLocaleString("de-DE")} km – Update / Tanken?\`;

  const quickOpenUrl = \`\${CONFIG.APP_URL}/?quick=1\`;
  const add100Url = \`\${CONFIG.APP_URL}/?quick=1&addKm=100&autosave=1\`;
  const add200Url = \`\${CONFIG.APP_URL}/?quick=1&addKm=200&autosave=1\`;
  const add350Url = \`\${CONFIG.APP_URL}/?quick=1&addKm=350&autosave=1\`;

  const htmlBody = \`
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;background:#121212;color:#ffffff;border-radius:20px;overflow:hidden;border:1px solid rgba(105,190,40,0.35);">
      <div style="background:linear-gradient(135deg,#1b3314,#121212);padding:22px 20px;text-align:center;border-bottom:1px solid rgba(105,190,40,0.25);">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.2px;color:#69BE28;font-weight:700;">🏍️ Moppedtagebuch • Täglicher Check</div>
        <h2 style="margin:6px 0 8px 0;font-size:24px;color:#ffffff;">\${CONFIG.BIKE_NAME}</h2>
        <span style="background:#69BE28;color:#000;padding:4px 12px;border-radius:10px;font-weight:800;font-size:13px;">\${state.licensePlate || CONFIG.LICENSE_PLATE}</span>

        <table style="width:100%;margin-top:20px;text-align:center;border-collapse:collapse;">
          <tr>
            <td style="padding:8px;">
              <div style="font-size:22px;font-weight:800;color:#ffffff;">\${currentKm.toLocaleString("de-DE")}</div>
              <div style="font-size:11px;color:#a0a0a0;">KM Stand</div>
            </td>
            <td style="padding:8px;">
              <div style="font-size:22px;font-weight:800;color:#ffffff;">\${nextService.toLocaleString("de-DE")}</div>
              <div style="font-size:11px;color:#a0a0a0;">Nächster Service</div>
            </td>
            <td style="padding:8px;">
              <div style="font-size:22px;font-weight:800;color:#69BE28;">\${kmToService.toLocaleString("de-DE")}</div>
              <div style="font-size:11px;color:#a0a0a0;">Rest-KM Service</div>
            </td>
          </tr>
        </table>
      </div>

      <div style="padding:20px;">
        <div style="background:#1e1e1e;border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:14px 16px;margin-bottom:16px;">
          <div style="font-size:14px;font-weight:700;color:#69BE28;margin-bottom:8px;">💬 Einfach auf diese Mail antworten (1 Zeile genügt):</div>
          <div style="font-size:13px;color:#d0d0d0;line-height:1.6;">
            ⛽ <b>Tankrechnung (Betrag, Datum, Tankstelle):</b><br>
            • <code style="color:#69BE28;font-weight:700;">36,48, 19.10. Avia</code><br>
            • <code style="color:#69BE28;font-weight:700;">\${currentKm + 200}, 45,15, \${dateStr}, Shell Himmelkron</code><br><br>
            🛣️ <b>Nur KM-Stand aktualisieren:</b><br>
            • <code style="color:#69BE28;font-weight:700;">\${currentKm + 180}</code> oder <code style="color:#69BE28;font-weight:700;">+180</code>
          </div>
        </div>

        <div style="font-size:14px;font-weight:700;color:#ffffff;margin-bottom:10px;text-align:center;">⚡ Oder per 1-Klick in der App (iPhone & Mac)</div>

        <div style="text-align:center;margin-bottom:12px;">
          <a href="\${add100Url}" style="display:inline-block;background:#1e2d19;color:#69BE28;border:1px solid #69BE28;text-decoration:none;padding:10px 14px;border-radius:12px;font-weight:700;font-size:13px;margin:4px;">+100 km</a>
          <a href="\${add200Url}" style="display:inline-block;background:#1e2d19;color:#69BE28;border:1px solid #69BE28;text-decoration:none;padding:10px 14px;border-radius:12px;font-weight:700;font-size:13px;margin:4px;">+200 km</a>
          <a href="\${add350Url}" style="display:inline-block;background:#1e2d19;color:#69BE28;border:1px solid #69BE28;text-decoration:none;padding:10px 14px;border-radius:12px;font-weight:700;font-size:13px;margin:4px;">+350 km</a>
        </div>

        <div style="text-align:center;margin-top:14px;">
          <a href="\${quickOpenUrl}" style="display:block;background:#69BE28;color:#000000;text-decoration:none;padding:13px 20px;border-radius:99px;font-weight:800;font-size:14px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">⚡ Schnell-Check & Tankrechnung öffnen</a>
        </div>

        <div style="font-size:11px;color:#777;text-align:center;margin-top:14px;">
          Letztes Update: \${state.lastUpdated || "unbekannt"} • Erinnerungs-Intervall: täglich
        </div>
      </div>
    </div>
  \`;

  MailApp.sendEmail({
    to: CONFIG.RECIPIENT_EMAIL,
    subject: subject,
    name: "Mopped-Bot",
    htmlBody: htmlBody
  });
}

/**
 * 🔍 Sucht alle deine E-Mail-Antworten der letzten 7 Tage, sortiert sie exakt
 * nach Uhrzeit (Sekunden-genau) und wendet IMMER die allerneueste Antwort an!
 */
function checkMoppedEmailReplies() {
  const props = PropertiesService.getScriptProperties();
  if (CONFIG.FIREBASE_REFRESH_TOKEN) {
    props.setProperty("SAVED_REFRESH_TOKEN", CONFIG.FIREBASE_REFRESH_TOKEN);
  }

  const threads = GmailApp.search('(subject:"Mopped-Check" OR subject:"Moppedtagebuch aktualisiert") newer_than:7d', 0, 20);
  if (!threads.length) return;

  const userReplies = [];

  threads.forEach(thread => {
    const messages = thread.getMessages();
    messages.forEach(msg => {
      const from = msg.getFrom() || "";
      if (from.indexOf("Mopped-Bot") !== -1) return;

      const plainBody = msg.getPlainBody() || "";
      const firstLine = plainBody
        .split(/\\r?\\n/)
        .map(l => l.trim())
        .filter(l =>
          l &&
          !l.startsWith(">") &&
          !l.startsWith("Am ") &&
          !l.startsWith("On ") &&
          !l.startsWith("Von:") &&
          !l.startsWith("From:") &&
          !l.startsWith("Gesendet:") &&
          !l.startsWith("Von meinem iPhone")
        )[0];

      if (!firstLine) return;

      if (
        firstLine.indexOf("🏍️") !== -1 ||
        firstLine.indexOf("✅") !== -1 ||
        firstLine.indexOf("Moppedtagebuch •") !== -1 ||
        firstLine.indexOf("Direkt im Moppedtagebuch gespeichert") !== -1
      ) {
        return;
      }

      const parsed = parseReplyLine(firstLine);
      if (parsed && (parsed.km || parsed.addKm || parsed.amount)) {
        userReplies.push({
          msg: msg,
          msgId: msg.getId(),
          timestamp: msg.getDate().getTime(),
          firstLine: firstLine,
          parsed: parsed
        });
      }
    });
  });

  if (!userReplies.length) {
    Logger.log("ℹ️ Keine neuen E-Mail-Antworten gefunden.");
    return;
  }

  userReplies.sort((a, b) => b.timestamp - a.timestamp);
  const newest = userReplies[0];

  const lastAppliedId = props.getProperty("LAST_APPLIED_REPLY_ID_V2") || "";
  const liveState = getCurrentBikeState();

  const kmAlreadyInCloud = newest.parsed.km && String(liveState.currentKm) === String(newest.parsed.km);
  if (newest.msgId === lastAppliedId && (kmAlreadyInCloud || !newest.parsed.km)) {
    Logger.log("ℹ️ Neueste Antwort ('" + newest.firstLine + "') wurde bereits gespeichert.");
    return;
  }

  Logger.log("📩 Wende neueste E-Mail-Antwort an: '" + newest.firstLine + "' -> " + JSON.stringify(newest.parsed));
  const res = applyParsedEntry(newest.parsed, liveState);

  if (res.wroteDirectToFirestore) {
    newest.msg.markRead();
    props.setProperty("LAST_APPLIED_REPLY_ID_V2", newest.msgId);

    MailApp.sendEmail({
      to: CONFIG.RECIPIENT_EMAIL,
      name: "Mopped-Bot",
      subject: "✅ Moppedtagebuch aktualisiert: " + res.summary,
      htmlBody: \`
        <div style="font-family:-apple-system,sans-serif;padding:18px;background:#121212;color:#fff;border-radius:16px;border:1px solid #69BE28;max-width:460px;">
          <h3 style="margin:0 0 8px 0;color:#69BE28;">✅ Direkt im Moppedtagebuch gespeichert!</h3>
          <p style="margin:0 0 14px 0;font-size:15px;line-height:1.5;">\${res.summary}</p>
          <a href="\${CONFIG.APP_URL}" style="display:inline-block;background:#69BE28;color:#000;padding:10px 16px;border-radius:99px;text-decoration:none;font-weight:700;">Im Moppedtagebuch ansehen →</a>
        </div>
      \`
    });
  }
}

/**
 * Parst E-Mail-Antworten exakt identisch zu den manuellen Finanzen-Einträgen:
 * - Titel (desc) = Name der Tankstelle (z.B. "Avia", "Shell Himmelkron")
 * - Datum (date) = Tankdatum im Format YYYY-MM-DD (wird angezeigt als "📅 19.10.2026")
 * - Kategorie (cat) = "Fuel" (wird angezeigt als "• ⛽ Tanken")
 * - Betrag (amount) = z.B. "36.48"
 */
function parseReplyLine(line) {
  let working = line.trim();
  const now = new Date();
  const currentYear = now.getFullYear();

  const result = {
    km: null,
    addKm: null,
    amount: null,
    cat: "Fuel",
    station: "",
    desc: "",
    date: Utilities.formatDate(now, "Europe/Berlin", "yyyy-MM-dd"),
    dateDisplay: Utilities.formatDate(now, "Europe/Berlin", "dd.MM.yyyy")
  };

  // 1. ZUERST Datum erkennen (z.B. "19.10.", "19.10.26", "19.10.2026" oder "2026-10-19")
  // Wichtig: Kein \\b nach dem zweiten Punkt, damit auch "19.10. Avia" ohne Jahreszahl erkannt wird!
  const deDateMatch = working.match(/\\b(\\d{1,2})\\.(\\d{1,2})\\.(\\d{2,4})?/);
  const isoDateMatch = !deDateMatch && working.match(/\\b(\\d{4})-(\\d{1,2})-(\\d{1,2})\\b/);

  if (deDateMatch) {
    const day = ("0" + deDateMatch[1]).slice(-2);
    const month = ("0" + deDateMatch[2]).slice(-2);
    let year = deDateMatch[3] ? String(deDateMatch[3]) : String(currentYear);
    if (year.length === 2) year = "20" + year;
    result.date = \`\${year}-\${month}-\${day}\`;
    result.dateDisplay = \`\${day}.\${month}.\${year}\`;
    working = working.replace(deDateMatch[0], " ");
  } else if (isoDateMatch) {
    const year = isoDateMatch[1];
    const month = ("0" + isoDateMatch[2]).slice(-2);
    const day = ("0" + isoDateMatch[3]).slice(-2);
    result.date = \`\${year}-\${month}-\${day}\`;
    result.dateDisplay = \`\${day}.\${month}.\${year}\`;
    working = working.replace(isoDateMatch[0], " ");
  } else if (/\\bgestern\\b/i.test(working)) {
    const yest = new Date(now.getTime() - 86400000);
    result.date = Utilities.formatDate(yest, "Europe/Berlin", "yyyy-MM-dd");
    result.dateDisplay = Utilities.formatDate(yest, "Europe/Berlin", "dd.MM.yyyy");
    working = working.replace(/\\bgestern\\b/i, " ");
  } else if (/\\bvorgestern\\b/i.test(working)) {
    const beforeYest = new Date(now.getTime() - 2 * 86400000);
    result.date = Utilities.formatDate(beforeYest, "Europe/Berlin", "yyyy-MM-dd");
    result.dateDisplay = Utilities.formatDate(beforeYest, "Europe/Berlin", "dd.MM.yyyy");
    working = working.replace(/\\bvorgestern\\b/i, " ");
  } else if (/\\bheute\\b/i.test(working)) {
    working = working.replace(/\\bheute\\b/i, " ");
  }

  // Tausenderpunkte bei 5-6-stelligen KM-Zahlen glätten (z.B. "39.150" -> "39150")
  working = working.replace(/(\\b\\d{2,3})\\.(\\d{3}\\b)/g, "$1$2");

  // 2. Relative KM (+180) erkennen
  const addMatch = working.match(/(?:^|[\\s,;])\\+\\s*(\\d{1,5})\\s*(?:km)?\\b/i);
  if (addMatch) {
    result.addKm = parseInt(addMatch[1], 10);
    working = working.replace(addMatch[0], " ");
  }

  // 3. Absoluten KM-Stand erkennen (5- bis 6-stellige ganze Zahl ohne Nachkommastellen)
  if (!result.addKm) {
    const kmMatch = working.match(/(?:^|[\\s,;])(\\d{5,6})(?![.,]\\d)\\s*(?:km)?\\b/i);
    if (kmMatch) {
      result.km = parseInt(kmMatch[1], 10);
      working = working.replace(kmMatch[0], " ");
    }
  }

  // 4. Betrag in Euro erkennen (z.B. "36,48", "36.48", "36,48 €", "30€")
  const amountMatch = working.match(/(?:^|[\\s,;])(\\d{1,3}(?:[.,]\\d{1,2})?|\\d{1,4}[.,]\\d{1,2})\\s*(?:€|eur|euro)?(?=$|[\\s,;])/i);
  if (amountMatch) {
    const val = parseFloat(amountMatch[1].replace(",", "."));
    if (val > 0 && val < 5000) {
      result.amount = val;
      working = working.replace(amountMatch[0], " ");
    }
  }

  // 5. Übriger Text = Name der Tankstelle (exakt wie bei manuellen Einträgen, z.B. "Avia" oder "Shell Himmelkron")
  let leftover = working
    .replace(/\\b(km|euro|eur|€)\\b/gi, " ")
    .replace(/^[,;\\s\\-]+|[,;\\s\\-]+$/g, "")
    .replace(/\\s*[,;]\\s*/g, " ")
    .replace(/\\s{2,}/g, " ")
    .trim();

  leftover = leftover.replace(/^(tanken|getankt)\\s*(bei|an der|in)?\\s*/i, "").trim();

  if (leftover) {
    result.station = leftover;
  }

  if (result.amount) {
    result.desc = result.station || "Tanken";
  }

  return result;
}

function applyParsedEntry(parsed, currentState) {
  const props = PropertiesService.getScriptProperties();
  const state = currentState || getCurrentBikeState();
  const oldKm = parseInt(state.currentKm || CONFIG.DEFAULT_KM, 10);
  let newKm = oldKm;

  if (parsed.km) {
    newKm = parsed.km;
  } else if (parsed.addKm) {
    newKm = oldKm + parsed.addKm;
  }

  const hasKmChange = Boolean(parsed.km || parsed.addKm);
  const diff = newKm - oldKm;
  const wroteDirectToFirestore = writeEntryDirectlyToFirestore(newKm, parsed, hasKmChange);

  if (wroteDirectToFirestore) {
    state.currentKm = String(newKm);
    state.lastUpdated = parsed.date;
    props.setProperty("BIKE_STATE", JSON.stringify(state));
  }

  const summary = [];
  if (hasKmChange) {
    summary.push(\`KM-Stand: \${newKm.toLocaleString("de-DE")} km\${diff > 0 ? \` (+\${diff} km)\` : ""}\`);
  }
  if (parsed.amount) {
    summary.push(
      \`\${parsed.desc}: € \${parsed.amount.toFixed(2)} am \${parsed.dateDisplay}\`
    );
  }
  return {
    summary: summary.join(" | "),
    newKm: newKm,
    wroteDirectToFirestore: wroteDirectToFirestore
  };
}

function getCurrentBikeState() {
  const props = PropertiesService.getScriptProperties();
  const savedRaw = props.getProperty("BIKE_STATE");
  const saved = savedRaw ? JSON.parse(savedRaw) : {
    currentKm: String(CONFIG.DEFAULT_KM),
    nextServiceDue: String(CONFIG.DEFAULT_NEXT_SERVICE),
    licensePlate: CONFIG.LICENSE_PLATE,
    lastUpdated: Utilities.formatDate(new Date(), "Europe/Berlin", "yyyy-MM-dd")
  };

  const authData = getFirebaseAuth();
  if (authData) {
    try {
      const docUrl = \`https://firestore.googleapis.com/v1/projects/\${CONFIG.FIREBASE_PROJECT_ID}/databases/(default)/documents/users/\${authData.uid}/data/technical_data\`;
      const res = UrlFetchApp.fetch(docUrl, {
        method: "get",
        headers: {
          "Authorization": "Bearer " + authData.idToken,
          "Referer": CONFIG.APP_URL + "/"
        },
        muteHttpExceptions: true
      });
      if (res.getResponseCode() === 200) {
        const doc = JSON.parse(res.getContentText());
        const f = doc.fields || {};
        if (f.currentKm && f.currentKm.stringValue) saved.currentKm = f.currentKm.stringValue;
        if (f.nextServiceDue && f.nextServiceDue.stringValue) saved.nextServiceDue = f.nextServiceDue.stringValue;
        if (f.licensePlate && f.licensePlate.stringValue) saved.licensePlate = f.licensePlate.stringValue;
        if (f.lastUpdated && f.lastUpdated.stringValue) saved.lastUpdated = f.lastUpdated.stringValue;
        props.setProperty("BIKE_STATE", JSON.stringify(saved));
      }
    } catch (e) {
      Logger.log("Firestore Lese-Hinweis: " + e);
    }
  }

  return saved;
}

function writeEntryDirectlyToFirestore(newKm, parsed, hasKmChange) {
  const authData = getFirebaseAuth();
  if (!authData) return false;

  try {
    const baseUrl = \`https://firestore.googleapis.com/v1/projects/\${CONFIG.FIREBASE_PROJECT_ID}/databases/(default)/documents/users/\${authData.uid}\`;

    const techUrl = \`\${baseUrl}/data/technical_data?updateMask.fieldPaths=currentKm&updateMask.fieldPaths=lastUpdated&updateMask.fieldPaths=lastUpdatedIso\`;
    const techPayload = {
      fields: {
        currentKm: { stringValue: String(newKm) },
        lastUpdated: { stringValue: parsed.date },
        lastUpdatedIso: { stringValue: new Date().toISOString() }
      }
    };
    const patchRes = UrlFetchApp.fetch(techUrl, {
      method: "patch",
      contentType: "application/json",
      headers: {
        "Authorization": "Bearer " + authData.idToken,
        "Referer": CONFIG.APP_URL + "/"
      },
      payload: JSON.stringify(techPayload),
      muteHttpExceptions: true
    });

    if (patchRes.getResponseCode() !== 200) {
      Logger.log("❌ Firestore Patch Fehler: " + patchRes.getResponseCode() + " " + patchRes.getContentText());
      return false;
    }

    if (parsed.amount && parsed.amount > 0) {
      const finUrl = \`\${baseUrl}/finance\`;
      // Exakt identische Feldstruktur wie bei manuellen Einträgen in Finance.jsx:
      // desc = Name der Tankstelle (z.B. "Avia"), date = "2026-10-19", cat = "Fuel", amount = "36.48"
      const descText = parsed.station || "Tanken";

      const finPayload = {
        fields: {
          date: { stringValue: parsed.date },
          desc: { stringValue: descText },
          amount: { stringValue: parsed.amount.toFixed(2) },
          cat: { stringValue: parsed.cat || "Fuel" }
        }
      };
      const finRes = UrlFetchApp.fetch(finUrl, {
        method: "post",
        contentType: "application/json",
        headers: {
          "Authorization": "Bearer " + authData.idToken,
          "Referer": CONFIG.APP_URL + "/"
        },
        payload: JSON.stringify(finPayload),
        muteHttpExceptions: true
      });
      if (finRes.getResponseCode() === 200) {
        Logger.log("✅ Tankrechnung gespeichert: " + descText + " | 📅 " + parsed.dateDisplay + " | € " + parsed.amount.toFixed(2));
      }
    }
    return true;
  } catch (e) {
    Logger.log("Firestore Schreib-Fehler: " + e);
    return false;
  }
}

function getFirebaseAuth() {
  const props = PropertiesService.getScriptProperties();
  const refreshToken = CONFIG.FIREBASE_REFRESH_TOKEN || props.getProperty("SAVED_REFRESH_TOKEN") || "";
  const savedUid = CONFIG.FIREBASE_UID || props.getProperty("SAVED_UID") || "";

  if (!refreshToken) return null;

  try {
    const tokenUrl = \`https://securetoken.googleapis.com/v1/token?key=\${CONFIG.FIREBASE_API_KEY}\`;
    const res = UrlFetchApp.fetch(tokenUrl, {
      method: "post",
      contentType: "application/x-www-form-urlencoded",
      headers: {
        "Referer": CONFIG.APP_URL + "/"
      },
      payload: \`grant_type=refresh_token&refresh_token=\${encodeURIComponent(refreshToken)}\`,
      muteHttpExceptions: true
    });
    if (res.getResponseCode() === 200) {
      const data = JSON.parse(res.getContentText());
      return {
        idToken: data.id_token,
        uid: data.user_id || savedUid
      };
    } else {
      Logger.log("Firebase Token-Fehler: " + res.getContentText());
    }
  } catch (e) {
    Logger.log("Firebase Auth Fehler: " + e);
  }
  return null;
}

// ============================================================================
// 📱 RIDELINK iPHONE-KURZBEFEHL WEBHOOK (Variante B – lautlos im Hintergrund)
// ============================================================================

function doGet(e) {
  const params = (e && e.parameter) ? e.parameter : {};
  const format = String(params.format || "text").toLowerCase();

  if (!isValidWebhookToken(params.token)) {
    return buildWebhookResponse(false, "❌ Ungültiges Token.", {}, format);
  }

  if (params.km || params.ocrText || params.text) {
    return handleRideLinkSync(params);
  }

  const state = getCurrentBikeState();
  const currentKm = parseInt(state.currentKm || CONFIG.DEFAULT_KM, 10) || 0;
  return buildWebhookResponse(
    true,
    \`✅ Moppedtagebuch RideLink-Webhook aktiv! \${CONFIG.BIKE_NAME} steht aktuell bei \${currentKm.toLocaleString("de-DE")} km.\`,
    { currentKm: currentKm, bike: CONFIG.BIKE_NAME },
    format
  );
}

function doPost(e) {
  let payload = {};
  if (e && e.postData && e.postData.contents) {
    const raw = String(e.postData.contents);
    try {
      payload = JSON.parse(raw);
    } catch (err) {
      if (e.parameter && Object.keys(e.parameter).length > 0) {
        payload = Object.assign({}, e.parameter);
      } else {
        payload = { ocrText: raw };
      }
    }
  }

  if (e && e.parameter) {
    if (!payload.token && e.parameter.token) payload.token = e.parameter.token;
    if (!payload.format && e.parameter.format) payload.format = e.parameter.format;
    if (payload.silentIfUnchanged === undefined && e.parameter.silentIfUnchanged !== undefined) {
      payload.silentIfUnchanged = e.parameter.silentIfUnchanged;
    }
    if (payload.force === undefined && e.parameter.force !== undefined) {
      payload.force = e.parameter.force;
    }
  }

  return handleRideLinkSync(payload);
}

function isValidWebhookToken(token) {
  return Boolean(token) && String(token).trim() === String(CONFIG.WEBHOOK_SECRET).trim();
}

function isTruthyFlag(val) {
  return val === true || val === 1 || String(val || "").toLowerCase() === "true" || String(val || "") === "1";
}

function buildWebhookResponse(ok, message, extra, format) {
  if (format === "json") {
    const body = Object.assign({ ok: ok, message: message }, extra || {});
    return ContentService
      .createTextOutput(JSON.stringify(body))
      .setMimeType(ContentService.MimeType.JSON);
  }
  return ContentService
    .createTextOutput(String(message || ""))
    .setMimeType(ContentService.MimeType.TEXT);
}

function parseRideLinkKmNumber(numStr) {
  if (!numStr) return null;
  const cleaned = String(numStr).replace(/\\s+/g, "").trim();
  if (!cleaned || !/^\\d[\\d.,]*$/.test(cleaned)) return null;

  const hasDot = cleaned.indexOf(".") !== -1;
  const hasComma = cleaned.indexOf(",") !== -1;

  let value = NaN;
  if (hasDot && hasComma) {
    const lastDot = cleaned.lastIndexOf(".");
    const lastComma = cleaned.lastIndexOf(",");
    if (lastComma > lastDot) {
      value = parseFloat(cleaned.replace(/\\./g, "").replace(",", "."));
    } else {
      value = parseFloat(cleaned.replace(/,/g, ""));
    }
  } else if (hasDot || hasComma) {
    const sep = hasDot ? "." : ",";
    const parts = cleaned.split(sep);
    if (parts.length === 2 && parts[1].length >= 1 && parts[1].length <= 2) {
      value = parseFloat(parts[0] + "." + parts[1]);
    } else {
      value = parseInt(parts.join(""), 10);
    }
  } else {
    value = parseInt(cleaned, 10);
  }

  if (isNaN(value) || value <= 0) return null;
  return {
    raw: value,
    rounded: Math.round(value)
  };
}

function extractRideLinkDataFromText(rawText, currentKm) {
  const text = String(rawText || "");
  if (!text.trim()) {
    return { km: null, rawKm: null, battery: null, source: "empty" };
  }

  let battery = null;
  const batMatch = text.match(/([+-]?\\d{1,2}[.,]\\d)\\s*V\\b/i);
  if (batMatch) {
    battery = batMatch[1].replace(/^\\+/, "").replace(".", ",") + " V";
  }

  const labelMatch = text.match(/(?:Gesamtstrecke|Total\\s*distance|Kilometerstand)[\\s\\S]{0,80}?(\\d{1,3}(?:[.,\\s]\\d{3})+(?:[.,]\\d{1,2})?|\\d{4,7}(?:[.,]\\d{1,2})?)\\s*km\\b/i);
  if (labelMatch) {
    const parsed = parseRideLinkKmNumber(labelMatch[1]);
    if (parsed) {
      return {
        km: parsed.rounded,
        rawKm: parsed.raw,
        battery: battery,
        source: "ridelink_gesamtstrecke"
      };
    }
  }

  const kmRegex = /(\\d{1,3}(?:[.,\\s]\\d{3})+(?:[.,]\\d{1,2})?|\\d{4,7}(?:[.,]\\d{1,2})?)\\s*km\\b/gi;
  const candidates = [];
  let m;
  while ((m = kmRegex.exec(text)) !== null) {
    const parsed = parseRideLinkKmNumber(m[1]);
    if (parsed && parsed.rounded >= 1000 && parsed.rounded <= 500000) {
      candidates.push(parsed);
    }
  }

  if (candidates.length > 0) {
    if (currentKm > 0) {
      const plausible = candidates.filter(
        c => c.rounded >= currentKm - 500 && c.rounded <= currentKm + CONFIG.RIDELINK_MAX_SINGLE_JUMP_KM
      );
      if (plausible.length > 0) {
        plausible.sort((a, b) => b.rounded - a.rounded);
        return {
          km: plausible[0].rounded,
          rawKm: plausible[0].raw,
          battery: battery,
          source: "fallback_plausible"
        };
      }
    }
    candidates.sort((a, b) => b.rounded - a.rounded);
    return {
      km: candidates[0].rounded,
      rawKm: candidates[0].raw,
      battery: battery,
      source: "fallback_max"
    };
  }

  return { km: null, rawKm: null, battery: battery, source: "not_found" };
}

function handleRideLinkSync(payload) {
  const format = String((payload && payload.format) || "text").toLowerCase();
  const silentIfUnchanged = isTruthyFlag(payload && payload.silentIfUnchanged);
  const force = isTruthyFlag(payload && payload.force);

  if (!payload || !isValidWebhookToken(payload.token)) {
    return buildWebhookResponse(false, "❌ Ungültiges Token.", {}, format);
  }

  const liveState = getCurrentBikeState();
  const oldKm = parseInt(liveState.currentKm || CONFIG.DEFAULT_KM, 10) || 0;
  const nextService = parseInt(liveState.nextServiceDue || CONFIG.DEFAULT_NEXT_SERVICE, 10) || CONFIG.DEFAULT_NEXT_SERVICE;

  let extracted = { km: null, rawKm: null, battery: null, source: "direct" };
  if (payload.km !== undefined && payload.km !== null && String(payload.km).trim() !== "") {
    const parsedDirect = parseRideLinkKmNumber(payload.km);
    if (parsedDirect) {
      extracted.km = parsedDirect.rounded;
      extracted.rawKm = parsedDirect.raw;
    }
  } else {
    const ocrText = payload.ocrText || payload.text || "";
    extracted = extractRideLinkDataFromText(ocrText, oldKm);
  }

  const batterySuffix = extracted.battery ? \` • Akku: \${extracted.battery}\` : "";

  if (!extracted.km) {
    if (silentIfUnchanged) {
      return buildWebhookResponse(true, "", { skipped: true, reason: "not_found" }, format);
    }
    return buildWebhookResponse(
      false,
      '⚠️ Kein Kilometerstand erkannt. Bitte in RideLink den Tab "Fahrzeug" (mit "Gesamtstrecke") öffnen.',
      { oldKm: oldKm, source: extracted.source },
      format
    );
  }

  const newKm = extracted.km;
  const diff = newKm - oldKm;

  if (newKm === oldKm) {
    if (silentIfUnchanged) {
      return buildWebhookResponse(true, "", { unchanged: true, currentKm: oldKm }, format);
    }
    return buildWebhookResponse(
      true,
      \`ℹ️ \${CONFIG.BIKE_NAME}: Kilometerstand bereits aktuell (\${oldKm.toLocaleString("de-DE")} km)\${batterySuffix}\`,
      { unchanged: true, oldKm: oldKm, newKm: newKm, battery: extracted.battery },
      format
    );
  }

  if (newKm < oldKm && !force) {
    return buildWebhookResponse(
      false,
      \`⚠️ Erkannter Stand (\${newKm.toLocaleString("de-DE")} km) ist kleiner als im Moppedtagebuch (\${oldKm.toLocaleString("de-DE")} km) – nichts überschrieben.\`,
      { oldKm: oldKm, detectedKm: newKm },
      format
    );
  }

  if (oldKm > 0 && diff > CONFIG.RIDELINK_MAX_SINGLE_JUMP_KM && !force) {
    const maybeMissedDot = Math.round(newKm / 10);
    const hint = (maybeMissedDot >= oldKm && maybeMissedDot <= oldKm + 5000)
      ? \` (evtl. Dezimalpunkt bei \${maybeMissedDot.toLocaleString("de-DE")} km übersehen)\`
      : "";
    return buildWebhookResponse(
      false,
      \`⚠️ Plausibilitäts-Stopp: \${newKm.toLocaleString("de-DE")} km liegt zu weit über \${oldKm.toLocaleString("de-DE")} km\${hint} – nichts überschrieben.\`,
      { oldKm: oldKm, detectedKm: newKm },
      format
    );
  }

  const now = new Date();
  const parsedEntry = {
    km: newKm,
    addKm: null,
    amount: null,
    cat: "Fuel",
    station: "",
    desc: "",
    date: Utilities.formatDate(now, "Europe/Berlin", "yyyy-MM-dd"),
    dateDisplay: Utilities.formatDate(now, "Europe/Berlin", "dd.MM.yyyy")
  };

  const res = applyParsedEntry(parsedEntry, liveState);
  if (!res.wroteDirectToFirestore) {
    return buildWebhookResponse(
      false,
      "❌ Fehler beim Speichern in Firebase – bitte Token/Verbindung in Apps Script prüfen.",
      { oldKm: oldKm, newKm: newKm },
      format
    );
  }

  const kmToService = Math.max(0, nextService - newKm);
  const diffStr = diff > 0 ? \` (+\${diff.toLocaleString("de-DE")} km)\` : "";
  const msg = \`✅ \${CONFIG.BIKE_NAME}: \${newKm.toLocaleString("de-DE")} km\${diffStr} gespeichert! • Service in \${kmToService.toLocaleString("de-DE")} km\${batterySuffix}\`;

  Logger.log("📱 RideLink-Webhook Sync: " + msg);

  return buildWebhookResponse(
    true,
    msg,
    {
      oldKm: oldKm,
      newKm: newKm,
      diffKm: diff,
      rawKm: extracted.rawKm,
      kmToService: kmToService,
      battery: extracted.battery,
      source: extracted.source
    },
    format
  );
}

function testRideLinkOcrParser() {
  const sampleOcr = [
    "Bike v",
    "Letzte Position",
    "Hauptstraße 93C, Neubiberg",
    "Gesamtstrecke",
    "46064.9km",
    ") 21t 12H",
    "+12.3V",
    "BATTERIE"
  ].join("\\n");
  const result = extractRideLinkDataFromText(sampleOcr, 45784);
  Logger.log("🧪 Test-Ergebnis: " + JSON.stringify(result));
}
`;
}
