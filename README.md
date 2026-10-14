# Shisha Connect 🔥

Mobile App für iPhone und Android, mit der eine private Freundesgruppe gemeinsame Besuche in Shisha-Bars organisiert:

**App öffnen → Bar auswählen → Datum & Uhrzeit festlegen → Freunde benachrichtigen → Zusagen sehen.**

## Technische Lösung

| Teil | Technik | Warum |
|---|---|---|
| App (iOS + Android) | **Expo / React Native** (SDK 57, Expo Router, TypeScript) | Eine Codebasis, echte native App, echte Push-Nachrichten auf beiden Plattformen |
| Backend | **Supabase** (Postgres, Auth, Realtime, Storage, Edge Functions) | Anmeldung, gemeinsame Daten, Live-Updates ohne eigenen Server |
| Push | **Expo Push Service** → APNs (Apple) / FCM (Google) | Zustellung auch bei geschlossener App |
| Bars & Karte | **OpenStreetMap** (Overpass-API für Bars, Nominatim für Ortssuche, Leaflet-Karte) | Echte Standortdaten, ohne API-Schlüssel und kostenlos |

Bewusst **keine PWA**: Auf dem iPhone funktionieren Web-Push-Nachrichten nur, wenn die Seite zum Home-Bildschirm hinzugefügt wurde (ab iOS 16.4), und sie sind weniger zuverlässig. Als native App kommen Einladungen wie bei WhatsApp an.

### So hängt alles zusammen

```
 App (iPhone/Android)                Supabase                              Apple / Google
 ───────────────────                 ────────                              ──────────────
 Treffen erstellen  ── RPC ──▶  create_meetup() (Postgres, RLS)
                    ── POST ─▶  Edge Function "notify" ──▶ Expo Push API ──▶ APNs / FCM ──▶ Handys
                                   └─ schreibt Mitteilungen in die In-App-Übersicht
 Zusage / Stimme    ── upsert ─▶ rsvps / option_votes ── Realtime ──▶ alle offenen Apps aktualisieren sich
 pg_cron (alle 5 Min.) ───────▶  Edge Function "send-reminders" ──▶ Erinnerung 1 Std. vorher
```

## Funktionen

- **Private Gruppe:** Registrierung mit E-Mail, Profil mit Name und optionalem Foto. Beitritt per 6-stelligem Gruppencode oder Einladungslink (`shishaconnect://join/CODE`). Treffen, Teilnehmende und Bars sind per Row Level Security nur für Gruppenmitglieder sichtbar. Mehrere Gruppen pro Person möglich.
- **Bars in der Nähe:** Liste und Karte, Standort (freiwillig) oder manuell eingegebener Ort, einstellbarer Radius (1–25 km), Name, Adresse, Entfernung, Öffnungszeiten (falls in OpenStreetMap vorhanden), Navigation (Apple Karten / Google Maps), Favoriten, fehlende Bars für die Gruppe ergänzen. **Beispieldaten** erscheinen nur, wenn OpenStreetMap nicht erreichbar ist, und sind deutlich als „BEISPIELDATEN“ markiert.
- **Treffen erstellen** in 3 Schritten: Bar → Zeit („Jetzt“, „Heute Abend“, „Datum und Uhrzeit wählen“) → optionale Nachricht. Alternativ **Abstimmung** mit bis zu 3 Bars × 4 Uhrzeiten; der Ersteller legt danach die finale Option fest.
- **Push-Nachrichten**, z. B. „Hannes lädt ein: Heute um 20:00 Uhr in der Lounge Sieben. Bist du dabei?“. Antippen öffnet direkt das Treffen. Auch bei Änderungen, Entscheidung einer Abstimmung, Absage und optional 1 Stunde vor Beginn. Steuerbar im Profil, inkl. „Test-Push an mich senden“.
- **In-App-Mitteilungen** (Glocke auf der Startseite): Jede Einladung wird zusätzlich gespeichert, auch wenn Push ausgeschaltet ist. Ist die Berechtigung verweigert, zeigt die Startseite einen Hinweis mit Link zu den Einstellungen.
- **Teilnahme:** „Dabei“, „Vielleicht“, „Keine Zeit“, jederzeit änderbar. Übersicht, wer zugesagt hat und wer noch nicht geantwortet hat. Zusagen und Stimmen aktualisieren sich live (Supabase Realtime).
- **Ersteller** kann Bar oder Uhrzeit ändern oder das Treffen absagen.
- **Keine Reservierung:** Eine Einladung löst nie eine Reservierung bei der Bar aus (darauf weist die App auch hin).

