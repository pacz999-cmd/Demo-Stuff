import { LightningElement, api } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import tireDependenciesResource from '@salesforce/resourceUrl/continentalTireSizeDependencies';
import tireProductsResource from '@salesforce/resourceUrl/continentalTireProducts';

export default class TireSizeSelectorStandard extends NavigationMixin(LightningElement) {
    buildVersion = '2026-08-09-native-contract-12';
    @api cardTitle = 'Search by Tire Size (Standard Search)';
    @api searchButtonLabel = 'Show Standard Results';
    @api searchTerm = 'tire';
    @api searchResultsBasePath = '/global-search';
    @api routeMode = 'categoryBaseline';
    @api categoryRouteBasePath = '/category';
    @api categorySlug = 'all-products';
    @api categoryId = '0ZGbm000000dmG5GAI';
    @api baselineMode = 'compositeSizeTerm';
    @api baselineSearchTerm = '';
    @api useFacetOnlyNavigation;
    @api includeRefinementsParam = false;
    @api includeFacetsParam = false;
    @api facetsFieldNameOrId = 'Tire_Diameter_Facet__c';
    @api includeSpeedLoadRefinement = false;
    // Legacy controls retained for backward compatibility; baselineMode supersedes these.
    @api useWidthAsSearchTerm;
    @api omitWidthRefinementWhenUsingWidthTerm;
    // Legacy Experience Builder properties retained for backward compatibility.
    @api widthFieldApiName = 'Tire_Width__c';
    @api aspectFieldApiName = 'Tire_Aspect_Ratio__c';
    @api diameterFieldApiName = 'Tire_Diameter__c';
    @api speedLoadFieldApiName = 'Tire_Speed_Load_Index__c';
    @api widthFieldNameOrId = 'Tire_Width_Facet__c';
    @api widthAttributeType = 'Custom';
    @api aspectFieldNameOrId = 'Tire_Aspect_Facet__c';
    @api aspectAttributeType = 'Custom';
    @api diameterFieldNameOrId = 'Tire_Diameter_Facet__c';
    @api diameterAttributeType = 'Custom';
    @api speedLoadFieldNameOrId = 'Tire_Speed_Load_Index__c';
    @api speedLoadAttributeType = 'String';
    @api defaultSortRule;
    @api defaultCategoryId;
    @api debugPayload = false;

    dependencyTree = {};
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
            this.catalogProducts = productsPayload.products || [];
            this.widthOptions = this.toComboboxOptions(Object.keys(this.dependencyTree));
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

