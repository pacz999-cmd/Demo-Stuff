import { LightningElement, api } from 'lwc';

export default class B2bPromoRibbon extends LightningElement {
    @api promo1Kicker = 'Frühbezug';
    @api promo1Title = 'Jetzt Frühbezugsaktion sichern';
    @api promo1Text = 'Top Sorten zu attraktiven Konditionen für Ihre Saison.';
    @api promo1Url = '/search';

    @api promo2Kicker = 'Saison';
    @api promo2Title = 'Bestellfenster Frühjahr';
    @api promo2Text = 'Verfügbarkeiten laufend aktuell im Shop einsehen.';
    @api promo2Url = '/search';

    @api promo3Kicker = 'Service';
    @api promo3Title = 'Beratung & Bestellung';
    @api promo3Text = 'Unser Team unterstützt Sie bei Auswahl und Planung.';
    @api promo3Url = '/contact';
}
