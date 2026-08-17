import { LightningElement } from 'lwc';
import tireDependenciesResource from '@salesforce/resourceUrl/continentalTireSizeDependencies';
import tireProductsResource from '@salesforce/resourceUrl/continentalTireProducts';

export default class TireSizeSelector extends LightningElement {
    dependencyTree = {};
    sourceConfig = {};
    catalogProducts = [];

    isLoading = true;
    loadError;

    selectedWidth = '';
    selectedAspectRatio = '';
    selectedDiameter = '';
    selectedLoadSpeedIndex = '';

    widthOptions = [];
    aspectRatioOptions = [];
    diameterOptions = [];
    loadSpeedOptions = [];

    connectedCallback() {
        this.loadDependencies();
    }

    async loadDependencies() {
        try {
            const [dependenciesResponse, productsResponse] = await Promise.all([
                fetch(tireDependenciesResource),
                fetch(tireProductsResource)
            ]);
            if (!dependenciesResponse.ok) {
                throw new Error(`Failed to load dependency resource: ${dependenciesResponse.status}`);
            }
            if (!productsResponse.ok) {
                throw new Error(`Failed to load product resource: ${productsResponse.status}`);
            }

            const [dependenciesPayload, productsPayload] = await Promise.all([
                dependenciesResponse.json(),
                productsResponse.json()
            ]);

            this.dependencyTree = dependenciesPayload.dependencyTree || {};
            this.sourceConfig = dependenciesPayload.source || {};
            this.catalogProducts = productsPayload.products || [];
            this.widthOptions = this.toComboboxOptions(Object.keys(this.dependencyTree));
            this.loadError = undefined;
        } catch (error) {
            this.loadError = error instanceof Error ? error.message : 'Unknown loading error';
        } finally {
            this.isLoading = false;
        }
    }

    get isSearchDisabled() {
        return !(this.selectedWidth && this.selectedAspectRatio && this.selectedDiameter);
    }

    get hasError() {
        return Boolean(this.loadError);
    }

    get hasLoadSpeedOptions() {
        return this.loadSpeedOptions.length > 0;
    }

    get isAspectDisabled() {
        return !this.selectedWidth;
    }

    get isDiameterDisabled() {
        return !this.selectedAspectRatio;
    }

    get isLoadSpeedDisabled() {
        return !this.selectedDiameter || !this.hasLoadSpeedOptions;
    }

    get widthHelpText() {
        return 'Tire width in millimeters';
    }

    get aspectHelpText() {
        return 'Sidewall height as percentage of width';
    }

    get diameterHelpText() {
        return 'Rim diameter in inches';
    }

    handleWidthChange(event) {
        this.selectedWidth = event.detail.value;
        this.selectedAspectRatio = '';
        this.selectedDiameter = '';
        this.selectedLoadSpeedIndex = '';

        const aspectKeys = Object.keys(this.dependencyTree[this.selectedWidth] || {});
        this.aspectRatioOptions = this.toComboboxOptions(aspectKeys);
        this.diameterOptions = [];
        this.loadSpeedOptions = [];
    }

    handleAspectRatioChange(event) {
        this.selectedAspectRatio = event.detail.value;
        this.selectedDiameter = '';
        this.selectedLoadSpeedIndex = '';

        const diameterNode = this.getDiameterNode();
        this.diameterOptions = this.toComboboxOptions(Object.keys(diameterNode));
        this.loadSpeedOptions = [];
    }

    handleDiameterChange(event) {
        this.selectedDiameter = event.detail.value;
        this.selectedLoadSpeedIndex = '';
        this.loadSpeedOptions = this.buildLoadSpeedOptions();
    }

    handleLoadSpeedChange(event) {
        this.selectedLoadSpeedIndex = event.detail.value;
    }

    handleShowResults() {
        const matchedSizes = this.getMatchedSizes();
        const payload = {
            width: this.selectedWidth,
            aspectRatio: this.selectedAspectRatio,
            diameter: this.selectedDiameter,
            loadSpeedIndex: this.selectedLoadSpeedIndex || null,
            sizeLabels: matchedSizes,
            source: this.sourceConfig
        };

        this.dispatchEvent(
            new CustomEvent('search', {
                detail: payload,
                bubbles: true,
                composed: true
            })
        );
    }

    getDiameterNode() {
        return (
            this.dependencyTree?.[this.selectedWidth]?.[this.selectedAspectRatio] || {}
        );
    }

    getMatchedSizes() {
        if (!this.selectedDiameter) {
            return [];
        }

        const diameterNode = this.getDiameterNode();
        return diameterNode[this.selectedDiameter] || [];
    }

    buildLoadSpeedOptions() {
        const selectedWidth = Number(this.selectedWidth);
        const selectedAspectRatio = Number(this.selectedAspectRatio);
        const selectedDiameter = Number(this.selectedDiameter);
        if (
            !Number.isFinite(selectedWidth) ||
            !Number.isFinite(selectedAspectRatio) ||
            !Number.isFinite(selectedDiameter)
        ) {
            return [];
        }

        const options = new Set();
        this.catalogProducts.forEach((product) => {
            const width = Number(product.width);
            const aspectRatio = Number(product.aspectRatio);
            const diameter = Number(product.diameter);
            if (
                width === selectedWidth &&
                aspectRatio === selectedAspectRatio &&
                diameter === selectedDiameter
            ) {
                const speedLoad = product.speedLoadIndex || product.loadSpeedIndex;
                if (speedLoad) {
                    options.add(speedLoad);
                }
            }
        });

        return [...options]
            .sort()
            .map((entry) => ({
                label: entry,
                value: entry
            }));
    }

    toComboboxOptions(values) {
        return [...values]
            .sort((a, b) => Number(a) - Number(b))
            .map((entry) => ({
                label: String(entry),
                value: String(entry)
            }));
    }
}
