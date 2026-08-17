// orderTracker.js
import { LightningElement, api } from 'lwc';
import { loadStyle, loadScript } from 'lightning/platformResourceLoader';
import LEAFLET_JS from '@salesforce/resourceUrl/leaflet_js';
import LEAFLET_CSS from '@salesforce/resourceUrl/leaflet_css';
import getCoordinates from '@salesforce/apex/OrderTrackerController.getCoordinates';
import getOrderSummaryAddress from '@salesforce/apex/OrderTrackerController.getOrderSummaryAddress';
import getOrderSummaryIdByNumber from '@salesforce/apex/OrderTrackerController.getOrderSummaryIdByNumber';

export default class OrderTracker extends LightningElement {
    @api recordId;
    actualOrderId = null;
    @api warehouseStreet = 'Schlüterstraße 3';
    @api warehouseCity = 'Düsseldorf';
    @api warehouseState = '';
    @api warehousePostalCode = '40235';
    @api warehouseCountry = 'Germany';
    
    // Destination address properties from Experience Builder expressions
    // Note: Experience Builder may pass empty strings for null fields; normalize to null.
    @api destinationStreet;
    @api destinationCity;
    @api destinationState;
    @api destinationPostalCode;
    @api destinationCountry;

    // Developer debug helper (not required). Set in Experience Builder to see raw values in console.
    @api debugExpressionOutput = false;
    
    mapInitialized = false;
    leafletLoaded = false;
    error = false;
    errorMessage = '';
    map;
    warehouseCoords = null;
    destinationCoords = null;
    isGeocodingWarehouse = false;
    isGeocodingDestination = false;
    orderData = null;
    isLoadingOrderData = false;

    get shippingStreet() { 
        return this.destinationStreet || this.orderData?.shippingStreet; 
    }
    get shippingCity() { 
        return this.destinationCity || this.orderData?.shippingCity; 
    }
    get shippingState() { 
        return this.destinationState || this.orderData?.shippingState; 
    }
    get shippingPostalCode() { 
        return this.destinationPostalCode || this.orderData?.shippingPostalCode; 
    }
    get shippingCountry() { 
        return this.destinationCountry || this.orderData?.shippingCountry; 
    }
    get status() { return this.orderData?.status || 'In Transit'; }

    normalizeExpressionValue(value) {
        // Experience Builder may pass empty string when an expression evaluates to null.
        if (value === undefined || value === null) return null;
        if (typeof value === 'string' && value.trim() === '') return null;
        return value;
    }

    get hasDestinationFromExpression() {
        return !!(
            this.normalizeExpressionValue(this.destinationStreet) ||
            this.normalizeExpressionValue(this.destinationCity) ||
            this.normalizeExpressionValue(this.destinationCountry)
        );
    }

    get isLoading() {
        return !this.error && !this.mapInitialized && (
            this.isLoadingOrderData ||
            this.isGeocodingWarehouse ||
            this.isGeocodingDestination
        );
    }

    get isDemoMode() {
        return !this.recordId && this.mapInitialized;
    }

    get mapClass() {
        return this.error ? 'map-container slds-hide' : 'map-container';
    }

