export function generateBotScriptWithToken({ refreshToken, uid, email, currentKm, nextServiceDue, licensePlate }) {
  const safeToken = refreshToken || '';
  const safeUid = uid || '';
  const safeEmail = email || 'backhaus.johannes@gmail.com';
  const safeKm = parseInt(String(currentKm || '38865').replace(/\D/g, ''), 10) || 38865;
  const safeService = parseInt(String(nextServiceDue || '52000').replace(/\D/g, ''), 10) || 52000;
  const safePlate = licensePlate || 'M-N 594';

  return `/**
 * ============================================================================
 * 🏍️ MOPPEDTAGEBUCH – 2-TAGE E-MAIL-BOT & ANTWORT-ASSISTENT (iPhone & Mac)
 * ============================================================================
 * ✅ AUTOMATISCH MIT DEINEM MOPPEDTAGEBUCH-ACCOUNT VERKNÜPFT!
 * Du brauchst KEIN Passwort einzutragen – dein persönlicher Zugangsschlüssel
 * (Refresh-Token) ist unten bereits fertig hinterlegt.
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
  REMINDER_HOUR: 19, // 19:00 Uhr abends alle 2 Tage

  FIREBASE_PROJECT_ID: "moppedtagebuch",
  FIREBASE_API_KEY: "AIzaSyCU4b7reiVNHjqvuEM7cXSLGilCmZ5YYlM",
  FIREBASE_UID: "${safeUid}",
  FIREBASE_REFRESH_TOKEN: "${safeToken}"
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

  // 2. Jede Minute prüfen, ob du auf eine Bot-Mail geantwortet hast
  ScriptApp.newTrigger("checkMoppedEmailReplies")
    .timeBased()
    .everyMinutes(1)
    .create();

  const auth = getFirebaseAuth();
  if (auth) {
    Logger.log("✅ Firebase-Datenbank erfolgreich ohne Passwort verbunden (UID: " + auth.uid + ")!");
  } else {
    Logger.log("❌ Verbindung fehlgeschlagen – bitte den Bot-Code erneut aus der Moppedtagebuch-App kopieren.");
    return;
  }

  // Zuerst die allerneueste E-Mail-Antwort auswerten und direkt in Firestore schreiben
  checkMoppedEmailReplies();

  // Danach den aktuellen Stand aus Firestore holen und im Protokoll anzeigen
  const currentState = getCurrentBikeState();
  Logger.log("📊 Aktueller KM-Stand in der Cloud-Datenbank: " + currentState.currentKm + " km");

  // Neue Erinnerungs-Mail mit dem aktuellen Stand senden
  sendTwoDayMoppedReminder();
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

  const subject = \`🏍️ Mopped-Check (\${dateStr}): \${CONFIG.BIKE_NAME} steht bei \${currentKm.toLocaleString("de-DE")} km – Update?\`;

  const quickOpenUrl = \`\${CONFIG.APP_URL}/?quick=1\`;
  const add100Url = \`\${CONFIG.APP_URL}/?quick=1&addKm=100&autosave=1\`;
  const add200Url = \`\${CONFIG.APP_URL}/?quick=1&addKm=200&autosave=1\`;
  const add350Url = \`\${CONFIG.APP_URL}/?quick=1&addKm=350&autosave=1\`;

  const htmlBody = \`
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;background:#121212;color:#ffffff;border-radius:20px;overflow:hidden;border:1px solid rgba(105,190,40,0.35);">
      <div style="background:linear-gradient(135deg,#1b3314,#121212);padding:22px 20px;text-align:center;border-bottom:1px solid rgba(105,190,40,0.25);">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.2px;color:#69BE28;font-weight:700;">🏍️ Moppedtagebuch • 2-Tage-Check</div>
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
          <div style="font-size:14px;font-weight:700;color:#69BE28;margin-bottom:6px;">💬 Weg 1: Einfach auf diese Mail antworten!</div>
          <div style="font-size:13px;color:#d0d0d0;line-height:1.5;">
            Antworte direkt mit einer Zeile auf diese E-Mail:<br>
            • <code style="color:#69BE28;font-weight:700;">\${currentKm + 180}</code> → setzt den neuen KM-Stand<br>
            • <code style="color:#69BE28;font-weight:700;">+180</code> → addiert 180 km zum aktuellen Stand<br>
            • <code style="color:#69BE28;font-weight:700;">\${currentKm + 220}, 28.50 Tanken</code> → KM + Tankbeleg speichern
          </div>
        </div>

        <div style="font-size:14px;font-weight:700;color:#ffffff;margin-bottom:10px;text-align:center;">⚡ Weg 2: 1-Klick Schnelleingabe (iPhone & Mac)</div>

        <div style="text-align:center;margin-bottom:12px;">
          <a href="\${add100Url}" style="display:inline-block;background:#1e2d19;color:#69BE28;border:1px solid #69BE28;text-decoration:none;padding:10px 14px;border-radius:12px;font-weight:700;font-size:13px;margin:4px;">+100 km</a>
          <a href="\${add200Url}" style="display:inline-block;background:#1e2d19;color:#69BE28;border:1px solid #69BE28;text-decoration:none;padding:10px 14px;border-radius:12px;font-weight:700;font-size:13px;margin:4px;">+200 km</a>
          <a href="\${add350Url}" style="display:inline-block;background:#1e2d19;color:#69BE28;border:1px solid #69BE28;text-decoration:none;padding:10px 14px;border-radius:12px;font-weight:700;font-size:13px;margin:4px;">+350 km</a>
        </div>

        <div style="text-align:center;margin-top:14px;">
          <a href="\${quickOpenUrl}" style="display:block;background:#69BE28;color:#000000;text-decoration:none;padding:13px 20px;border-radius:99px;font-weight:800;font-size:14px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">⚡ Schnell-Check & Tanken öffnen</a>
        </div>

        <div style="font-size:11px;color:#777;text-align:center;margin-top:14px;">
          Letztes Update: \${state.lastUpdated || "unbekannt"} • Erinnerungs-Intervall: alle 2 Tage
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
        firstLine.indexOf("Moppedtagebuch • 2-Tage-Check") !== -1 ||
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

  const lastAppliedId = props.getProperty("LAST_APPLIED_REPLY_ID") || "";
  const liveState = getCurrentBikeState();

  const kmAlreadyInCloud = newest.parsed.km && String(liveState.currentKm) === String(newest.parsed.km);
  if (newest.msgId === lastAppliedId && (kmAlreadyInCloud || !newest.parsed.km)) {
    Logger.log("ℹ️ Neueste Antwort ('" + newest.firstLine + "') ist bereits in der Cloud aktiv (" + liveState.currentKm + " km).");
    return;
  }

  Logger.log("📩 Wende neueste E-Mail-Antwort an: '" + newest.firstLine + "' vom " + newest.msg.getDate());
  const res = applyParsedEntry(newest.parsed, liveState);

  if (res.wroteDirectToFirestore) {
    newest.msg.markRead();
    props.setProperty("LAST_APPLIED_REPLY_ID", newest.msgId);

    MailApp.sendEmail({
      to: CONFIG.RECIPIENT_EMAIL,
      name: "Mopped-Bot",
      subject: "✅ Moppedtagebuch aktualisiert: " + res.summary,
      htmlBody: \`
        <div style="font-family:-apple-system,sans-serif;padding:18px;background:#121212;color:#fff;border-radius:16px;border:1px solid #69BE28;max-width:460px;">
          <h3 style="margin:0 0 8px 0;color:#69BE28;">✅ Direkt im Moppedtagebuch gespeichert!</h3>
          <p style="margin:0 0 14px 0;font-size:15px;">\${res.summary}</p>
          <a href="\${CONFIG.APP_URL}" style="display:inline-block;background:#69BE28;color:#000;padding:10px 16px;border-radius:99px;text-decoration:none;font-weight:700;">Im Moppedtagebuch öffnen →</a>
        </div>
      \`
    });
  }
}

function parseReplyLine(line) {
  const normalized = line.replace(/(\\d{1,3})\\.(\\d{3})\\b/g, "$1$2").trim();
  const result = {
    km: null,
    addKm: null,
    amount: null,
    cat: "Fuel",
    desc: "",
    date: Utilities.formatDate(new Date(), "Europe/Berlin", "yyyy-MM-dd")
  };

  const addMatch = normalized.match(/^\\+\\s*(\\d{1,5})\\b/);
  if (addMatch) {
    result.addKm = parseInt(addMatch[1], 10);
  }

  const parts = normalized.split(/[,;]/).map(s => s.trim()).filter(Boolean);

  if (parts.length >= 1 && !result.addKm) {
    const kmMatch = parts[0].match(/\\b(\\d{4,6})\\b/);
    if (kmMatch) {
      result.km = parseInt(kmMatch[1], 10);
    }
  }

  const restText = parts.length > 1
    ? parts.slice(1).join(" ")
    : (result.km || result.addKm ? normalized.replace(/^\\+?\\d+\\s*(km)?/i, "").trim() : normalized);

  if (restText) {
    const amountMatch = restText.match(/(\\d{1,4}(?:[.,]\\d{1,2})?)\\s*€?/);
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

    const customDesc = restText.replace(/(\\d{1,4}(?:[.,]\\d{1,2})?)\\s*€?/g, "").trim();
    result.desc = customDesc || (result.cat === "Fuel" ? "Tanken" : "Eintrag per Bot");
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

  const diff = newKm - oldKm;
  const wroteDirectToFirestore = writeEntryDirectlyToFirestore(newKm, parsed);

  if (wroteDirectToFirestore) {
    state.currentKm = String(newKm);
    state.lastUpdated = parsed.date;
    props.setProperty("BIKE_STATE", JSON.stringify(state));
  }

  const summary = [];
  if (parsed.km || parsed.addKm) {
    summary.push(\`KM-Stand: \${newKm.toLocaleString("de-DE")} km\${diff > 0 ? \` (+\${diff} km)\` : ""}\`);
  }
  if (parsed.amount) {
    summary.push(\`Ausgabe: € \${parsed.amount.toFixed(2)} (\${parsed.desc || "Tanken"})\`);
  }
  return {
    summary: summary.join(" • "),
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

function writeEntryDirectlyToFirestore(newKm, parsed) {
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
    Logger.log("✅ Firestore KM-Stand erfolgreich auf " + newKm + " km gesetzt!");

    if (parsed.amount && parsed.amount > 0) {
      const finUrl = \`\${baseUrl}/finance\`;
      const finPayload = {
        fields: {
          date: { stringValue: parsed.date },
          desc: { stringValue: \`\${parsed.desc || "Tanken"} (\${newKm} km)\` },
          amount: { stringValue: parsed.amount.toFixed(2) },
          cat: { stringValue: parsed.cat || "Fuel" },
          km: { stringValue: String(newKm) }
        }
      };
      UrlFetchApp.fetch(finUrl, {
        method: "post",
        contentType: "application/json",
        headers: {
          "Authorization": "Bearer " + authData.idToken,
          "Referer": CONFIG.APP_URL + "/"
        },
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
`;
}
