/**
 * ============================================================================
 * 🏍️ MOPPEDTAGEBUCH – 2-TAGE E-MAIL-BOT & ANTWORT-ASSISTENT (iPhone & Mac)
 * ============================================================================
 *
 * Funktionen dieses Bots:
 * 1. Schickt dir ALLE 2 TAGE eine kompakte Status-Mail für deine Versys 1000 SE
 *    auf iPhone & Mac.
 * 2. Du kannst EINFACH AUF DIE E-MAIL ANTWORTEN, z. B.:
 *    - "39150"                -> Setzt den KM-Stand auf 39.150 km
 *    - "+220"                 -> Addiert 220 km auf den aktuellen Stand
 *    - "39150, 28.50 Tanken"  -> Setzt KM auf 39.150 km + speichert 28,50 € Tanken
 *    - "29,80 Tanken"         -> Speichert 29,80 € unter Finanzen (Tanken)
 * 3. Oder du tippst in der E-Mail auf einen der 1-Klick-Buttons (+100 km, +200 km,
 *    +350 km, Tanken), die direkt deine Webapp öffnen und automatisch speichern!
 *
 * EINRICHTUNG (dauert 1 Minute):
 * 1. Öffne https://script.google.com -> "Neues Projekt"
 * 2. Diesen Code komplett einfügen und speichern.
 * 3. Optional: Trage unten bei FIREBASE_PASSWORD dein Moppedtagebuch-Passwort ein,
 *    damit der Bot deine E-Mail-Antworten sofort live in Firestore einträgt.
 * 4. Oben in der Leiste die Funktion "setupTwoDayMoppedBot" auswählen und auf
 *    "Ausführen" klicken -> Berechtigungen bestätigen -> Fertig!
 */

const CONFIG = {
  RECIPIENT_EMAIL: "backhaus.johannes@gmail.com",
  APP_URL: "https://tagebuch.vjbackhaus.de",
  BIKE_NAME: "Versys 1000 SE",
  LICENSE_PLATE: "M-N 594",
  DEFAULT_KM: 38865,
  DEFAULT_NEXT_SERVICE: 52000,
  REMINDER_HOUR: 19, // 19:00 Uhr abends alle 2 Tage

  // Firebase-Konfiguration (aus deiner Moppedtagebuch Webapp)
  FIREBASE_PROJECT_ID: "moppedtagebuch",
  FIREBASE_API_KEY: "AIzaSyCU4b7reiVNHjqvuEM7cXSLGilCmZ5YYlM",
  FIREBASE_EMAIL: "backhaus.johannes@gmail.com",
  // Optional für Direkt-Schreibzugriff in Firestore ohne App-Öffnen:
  FIREBASE_PASSWORD: "" 
};

/**
 * 🚀 EINMALIG AUSFÜHREN: Richtet den 2-Tage-Trigger + Antwort-Checker ein
 * und schickt sofort eine erste Test-Nachricht.
 */
function setupTwoDayMoppedBot() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => {
    const fn = t.getHandlerFunction();
    if (fn === "sendTwoDayMoppedReminder" || fn === "checkMoppedEmailReplies") {
      ScriptApp.deleteTrigger(t);
    }
  });

  // 1. Alle 2 Tage um 19:00 Uhr erinnern
  ScriptApp.newTrigger("sendTwoDayMoppedReminder")
    .timeBased()
    .everyDays(2)
    .atHour(CONFIG.REMINDER_HOUR)
    .create();

  // 2. Alle 15 Minuten prüfen, ob du auf eine Bot-Mail geantwortet hast
  ScriptApp.newTrigger("checkMoppedEmailReplies")
    .timeBased()
    .everyMinutes(15)
    .create();

  // Direkt erste Mail zum Testen senden
  sendTwoDayMoppedReminder();
  Logger.log("✅ 2-Tage-Bot & Antwort-Checker aktiviert! Erste Mail wurde an " + CONFIG.RECIPIENT_EMAIL + " gesendet.");
}

