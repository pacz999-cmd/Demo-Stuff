import { LightningElement, api, track } from 'lwc';
import isGuest from '@salesforce/user/isGuest';

const MODE_DIRECT = 'direct';
const MODE_DISTRIBUTOR = 'distributor';
const MODE_ADVISOR = 'advisor';
const MODAL_DISMISSED_KEY = 'orderModeChooserDismissed';
const ORDER_MODE_KEY = 'orderMode';

export default class B2bOrderModeChooser extends LightningElement {
    isGuestUser = isGuest;
    @api eyebrow = 'Unser Saatgut';
    @api title = 'Wie möchten Sie bestellen?';

    @api option1Label = 'Bestellung über SAATBAU';
    @api option1Text = 'Bestellen Sie direkt bei SAATBAU.';

    @api option2Label = 'Bestellung über Händler/Lagerhaus';
    @api option2Text = 'Wählen Sie zuerst einen Händler in Ihrer Nähe.';

    @api option3Label = 'Sortenberaterbestellung';
    @api option3Text = 'Bestellung für einen Landwirt durch einen Sortenberater.';
    @api option3Hint = 'Sortenberater-Bestellung ist derzeit nicht verfügbar.';

    @api nextLabel = 'Weiter';
    @api continueShoppingUrl = '/de-AT/search';

    @track selectedMode = MODE_DIRECT;
    @track showOption3Hint = false;
    @track showModal = false;

    get visible() {
        return !this.isGuestUser;
    }

    connectedCallback() {
        if (this.isGuestUser) {
            this.showModal = false;
            return;
        }

        const dismissed = window.sessionStorage.getItem(MODAL_DISMISSED_KEY) === 'true';
        const existingMode = window.sessionStorage.getItem(ORDER_MODE_KEY);
        if (existingMode === MODE_DIRECT || existingMode === MODE_DISTRIBUTOR || existingMode === MODE_ADVISOR) {
            this.selectedMode = existingMode;
        }

        this.showModal = !dismissed;
    }

    get option1Class() {
        return this.selectedMode === MODE_DIRECT ? 'option selected' : 'option';
    }

    get option2Class() {
        return this.selectedMode === MODE_DISTRIBUTOR ? 'option selected' : 'option';
    }

    get option3Class() {
        return this.selectedMode === MODE_ADVISOR ? 'option selected disabled' : 'option disabled';
    }

    get option1Check() {
        return this.selectedMode === MODE_DIRECT ? '✓' : '';
    }

    get option2Check() {
        return this.selectedMode === MODE_DISTRIBUTOR ? '✓' : '';
    }

    get option3Check() {
        return this.selectedMode === MODE_ADVISOR ? '✓' : '';
    }

    get nextDisabled() {
        return this.selectedMode === MODE_ADVISOR;
    }

    selectOption1() {
        this.selectedMode = MODE_DIRECT;
        this.showOption3Hint = false;
    }

    selectOption2() {
        this.selectedMode = MODE_DISTRIBUTOR;
        this.showOption3Hint = false;
    }

    selectOption3() {
        this.selectedMode = MODE_ADVISOR;
        this.showOption3Hint = true;
    }

    goNext() {
        if (this.isGuestUser) {
            return;
        }

        if (this.selectedMode === MODE_ADVISOR) {
            this.showOption3Hint = true;
            return;
        }

        window.sessionStorage.setItem(ORDER_MODE_KEY, this.selectedMode);
        if (this.selectedMode === MODE_DISTRIBUTOR) {
            window.sessionStorage.removeItem('selectedDistributor');
        }
        window.sessionStorage.setItem(MODAL_DISMISSED_KEY, 'true');
        this.showModal = false;
    }
}
