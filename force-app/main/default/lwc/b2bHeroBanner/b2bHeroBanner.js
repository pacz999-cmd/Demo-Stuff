import { LightningElement, api } from 'lwc';

export default class B2bHeroBanner extends LightningElement {
    @api eyebrow = 'Saatbau Demo Shop';
    @api headline = 'Qualitaetssaatgut fuer professionelle Betriebe';
    @api subtext = 'Schnell finden, vergleichen und direkt fuer Ihre Saison bestellen.';
    @api primaryCtaLabel = 'Jetzt kaufen';
    @api primaryCtaUrl = '/search';
    @api secondaryCtaLabel = 'Produkte entdecken';
    @api secondaryCtaUrl = '/search';
    @api backgroundImageUrl =
        'https://images.unsplash.com/photo-1622383563227-04401ab4e5ea?auto=format&fit=crop&w=1600&q=80';

    get heroStyle() {
        return `background-image: url('${this.backgroundImageUrl}');`;
    }
}