/**
 * 📩 Sendet die 2-Tage-Erinnerung mit 1-Klick-Buttons & Antwort-Funktion
 */
function sendTwoDayMoppedReminder() {
  const state = getCurrentBikeState();
  const currentKm = parseInt(state.currentKm || CONFIG.DEFAULT_KM, 10);
  const nextService = parseInt(state.nextServiceDue || CONFIG.DEFAULT_NEXT_SERVICE, 10);
  const kmToService = Math.max(0, nextService - currentKm);
  const dateStr = Utilities.formatDate(new Date(), "Europe/Berlin", "dd.MM.yyyy");

  const subject = `🏍️ Mopped-Check (${dateStr}): ${CONFIG.BIKE_NAME} steht bei ${ currentKm.toLocaleString("de-DE") } km – Update?`;

  const quickOpenUrl = `${CONFIG.APP_URL}/?quick=1`;
  const add100Url = `${CONFIG.APP_URL}/?quick=1&addKm=100&autosave=1`;
  const add200Url = `${CONFIG.APP_URL}/?quick=1&addKm=200&autosave=1`;
  const add350Url = `${CONFIG.APP_URL}/?quick=1&addKm=350&autosave=1`;

  const htmlBody = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;background:#121212;color:#ffffff;border-radius:20px;overflow:hidden;border:1px solid rgba(105,190,40,0.35);">
      <div style="background:linear-gradient(135deg,#1b3314,#121212);padding:22px 20px;text-align:center;border-bottom:1px solid rgba(105,190,40,0.25);">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.2px;color:#69BE28;font-weight:700;">🏍️ Moppedtagebuch • 2-Tage-Check</div>
        <h2 style="margin:6px 0 8px 0;font-size:24px;color:#ffffff;">${CONFIG.BIKE_NAME}</h2>
        <span style="background:#69BE28;color:#000;padding:4px 12px;border-radius:10px;font-weight:800;font-size:13px;">${state.licensePlate || CONFIG.LICENSE_PLATE}</span>

        <table style="width:100%;margin-top:20px;text-align:center;border-collapse:collapse;">
          <tr>
            <td style="padding:8px;">
              <div style="font-size:22px;font-weight:800;color:#ffffff;">${currentKm.toLocaleString("de-DE")}</div>
              <div style="font-size:11px;color:#a0a0a0;">KM Stand</div>
            </td>
            <td style="padding:8px;">
              <div style="font-size:22px;font-weight:800;color:#ffffff;">${nextService.toLocaleString("de-DE")}</div>
              <div style="font-size:11px;color:#a0a0a0;">Nächster Service</div>
            </td>
            <td style="padding:8px;">
              <div style="font-size:22px;font-weight:800;color:#69BE28;">${kmToService.toLocaleString("de-DE")}</div>
              <div style="font-size:11px;color:#a0a0a0;">Rest-KM Service</div>
            </td>
          </tr>
        </table>
      </div>

      <div style="padding:20px;">
        <div style="background:#1e1e1e;border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:14px 16px;margin-bottom:16px;">
          <div style="font-size:14px;font-weight:700;color:#69BE28;margin-bottom:6px;">💬 Weg 1: Einfach auf diese Mail antworten!</div>
          <div style="font-size:13px;color:#d0d0d0;line-height:1.5;">
            Antworte direkt mit einer Zeile auf diese E-Mail:<br>
            • <code style="color:#69BE28;font-weight:700;">${currentKm + 180}</code> → setzt den neuen KM-Stand<br>
            • <code style="color:#69BE28;font-weight:700;">+180</code> → addiert 180 km zum aktuellen Stand<br>
            • <code style="color:#69BE28;font-weight:700;">${currentKm + 220}, 28.50 Tanken</code> → KM + Tankbeleg speichern
          </div>
        </div>

        <div style="font-size:14px;font-weight:700;color:#ffffff;margin-bottom:10px;text-align:center;">⚡ Weg 2: 1-Klick Schnelleingabe (iPhone & Mac)</div>

        <div style="text-align:center;margin-bottom:12px;">
          <a href="${add100Url}" style="display:inline-block;background:#1e2d19;color:#69BE28;border:1px solid #69BE28;text-decoration:none;padding:10px 14px;border-radius:12px;font-weight:700;font-size:13px;margin:4px;">+100 km</a>
          <a href="${add200Url}" style="display:inline-block;background:#1e2d19;color:#69BE28;border:1px solid #69BE28;text-decoration:none;padding:10px 14px;border-radius:12px;font-weight:700;font-size:13px;margin:4px;">+200 km</a>
          <a href="${add350Url}" style="display:inline-block;background:#1e2d19;color:#69BE28;border:1px solid #69BE28;text-decoration:none;padding:10px 14px;border-radius:12px;font-weight:700;font-size:13px;margin:4px;">+350 km</a>
        </div>

        <div style="text-align:center;margin-top:14px;">
          <a href="${quickOpenUrl}" style="display:block;background:#69BE28;color:#000000;text-decoration:none;padding:13px 20px;border-radius:99px;font-weight:800;font-size:14px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">⚡ Schnell-Check & Tanken öffnen</a>
        </div>

        <div style="font-size:11px;color:#777;text-align:center;margin-top:14px;">
          Letztes Update: ${state.lastUpdated || "unbekannt"} • Erinnerungs-Intervall: alle 2 Tage
        </div>
      </div>
    </div>
  `;

  MailApp.sendEmail({
    to: CONFIG.RECIPIENT_EMAIL,
    subject: subject,
    htmlBody: htmlBody
  });
}

/**
 * 🔍 Prüft alle 15 Minuten, ob du auf die Mopped-Check-Mail geantwortet hast
 */
function checkMoppedEmailReplies() {
  const threads = GmailApp.search('subject:"Mopped-Check" is:unread', 0, 10);
  if (!threads.length) return;

  threads.forEach(thread => {
    const messages = thread.getMessages();
    messages.forEach(msg => {
      if (!msg.isUnread()) return;

      const body = msg.getPlainBody() || "";
      const firstLine = body
        .split(/\r?\n/)
        .map(l => l.trim())
        .filter(l => l && !l.startsWith(">") && !l.startsWith("Am ") && !l.startsWith("On "))[0];

      if (!firstLine) {
        msg.markRead();
        return;
      }

      const parsed = parseReplyLine(firstLine);
      if (parsed && (parsed.km || parsed.addKm || parsed.amount)) {
        const resultSummary = applyParsedEntry(parsed);
        msg.markRead();

        MailApp.sendEmail({
          to: CONFIG.RECIPIENT_EMAIL,
          subject: "✅ Moppedtagebuch aktualisiert: " + resultSummary,
          htmlBody: `
            <div style="font-family:-apple-system,sans-serif;padding:16px;background:#121212;color:#fff;border-radius:14px;border:1px solid #69BE28;max-width:460px;">
              <h3 style="margin:0 0 8px 0;color:#69BE28;">✅ Eintrag gespeichert!</h3>
              <p style="margin:0 0 12px 0;font-size:15px;">${resultSummary}</p>
              <a href="${CONFIG.APP_URL}" style="color:#69BE28;font-weight:700;">Im Moppedtagebuch ansehen →</a>
            </div>
          `
        });
      }
    });
  });
}

function parseReplyLine(line) {
  const cleaned = line.trim();
  const result = {
    km: null,
    addKm: null,
    amount: null,
    cat: "Fuel",
    desc: "",
    date: Utilities.formatDate(new Date(), "Europe/Berlin", "yyyy-MM-dd")
  };

  const addMatch = cleaned.match(/^\+\s*(\d{1,5})\b/);
  if (addMatch) {
    result.addKm = parseInt(addMatch[1], 10);
  }

  const parts = cleaned.split(/[,;]/).map(s => s.trim()).filter(Boolean);

  if (parts.length >= 1 && !result.addKm) {
    const kmMatch = parts[0].match(/\b(\d{4,6})\b/);
    if (kmMatch) {
      result.km = parseInt(kmMatch[1], 10);
    }
  }

  const restText = parts.length > 1 ? parts.slice(1).join(" ") : (result.km || result.addKm ? cleaned.replace(/^\+?\d+\s*(km)?/i, "").trim() : cleaned);
  if (restText) {
    const amountMatch = restText.match(/(\d{1,4}(?:[.,]\d{1,2})?)\s*€?/);
    if (amountMatch) {
      const val = parseFloat(amountMatch[1].replace(",", "."));
      if (val > 0 && val !== result.km && val < 5000) {
        result.amount = val;
      }
    }

    const lower = restText.toLowerCase();
    if (lower.indexOf("service") !== -1 || lower.indexOf("wartung") !== -1 || lower.indexOf("inspektion") !== -1) {
      result.cat = "Service";
    } else if (lower.indexOf("teil") !== -1 || lower.indexOf("öl") !== -1 || lower.indexOf("kette") !== -1 || lower.indexOf("reifen") !== -1) {
      result.cat = "Parts";
    } else {
      result.cat = "Fuel";
    }

    const customDesc = restText.replace(/(\d{1,4}(?:[.,]\d{1,2})?)\s*€?/g, "").trim();
    result.desc = customDesc || (result.cat === "Fuel" ? "Tanken" : "Eintrag per Bot");
  }

  return result;
}

function applyParsedEntry(parsed) {
  const props = PropertiesService.getScriptProperties();
  const state = getCurrentBikeState();
  let newKm = parseInt(state.currentKm || CONFIG.DEFAULT_KM, 10);

  if (parsed.km) {
    newKm = parsed.km;
  } else if (parsed.addKm) {
    newKm = newKm + parsed.addKm;
  }

  const diff = newKm - parseInt(state.currentKm || CONFIG.DEFAULT_KM, 10);
  state.currentKm = String(newKm);
  state.lastUpdated = parsed.date;
  props.setProperty("BIKE_STATE", JSON.stringify(state));

  const wroteDirectToFirestore = writeEntryDirectlyToFirestore(newKm, parsed);

  if (!wroteDirectToFirestore) {
    const queueRaw = props.getProperty("PENDING_REPLIES") || "[]";
    const queue = JSON.parse(queueRaw);
    queue.push({
      km: newKm,
      amount: parsed.amount,
      cat: parsed.cat,
      desc: parsed.desc,
      date: parsed.date
    });
    props.setProperty("PENDING_REPLIES", JSON.stringify(queue));
  }

  const summary = [];
  if (parsed.km || parsed.addKm) {
    summary.push(`KM-Stand: ${newKm.toLocaleString("de-DE")} km${diff > 0 ? ` (+${diff} km)` : ""}`);
  }
  if (parsed.amount) {
    summary.push(`Ausgabe: € ${parsed.amount.toFixed(2)} (${parsed.desc || "Tanken"})`);
  }
  return summary.join(" • ");
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
      const docUrl = `https://firestore.googleapis.com/v1/projects/${CONFIG.FIREBASE_PROJECT_ID}/databases/(default)/documents/users/${authData.uid}/data/technical_data`;
      const res = UrlFetchApp.fetch(docUrl, {
        method: "get",
        headers: { Authorization: "Bearer " + authData.idToken },
        muteHttpExceptions: true
      });
      if (res.getResponseCode() === 200) {
        const doc = JSON.parse(res.getContentText());
        const f = doc.fields || {};
        if (f.currentKm?.stringValue) saved.currentKm = f.currentKm.stringValue;
        if (f.nextServiceDue?.stringValue) saved.nextServiceDue = f.nextServiceDue.stringValue;
        if (f.licensePlate?.stringValue) saved.licensePlate = f.licensePlate.stringValue;
        if (f.lastUpdated?.stringValue) saved.lastUpdated = f.lastUpdated.stringValue;
        props.setProperty("BIKE_STATE", JSON.stringify(saved));
      }
    } catch (e) {
      Logger.log("Firestore Lese-Hinweis: " + e);
    }
  }

  return saved;
}

