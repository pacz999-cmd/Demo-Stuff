import { LightningElement, wire, track, api } from 'lwc';
import { getRecord, getFieldValue } from 'lightning/uiRecordApi';
import USER_ID from '@salesforce/user/Id';
import USER_CONTACT_ID from '@salesforce/schema/User.ContactId';
import USER_FIRSTNAME from '@salesforce/schema/User.FirstName';
import CONTACT_LOYALTY_TIER from '@salesforce/schema/Contact.SDO_Cust360_Metric1__c';
import CONTACT_LOYALTY_PTS from '@salesforce/schema/Contact.SDO_Cust360_Metric2__c';
import BRONZE_BADGE from '@salesforce/resourceUrl/KarcherLoyaltyBronze';
import SILVER_BADGE from '@salesforce/resourceUrl/KarcherLoyaltySilver';
import GOLD_BADGE from '@salesforce/resourceUrl/KarcherLoyaltyGold';

const SILVER_THRESHOLD = 2000;
const GOLD_THRESHOLD = 10000;

export default class SdoScomLoyaltyGreeting extends LightningElement {
    @api greetingTemplate;
    @api backgroundColor;
    @api textColor;
    @api themeTextStyle;
    @api textOrientation;
    @track _contactId;
    @track _firstName;
    @track _points = 0;
    @track _tier = null;
    @track status;
    @track isVisible = false;

    bronzeBadge = BRONZE_BADGE;
    silverBadge = SILVER_BADGE;
    goldBadge = GOLD_BADGE;

    get isExperienceBuilderPreview() {
        const href = typeof window !== 'undefined' ? window.location.href : '';
        return href.includes('sitepreview') || href.includes('livepreview') || href.includes('builder');
    }

    get shouldRender() {
        return this.isVisible || this.isExperienceBuilderPreview || !this._contactId;
    }

    get containerStyle() {
        const styles = [];
        if (this.backgroundColor && this.backgroundColor.trim()) {
            styles.push(`background:${this.backgroundColor.trim()}`);
        }
        if (this.textColor && this.textColor.trim()) {
            styles.push(`color:${this.textColor.trim()}`);
        }
        return styles.join(';');
    }

    get textStyle() {
        const raw = (this.themeTextStyle || 'h2').toLowerCase().replace(/\s+/g, '');
        const map = {
            heading1: 'h1',
            heading2: 'h2',
            heading3: 'h3',
            body: 'p'
        };
        let value = map[raw] || raw;
        if (!['h1', 'h2', 'h3', 'p'].includes(value)) {
            if (raw.includes('1')) value = 'h1';
            else if (raw.includes('2')) value = 'h2';
            else if (raw.includes('3')) value = 'h3';
            else if (raw.includes('body') || raw.includes('text') || raw.includes('paragraph')) value = 'p';
        }
        if (['h1', 'h2', 'h3', 'p'].includes(value)) {
            return value;
        }
        return 'h2';
    }

    get textClass() {
        return `loyalty-greeting-text ${this.textAlignmentClass} ${this.themeTypographyClass}`;
    }

    get themeTypographyClass() {
        if (this.textStyle === 'h1') return 'slds-text-heading_large';
        if (this.textStyle === 'h2') return 'slds-text-heading_medium';
        if (this.textStyle === 'h3') return 'slds-text-heading_small';
        return 'slds-text-body_regular';
    }

    get textAlignmentClass() {
        const value = (this.textOrientation || 'left').toLowerCase().trim();
        if (value === 'center') return 'align-center';
        if (value === 'right') return 'align-right';
        return 'align-left';
    }

    get isH1() {
        return this.textStyle === 'h1';
    }

    get isH2() {
        return this.textStyle === 'h2';
    }

    get isH3() {
        return this.textStyle === 'h3';
    }

    get isBody() {
        return this.textStyle === 'p';
    }

    normalizePoints(value) {
        const points = Number(value);
        return Number.isFinite(points) ? points : 0;
    }

