import { LightningElement, api } from 'lwc';

export default class B2bNewsAktuelles extends LightningElement {
    @api title = 'News & Aktuelles';
    @api subtitle = 'Neuigkeiten, Saisoninfos und wichtige Hinweise auf einen Blick.';
    @api filterAllLabel = 'Alle anzeigen';
    @api filterPostsLabel = 'Beiträge';
    @api filterEventsLabel = 'Termine';
    @api allUrl = '#';
    @api postsUrl = '#';
    @api eventsUrl = '#';

    @api mode = 'cards'; // cards | iframe
    @api iframeUrl = 'https://www.saatbau.com/news-frame/';

    @api item1Kicker = 'Niederösterreich';
    @api item1Title = 'Feldbegehung Großkrut';
    @api item1Text = '15.06.2026 · 19:00 Uhr';
    @api item1Url = '/search';
    @api item1ImageUrl = '';

    @api item2Kicker = 'Niederösterreich';
    @api item2Title = 'Feldbegehung Hippels';
    @api item2Text = '16.06.2026 · 19:00 Uhr';
    @api item2Url = '/search';
    @api item2ImageUrl = '';

    @api item3Kicker = 'News';
    @api item3Title = 'Aktuelle Bestandesführung bei Wintergerste';
    @api item3Text = 'Wissen kompakt zur Saison 2026.';
    @api item3Url = '/contact';
    @api item3ImageUrl = '';

    @api item4Kicker = 'News';
    @api item4Title = 'Klimawandel im Grünland';
    @api item4Text = 'Praxisnahe Empfehlungen für stabile Erträge.';
    @api item4Url = '/search';
    @api item4ImageUrl = '';

    @api item5Kicker = 'News';
    @api item5Title = 'So gelingt der Sojaanbau 2026';
    @api item5Text = 'Erfolgsfaktoren von Saat bis Ernte.';
    @api item5Url = '/search';
    @api item5ImageUrl = '';

    @api item6Kicker = 'Oberösterreich';
    @api item6Title = 'Feldtag Reichersberg';
    @api item6Text = '18.06.2026 · 16:00 Uhr';
    @api item6Url = '/search';
    @api item6ImageUrl = '';

    @api allNewsButtonLabel = 'Alle Termine & News';
    @api allNewsButtonUrl = '#';

    get showIframe() {
        return (this.mode || '').toLowerCase() === 'iframe';
    }

    cardStyle(url) {
        if (!url || !url.trim()) {
            return '';
        }
        return `background-image: linear-gradient(rgba(6, 58, 29, 0.58), rgba(6, 58, 29, 0.58)), url('${url}');`;
    }

    cardClass(url) {
        return url && url.trim() ? 'card card-photo' : 'card';
    }

    get item1Style() { return this.cardStyle(this.item1ImageUrl); }
    get item2Style() { return this.cardStyle(this.item2ImageUrl); }
    get item3Style() { return this.cardStyle(this.item3ImageUrl); }
    get item4Style() { return this.cardStyle(this.item4ImageUrl); }
    get item5Style() { return this.cardStyle(this.item5ImageUrl); }
    get item6Style() { return this.cardStyle(this.item6ImageUrl); }

    get item1Class() { return this.cardClass(this.item1ImageUrl); }
    get item2Class() { return this.cardClass(this.item2ImageUrl); }
    get item3Class() { return this.cardClass(this.item3ImageUrl); }
    get item4Class() { return this.cardClass(this.item4ImageUrl); }
    get item5Class() { return this.cardClass(this.item5ImageUrl); }
    get item6Class() { return this.cardClass(this.item6ImageUrl); }
}