function writeEntryDirectlyToFirestore(newKm, parsed) {
  const authData = getFirebaseAuth();
  if (!authData) return false;

  try {
    const baseUrl = `https://firestore.googleapis.com/v1/projects/${CONFIG.FIREBASE_PROJECT_ID}/databases/(default)/documents/users/${authData.uid}`;

    const techUrl = `${baseUrl}/data/technical_data?updateMask.fieldPaths=currentKm&updateMask.fieldPaths=lastUpdated&updateMask.fieldPaths=lastUpdatedIso`;
    const techPayload = {
      fields: {
        currentKm: { stringValue: String(newKm) },
        lastUpdated: { stringValue: parsed.date },
        lastUpdatedIso: { stringValue: new Date().toISOString() }
      }
    };
    UrlFetchApp.fetch(techUrl, {
      method: "patch",
      contentType: "application/json",
      headers: { Authorization: "Bearer " + authData.idToken },
      payload: JSON.stringify(techPayload),
      muteHttpExceptions: true
    });

    if (parsed.amount && parsed.amount > 0) {
      const finUrl = `${baseUrl}/finance`;
      const finPayload = {
        fields: {
          date: { stringValue: parsed.date },
          desc: { stringValue: `${parsed.desc || "Tanken"} (${newKm} km)` },
          amount: { stringValue: parsed.amount.toFixed(2) },
          cat: { stringValue: parsed.cat || "Fuel" },
          km: { stringValue: String(newKm) }
        }
      };
      UrlFetchApp.fetch(finUrl, {
        method: "post",
        contentType: "application/json",
        headers: { Authorization: "Bearer " + authData.idToken },
        payload: JSON.stringify(finPayload),
        muteHttpExceptions: true
      });
    }
    return true;
  } catch (e) {
    Logger.log("Firestore Schreib-Fehler: " + e);
    return false;
  }
}