    get isSearchDisabled() {
        return !(this.selectedWidth && this.selectedAspectRatio && this.selectedDiameter);
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

    get computedCardTitle() {
        return (this.cardTitle || '').trim() || 'Search by Tire Size (Standard Search)';
    }

    get computedSearchButtonLabel() {
        return (this.searchButtonLabel || '').trim() || 'Show Standard Results';
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
        const normalizedSearchTerm = this.normalizeSearchTerm(this.searchTerm);
        const widthNameOrId = this.resolveRefinementNameOrId(
            this.widthFieldNameOrId || this.widthFieldApiName
        );
        const aspectNameOrId = this.resolveRefinementNameOrId(
            this.aspectFieldNameOrId || this.aspectFieldApiName
        );
        const diameterNameOrId = this.resolveRefinementNameOrId(
            this.diameterFieldNameOrId || this.diameterFieldApiName
        );
        const speedLoadNameOrId = this.resolveRefinementNameOrId(
            this.speedLoadFieldNameOrId || this.speedLoadFieldApiName
        );
        const widthAttributeType = this.resolveAttributeType(widthNameOrId, this.widthAttributeType);
        const aspectAttributeType = this.resolveAttributeType(aspectNameOrId, this.aspectAttributeType);
        const diameterAttributeType = this.resolveAttributeType(
            diameterNameOrId,
            this.diameterAttributeType
        );
        const speedLoadAttributeType = this.resolveAttributeType(
            speedLoadNameOrId,
            this.speedLoadAttributeType
        );
        // Keep native storefront facet order to minimize URL contract differences.
        const refinements = [
            this.createDistinctRefinement(aspectNameOrId, this.selectedAspectRatio, aspectAttributeType),
            this.createDistinctRefinement(diameterNameOrId, this.selectedDiameter, diameterAttributeType),
            this.createDistinctRefinement(widthNameOrId, this.selectedWidth, widthAttributeType)
        ];

        if (this.selectedLoadSpeedIndex) {
            refinements.push(
                this.createDistinctRefinement(
                    speedLoadNameOrId,
                    this.selectedLoadSpeedIndex,
                    speedLoadAttributeType
                )
            );
        }

        const queryEntries = [];
        // Always emit the three primary facet section flags to mirror standard search behavior.
        queryEntries.push([`search-facet-section-${widthNameOrId}`, 'true']);
        queryEntries.push([`search-facet-section-${aspectNameOrId}`, 'true']);
        queryEntries.push([`search-facet-section-${diameterNameOrId}`, 'true']);
        if (this.selectedLoadSpeedIndex) {
            queryEntries.push([`search-facet-section-${speedLoadNameOrId}`, 'true']);
        }
        queryEntries.push(['page', '1']);
        const serializedRefinements = JSON.stringify(refinements);
        const encodedRefinements = encodeURIComponent(serializedRefinements);
        const isCategoryMode = this.isCategoryBaselineMode();
        // Category-baseline mode requires refinements to keep filtering deterministic.
        const includeRefinementsEffective = isCategoryMode || this.includeRefinementsParam;
        if (includeRefinementsEffective) {
            queryEntries.push(['refinements', encodedRefinements]);
        }

        const facetsPayload = this.buildFacetsPayload(refinements);
        if (facetsPayload) {
            queryEntries.push(['facets', encodeURIComponent(JSON.stringify(facetsPayload))]);
        }
        if (this.defaultSortRule) {
            queryEntries.push(['sortRule', this.defaultSortRule]);
        }
        if (this.defaultCategoryId) {
            queryEntries.push(['categoryId', this.defaultCategoryId]);
        }
        if (isCategoryMode && this.categoryId) {
            queryEntries.push(['category', this.categoryId]);
        }
        const queryParams = new URLSearchParams(queryEntries);

        const baselineMode = (this.baselineMode || 'compositeSizeTerm').trim();
        const pathSearchTerm = this.resolvePathSearchTerm(baselineMode, normalizedSearchTerm);
        const targetUrl = isCategoryMode
            ? this.buildCategoryUrl(queryParams)
            : this.buildSearchUrl(pathSearchTerm, queryParams);

        if (this.debugPayload) {
            // eslint-disable-next-line no-console
            console.info('[tireSizeSelectorStandard] Generated search payload', {
                buildVersion: this.buildVersion,
                searchTerm: normalizedSearchTerm,
                routeMode: this.routeMode,
                categoryRouteBasePath: this.categoryRouteBasePath,
                categorySlug: this.categorySlug,
                categoryId: this.categoryId,
                isCategoryMode,
                baselineMode,
                baselineSearchTerm: this.baselineSearchTerm,
                pathSearchTerm,
                pathSearchTermComposite: `${this.selectedWidth}, ${this.selectedAspectRatio}, ${this.selectedDiameter}`,
                useWidthAsSearchTerm: this.useWidthAsSearchTerm,
                omitWidthRefinementWhenUsingWidthTerm: this.omitWidthRefinementWhenUsingWidthTerm,
                useFacetOnlyNavigation: false,
                includeRefinementsParam: this.includeRefinementsParam,
                includeRefinementsEffective,
                encodedRefinements,
                includeFacetsParam: this.includeFacetsParam,
                includeSpeedLoadRefinement: this.includeSpeedLoadRefinement,
                facetsFieldNameOrId: this.facetsFieldNameOrId,
                facetsPayload,
                refinements,
                resolvedFields: {
                    widthNameOrId,
                    aspectNameOrId,
                    diameterNameOrId,
                    speedLoadNameOrId
                },
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

    createDistinctRefinement(nameOrId, value, attributeType) {
        const normalizedType = (attributeType || '').trim();
        const normalizedValue = this.normalizeRefinementValue(value, normalizedType);
        const refinement = {
            nameOrId,
            type: 'DistinctValue',
            values: [normalizedValue]
        };
        if (normalizedType) {
            refinement.attributeType = normalizedType;
        }
        return refinement;
    }

    normalizeRefinementValue(value, attributeType) {
        return String(value);
    }

    isCategoryBaselineMode() {
        return (this.routeMode || '').trim().toLowerCase() === 'categorybaseline';
    }

    buildCategoryUrl(queryParams) {
        const base = (this.categoryRouteBasePath || '/category').replace(/\/$/, '');
        const slug = (this.categorySlug || '').trim();
        const id = (this.categoryId || '').trim();
        return `${base}/${encodeURIComponent(slug)}/${encodeURIComponent(id)}?${queryParams.toString()}`;
    }

    buildSearchUrl(pathSearchTerm, queryParams) {
        const basePath = (this.searchResultsBasePath || '/global-search').replace(/\/$/, '');
        const termPath = pathSearchTerm ? `/${encodeURIComponent(pathSearchTerm)}` : '';
        return `${basePath}${termPath}?${queryParams.toString()}`;
    }

    resolvePathSearchTerm(baselineMode, normalizedSearchTerm) {
        switch ((baselineMode || '').toLowerCase()) {
            case 'compositesizeterm':
                return `${this.selectedWidth}, ${this.selectedAspectRatio}, ${this.selectedDiameter}`;
            case 'configuredterm':
                return (this.baselineSearchTerm || '').trim() || normalizedSearchTerm;
            case 'componentsearchterm':
                return normalizedSearchTerm;
            case 'widthterm':
                return (this.selectedWidth || '').trim();
            case 'none':
            default:
                return '';
        }
    }

    buildFacetsPayload(refinements) {
        if (!this.includeFacetsParam) {
            return null;
        }
        const targetField = this.resolveRefinementNameOrId(this.facetsFieldNameOrId || '');
        if (!targetField) {
            return null;
        }
        const selectedRefinement = refinements.find((entry) => entry.nameOrId === targetField);
        if (!selectedRefinement || !selectedRefinement.values?.length) {
            return null;
        }
        const selectedValue = String(selectedRefinement.values[0]);
        const selectedAttributeType = selectedRefinement.attributeType || 'Custom';
        return {
            attributeType: selectedAttributeType,
            facetType: 'DistinctValue',
            nameOrId: selectedRefinement.nameOrId,
            values: [
                {
                    id: selectedValue,
                    checked: true,
                    displayMetadata: null,
                    focusOnInit: false,
                    name: selectedValue,
                    productCount: 1
                }
            ],
            id: `${selectedRefinement.nameOrId}:${selectedAttributeType}`
        };
    }

    normalizeSearchTerm(inputTerm) {
        const configuredTerm = (inputTerm || '').trim();
        if (!configuredTerm) {
            return 'tire';
        }

        // Keep compatibility with older page-level values.
        if (configuredTerm.toLowerCase() === 'tires') {
            return 'tire';
        }

        return configuredTerm;
    }

    resolveRefinementNameOrId(configuredNameOrId) {
        const mapping = {
            Tire_Width__c: 'Tire_Width_Facet__c',
            Tire_Aspect_Ratio__c: 'Tire_Aspect_Facet__c',
            Tire_Diameter__c: 'Tire_Diameter_Facet__c'
        };
        return mapping[configuredNameOrId] || configuredNameOrId;
    }

    resolveAttributeType(resolvedNameOrId, configuredAttributeType) {
        if (resolvedNameOrId?.endsWith('_Facet__c')) {
            return 'Custom';
        }
        return configuredAttributeType;
    }

    getDiameterNode() {
        return this.dependencyTree?.[this.selectedWidth]?.[this.selectedAspectRatio] || {};
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
