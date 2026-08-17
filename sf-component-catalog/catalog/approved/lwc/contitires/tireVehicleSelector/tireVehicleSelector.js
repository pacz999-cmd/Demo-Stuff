import { LightningElement, api } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import vehicleDependenciesResource from '@salesforce/resourceUrl/continentalVehicleDependencies';

export default class TireVehicleSelector extends NavigationMixin(LightningElement) {
    @api cardTitle = 'Search by Vehicle';
    @api searchButtonLabel = 'Show Results';
    @api categoryRouteBasePath = '/category';
    @api categorySlug = 'all-products';
    @api categoryId = '0ZGbm000000dmG5GAI';
    @api widthFieldNameOrId = 'Tire_Width_Facet__c';
    @api aspectFieldNameOrId = 'Tire_Aspect_Facet__c';
    @api diameterFieldNameOrId = 'Tire_Diameter_Facet__c';
    @api speedLoadFieldNameOrId = 'Tire_Speed_Load_Index__c';
    @api includeSpeedLoadRefinement;
    @api debugPayload = false;

    dependencyTree = {};
    isLoading = true;
    loadError;
    scopeMessage;

    selectedBrand = '';
    selectedModel = '';
    selectedYear = '';
    selectedVersion = '';
    selectedFitment = '';

    brandOptions = [];
    modelOptions = [];
    yearOptions = [];
    versionOptions = [];
    fitmentOptions = [];

    connectedCallback() {
        this.loadDependencies();
    }

    async loadDependencies() {
        try {
            const response = await fetch(vehicleDependenciesResource);
            if (!response.ok) {
                throw new Error(`Failed to load vehicle dependency resource: ${response.status}`);
            }
            const payload = await response.json();
            this.dependencyTree = payload.dependencyTree || {};
            this.brandOptions = this.toComboboxOptions(Object.keys(this.dependencyTree));
            this.loadError = undefined;
        } catch (error) {
            this.loadError = error instanceof Error ? error.message : 'Unknown loading error';
        } finally {
            this.isLoading = false;
        }
    }

    get hasError() {
        return Boolean(this.loadError);
    }

    get computedCardTitle() {
        return (this.cardTitle || '').trim() || 'Search by Vehicle';
    }

    get computedSearchButtonLabel() {
        return (this.searchButtonLabel || '').trim() || 'Show Results';
    }

    get isSearchDisabled() {
        return !(this.selectedBrand && this.selectedModel);
    }

    get includeSpeedLoadRefinementEnabled() {
        return this.includeSpeedLoadRefinement !== false && this.includeSpeedLoadRefinement !== 'false';
    }

    get isModelDisabled() {
        return !this.selectedBrand;
    }

    get isYearDisabled() {
        return !this.selectedModel;
    }

    get isVersionDisabled() {
        return !this.selectedModel || this.versionOptions.length === 0;
    }

    get isFitmentDisabled() {
        return !this.selectedModel || this.fitmentOptions.length === 0;
    }

    handleBrandChange(event) {
        this.selectedBrand = event.detail.value;
        this.selectedModel = '';
        this.selectedYear = '';
        this.selectedVersion = '';
        this.selectedFitment = '';

        this.modelOptions = this.toComboboxOptions(Object.keys(this.dependencyTree?.[this.selectedBrand] || {}));
        this.updateSelectionScope();
    }

    handleModelChange(event) {
        this.selectedModel = event.detail.value;
        this.selectedYear = '';
        this.selectedVersion = '';
        this.selectedFitment = '';

        this.updateSelectionScope();
    }

    handleYearChange(event) {
        this.selectedYear = event.detail.value;
        this.selectedVersion = '';
        this.selectedFitment = '';
        this.updateSelectionScope();
    }

    handleVersionChange(event) {
        this.selectedVersion = event.detail.value;
        this.selectedFitment = '';
        this.updateSelectionScope();
    }

    handleFitmentChange(event) {
        this.selectedFitment = event.detail.value;
        this.scopeMessage = undefined;
    }