function getFirebaseAuth() {
  if (!CONFIG.FIREBASE_PASSWORD) return null;
  try {
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${CONFIG.FIREBASE_API_KEY}`;
    const res = UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({
        email: CONFIG.FIREBASE_EMAIL,
        password: CONFIG.FIREBASE_PASSWORD,
        returnSecureToken: true
      }),
      muteHttpExceptions: true
    });
    if (res.getResponseCode() === 200) {
      const data = JSON.parse(res.getContentText());
      return { idToken: data.idToken, uid: data.localId };
    }
  } catch (e) {
    Logger.log("Firebase Auth Fehler: " + e);
  }
  return null;
}

function doGet(e) {
  const action = e?.parameter?.action || "status";
  const props = PropertiesService.getScriptProperties();

  if (action === "getPendingReplies") {
    const replies = JSON.parse(props.getProperty("PENDING_REPLIES") || "[]");
    return ContentService.createTextOutput(JSON.stringify({ replies }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService.createTextOutput(JSON.stringify(getCurrentBikeState()))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const props = PropertiesService.getScriptProperties();
  try {
    const body = JSON.parse(e.postData.contents || "{}");
    if (body.action === "ackReplies") {
      props.setProperty("PENDING_REPLIES", "[]");
    }
    if (body.currentKm) {
      const state = getCurrentBikeState();
      state.currentKm = String(body.currentKm);
      if (body.nextServiceDue) state.nextServiceDue = String(body.nextServiceDue);
      if (body.lastUpdated) state.lastUpdated = String(body.lastUpdated);
      props.setProperty("BIKE_STATE", JSON.stringify(state));
    }
    return ContentService.createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