    async connectedCallback() {
        console.log('OrderTracker connectedCallback called');
        console.log('recordId:', this.recordId);
        console.log('Destination from expressions:', {
            street: this.destinationStreet,
            city: this.destinationCity,
            state: this.destinationState,
            postalCode: this.destinationPostalCode,
            country: this.destinationCountry
        });
        console.log('Current URL:', window.location.href);
        
        // If we have destination address from Experience Builder expressions, skip Apex calls
        if (this.hasDestinationFromExpression) {
            console.log('Using destination address from Experience Builder expressions');
            // Log normalized values for debugging
            const normalized = {
                destinationStreet: this.normalizeExpressionValue(this.destinationStreet),
                destinationCity: this.normalizeExpressionValue(this.destinationCity),
                destinationState: this.normalizeExpressionValue(this.destinationState),
                destinationPostalCode: this.normalizeExpressionValue(this.destinationPostalCode),
                destinationCountry: this.normalizeExpressionValue(this.destinationCountry)
            };
            console.info('OrderTracker - destination expressions (normalized):', normalized);
            if (this.debugExpressionOutput) {
                // expose exact raw values too
                console.info('OrderTracker - destination expressions (raw):', {
                    destinationStreet: this.destinationStreet,
                    destinationCity: this.destinationCity,
                    destinationState: this.destinationState,
                    destinationPostalCode: this.destinationPostalCode,
                    destinationCountry: this.destinationCountry
                });
            }
            return;
        }
        
        // Otherwise, try to get the Order ID and load data via Apex
        if (this.recordId) {
            // Standard record page context
            console.log('Using recordId from component property');
            this.actualOrderId = this.recordId;
            await this.loadOrderData();
        } else {
            // Experience Cloud context - try to get order number from URL
            const orderNumber = this.getUrlParameter('orderNumber');
            console.log('Order Number from URL:', orderNumber);
            
            if (orderNumber) {
                try {
                    console.log('Calling getOrderSummaryIdByNumber with:', orderNumber);
                    this.actualOrderId = await getOrderSummaryIdByNumber({ orderNumber });
                    console.log('OrderSummary ID resolved:', this.actualOrderId);
                    
                    if (this.actualOrderId) {
                        await this.loadOrderData();
                    } else {
                        console.warn('Could not find OrderSummary with number:', orderNumber);
                        // Don't show error, just use demo mode
                    }
                } catch (error) {
                    console.error('Error getting OrderSummary ID from number:', error);
                    console.error('Error body:', error.body);
                    console.error('Error message:', error.body?.message);
                    console.error('Error status:', error.status);
                    console.error('Full error object:', error);
                    // Show the actual error message to help diagnose
                    if (error.body?.message) {
                        this.error = true;
                        this.errorMessage = 'Error: ' + error.body.message;
                    }
                    // Don't block the component, allow demo mode to work
                }
            } else {
                console.log('No recordId or orderNumber found, using demo mode');
            }
        }
    }

