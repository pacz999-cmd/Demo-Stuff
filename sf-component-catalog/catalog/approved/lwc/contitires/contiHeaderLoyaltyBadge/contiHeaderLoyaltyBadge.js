import { LightningElement, api, wire } from 'lwc';
import { getRecord, getFieldValue } from 'lightning/uiRecordApi';
import USER_ID from '@salesforce/user/Id';
import USER_CONTACT_ID from '@salesforce/schema/User.ContactId';
import CONTACT_ACCOUNT_ID from '@salesforce/schema/Contact.AccountId';
import ACCOUNT_LOYALTY_TIER from '@salesforce/schema/Account.SDO_SCOM_Loyalty_Tier__c';
import BRONZE_BADGE from '@salesforce/resourceUrl/ContiLoyaltyBronze';
import SILVER_BADGE from '@salesforce/resourceUrl/ContiLoyaltySilver';
import GOLD_BADGE from '@salesforce/resourceUrl/ContiLoyaltyGold';

export default class ContiHeaderLoyaltyBadge extends LightningElement {
    @api marginLeft = 0;
    @api marginRight = 0;
    @api sizePx = 30;
    @api previewTier = 'Bronze';
    @api showPreviewFallback;
    @api pinNearLogo;
    @api fixedTopPx = 14;
    @api fixedLeftPx = 210;
    @api zIndex = 1000;

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
            console.error('Header loyalty badge - user wire error', JSON.stringify(error));
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
            console.error('Header loyalty badge - contact wire error', JSON.stringify(error));
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
            console.error('Header loyalty badge - account wire error', JSON.stringify(error));
            this.isLoaded = true;
        }
    }

    get resolvedTier() {
        const normalizedAccountTier = (this.accountTier || '').trim();
        if (normalizedAccountTier) {
            return normalizedAccountTier;
        }
        return null;
    }

    get effectiveTier() {
        if (this.resolvedTier) {
            return this.resolvedTier;
        }
        if (this.showPreviewFallback !== false && this.showPreviewFallback !== 'false') {
            const normalizedPreviewTier = (this.previewTier || '').trim();
            return normalizedPreviewTier || 'Bronze';
        }
        return null;
    }

    get hasTier() {
        return Boolean(this.effectiveTier);
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

    get containerStyle() {
        if (this.pinNearLogoEnabled) {
            return `position:fixed;top:${this.normalizePosition(this.fixedTopPx)};left:${this.normalizePosition(this.fixedLeftPx)};z-index:${this.normalizeZIndex(this.zIndex)};`;
        }
        return `margin-left:${this.normalizePixel(this.marginLeft)};margin-right:${this.normalizePixel(this.marginRight)};`;
    }

    get imageStyle() {
        const size = this.normalizeSize(this.sizePx);
        return `width:${size};height:${size};`;
    }

    normalizeSize(value) {
        const numeric = Number(value);
        const bounded = Number.isFinite(numeric) ? Math.max(16, Math.min(220, numeric)) : 30;
        return `${Math.round(bounded)}px`;
    }

    normalizePixel(value) {
        const numeric = Number(value);
        const bounded = Number.isFinite(numeric) ? Math.max(0, Math.min(40, numeric)) : 0;
        return `${Math.round(bounded)}px`;
    }

    get pinNearLogoEnabled() {
        return this.pinNearLogo !== false && this.pinNearLogo !== 'false';
    }

    normalizePosition(value) {
        const numeric = Number(value);
        const bounded = Number.isFinite(numeric) ? Math.max(0, Math.min(2000, numeric)) : 0;
        return `${Math.round(bounded)}px`;
    }

    normalizeZIndex(value) {
        const numeric = Number(value);
        const bounded = Number.isFinite(numeric) ? Math.max(1, Math.min(9999, numeric)) : 1000;
        return `${Math.round(bounded)}`;
    }
}
