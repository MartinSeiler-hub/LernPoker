# LernPoker – Offline-MTT-Preflop-Trainer

Die mobile Lernapp basiert auf einem vereinfachten Chip-EV-Modell mit den drei Turnierprofilen aus den Screenshots des Nutzers (8-Max mit 10.000 Startchips / 8-Min.-Blinds; 6-Max mit 10.000 Startchips / 5-Min.-Blinds und denselben Antes je Spieler; 8-Max mit 8.000 Startchips / 5-Min.-Blinds).

**Funktionen:** Wahl der Turniersituation und eigener Karten; 169-Hand-Preflop-Matrix; Fold, Call, Raise, 3-Bet, All-in; Quiz mit lokaler Statistik; ICM-Rechner für 2–10 verbleibende Spieler; Offline-Cache.

**Modellgrenzen:** Die Aktionsentscheidungen sind keine bewiesenen GTO-Ranges. Gegner-Ranges und Equity-Realisierung sind Annahmen; das zugrunde liegende Monte-Carlo-Showdown-Modell löst keine vollständigen Postflop-Spielbäume. ICM liefert nur bei vollständig bekannten Stacks und Auszahlungen der tatsächlich verbleibenden maximal zehn Spieler eine vollständige Modellrechnung. Die Anwendung ist für das Lernen außerhalb laufender Online-Partien gedacht (keine Real-Time Assistance).

## GitHub Pages aktivieren

1. Repository → **Settings** → **Pages**.
2. Bei **Build and deployment** → **Source: Deploy from a branch**.
3. **Branch: main**, **Folder: /(root)**, dann **Save**.
4. Danach: https://martinseiler-hub.github.io/LernPoker/
5. Android: In Chrome öffnen, Menü → „App installieren“ oder „Zum Startbildschirm hinzufügen“, App einmal vollständig laden, Offline-Test im Flugmodus.

Ohne GitHub-Pages-Aktivierung ist der Quellcode zwar im Repository, aber die App-URL noch nicht erreichbar. Die Daten werden lokal verarbeitet; keine Pokerplattform-Schnittstelle.

## Bedienung auf dem Handy (Version 5)

- Beim ersten Start einmal Turnierprofil A, B oder C wählen; die Auswahl wird gespeichert.
- **Position direkt antippen:** UTG, HJ, CO, BTN, SB, BB usw. Kein Dropdown mehr für die eigene Position.
- **Stack in Zehntel-BB:** Nur Ziffern eingeben. Die letzte Stelle steht automatisch hinter dem Komma: `154` = 15,4 BB, `800` = 80,0 BB. Die App zeigt den formatierten Wert daneben und rechnet intern in Chips um.
- **Starthand mit vier Farbbuttons:** Für Karte 1 und Karte 2 jeweils Rang wählen und dann eine der vier Farben `♠ ♥ ♦ ♣` antippen. Die aktive Karte ist hervorgehoben; nach der Farbwahl für Karte 1 wird Karte 2 ausgewählt. Die App bildet daraus die 169 Starthandklassen (Paar, suited, offsuit), verhindert physisch doppelte Karten und synchronisiert die Matrix.
- **Gegneraktionen direkt und ohne Ausklappen:** Unter `Vor meiner Entscheidung` erscheinen alle Positionen vor Hero als ständig sichtbare Zeilen mit den Tasten `Fold`, `Call`, `Raise`, `All-in`. `Nach meinem Raise` zeigt dieselben direkten Tasten für die Spieler hinter Hero (Raise wird 3-Bet). Sobald eine andere Aktion als Fold gewählt wurde, erscheinen direkt in der Zeile die Eingabefelder für Gesamteinsatz und Stack in Zehntel-BB. `Alle folden` setzt die Aktionen auf Fold zurück und wechselt in die Eröffnungssituation. Gibt es noch keine Aktion vor Hero, ist der Fall automatisch RFI – eine separate Umschaltung ist nicht mehr nötig.
- **Modellgrenze:** Die bisherige mathematische Engine wertet nur einen aktiven Heads-up-Gegner aus. Für mehrere eingestiegene Spieler, Limp-Pots, 3-Bet-All-ins nach eigenem Open und komplexere Raise-Folgen zeigt die App ausdrücklich **keine verlässliche Empfehlung**, statt solche Szenarien fälschlich als Heads-up zu bewerten. Das reine Erfassen dieser Situationen ist bereits möglich.
- Blindlevel, Spielerzahl, ICM und Gegnermodell befinden sich weiterhin unter **Weitere Angaben**.
- Über `⚙ Turnierformat ändern` lässt sich das Profil später wechseln.
- Das Quiz ist deaktiviert, wenn das eingegebene Szenario noch nicht durch das Modell unterstützt wird.

**V4 Lernansicht:** Die allgemeinen Modellhinweise und technischen Warnungen sind während des Lernens ausgeblendet und über `Weitere Angaben → Methodik und Nutzung` optional einsehbar. Bei Situationen, für die keine zuverlässige Empfehlung möglich ist, bleibt eine knappe Fehlermeldung sichtbar.

**Hinweis zur echten Pokerpraxis:** Bei Online-Poker gelten gegebenenfalls Regeln gegen Real-Time Assistance. Die App ist als Lern- und Nachanalysewerkzeug außerhalb laufender Hände gedacht.


## Mehrspieler-Strategie (V6 – experimentelles Chip-EV-Modell)

