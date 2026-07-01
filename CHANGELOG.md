# Changelog

## 3.10 – Build 20260701-006

- Einstellungen neu strukturiert in Daten, Verwaltung, Information und Entwicklung.
- Backup-Export als vollständiges Ritter-Kasse-Backupformat mit App, Schema, Version, Build, Zeitstempel und Daten ergänzt.
- Backup-Import mit JSON-Prüfung, Strukturvalidierung, Zusammenfassung und Sicherheitsabfrage ergänzt.
- Backup-Test zur internen Validierung des aktuellen Datenbestands ergänzt.
- Personen-Seite als vorbereitete Anzeige für die spätere Cloud/Admin-Version ergänzt.
- Lokale Daten löschen als Entwicklungsfunktion mit zweistufiger Warnung ergänzt.
- Versionsnummern, Cache-Buster und Service-Worker-Cache konsistent aktualisiert.

## 3.9 – Build 20260701-005

- Bereichs-Piktogramme in die obere Seitenleiste verschoben.
- Piktogramme erscheinen jetzt auch auf Unterseiten:
  - Start: Burg
  - Unternehmungen und Unterseiten: gekreuzte Schwerter
  - Salden und Ausgleichszahlung: Geldfluss-Symbol
  - Einstellungen: Zahnrad
- Versionsnummern, Cache-Buster und Service-Worker-Cache konsistent aktualisiert.

## 3.8 – Build 20260701-004

- Dezente Seiten-Piktogramme für die Hauptbereiche ergänzt:
  - Start: Burg im Titelbereich
  - Unternehmungen: gekreuzte Schwerter
  - Salden: Geldfluss-Symbol
  - Einstellungen: Zahnrad
- Versionsnummern, Cache-Buster und Service-Worker-Cache konsistent aktualisiert.

## 3.7 – Build 20260701-003

- Startseite vereinfacht: Dort werden nur noch die aktuellen Salden insgesamt angezeigt.
- Die Detailanzeige „Wer zahlt wem?“ bleibt dem Menüpunkt „Salden“ vorbehalten.
- Rück-Button in der Detailansicht einzelner Unternehmungen ergänzt.
- Versionsnummern, Cache-Buster und Service-Worker-Cache konsistent aktualisiert.

## 3.6 – Build 20260701-002

- Ausgabeformular fachlich klarer formuliert:
  - „Abweichende Beteiligte für diesen Posten“
  - „Beteiligte dieses Postens“
- Hinweis ergänzt: Die zahlende Person muss an diesem Posten bzw. dieser Aktivität nicht beteiligt sein.
- Versionsnummern, Cache-Buster und Service-Worker-Cache konsistent aktualisiert.

## 3.5 – Build 20260701-001

- Helleres Ritterhelm-/Schatztruhen-Icon als offizielles App-Icon übernommen.
- Burg-Emoji im Kopfbereich vergrößert und rechts neben den Titel gesetzt.
- Restcent-Hinweis im Ausgabeformular wird jetzt live aktualisiert, wenn Betrag oder Teilnehmer geändert werden.
- Datumsfelder aus Version 3.2.1 beibehalten.
- Versionsnummern, Cache-Buster und Service-Worker-Cache konsistent aktualisiert.

## 3.2 – Build 20260630-003

- Angefügtes Ritterhelm-/Schatztruhen-Icon als offizielles App-Icon übernommen.
- `apple-touch-icon.png` für iPhone-Homescreen ergänzt.
- `icon-192.png` und `icon-512.png` aus demselben Icon erzeugt.
- `index.html` um Apple-Homescreen-Metatags ergänzt bzw. aktualisiert.
- Datumsfelder auf kleinen Displays schmaler und robuster gemacht.
- Versionsnummer und Build aktualisiert.

## 3.0.1 Beta – Build 20260629-004

- Lokalen Test robuster gemacht.
- `dirtyModal` ist jetzt inline versteckt, falls `style.css` nicht geladen wird.
- Hinweis ergänzt, wenn `app.js`/`style.css` fehlen.
- Service Worker wird lokal über `file://` nicht registriert.

## 3.0 Beta

- Projektstruktur modernisiert.
- App in mehrere Dateien aufgeteilt.
- PWA-Grundstruktur vorbereitet.
