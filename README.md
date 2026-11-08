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

## Bedienung auf dem Handy (Version 3)

- Beim ersten Start einmal Turnierprofil A, B oder C wählen; die Auswahl wird gespeichert.
- **Position direkt antippen:** UTG, HJ, CO, BTN, SB, BB usw. Kein Dropdown mehr für die eigene Position.
- **Stack in Zehntel-BB:** Nur Ziffern eingeben. Die letzte Stelle steht automatisch hinter dem Komma: `154` = 15,4 BB, `800` = 80,0 BB. Die App zeigt den formatierten Wert daneben und rechnet intern in Chips um.
- **Starthand über Tasten:** Zuerst den Rang für Karte 1, dann Karte 2 antippen. Anschließend `gleiche Farbe (s)` oder `verschieden (o)`; bei Paaren entfällt diese Wahl. Die konkrete Kartenfarbe (Pik/Herz/Karo/Kreuz) wird für die 169 Preflop-Handklassen nicht benötigt.
- **Aktionen je Position:** `Alle folden`, `Aktionen vor mir` oder `Nach meinem Raise`. Nach Auswahl einer Position Fold, Call/Limp, Raise/3-Bet oder All-in wählen. Bei aktiven Spielern Gesamteinsatz und Startstack in BB (ebenfalls Zehntel-BB-Eingabe) erfassen.
- **Modellgrenze:** Die bisherige mathematische Engine wertet nur einen aktiven Heads-up-Gegner aus. Für mehrere eingestiegene Spieler, Limp-Pots, 3-Bet-All-ins nach eigenem Open und komplexere Raise-Folgen zeigt die App ausdrücklich **keine verlässliche Empfehlung**, statt solche Szenarien fälschlich als Heads-up zu bewerten. Das reine Erfassen dieser Situationen ist bereits möglich.
- Blindlevel, Spielerzahl, ICM und Gegnermodell befinden sich weiterhin unter **Weitere Angaben**.
- Über `⚙ Turnierformat ändern` lässt sich das Profil später wechseln.
- Das Quiz ist deaktiviert, wenn das eingegebene Szenario noch nicht durch das Modell unterstützt wird.

**Hinweis zur echten Pokerpraxis:** Bei Online-Poker gelten gegebenenfalls Regeln gegen Real-Time Assistance. Die App ist als Lern- und Nachanalysewerkzeug außerhalb laufender Hände gedacht.