## Projektstruktur

```
src/app/                 Screens (Expo Router)
  (auth)/                Anmelden, Registrieren
  (tabs)/                Treffen (Start), Bars, Gruppe, Profil
  meetup/new.tsx         Assistent „Treffen erstellen“
  meetup/[id].tsx        Treffen-Details, Zusagen, Abstimmung
  meetup/edit/[id].tsx   Bar/Uhrzeit ändern
  notifications.tsx      In-App-Mitteilungen
  join/[code].tsx        Ziel des Einladungslinks
src/lib/                 API, Push, Bar-Suche (OpenStreetMap), Formatierung, Design
src/providers/           Anmeldung, Gruppen, Bar-Suche (React Context)
supabase/migrations/     Datenbankschema inkl. Sicherheitsregeln (RLS) und Funktionen
supabase/functions/      Edge Functions: notify (Push bei Treffen), send-reminders (Erinnerungen)
supabase/cron.sql        Zeitplan für Erinnerungen
```

---

## Einrichtung (einmalig, ca. 45–60 Minuten)

Du brauchst: einen Computer mit [Node.js 22+](https://nodejs.org), ein kostenloses [Supabase](https://supabase.com)-Konto, ein kostenloses [Expo](https://expo.dev)-Konto, ein kostenloses [Firebase](https://console.firebase.google.com)-Konto (für Android-Push) und für iPhones eine **Apple-Developer-Mitgliedschaft** (99 USD/Jahr; ohne sie lassen sich auf iPhones keine Apps mit Push installieren).

```bash
git clone <dieses Repository> && cd Shisha-Connect
npm install
```

### 1. Supabase (Backend)

1. Auf supabase.com ein neues Projekt anlegen (Region z. B. Frankfurt oder Zürich).
2. Datenbank-Schema einspielen, **entweder**
   - im Dashboard unter *SQL Editor* den Inhalt von `supabase/migrations/20261014000000_init.sql` einfügen und ausführen, **oder**
   - per CLI: `npx supabase login`, `npx supabase link --project-ref <PROJECT_REF>`, `npx supabase db push`.
3. *Authentication → Sign In / Providers → Email*: aktiviert lassen und **„Confirm email“ ausschalten**. Dann ist man direkt nach der Registrierung angemeldet, ohne Bestätigungs-E-Mail. (Die App unterstützt auch den Modus mit Bestätigung, falls du das später änderst.)
4. `.env` anlegen (Werte unter *Project Settings → API*):
   ```bash
   cp .env.example .env
   # EXPO_PUBLIC_SUPABASE_URL=https://<PROJECT_REF>.supabase.co
   # EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon- bzw. publishable-Key>
   ```
5. Edge Functions deployen und Secrets setzen:
   ```bash
   npx supabase functions deploy notify
   npx supabase functions deploy send-reminders
   npx supabase secrets set CRON_SECRET=<langes-zufälliges-passwort> APP_TIMEZONE=Europe/Zurich
   ```
   Optional für mehr Sicherheit: In expo.dev unter *Account → Access Tokens* einen Token erstellen, in den Projekt-Einstellungen „Enhanced Security for Push Notifications“ aktivieren und `npx supabase secrets set EXPO_ACCESS_TOKEN=<token>` setzen.
6. Erinnerungen aktivieren: `supabase/cron.sql` öffnen, `<PROJECT_REF>` und `<CRON_SECRET>` ersetzen und im *SQL Editor* ausführen. Ab dann läuft alle 5 Minuten die Erinnerungs-Funktion.

### 2. Expo / EAS (App-Build)

```bash
npx eas-cli@latest login
npx eas-cli@latest init          # legt das Expo-Projekt an und gibt die projectId aus
```
Die angezeigte `projectId` in `app.json` unter `extra.eas.projectId` eintragen (die `.env` wird nicht mit in den Cloud-Build hochgeladen). Ohne sie kann die App keinen Push-Token abrufen.

Die Supabase-Werte müssen auch beim Cloud-Build bekannt sein:
```bash
npx eas-cli@latest env:create --name EXPO_PUBLIC_SUPABASE_URL --value https://<PROJECT_REF>.supabase.co --environment development --environment preview --environment production --visibility plaintext
npx eas-cli@latest env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <KEY> --environment development --environment preview --environment production --visibility plaintext
```

### 3. Push für Android (Firebase Cloud Messaging) – nur nötig, wenn jemand ein Android-Handy hat

1. In der [Firebase Console](https://console.firebase.google.com) ein Projekt anlegen → *Android-App hinzufügen* mit Paketname **`ch.shishaconnect.app`**.
2. `google-services.json` herunterladen und in den Projektordner legen (wird nicht ins Git eingecheckt). Für Cloud-Builds zusätzlich als Datei-Variable hinterlegen:
   `npx eas-cli@latest env:create --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json --environment development --environment preview --environment production`
3. Firebase → *Projekteinstellungen → Dienstkonten → Neuen privaten Schlüssel generieren* (JSON).
4. `npx eas-cli@latest credentials` → Android → *Google Service Account* → *Manage your Google Service Account Key for Push Notifications (FCM V1)* → JSON hochladen.

### 4. Push für iPhone (Apple Push Notification service)

1. Apple-Developer-Mitgliedschaft aktivieren.
2. Beim ersten iOS-Build (`npx eas-cli@latest build --platform ios`) mit deiner Apple-ID anmelden und die Frage *„Generate a new Apple Push Notifications service key?“* mit **Ja** beantworten. EAS richtet Zertifikate, Bundle-ID (`ch.shishaconnect.app`) und Push-Key automatisch ein.

### 5. App bauen und an Freunde verteilen

| Ziel | Befehl | Installation |
|---|---|---|
| **iPhone für Freunde** (empfohlen) | `npx eas-cli@latest build --profile production --platform ios` und danach `npx eas-cli@latest submit --platform ios` | In [App Store Connect](https://appstoreconnect.apple.com) unter *TestFlight* die Freunde per E-Mail als Tester einladen → sie installieren die App „TestFlight“ aus dem App Store → darüber Shisha Connect installieren. Neue Versionen erscheinen dort automatisch. |
| Android für Freunde | `npx eas-cli@latest build --profile preview --platform android` | Link/QR-Code aus EAS öffnen → APK installieren („Installation aus unbekannten Quellen“ erlauben) |
| iPhone ohne TestFlight | `npx eas-cli@latest device:create` (jedes iPhone registrieren), dann `build --profile preview --platform ios` | Link aus EAS öffnen (nur registrierte Geräte) |
| Entwicklung | `npx eas-cli@latest build --profile development --platform android` (bzw. ios), dann `npx expo start` | Development-Build installieren, Code lädt live vom Computer |

> **Wichtig:** Push-Nachrichten funktionieren nur in einem echten Build auf einem echten Gerät, **nicht** in Expo Go und nicht im iOS-Simulator.

### 6. Berechtigungen auf den Geräten

- **iPhone:** Beim ersten Öffnen der Startseite erklärt die App, wofür Mitteilungen gebraucht werden, und fragt danach die Systemberechtigung ab. Falls abgelehnt: *Einstellungen → Mitteilungen → Shisha Connect → Mitteilungen erlauben* (die App bietet einen direkten Knopf dafür an).
- **Android 13+:** Gleicher Ablauf (Berechtigung „Benachrichtigungen“). Falls abgelehnt: *Einstellungen → Apps → Shisha Connect → Benachrichtigungen*. Der Kanal heisst „Treffen & Erinnerungen“. Bei manchen Herstellern (Xiaomi, Huawei, Samsung) zusätzlich den Energiesparmodus für die App deaktivieren, damit Nachrichten sofort ankommen.
- **Standort:** Wird nur abgefragt, wenn du in „Bars“ auf den Standort-Knopf tippst („Beim Verwenden der App“). Alternativ einen Ort eingeben.
- **Fotos:** Nur beim Wählen eines Profilbilds.

### 7. Testen, ob alles funktioniert

1. App auf zwei Handys installieren, zwei Konten registrieren.
2. Handy A: Gruppe gründen → *Gruppe → Freunde einladen*. Handy B: mit dem Code beitreten.
3. Auf beiden: Benachrichtigungen erlauben, *Profil → Test-Push an mich senden*.
4. Handy B: App schliessen. Handy A: *Treffen erstellen* → Bar → „Heute Abend“ → *Freunde einladen*.
5. Handy B erhält die Push-Nachricht → antippen → Treffen öffnet sich → „Dabei“. Handy A sieht die Zusage sofort.

**Fehlersuche:** Supabase-Dashboard → *Edge Functions → notify → Logs*. Tickets und Zustellstatus zeigt das Expo-Dashboard unter *Push Notifications*.

---

## Datenquellen und Datenschutz

- Bars stammen live aus **OpenStreetMap** (Tag `amenity=hookah_lounge`, `shisha=yes`, sowie Bars/Cafés mit „Shisha/Hookah“ im Namen). Die Abdeckung ist je nach Stadt unterschiedlich; fehlende Bars ergänzt die Gruppe selbst (sie sind dann für alle in der Gruppe sichtbar). Die öffentlichen OSM-Server sind für kleine Gruppen gedacht; bei vielen Nutzer:innen sollte ein eigener bzw. kommerzieller Overpass-/Geocoding-Dienst verwendet werden (`src/lib/bars.ts`).
- Der Standort verlässt das Handy nur als Suchanfrage an OpenStreetMap und wird nicht in der Datenbank gespeichert.
- Alle Tabellen sind mit Row Level Security geschützt: Nur Gruppenmitglieder sehen Treffen, Teilnehmende, Stimmen und Gruppen-Bars; nur der Ersteller kann ein Treffen ändern, entscheiden oder absagen; Push-Tokens sind nur für die eigene Person sichtbar.

## Entwicklung

```bash
npm run typecheck     # TypeScript
npm run lint          # ESLint (Expo-Konfiguration)
npx expo start        # Dev-Server (mit installiertem Development-Build)
npx expo start --web  # Schnelle Vorschau der Oberfläche im Browser (ohne Push-Nachrichten)
```

Die Browser-Vorschau braucht ebenfalls die `.env` mit den Supabase-Werten. Push, Erinnerungen und Standort-Feinheiten gibt es nur in der echten App.

## Bekannte Grenzen / mögliche nächste Schritte

- Einladungslinks verwenden das App-Schema `shishaconnect://`. Manche Messenger machen solche Links nicht anklickbar – der Gruppencode steht deshalb immer mit in der Einladung. Für klickbare `https://`-Links bräuchte es eine eigene Domain (Universal Links / App Links).
- Anmeldung aktuell per E-Mail und Passwort; „Mit Apple/Google anmelden“ lässt sich in Supabase ergänzen.
- App-Icon und Splash-Screen sind noch die Expo-Platzhalter (`assets/`).
