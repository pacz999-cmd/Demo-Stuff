import { LightningElement, api, wire } from 'lwc';
import { getRecord, getFieldValue } from 'lightning/uiRecordApi';
import USER_ID from '@salesforce/user/Id';
import USER_CONTACT_ID from '@salesforce/schema/User.ContactId';
import CONTACT_ACCOUNT_ID from '@salesforce/schema/Contact.AccountId';
import ACCOUNT_LOYALTY_TIER from '@salesforce/schema/Account.SDO_SCOM_Loyalty_Tier__c';
import BRONZE_BADGE from '@salesforce/resourceUrl/ContiLoyaltyBronze';
import SILVER_BADGE from '@salesforce/resourceUrl/ContiLoyaltySilver';
import GOLD_BADGE from '@salesforce/resourceUrl/ContiLoyaltyGold';

export default class ContiHeaderLogoLoyalty extends LightningElement {
    @api logoUrl;
    @api logoAlt = 'Continental';
    @api homeUrl = '/';
    @api logoSizePx = 64;
    @api gapPx = 8;
    @api previewTier = 'Bronze';
    @api showPreviewFallback;

    contactId;
    accountId;
    accountTier;
    isLoaded = false;

    @wire(getRecord, { recordId: USER_ID, fields: [USER_CONTACT_ID] })
    wiredUser({ data, error }) {
        if (data) {
            this.contactId = getFieldValue(data, USER_CONTACT_ID);
            if (!this.contactId) {
                this.isLoaded = true;
            }
        } else if (error) {
            // eslint-disable-next-line no-console
            console.error('Logo loyalty - user wire error', JSON.stringify(error));
            this.isLoaded = true;
        }
    }

    @wire(getRecord, { recordId: '$contactId', fields: [CONTACT_ACCOUNT_ID] })
    wiredContact({ data, error }) {
        if (data) {
            this.accountId = getFieldValue(data, CONTACT_ACCOUNT_ID);
            if (!this.accountId) {
                this.isLoaded = true;
            }
        } else if (error) {
            // eslint-disable-next-line no-console
            console.error('Logo loyalty - contact wire error', JSON.stringify(error));
            this.isLoaded = true;
        }
    }

    @wire(getRecord, { recordId: '$accountId', fields: [ACCOUNT_LOYALTY_TIER] })
    wiredAccount({ data, error }) {
        if (data) {
            this.accountTier = getFieldValue(data, ACCOUNT_LOYALTY_TIER);
            this.isLoaded = true;
        } else if (error) {
            // eslint-disable-next-line no-console
            console.error('Logo loyalty - account wire error', JSON.stringify(error));
            this.isLoaded = true;
        }
    }

    get resolvedTier() {
        const accountTier = (this.accountTier || '').trim();
        if (accountTier) {
            return accountTier;
        }
        return null;
    }

    get effectiveTier() {
        if (this.resolvedTier) {
            return this.resolvedTier;
        }
        const fallbackEnabled = this.showPreviewFallback !== false && this.showPreviewFallback !== 'false';
        if (fallbackEnabled) {
            const tier = (this.previewTier || '').trim();
            return tier || 'Bronze';
        }
        return null;
    }

    get hasTier() {
        return Boolean(this.effectiveTier);
    }

    get safeLogoUrl() {
        return (this.logoUrl || '').trim();
    }

    get hasLogo() {
        return Boolean(this.safeLogoUrl);
    }

    get wrapperStyle() {
        return `gap:${this.normalizePixel(this.gapPx)};`;
    }

    get logoStyle() {
        const size = this.normalizeSize(this.logoSizePx);
        return `width:${size};height:${size};`;
    }

    get badgeStyle() {
        const size = this.normalizeSize(this.logoSizePx);
        return `width:${size};height:${size};`;
    }

    get badgeUrl() {
        if (this.effectiveTier === 'Gold') {
            return GOLD_BADGE;
        }
        if (this.effectiveTier === 'Silver') {
            return SILVER_BADGE;
        }
        return BRONZE_BADGE;
    }

    get badgeAlt() {
        return this.effectiveTier ? `${this.effectiveTier} loyalty tier` : 'Loyalty tier';
    }

    normalizeSize(value) {
        const numeric = Number(value);
        const bounded = Number.isFinite(numeric) ? Math.max(24, Math.min(180, numeric)) : 64;
        return `${Math.round(bounded)}px`;
    }

    normalizePixel(value) {
        const numeric = Number(value);
        const bounded = Number.isFinite(numeric) ? Math.max(0, Math.min(40, numeric)) : 8;
        return `${Math.round(bounded)}px`;
    }
}
