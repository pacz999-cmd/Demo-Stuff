import { LightningElement, api, track } from 'lwc';
import isGuest from '@salesforce/user/isGuest';

const DISTRIBUTORS = [
    { id: 'd1', name: 'Lagerhaus Vöcklabruck - Gmunden eGen', street: 'Vöcklabrucker Straße 19', zip: '4844', city: 'Regau', country: 'Österreich' },
    { id: 'd2', name: 'Philipp Gamsjäger', street: 'Buchengasse 7', zip: '4844', city: 'Regau', country: 'Österreich' },
    { id: 'd3', name: 'Lagerhaus Vöcklabruck - Gmunden eGen', street: 'Hauptstraße 36', zip: '4851', city: 'Schörfling am Attersee', country: 'Österreich' },
    { id: 'd4', name: 'Lagerhaus Grieskirchen', street: 'Industriestraße 11', zip: '4710', city: 'Grieskirchen', country: 'Österreich' },
    { id: 'd5', name: 'Lagerhaus Eferding', street: 'Bahnhofstraße 22', zip: '4070', city: 'Eferding', country: 'Österreich' }
];

export default class B2bDistributorSelector extends LightningElement {
    isGuestUser = isGuest;
    @api checkoutUrl = '/de-AT/checkout';
    @api backUrl = '/';
    @api loginUrl = '/login';
    siteBasePath = '';

    @track zip = '';
    @track radius = '50';
    @track selectedDistributorId = '';

    connectedCallback() {
        this.siteBasePath = this.detectSiteBasePath();
        if (this.isGuestUser) {
            window.location.assign(this.resolveStorefrontUrl(this.loginUrl));
        }
    }

    get filteredDistributors() {
        const zipInput = (this.zip || '').trim();
        const base = zipInput ? DISTRIBUTORS.filter((d) => d.zip.startsWith(zipInput)) : DISTRIBUTORS;
        return base.map((d) => ({
            ...d,
            cardClass: d.id === this.selectedDistributorId ? 'entry selected' : 'entry'
        }));
    }

    get nextDisabled() {
        return !this.selectedDistributorId;
    }

    get hasResults() {
        return this.filteredDistributors.length > 0;
    }

    get showNoResults() {
        return !this.hasResults;
    }

    get noResultsText() {
        const zipInput = (this.zip || '').trim();
        if (zipInput) {
            return `Keine Händler für PLZ "${zipInput}" gefunden.`;
        }
        return 'Keine Händler gefunden.';
    }

    get mapMarkers() {
        return this.filteredDistributors.map((d, idx) => ({
            value: d.id,
            title: `${idx + 1}. ${d.name}`,
            description: `${d.street}, ${d.zip} ${d.city}`,
            location: {
                Street: d.street,
                PostalCode: d.zip,
                City: d.city,
                Country: d.country
            },
            icon: d.id === this.selectedDistributorId ? 'utility:checkin' : 'utility:location'
        }));
    }

    get selectedMarkerValue() {
        return this.selectedDistributorId || null;
    }

    get zoomLevel() {
        const count = this.filteredDistributors.length;
        if (count <= 1) {
            return 11;
        }
        if (count <= 3) {
            return 10;
        }
        return 9;
    }

    get mapStyle() {
        return 'height: 100%;';
    }

    handleZipInput(event) {
        this.zip = event.target.value;
        if (!this.filteredDistributors.some((d) => d.id === this.selectedDistributorId)) {
            this.selectedDistributorId = '';
        }
    }

    handleRadiusChange(event) {
        this.radius = event.target.value;
    }

    indexLabel(index) {
        return index + 1;
    }

    selectDistributor(event) {
        this.selectedDistributorId = event.currentTarget.dataset.id;
    }

    handleMarkerSelect(event) {
        this.selectedDistributorId = event.detail.selectedMarkerValue;
    }

    continueToCheckout() {
        if (this.isGuestUser) {
            return;
        }
        const selected = this.filteredDistributors.find((d) => d.id === this.selectedDistributorId);
        if (!selected) {
            return;
        }

        window.sessionStorage.setItem('orderMode', 'distributor');
        window.sessionStorage.setItem('selectedDistributor', JSON.stringify(selected));
        window.location.assign(this.resolveStorefrontUrl(this.checkoutUrl));
    }

    detectSiteBasePath() {
        const parts = window.location.pathname.split('/').filter(Boolean);
        if (parts.length >= 2) {
            return `/${parts[0]}/${parts[1]}`;
        }
        return '';
    }

    resolveStorefrontUrl(rawUrl) {
        if (!rawUrl) {
            return this.siteBasePath || '/';
        }
        if (/^https?:\/\//i.test(rawUrl)) {
            return rawUrl;
        }

        const normalized = rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`;
        if (this.siteBasePath && !normalized.startsWith(this.siteBasePath + '/')) {
            return `${this.siteBasePath}${normalized}`;
        }
        return normalized;
    }
}