    handleShowResults() {
        const currentFitments = this.getCurrentFitmentsForScope();
        if (!currentFitments.length) {
            this.scopeMessage = 'No compatible fitments found for the current selection.';
            return;
        }
        this.scopeMessage = undefined;

        const fitmentsToApply = this.selectedFitment
            ? currentFitments.filter((fitment) => fitment.fitmentLabel === this.selectedFitment)
            : currentFitments;
        if (!fitmentsToApply.length) {
            return;
        }

        const widthValues = this.toDistinctStringValues(fitmentsToApply.map((fitment) => fitment.width));
        const aspectValues = this.toDistinctStringValues(
            fitmentsToApply.map((fitment) => fitment.aspectRatio)
        );
        const diameterValues = this.toDistinctStringValues(
            fitmentsToApply.map((fitment) => fitment.diameter)
        );
        const speedLoadValues = this.toDistinctStringValues(
            fitmentsToApply.map((fitment) => fitment.speedLoadIndex)
        );

        const refinements = [
            this.createDistinctRefinement(this.widthFieldNameOrId, widthValues, 'Custom'),
            this.createDistinctRefinement(this.aspectFieldNameOrId, aspectValues, 'Custom'),
            this.createDistinctRefinement(this.diameterFieldNameOrId, diameterValues, 'Custom')
        ];

        const hasExplicitFitment = Boolean(this.selectedFitment);
        if (this.includeSpeedLoadRefinementEnabled && hasExplicitFitment && speedLoadValues.length) {
            refinements.push(
                this.createDistinctRefinement(
                    this.speedLoadFieldNameOrId,
                    speedLoadValues,
                    'String'
                )
            );
        }

        const queryEntries = [
            [`search-facet-section-${this.widthFieldNameOrId}`, 'true'],
            [`search-facet-section-${this.aspectFieldNameOrId}`, 'true'],
            [`search-facet-section-${this.diameterFieldNameOrId}`, 'true'],
            ['page', '1'],
            ['category', this.categoryId],
            ['refinements', encodeURIComponent(JSON.stringify(refinements))]
        ];

        if (this.includeSpeedLoadRefinementEnabled && hasExplicitFitment && speedLoadValues.length) {
            queryEntries.push([`search-facet-section-${this.speedLoadFieldNameOrId}`, 'true']);
        }

        const targetUrl = `${this.categoryRouteBasePath.replace(/\/$/, '')}/${encodeURIComponent(this.categorySlug)}/${encodeURIComponent(this.categoryId)}?${new URLSearchParams(queryEntries).toString()}`;

        if (this.debugPayload) {
            // eslint-disable-next-line no-console
            console.info('[tireVehicleSelector] Generated search payload', {
                selectedBrand: this.selectedBrand,
                selectedModel: this.selectedModel,
                selectedYear: this.selectedYear,
                selectedVersion: this.selectedVersion,
                selectedFitment: this.selectedFitment,
                fitmentCountApplied: fitmentsToApply.length,
                hasExplicitFitment,
                refinements,
                targetUrl
            });
        }

        this[NavigationMixin.Navigate]({
            type: 'standard__webPage',
            attributes: {
                url: targetUrl
            }
        });
    }

    updateSelectionScope() {
        this.yearOptions = this.toComboboxOptions(this.getYearValuesForSelectedModel());
        this.versionOptions = this.toComboboxOptions(this.getVersionValuesForCurrentScope());
        this.fitmentOptions = this.toFitmentOptions(this.getCurrentFitmentsForScope());
        this.scopeMessage = undefined;
    }

    getYearValuesForSelectedModel() {
        const yearNode = this.dependencyTree?.[this.selectedBrand]?.[this.selectedModel] || {};
        return Object.keys(yearNode);
    }

    getVersionValuesForCurrentScope() {
        const yearNode = this.dependencyTree?.[this.selectedBrand]?.[this.selectedModel] || {};
        if (!this.selectedYear) {
            const versions = [];
            Object.values(yearNode).forEach((versionNode) => {
                versions.push(...Object.keys(versionNode || {}));
            });
            return this.toDistinctStringValues(versions);
        }
        return Object.keys(yearNode?.[this.selectedYear] || {});
    }

    getCurrentFitmentsForScope() {
        if (!(this.selectedBrand && this.selectedModel)) {
            return [];
        }
        const yearNode = this.dependencyTree?.[this.selectedBrand]?.[this.selectedModel] || {};
        const fitments = [];
        Object.entries(yearNode).forEach(([yearLabel, versionNode]) => {
            if (this.selectedYear && this.selectedYear !== yearLabel) {
                return;
            }
            Object.entries(versionNode || {}).forEach(([versionLabel, versionFitments]) => {
                if (this.selectedVersion && this.selectedVersion !== versionLabel) {
                    return;
                }
                (versionFitments || []).forEach((fitment) => {
                    fitments.push(fitment);
                });
            });
        });
        return fitments;
    }

    toFitmentOptions(fitments) {
        const byLabel = new Map();
        fitments.forEach((fitment) => {
            if (fitment?.fitmentLabel && !byLabel.has(fitment.fitmentLabel)) {
                byLabel.set(fitment.fitmentLabel, {
                    label: fitment.fitmentLabel,
                    value: fitment.fitmentLabel
                });
            }
        });
        return [...byLabel.values()].sort((a, b) => a.label.localeCompare(b.label));
    }

    createDistinctRefinement(nameOrId, values, attributeType) {
        return {
            nameOrId,
            type: 'DistinctValue',
            attributeType,
            values
        };
    }

    toDistinctStringValues(values) {
        const normalized = values
            .map((value) => (value === null || value === undefined ? '' : String(value).trim()))
            .filter((value) => Boolean(value));
        return [...new Set(normalized)];
    }

    toComboboxOptions(values) {
        return [...values].sort((a, b) => String(a).localeCompare(String(b))).map((entry) => ({
            label: String(entry),
            value: String(entry)
        }));
    }
}
