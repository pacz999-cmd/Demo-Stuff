import { LightningElement, api } from 'lwc';

export default class B2bPdpHighlights extends LightningElement {
    @api title = 'Warum dieses Produkt?';

    @api item1Title = 'Hohe Leistung';
    @api item1Text = 'Zuverlässige Ergebnisse für anspruchsvolle Bedingungen.';

    @api item2Title = 'Klare Verfügbarkeit';
    @api item2Text = 'Bestände und Mengen transparent im Shop einsehbar.';

    @api item3Title = 'Schnelle Lieferung';
    @api item3Text = 'Direkte Zustellung bis zu Ihrem Betrieb.';
}
