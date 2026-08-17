import { LightningElement, wire, track } from 'lwc';
import { getRecord, getFieldValue } from 'lightning/uiRecordApi';
import USER_ID from '@salesforce/user/Id';
import USER_CONTACT_ID from '@salesforce/schema/User.ContactId';
import CONTACT_ACCOUNT_ID from '@salesforce/schema/Contact.AccountId';
import ACCOUNT_LOYALTY_TIER from '@salesforce/schema/Account.SDO_SCOM_Loyalty_Tier__c';
import ACCOUNT_LOYALTY_POINTS from '@salesforce/schema/Account.SDO_SCOM_Loyalty_Points__c';
import BRONZE_BADGE from '@salesforce/resourceUrl/ContiLoyaltyBronze';
import SILVER_BADGE from '@salesforce/resourceUrl/ContiLoyaltySilver';
import GOLD_BADGE from '@salesforce/resourceUrl/ContiLoyaltyGold';

const SILVER_THRESHOLD = 2000;
const GOLD_THRESHOLD = 10000;

export default class ContiLoyaltyStatus extends LightningElement {
    @track contactId;
    @track accountId;
    @track points = 0;
    @track tier = null;
    @track isLoaded = false;

    bronzeBadge = BRONZE_BADGE;
    silverBadge = SILVER_BADGE;
    goldBadge = GOLD_BADGE;

    @wire(getRecord, { recordId: USER_ID, fields: [USER_CONTACT_ID] })
    wiredUser({ data, error }) {
        if (data) {
            this.contactId = getFieldValue(data, USER_CONTACT_ID);
            if (!this.contactId) {
                this.isLoaded = true;
            }
        } else if (error) {
            // eslint-disable-next-line no-console
            console.error('Conti loyalty status - user wire error', JSON.stringify(error));
            this.isLoaded = true;
        }
    }

    @wire(getRecord, {
        recordId: '$contactId',
        fields: [CONTACT_ACCOUNT_ID]
    })
    wiredContact({ data, error }) {
        if (data) {
            this.accountId = getFieldValue(data, CONTACT_ACCOUNT_ID);
            if (!this.accountId) {
                this.isLoaded = true;
            }
        } else if (error) {
            // eslint-disable-next-line no-console
            console.error('Conti loyalty status - contact wire error', JSON.stringify(error));
            this.isLoaded = true;
        }
    }

    @wire(getRecord, {
        recordId: '$accountId',
        fields: [ACCOUNT_LOYALTY_TIER, ACCOUNT_LOYALTY_POINTS]
    })
    wiredAccount({ data, error }) {
        if (data) {
            const rawPoints = getFieldValue(data, ACCOUNT_LOYALTY_POINTS);
            this.points = rawPoints != null ? parseInt(String(rawPoints), 10) || 0 : 0;
            this.tier = getFieldValue(data, ACCOUNT_LOYALTY_TIER) || 'Bronze';
            this.isLoaded = true;
        } else if (error) {
            // eslint-disable-next-line no-console
            console.error('Conti loyalty status - account wire error', JSON.stringify(error));
            this.isLoaded = true;
        }
    }

    get status() {
        if (!this.tier) {
            return null;
        }
        const currentPoints = this.points || 0;
        const currentTier = this.tier;
        let nextTier = null;
        let pointsToNextTier = 0;
        if (currentPoints < SILVER_THRESHOLD) {
            nextTier = 'Silver';
            pointsToNextTier = SILVER_THRESHOLD - currentPoints;
        } else if (currentPoints < GOLD_THRESHOLD) {
            nextTier = 'Gold';
            pointsToNextTier = GOLD_THRESHOLD - currentPoints;
        }
        return { points: currentPoints, tier: currentTier, nextTier, pointsToNextTier };
    }

    get tierDisplayName() {
        return this.tier || 'Bronze';
    }

    get nextTierDisplayName() {
        const currentStatus = this.status;
        return currentStatus?.nextTier || '';
    }

    get progressInfo() {
        const currentStatus = this.status;
        if (!currentStatus || !currentStatus.nextTier) {
            return '';
        }
        return `${currentStatus.pointsToNextTier} points to ${currentStatus.nextTier}`;
    }

    get badgeUrl() {
        if (this.tier === 'Gold') {
            return this.goldBadge;
        }
        if (this.tier === 'Silver') {
            return this.silverBadge;
        }
        return this.bronzeBadge;
    }

    get badgeAlt() {
        return `${this.tierDisplayName} loyalty tier`;
    }

    get isGold() {
        return this.tier === 'Gold';
    }

    get progressBarStyle() {
        const currentPoints = this.points || 0;
        let percentage = 0;
        if (currentPoints < SILVER_THRESHOLD) {
            percentage = Math.round((currentPoints / SILVER_THRESHOLD) * 100);
        } else if (currentPoints < GOLD_THRESHOLD) {
            percentage = Math.round(
                ((currentPoints - SILVER_THRESHOLD) / (GOLD_THRESHOLD - SILVER_THRESHOLD)) * 100
            );
        } else {
            percentage = 100;
        }
        return `width: ${percentage}%`;
    }
}
