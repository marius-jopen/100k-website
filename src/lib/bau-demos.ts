/**
 * The four demo sites behind the construction landing page.
 *
 * One record per trade; `/bau/demo/[trade].astro` renders each as a complete
 * small website and `/bau/` previews them. Everything a visitor reads on a
 * demo — names, places, numbers — is invented, and says so in the footer.
 */
export interface DemoService {
  title: string;
  text: string;
}

export interface DemoReference {
  title: string;
  place: string;
  scope: string;
  image: string;
  /** Sanierung shows a pair; the others one photograph. */
  before?: string;
}

export interface DemoFeature {
  /** What the landing page highlights. */
  label: string;
  /** The section of the demo it scrolls to. */
  target: string;
}

export interface BauDemo {
  value: string;
  short: string;
  firm: string;
  city: string;
  phone: string;
  domain: string;
  /** Hero copy. */
  claim: string;
  sub: string;
  cta: string;
  hero: string;
  /** Three proof points under the hero. */
  facts: [string, string][];
  services: DemoService[];
  references: DemoReference[];
  /** What the request form asks first. */
  requestOptions: string[];
  objectOptions: string[];
  jobs: string[];
  features: DemoFeature[];
}

export const BAU_DEMOS: BauDemo[] = [
  {
    value: "abbruch",
    short: "Abbruch",
    firm: "Muster Abbruch GmbH",
    city: "Köln",
    phone: "0221 000 00 00",
    domain: "muster-abbruch.de",
    claim: "Wir reißen ab. Sie bauen neu.",
    sub: "Abbruch, Entkernung und Rückbau in Köln und 50 km Umkreis. Festpreis nach Besichtigung, Entsorgung inklusive.",
    cta: "Angebot in 2 Minuten",
    hero: "/images/bau/abbruch.jpg",
    facts: [
      ["412", "Objekte abgebrochen"],
      ["24 h", "Rückmeldung auf jede Anfrage"],
      ["4,9", "Sterne bei Google"],
    ],
    services: [
      { title: "Komplettabbruch", text: "Vom Einfamilienhaus bis zur Industriehalle. Mit eigenem Maschinenpark, Bagger bis 40 Tonnen." },
      { title: "Entkernung", text: "Alles raus bis auf den Rohbau: Böden, Wände, Technik. Sauber getrennt, fachgerecht entsorgt." },
      { title: "Schadstoffsanierung", text: "Asbest, KMF, PAK. Zugelassen nach TRGS 519, mit Freimessung und Nachweis." },
    ],
    references: [
      { title: "Mehrfamilienhaus, 4 Geschosse", place: "Köln-Ehrenfeld", scope: "Komplettabbruch, 3 Wochen", image: "/images/bau/abbruch-1.jpg" },
      { title: "Lagerhalle, 2.400 m²", place: "Hürth", scope: "Rückbau und Entsorgung", image: "/images/bau/abbruch-2.jpg" },
      { title: "Bürogebäude, Entkernung", place: "Leverkusen", scope: "Entkernung mit Asbestsanierung", image: "/images/bau/abbruch-3.jpg" },
    ],
    requestOptions: ["Komplettabbruch", "Entkernung", "Schadstoffsanierung", "Etwas anderes"],
    objectOptions: ["Einfamilienhaus", "Mehrfamilienhaus", "Halle", "Industrie"],
    jobs: ["Baggerfahrer/in", "Abbruchhelfer/in", "Polier/in", "Ausbildung"],
    features: [
      { label: "Ein Foto, ein Satz, ein Knopf", target: "#start" },
      { label: "Leistungen ohne Fachchinesisch", target: "#leistungen" },
      { label: "Referenzen mit Ort und Umfang", target: "#referenzen" },
      { label: "Angebot in 2 Minuten", target: "#anfrage" },
      { label: "Bewerben ohne Anschreiben", target: "#karriere" },
    ],
  },
  {
    value: "rohbau",
    short: "Rohbau",
    firm: "Muster Rohbau GmbH",
    city: "Bonn",
    phone: "0228 000 00 00",
    domain: "muster-rohbau.de",
    claim: "Rohbau aus einer Hand.",
    sub: "Fundament, Mauerwerk, Decken und Treppen für Wohnhäuser und Gewerbe in Bonn und Umgebung. Eigene Kolonnen, ein Bauleiter, ein Termin.",
    cta: "Projekt anfragen",
    hero: "/images/bau/rohbau.jpg",
    facts: [
      ["Seit 1987", "in Familienhand"],
      ["38", "Mitarbeiter, eigene Kolonnen"],
      ["Termintreu", "mit Bauzeitenplan"],
    ],
    services: [
      { title: "Mauerwerksbau", text: "Kalksandstein, Poroton, Beton. Nach Statik, mit eigenem Kran auf jeder Baustelle." },
      { title: "Stahlbetonbau", text: "Fundamente, Decken, Stützen, Treppen. Schalung, Bewehrung und Beton aus einer Hand." },
      { title: "Bauleitung", text: "Ein Ansprechpartner von der Baugrube bis zur Dachdecke. Wöchentlicher Baustellenbericht per WhatsApp." },
    ],
    references: [
      { title: "Mehrfamilienhaus, 12 Wohnungen", place: "Bonn-Beuel", scope: "Rohbau komplett, 7 Monate", image: "/images/bau/rohbau-1.jpg" },
      { title: "Doppelhaus", place: "Sankt Augustin", scope: "Fundament bis Dachdecke", image: "/images/bau/rohbau-2.jpg" },
      { title: "Gewerbehalle mit Büro", place: "Troisdorf", scope: "Stahlbeton-Skelettbau", image: "/images/bau/rohbau-3.jpg" },
    ],
    requestOptions: ["Mauerwerksbau", "Stahlbetonbau", "Rohbau komplett", "Etwas anderes"],
    objectOptions: ["Einfamilienhaus", "Mehrfamilienhaus", "Gewerbe", "Anbau"],
    jobs: ["Maurer/in", "Betonbauer/in", "Polier/in", "Ausbildung"],
    features: [
      { label: "Ruhige Startseite mit Zahlen", target: "#start" },
      { label: "Leistungen nummeriert", target: "#leistungen" },
      { label: "Projekte mit Bauzeit", target: "#referenzen" },
      { label: "Projekt in 2 Minuten anfragen", target: "#anfrage" },
      { label: "Azubis und Maurer finden", target: "#karriere" },
    ],
  },
  {
    value: "sanierung",
    short: "Sanierung",
    firm: "Muster Sanierung GmbH",
    city: "Düsseldorf",
    phone: "0211 000 00 00",
    domain: "muster-sanierung.de",
    claim: "Ihr Altbau. Wie neu.",
    sub: "Kernsanierung, energetische Sanierung und Feuchteschäden in Düsseldorf. Eine Ansprechpartnerin von der Beratung bis zur Übergabe.",
    cta: "Beratung vereinbaren",
    hero: "/images/bau/sanierung-nachher.jpg",
    facts: [
      ["Förderung", "wir beantragen sie mit"],
      ["Alle Gewerke", "koordiniert aus einer Hand"],
      ["Festpreis", "nach Besichtigung"],
    ],
    services: [
      { title: "Kernsanierung", text: "Bis auf den Rohbau und wieder zurück: Leitungen, Böden, Bäder, Fenster. Mit festem Übergabetermin." },
      { title: "Energetische Sanierung", text: "Dämmung, Fenster, Heizung. Wir rechnen die Förderung durch und beantragen sie mit Ihnen." },
      { title: "Feuchteschäden", text: "Ursache finden, trocknen, abdichten. Mit Messprotokoll, nicht mit Vermutungen." },
    ],
    references: [
      { title: "Gründerzeitwohnung, 140 m²", place: "Düsseldorf-Flingern", scope: "Kernsanierung, 4 Monate", image: "/images/bau/sanierung-nachher.jpg", before: "/images/bau/sanierung-vorher.jpg" },
      { title: "Reihenhaus, energetisch", place: "Neuss", scope: "Dämmung, Fenster, Wärmepumpe", image: "/images/bau/sanierung-1.jpg" },
      { title: "Fassade und Dach", place: "Meerbusch", scope: "Putz, Dämmung, Dachdeckung", image: "/images/bau/sanierung-2.jpg" },
    ],
    requestOptions: ["Kernsanierung", "Energetische Sanierung", "Feuchteschaden", "Etwas anderes"],
    objectOptions: ["Wohnung", "Einfamilienhaus", "Mehrfamilienhaus", "Gewerbe"],
    jobs: ["Trockenbauer/in", "Fliesenleger/in", "Bauleiter/in", "Ausbildung"],
    features: [
      { label: "Vorher und Nachher auf der Startseite", target: "#start" },
      { label: "Förderung als Leistung", target: "#leistungen" },
      { label: "Referenzen zum Umschalten", target: "#referenzen" },
      { label: "Beratung in 2 Minuten anfragen", target: "#anfrage" },
      { label: "Bewerben vom Handy", target: "#karriere" },
    ],
  },
  {
    value: "tiefbau",
    short: "Tiefbau",
    firm: "Muster Tiefbau GmbH",
    city: "Essen",
    phone: "0201 000 00 00",
    domain: "muster-tiefbau.de",
    claim: "Erdarbeiten, Kanal, Anschluss.",
    sub: "Baugruben, Kanalbau und Hausanschlüsse in Essen und im Ruhrgebiet. Eigener Maschinenpark, Entsorgung inklusive.",
    cta: "Baugrube anfragen",
    hero: "/images/bau/tiefbau.jpg",
    facts: [
      ["40 km", "Einsatzgebiet um Essen"],
      ["Bagger bis 30 t", "eigener Maschinenpark"],
      ["RAL-GZ 961", "zertifizierter Kanalbau"],
    ],
    services: [
      { title: "Erdarbeiten", text: "Baugrube, Aushub, Verfüllung, Bodenaustausch. Mit Abfuhr und Entsorgungsnachweis." },
      { title: "Kanalbau", text: "Neubau und Sanierung von Abwasserleitungen, Schächte, Dichtheitsprüfung." },
      { title: "Hausanschlüsse", text: "Wasser, Strom, Gas, Glasfaser. Wir koordinieren mit den Versorgern, Sie bekommen einen Termin." },
    ],
    references: [
      { title: "Baugrube Mehrfamilienhaus", place: "Essen-Rüttenscheid", scope: "4.200 m³ Aushub, 2 Wochen", image: "/images/bau/tiefbau-1.jpg" },
      { title: "Kanalsanierung, 180 m", place: "Bochum", scope: "Offene Bauweise, Schächte neu", image: "/images/bau/tiefbau-2.jpg" },
      { title: "Hausanschlüsse Neubaugebiet", place: "Gelsenkirchen", scope: "22 Grundstücke, alle Medien", image: "/images/bau/tiefbau.jpg" },
    ],
    requestOptions: ["Baugrube", "Kanalbau", "Hausanschluss", "Etwas anderes"],
    objectOptions: ["Einfamilienhaus", "Mehrfamilienhaus", "Gewerbe", "Öffentlich"],
    jobs: ["Baggerfahrer/in", "Kanalbauer/in", "LKW-Fahrer/in", "Ausbildung"],
    features: [
      { label: "Einsatzgebiet auf einen Blick", target: "#start" },
      { label: "Drei Leistungen, klar getrennt", target: "#leistungen" },
      { label: "Referenzen mit Kubikmetern", target: "#referenzen" },
      { label: "Baugrube in 2 Minuten anfragen", target: "#anfrage" },
      { label: "Fahrer finden", target: "#karriere" },
    ],
  },
];

export const findBauDemo = (value: string): BauDemo | undefined => BAU_DEMOS.find((demo) => demo.value === value);
