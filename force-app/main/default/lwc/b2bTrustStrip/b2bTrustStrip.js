import { LightningElement, api } from 'lwc';

export default class B2bTrustStrip extends LightningElement {
    @api item1Title = 'Schnelle Lieferung';
    @api item1Text = 'Direkt und zuverlässig bis zu Ihrem Hof.';

    @api item2Title = 'Starke Sorten';
    @api item2Text = 'Qualitätssaatgut für moderne Landwirtschaft.';

    @api item3Title = 'Verfügbarkeit';
    @api item3Text = 'Transparente Bestände und klare Mengen.';

    @api item4Title = 'Persönlicher Service';
    @api item4Text = 'Unser Team ist für Sie erreichbar.';
}
