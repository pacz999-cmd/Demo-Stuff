import { LightningElement, api } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import tireProductsResource from '@salesforce/resourceUrl/continentalTireProducts';

export default class TireSearchResults extends NavigationMixin(LightningElement) {
    @api sitePath = 'b2benhanced';
    selectedCriteria;
    allProducts = [];
    products = [];
    isLoadingCatalog = true;
    catalogError;
    hasSearched = false;

    connectedCallback() {
        this.loadCatalog();
    }

    @api
    set criteria(value) {
        this.applyCriteria(value);
    }

    get criteria() {
        return this.selectedCriteria;
    }

    @api
    applyCriteria(value) {
        this.hasSearched = true;
        if (!value || !value.sizeLabels?.length) {
            this.selectedCriteria = value;
            this.products = [];
            return;
        }

        this.selectedCriteria = value;
        this.products = this.filterProducts(value);
    }

    get hasProducts() {
        return this.products.length > 0;
    }

    get showInitialHint() {
        return !this.hasSearched && !this.isLoadingCatalog && !this.catalogError;
    }

    get showEmptyResults() {
        return this.hasSearched && !this.hasProducts && !this.catalogError && !this.isLoadingCatalog;
    }

    get selectedSummary() {
        if (!this.selectedCriteria) {
            return '';
        }

        const { width, aspectRatio, diameter, loadSpeedIndex } = this.selectedCriteria;
        const base = `${width}/${aspectRatio} R${diameter}`;
        return loadSpeedIndex ? `${base} - ${loadSpeedIndex}` : base;
    }

    handleSelectorSearch(event) {
        this.applyCriteria(event.detail);
    }

    handleProductClick(event) {
        const targetUrl = event.currentTarget.dataset.url;
        if (!targetUrl) {
            return;
        }

        this[NavigationMixin.Navigate]({
            type: 'standard__webPage',
            attributes: {
                url: targetUrl
            }
        });
    }

    async loadCatalog() {
        try {
            // Add a cache-busting query string so updated static-resource image URLs are fetched immediately.
            const response = await fetch(`${tireProductsResource}?v=20260807-3`);
            if (!response.ok) {
                throw new Error(`Failed to load product catalog: ${response.status}`);
            }

            const payload = await response.json();
            this.allProducts = payload.products || [];
            this.catalogError = undefined;
        } catch (error) {
            this.catalogError = error instanceof Error ? error.message : 'Unknown catalog loading error';
            this.allProducts = [];
        } finally {
            this.isLoadingCatalog = false;
        }
    }

    filterProducts(criteria) {
        const labels = new Set(criteria.sizeLabels || []);
        const requestedWidth = this.toNumber(criteria.width);
        const requestedAspect = this.toNumber(criteria.aspectRatio);
        const requestedDiameter = this.toNumber(criteria.diameter);
        const selectedSpeedLoad = criteria.loadSpeedIndex || null;
        const hasAttributeCriteria =
            Number.isFinite(requestedWidth) &&
            Number.isFinite(requestedAspect) &&
            Number.isFinite(requestedDiameter);

        if (!labels.size && !hasAttributeCriteria) {
            return [];
        }

        return this.allProducts
            .filter((product) => {
                if (hasAttributeCriteria) {
                    return (
                        this.toNumber(product.width) === requestedWidth &&
                        this.toNumber(product.aspectRatio) === requestedAspect &&
                        this.toNumber(product.diameter) === requestedDiameter
                    );
                }
                return labels.has(product.sizeLabel);
            })
            .filter((product) => {
                if (!selectedSpeedLoad) {
                    return true;
                }
                const productSpeedLoad = product.speedLoadIndex || product.loadSpeedIndex;
                return productSpeedLoad === selectedSpeedLoad;
            })
            .map((product) => ({
                ...product,
                key: product.id,
                pdpUrl: this.buildPdpUrl(product),
                displayPrice: this.formatPrice(product.price, product.currencyIsoCode),
                productImageUrl: product.cmsImageUrl || null,
                hasProductImage: Boolean(product.cmsImageUrl)
            }));
    }

    buildPdpUrl(product) {
        if (!product.slug || !product.productId) {
            return product.pdpUrl;
        }

        const origin = window.location?.origin || '';
        return `${origin}/${this.sitePath}/product/${product.slug}/${product.productId}`;
    }

    toNumber(value) {
        const number = Number(value);
        return Number.isFinite(number) ? number : NaN;
    }

    formatPrice(price, currencyCode) {
        if (typeof price !== 'number') {
            return '';
        }
        return new Intl.NumberFormat('en-GB', {
            style: 'currency',
            currency: currencyCode || 'EUR'
        }).format(price);
    }
}
