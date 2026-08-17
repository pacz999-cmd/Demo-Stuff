import { LightningElement, api, wire } from 'lwc';
import USER_ID from '@salesforce/user/Id';
import { getRecord, getFieldValue } from 'lightning/uiRecordApi';
import FIRST_NAME_FIELD from '@salesforce/schema/User.FirstName';

const USER_FIELDS = [FIRST_NAME_FIELD];

export default class ContiUserGreeting extends LightningElement {
    @api prefixText = 'Hi, ';
    @api suffixText = '';
    @api fontSizePx = 16;
    @api textColor = '#1f1f1f';

    @wire(getRecord, { recordId: USER_ID, fields: USER_FIELDS })
    userRecord;

    get firstName() {
        return getFieldValue(this.userRecord.data, FIRST_NAME_FIELD);
    }

    get greetingText() {
        const firstName = this.firstName;
        if (!firstName) {
            return `${this.prefixText || ''}${this.suffixText || ''}`.trim() || 'Hi';
        }
        return `${this.prefixText || ''}${firstName}${this.suffixText || ''}`;
    }

    get greetingStyle() {
        const size = this.normalizeFontSize(this.fontSizePx);
        const color = this.textColor || '#1f1f1f';
        return `font-size:${size}px;color:${color};line-height:1.2;`;
    }

    normalizeFontSize(value) {
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) return 16;
        return Math.min(Math.max(Math.round(parsed), 10), 72);
    }
}