    getUrlParameter(param) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(param);
    }

    async loadOrderData() {
        this.isLoadingOrderData = true;
        try {
            this.orderData = await getOrderSummaryAddress({ orderSummaryId: this.actualOrderId });
            console.log('OrderSummary Data Loaded:', this.orderData);
        } catch (error) {
            console.error('Error loading order summary data:', error);
            this.error = true;
            this.errorMessage = 'Error loading order data: ' + (error.body?.message || error.message);
        } finally {
            this.isLoadingOrderData = false;
        }
    }

    renderedCallback() {
        if (this.mapInitialized) return;

        // If we have an order ID (from recordId or URL) and haven't loaded order data yet, wait
        // BUT: Skip this wait if we have destination address from expressions
        if (!this.hasDestinationFromExpression && this.actualOrderId && !this.orderData && !this.error) return;

        if (this.leafletLoaded) {
            this.geocodeAddresses();
            return;
        }

        this.leafletLoaded = true;
        Promise.all([
            loadScript(this, LEAFLET_JS),
            loadStyle(this, LEAFLET_CSS)
        ])
        .then(() => {
            this.geocodeAddresses();
        })
        .catch(err => {
            this.error = true;
            this.errorMessage = 'Error loading Leaflet. Check if static resources "leaflet_js" and "leaflet_css" exist.';
            console.error('Leaflet Load Error', err);
        });
    }

    async geocodeAddresses() {
        if (this.mapInitialized) return;

        console.log('Shipping Street:', this.shippingStreet);
        console.log('Shipping City:', this.shippingCity);
        console.log('Shipping Country:', this.shippingCountry);

        try {
            // Geocode warehouse address
            this.isGeocodingWarehouse = true;
            const warehouseResult = await getCoordinates({
                street: this.warehouseStreet,
                city: this.warehouseCity,
                state: this.warehouseState,
                postalCode: this.warehousePostalCode,
                country: this.warehouseCountry
            });
            this.isGeocodingWarehouse = false;

            if (warehouseResult.success) {
                this.warehouseCoords = [warehouseResult.latitude, warehouseResult.longitude];
            } else {
                console.warn('Warehouse geocoding failed:', warehouseResult.errorMessage);
                // Fallback to default Düsseldorf coordinates
                this.warehouseCoords = [51.2330, 6.8120];
            }

            // Geocode destination address if we have order data
            if (this.orderData && (this.shippingStreet || this.shippingCity)) {
                this.isGeocodingDestination = true;
                const destinationResult = await getCoordinates({
                    street: this.shippingStreet || '',
                    city: this.shippingCity || '',
                    state: this.shippingState || '',
                    postalCode: this.shippingPostalCode || '',
                    country: this.shippingCountry || ''
                });
                this.isGeocodingDestination = false;

                if (destinationResult.success) {
                    this.destinationCoords = [destinationResult.latitude, destinationResult.longitude];
                } else {
                    console.warn('Destination geocoding failed:', destinationResult.errorMessage);
                    // Fallback to default destination coordinates
                    this.destinationCoords = [51.2255, 6.7828];
                }
            } else {
                // Demo mode - use default destination
                this.destinationCoords = [51.2255, 6.7828];
            }

            this.initializeMap();

        } catch (error) {
            this.isGeocodingWarehouse = false;
            this.isGeocodingDestination = false;
            this.error = true;
            this.errorMessage = 'Error geocoding addresses: ' + error.message;
            console.error('Geocoding Error', error);
        }
    }

    initializeMap() {
        const container = this.template.querySelector('.map-root');
        if (!container || this.mapInitialized || !this.warehouseCoords || !this.destinationCoords) return;

        try {
            const L = window.L;
            if (!L) return;

            this.mapInitialized = true;
            
            const warehouse = this.warehouseCoords;
            const destination = this.destinationCoords;

            // Create a simple route between warehouse and destination
            const roadRoute = this.generateRoute(warehouse, destination);

            this.map = L.map(container);
            this.map.fitBounds([warehouse, destination], { padding: [50, 50] });

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap'
            }).addTo(this.map);

            const warehouseIcon = L.divIcon({
                html: '<div style="display:flex;justify-content:center;align-items:center;width:24px;height:24px;background:#444;border:2px solid white;border-radius:4px;box-shadow:0 2px 4px rgba(0,0,0,0.3);"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg></div>',
                iconSize: [24, 24],
                iconAnchor: [12, 12]
            });
            
            const warehouseName = [this.warehouseStreet, this.warehouseCity, this.warehouseCountry]
                .filter(p => p).join(', ');
            L.marker(warehouse, { icon: warehouseIcon }).addTo(this.map)
                .bindPopup(`Warehouse: ${warehouseName}`);

            const destinationIcon = L.divIcon({
                html: '<div style="display:flex;justify-content:center;align-items:center;width:32px;height:32px;background:#0176d3;border:2px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.4);"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path><circle cx="12" cy="10" r="3"></circle></svg></div>',
                iconSize: [32, 32],
                iconAnchor: [16, 32]
            });
            
            const destName = [this.shippingStreet, this.shippingCity, this.shippingCountry]
                .filter(p => p).join(', ') || 'Destination';
            L.marker(destination, { icon: destinationIcon }).addTo(this.map)
                .bindPopup(`Shipping to: ${destName}`);

            L.polyline(roadRoute, { color: '#0176d3', weight: 4, opacity: 0.6 }).addTo(this.map);
            
            // Force a resize check to fix gray tiles issue
            setTimeout(() => { this.map.invalidateSize(); }, 500);

        } catch (e) {
            this.error = true;
            this.errorMessage = 'Error initializing map. Check console for details.';
            console.error('Map Init Error', e);
        }
    }

    generateRoute(start, end) {
        // Generate a simple 4-point route between two coordinates
        const latDiff = (end[0] - start[0]) / 3;
        const lonDiff = (end[1] - start[1]) / 3;
        
        return [
            start,
            [start[0] + latDiff, start[1] + lonDiff * 0.8],
            [start[0] + latDiff * 2, start[1] + lonDiff * 2.2],
            end
        ];
    }

    disconnectedCallback() {
        if (this.map) {
            this.map.remove();
        }
    }
}