import { LightningElement, api } from 'lwc';
import isGuest from '@salesforce/user/isGuest';

export default class B2bCheckoutModeBanner extends LightningElement {
    isGuestUser = isGuest;
    @api directTitle = 'Bestellmodus';
    @api directText = 'Bestellung direkt über SAATBAU.';
    @api distributorTitle = 'Bestellmodus';
    @api distributorSelectionUrl = '/de-AT/haendlerauswahl';
    @api redirectDistributorWithoutSelection = false;

    mode = '';
    distributorName = '';
    distributorCity = '';
    siteBasePath = '';

    connectedCallback() {
        if (this.isGuestUser) {
            return;
        }

        this.siteBasePath = this.detectSiteBasePath();
        this.mode = window.sessionStorage.getItem('orderMode') || '';
        const raw = window.sessionStorage.getItem('selectedDistributor');
        if (raw) {
            try {
                const parsed = JSON.parse(raw);
                this.distributorName = parsed.name || '';
                this.distributorCity = parsed.city || '';
            } catch (e) {
                this.distributorName = '';
                this.distributorCity = '';
            }
        }

        if (
            this.redirectDistributorWithoutSelection &&
            this.mode === 'distributor' &&
            !this.distributorName
        ) {
            window.location.assign(this.resolveStorefrontUrl(this.distributorSelectionUrl));
        }
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

    get visible() {
        if (this.isGuestUser) {
            return false;
        }
        return this.mode === 'direct' || this.mode === 'distributor';
    }

    get bannerClass() {
        return this.mode === 'distributor' ? 'banner distributor' : 'banner direct';
    }

    get bannerTitle() {
        return this.mode === 'distributor' ? this.distributorTitle : this.directTitle;
    }

    get bannerText() {
        if (this.mode === 'distributor') {
            if (this.distributorName) {
                return `Bestellung über Händler: ${this.distributorName}${this.distributorCity ? `, ${this.distributorCity}` : ''}.`;
            }
            return 'Bestellung über Händler.';
        }
        return this.directText;
    }
}