Die Positionszeilen fließen in die Empfehlung ein. Das neue Modul \`multiway-engine.js\` wertet je nach Aktion **alle vor Hero eingestiegenen Gegner**, deren Position, Raise-/Call-/All-in-Betrag und Stack aus. Unterstützt sind u. a.:

- Zwei oder mehr Limper vor Hero: Check (im BB), Overlimp/Call, Isolation-Raise, ggf. All-in.
- Raise plus ein oder mehrere Calls: Fold/Call/Squeeze-3-Bet/All-in.
- Mehrere Raises oder All-ins vor Hero: Call/Reraise/All-in soweit anhand vorhandener Einsätze möglich.
- Nach eigenem Open: 3-Bet plus Caller, Entscheidung über Fold, Call, 4-Bet oder All-in.

**Pot und Sidepots:** Bereits gezahlte Antes/Blinds, vollständige bekannte Einsatzhöhen, Callkosten und Pot-Layer bei verschiedenen All-in-Stacks werden algebraisch berechnet. Der nachfolgenden Entscheidung noch nicht vorausgegangene Reaktionen (z. B. Spieler hinter Hero) werden probabilistisch modelliert.

**Modellannahmen:** Gegner-Ranges stammen aus positionsabhängigen Heuristiken und der gewählten Tight/Normal/Loose-Option. Multiway-Equity wird näherungsweise als Produkt von Heads-up-Equities geschätzt (keine Karte-zu-Karte-korrelierte 3+-Spieler-Simulation). Folgeaktionen (Call/Fold nach Hero-Raise) werden als unabhängig angenommen. Die Postflop-Equity-Realisierung wird pauschal geschätzt; Interaktion zwischen Sidepots und Aktionen, weitere Raise-Runden, Bounties und dynamische ICM-Effekte sind nicht vollständig gelöst. **Keine exakten GTO-Ranges, kein garantierter positiver Erwartungswert.**

**Was noch nicht automatisch einfließt:** Entries, Garantie und Preisgeldstaffel. Sie betreffen hauptsächlich das getrennte ICM-/ROI-Modell. Für den reinen Chip-EV benötigt die App die individuellen Spieler-Stacks, Positionen, Blinds, Antes, Aktionen und Einsatzhöhen.

Die Engine liefert für jede Lage eine 169-Hand-Matrix mit einer **modellierten Entscheidung und geschätzten Chip-EV-Werten**. RFI ohne eingestiegene Gegner verwendet weiterhin das bisherige Modell. Der ICM-Rechner bleibt separat; Multiway-Entscheidungen sind derzeit ausschließlich Chip-EV.

Alle Änderungen werden anhand der Formeln und plausibler Beispielszenarien geprüft. Ein vollständiger GTO-Solver- oder Langzeitsimulationstest liegt nicht vor.


## Handy-Lernmodus V7: Chip-EV, Stacks, Raisehöhen und Stimme

Die normale Lernoberfläche konzentriert sich vorerst **nur auf Preflop-Chip-EV**. Die Preisgeldverteilung, Entries, Preispool und ICM werden nicht angezeigt und nicht in die Chip-EV-Handentscheidung eingerechnet. Der frühere ICM-Code bleibt als getrennte spätere Erweiterung in der Codebasis erhalten.

- **Feststehende Empfehlung statt Reiterleiste:** Die aktuelle Kartenkombination und die Aktion (z. B. „3-Bet auf 7,5 BB“) bleiben beim Scrollen sichtbar. Die Reiter „Empfehlung“, „169 Hände“ und „Lernen“ sind weiterhin erreichbar, aber nicht mehr fixiert.
- **Stacks für jede Position:** Die Stackgrößen aller anderen am Tisch sitzenden Positionen lassen sich jederzeit in einem kompakten Tasten-/Ziffernraster eingeben. Das gilt auch für momentan noch nicht beteiligte Spieler. Die letzte eingegebene Ziffer gilt wie bisher als Zehntel-BB (\`154\` → 15,4 BB). Werte in den Aktionszeilen und im Stackraster werden synchronisiert.
- **Raisehöhe:** Bei einer vom Modell vorgeschlagenen Erhöhung werden Raisegrößen von 33 %, 50 %, 75 % und 100 % des Pots (nach Ausgleich des aktuellen Einsatzes) auf rechtlich zulässige Minimum-Raises und effektive Stacks geprüft. Die Engine berechnet einen **modellierten** Chip-EV für jede zulässige Variante; in der Empfehlung steht die Variante mit dem höchsten geschätzten EV als Betrag in BB. Nicht zulässige Potgrößen werden gekennzeichnet. All-in-Empfehlungen zeigen den Stackbetrag.
- **Optionale Spracheingabe:** Die Taste „🎤 Spracheingabe“ kann mit einer Browser-Spracherkennung auf Deutsch einen kurzen Diktattext erfassen. Die erkannten Werte werden in einer Vorschau angezeigt und **erst nach explizitem „Übernehmen“** in Position, Stacks, Karten und Aktionsverlauf übertragen. Alternativ ist ein manueller Text in demselben Feld möglich.
- **Offline:** Die Touch-Eingabe und die Berechnung laufen nach Installation weiterhin offline. Die Spracherkennung kann je nach Browser/Handy einen Onlinedienst benötigen; ohne Browser-Unterstützung bleibt nur die manuelle Text-/Touch-Eingabe.

**Beispieldiktat:** \`Position Button, mein Stack 15 Komma 4 BB, Ass Pik König Herz, HJ Raise auf 2 Komma 2 BB, Stack 30 BB, CO Call Stack 25.\`

**Modellgrenzen:** Das „optimale“ Raise-Sizing wird **nicht** durch einen vollständigen GTO-Solver ermittelt. Die Rangewahl, zukünftige Fold-/Call-Entscheidungen, Multiway-Equities und die Postflop-Verläufe sind weiterhin vereinfachte Modelle. Die Ausgaben sind zum Lernen außerhalb laufender Online-Poker-Hände vorgesehen.
