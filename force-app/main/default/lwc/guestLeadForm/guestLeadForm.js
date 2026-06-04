import { LightningElement, api, track } from 'lwc';
import createLead from '@salesforce/apex/GuestLeadFormController.createLead';

const DEFAULT_ERROR = 'Looks like something went wrong.';

export default class GuestLeadForm extends LightningElement {
    @api firstNameLabel = 'First Name';
    @api firstNamePlaceholder = '';
    @api lastNameLabel = 'Last Name';
    @api lastNamePlaceholder = '';
    @api phoneLabel = 'Phone #';
    @api phonePlaceholder = '';
    @api emailLabel = 'Email';
    @api emailPlaceholder = '';
    @api companyLabel = '* Company';
    @api companyPlaceholder = '';
    @api buttonLabel = 'Submit';
    @api leadSource = '';
    @api recordTypeDeveloperName = '';
    @api successText = 'Thank you';
    @api errorText = DEFAULT_ERROR;
    @api formWidth = '100%';
    @api horizontalAlignment = 'left';

    @api customField1ApiName = '';
    @api customField1Label = '';
    @api customField1Placeholder = '';
    @api customField2ApiName = '';
    @api customField2Label = '';
    @api customField2Placeholder = '';
    @api customField3ApiName = '';
    @api customField3Label = '';
    @api customField3Placeholder = '';
    @api customField4ApiName = '';
    @api customField4Label = '';
    @api customField4Placeholder = '';
    @api customField5ApiName = '';
    @api customField5Label = '';
    @api customField5Placeholder = '';

    @track state = {
        firstName: '',
        lastName: '',
        phone: '',
        email: '',
        company: ''
    };
    @track extraValues = {};

    submitting = false;
    errorMessage = '';
    successMessage = '';

    get baseFields() {
        return [
            this.buildField('firstName', this.firstNameLabel, this.firstNamePlaceholder, 'text', false, 'half'),
            this.buildField('lastName', this.lastNameLabel, this.lastNamePlaceholder, 'text', true, 'half'),
            this.buildField('phone', this.phoneLabel, this.phonePlaceholder, 'tel', false, 'full'),
            this.buildField('email', this.emailLabel, this.emailPlaceholder, 'email', false, 'full'),
            this.buildField('company', this.companyLabel, this.companyPlaceholder, 'text', true, 'full')
        ];
    }

    get configuredExtraFields() {
        const rawFields = [
            this.extraFieldConfig(1),
            this.extraFieldConfig(2),
            this.extraFieldConfig(3),
            this.extraFieldConfig(4),
            this.extraFieldConfig(5)
        ];
        return rawFields.filter((field) => field.apiName);
    }

    get wrapperStyle() {
        const alignmentMap = {
            left: 'flex-start',
            center: 'center',
            right: 'flex-end'
        };
        const align = alignmentMap[this.horizontalAlignment] || 'flex-start';
        return `max-width:${this.formWidth};margin-left:${align === 'left' ? '0' : 'auto'};margin-right:${align === 'right' ? '0' : 'auto'};`;
    }

    buildField(key, label, placeholder, type, required, layoutClass) {
        return {
            key,
            label,
            placeholder,
            type,
            required,
            value: this.state[key],
            containerClass: `field ${layoutClass}`
        };
    }

    extraFieldConfig(index) {
        const apiName = (this[`customField${index}ApiName`] || '').trim();
        return {
            key: `customField${index}`,
            apiName,
            label: this[`customField${index}Label`] || apiName,
            placeholder: this[`customField${index}Placeholder`] || '',
            value: this.extraValues[`customField${index}`] || ''
        };
    }

    handleInput(event) {
        const { name, value } = event.target;
        this.state = { ...this.state, [name]: value };
    }

    handleExtraInput(event) {
        const key = event.target.dataset.key;
        this.extraValues = { ...this.extraValues, [key]: event.target.value };
    }

    async handleSubmit() {
        this.errorMessage = '';
        this.successMessage = '';

        if (!this.state.lastName || !this.state.company) {
            this.errorMessage = this.errorText || DEFAULT_ERROR;
            return;
        }

        this.submitting = true;
        try {
            const extras = {};
            this.configuredExtraFields.forEach((field) => {
                extras[field.apiName] = field.value || '';
            });

            await createLead({
                firstName: this.state.firstName,
                lastName: this.state.lastName,
                phone: this.state.phone,
                email: this.state.email,
                company: this.state.company,
                leadSource: this.leadSource,
                recordTypeDeveloperName: this.recordTypeDeveloperName,
                extraFields: extras
            });

            this.successMessage = this.successText;
            this.resetForm();
        } catch (error) {
            this.errorMessage = this.extractError(error);
        } finally {
            this.submitting = false;
        }
    }

    resetForm() {
        this.state = { firstName: '', lastName: '', phone: '', email: '', company: '' };
        this.extraValues = {};
        this.template.querySelectorAll('input').forEach((input) => {
            input.value = '';
        });
    }

    extractError(error) {
        if (error?.body?.message) {
            return error.body.message;
        }
        return this.errorText || DEFAULT_ERROR;
    }
}