    tierFromPoints(points) {
        if (points >= GOLD_THRESHOLD) return 'Gold';
        if (points >= SILVER_THRESHOLD) return 'Silver';
        return 'Bronze';
    }

    normalizeTier(value, points) {
        const tier = (value || '').toString().trim().toLowerCase();
        if (tier === 'gold') return 'Gold';
        if (tier === 'silver') return 'Silver';
        if (tier === 'bronze') return 'Bronze';
        return this.tierFromPoints(points);
    }

    buildStatus(rawPoints, rawTier) {
        const points = this.normalizePoints(rawPoints);
        const tier = this.normalizeTier(rawTier, points);
        return {
            points,
            tier,
            nextTier: this._nextTier(points),
            pointsToNextTier: this._pointsToNext(points)
        };
    }

    formatTemplate(name, tier, points, nextTier, pointsToNextTier) {
        if (this.greetingTemplate && this.greetingTemplate.trim()) {
            return this.greetingTemplate
                .replaceAll('{name}', name)
                .replaceAll('{tier}', tier)
                .replaceAll('{points}', String(points))
                .replaceAll('{nextTier}', nextTier || '')
                .replaceAll('{pointsToNextTier}', String(pointsToNextTier));
        }
        if (!nextTier) {
            return `Hi ${name}! You are a ${tier} status member with ${points} points - our highest tier!`;
        }
        return `Hi ${name}! You are a ${tier} status member with ${points} points. You need ${pointsToNextTier} more points to reach ${nextTier} status.`;
    }

    @wire(getRecord, { recordId: USER_ID, fields: [USER_CONTACT_ID, USER_FIRSTNAME] })
    wiredUser({ data, error }) {
        if (data) {
            this._contactId = getFieldValue(data, USER_CONTACT_ID);
            this._firstName = getFieldValue(data, USER_FIRSTNAME);
        } else if (error) {
            console.error('Loyalty greeting - user wire error', JSON.stringify(error));
        }
    }

    @wire(getRecord, { recordId: '$_contactId', fields: [CONTACT_LOYALTY_TIER, CONTACT_LOYALTY_PTS] })
    wiredContact({ data, error }) {
        if (data) {
            const rawPts = getFieldValue(data, CONTACT_LOYALTY_PTS);
            this._points = rawPts != null ? (parseInt(String(rawPts).replace(/[^0-9]/g, ''), 10) || 0) : 0;
            this._tier = getFieldValue(data, CONTACT_LOYALTY_TIER) || 'Bronze';
            this.status = this.buildStatus(this._points, this._tier);
            this.isVisible = true;
        } else if (error) {
            console.error('Loyalty greeting - contact wire error', JSON.stringify(error));
            this.status = this.buildStatus(0, 'Bronze');
            this.isVisible = true;
        }
    }

    _nextTier(pts) {
        if (pts >= GOLD_THRESHOLD) return null;
        if (pts >= SILVER_THRESHOLD) return 'Gold';
        return 'Silver';
    }

    _pointsToNext(pts) {
        if (pts >= GOLD_THRESHOLD) return 0;
        if (pts >= SILVER_THRESHOLD) return GOLD_THRESHOLD - pts;
        return SILVER_THRESHOLD - pts;
    }

    get greetingMessage() {
        if (!this.status) {
            if (!this.isExperienceBuilderPreview && this._contactId) return '';
            return this.formatTemplate('there', 'Bronze', 0, 'Silver', SILVER_THRESHOLD);
        }
        const { tier, points, nextTier, pointsToNextTier } = this.status;
        const name = this._firstName || 'there';
        return this.formatTemplate(name, tier, points, nextTier, pointsToNextTier);
    }

    get badgeUrl() {
        if (!this.status) return this.bronzeBadge;
        if (this.status.tier === 'Gold') return this.goldBadge;
        if (this.status.tier === 'Silver') return this.silverBadge;
        return this.bronzeBadge;
    }

    get badgeAlt() {
        return this.status ? `${this.status.tier} tier badge` : 'Loyalty badge';
    }
}
