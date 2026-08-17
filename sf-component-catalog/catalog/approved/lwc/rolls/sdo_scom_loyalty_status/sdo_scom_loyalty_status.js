import { LightningElement, wire, track } from 'lwc';
import { getRecord, getFieldValue } from 'lightning/uiRecordApi';
import USER_ID from '@salesforce/user/Id';
import USER_CONTACT_ID from '@salesforce/schema/User.ContactId';
import CONTACT_LOYALTY_TIER from '@salesforce/schema/Contact.SDO_Cust360_Metric1__c';
import CONTACT_LOYALTY_PTS from '@salesforce/schema/Contact.SDO_Cust360_Metric2__c';
import BRONZE_BADGE from '@salesforce/resourceUrl/KarcherLoyaltyBronze';
import SILVER_BADGE from '@salesforce/resourceUrl/KarcherLoyaltySilver';
import GOLD_BADGE from '@salesforce/resourceUrl/KarcherLoyaltyGold';

const SILVER_THRESHOLD = 2000;
const GOLD_THRESHOLD   = 10000;

export default class SdoScomLoyaltyStatus extends LightningElement {
    @track _contactId;
    @track _points = 0;
    @track _tier   = null;
    @track isLoaded = false;

    bronzeBadge = BRONZE_BADGE;
    silverBadge = SILVER_BADGE;
    goldBadge   = GOLD_BADGE;

    // ── Wire chain: User → Contact (loyalty fields read directly from Contact) ──

    @wire(getRecord, { recordId: USER_ID, fields: [USER_CONTACT_ID] })
    wiredUser({ data, error }) {
        if (data) {
            this._contactId = getFieldValue(data, USER_CONTACT_ID);
            if (!this._contactId) this.isLoaded = true; // admin/preview — nothing to load
        } else if (error) {
            console.error('Loyalty status - user wire error', JSON.stringify(error));
            this.isLoaded = true;
        }
    }

    @wire(getRecord, {
        recordId: '$_contactId',
        fields: [CONTACT_LOYALTY_TIER, CONTACT_LOYALTY_PTS]
    })
    wiredContact({ data, error }) {
        if (data) {
            const rawPts = getFieldValue(data, CONTACT_LOYALTY_PTS);
            this._points = rawPts != null ? (parseInt(String(rawPts).replace(/[^0-9]/g, ''), 10) || 0) : 0;
            this._tier   = getFieldValue(data, CONTACT_LOYALTY_TIER) || 'Bronze';
            this.isLoaded = true;
        } else if (error) {
            console.error('Loyalty status - contact wire error', JSON.stringify(error));
            this.isLoaded = true;
        }
    }

    // ── Status computed value ────────────────────────────────────────────

    get status() {
        if (!this._tier) return null;
        const points = this._points || 0;
        const tier   = this._tier;
        let nextTier = null;
        let pointsToNextTier = 0;
        if (points < SILVER_THRESHOLD) {
            nextTier = 'Silver';
            pointsToNextTier = SILVER_THRESHOLD - points;
        } else if (points < GOLD_THRESHOLD) {
            nextTier = 'Gold';
            pointsToNextTier = GOLD_THRESHOLD - points;
        }
        return { points, tier, nextTier, pointsToNextTier };
    }

    // ── German display helpers ────────────────────────────────────────────

    _deLabel(tier) {
        if (tier === 'Silver') return 'Silber';
        return tier || '';
    }

    get tierDisplayName() {
        return this._deLabel(this._tier || 'Bronze');
    }

    get nextTierDisplayName() {
        const s = this.status;
        return s && s.nextTier ? this._deLabel(s.nextTier) : '';
    }

    get progressInfo() {
        const s = this.status;
        if (!s || !s.nextTier) return '';
        return `${s.pointsToNextTier} Punkte bis ${this._deLabel(s.nextTier)}`;
    }

    // ── Badge / display getters ───────────────────────────────────────────

    get badgeUrl() {
        if (this._tier === 'Gold')   return this.goldBadge;
        if (this._tier === 'Silver') return this.silverBadge;
        return this.bronzeBadge;
    }

    get badgeAlt() {
        return `${this.tierDisplayName} Treuestufe`;
    }

    get isGold() {
        return this._tier === 'Gold';
    }

    get progressBarStyle() {
        const points = this._points || 0;
        let pct = 0;
        if (points < SILVER_THRESHOLD) {
            pct = Math.round((points / SILVER_THRESHOLD) * 100);
        } else if (points < GOLD_THRESHOLD) {
            pct = Math.round(((points - SILVER_THRESHOLD) / (GOLD_THRESHOLD - SILVER_THRESHOLD)) * 100);
        } else {
            pct = 100;
        }
        return `width: ${pct}%`;
    }
}