// orderTracker.js
import { LightningElement, api, wire } from 'lwc';
import { getRecord, getFieldValue } from 'lightning/uiRecordApi';
import { loadStyle, loadScript } from 'lightning/platformResourceLoader';
import LEAFLET_JS from '@salesforce/resourceUrl/leaflet_js';
import LEAFLET_CSS from '@salesforce/resourceUrl/leaflet_css';
import USER_ID from '@salesforce/user/Id';
import USER_CONTACT_ID from '@salesforce/schema/User.ContactId';
import CONTACT_MAILING_STREET from '@salesforce/schema/Contact.MailingStreet';
import CONTACT_MAILING_CITY from '@salesforce/schema/Contact.MailingCity';
import CONTACT_MAILING_POSTAL_CODE from '@salesforce/schema/Contact.MailingPostalCode';
import CONTACT_MAILING_COUNTRY from '@salesforce/schema/Contact.MailingCountry';

import SHIPPING_STREET from '@salesforce/schema/Order.ShippingStreet';
import SHIPPING_CITY from '@salesforce/schema/Order.ShippingCity';
import SHIPPING_STATE from '@salesforce/schema/Order.ShippingState';
import SHIPPING_POSTAL_CODE from '@salesforce/schema/Order.ShippingPostalCode';
import STATUS from '@salesforce/schema/Order.Status';

const FIELDS = [SHIPPING_STREET, SHIPPING_CITY, SHIPPING_STATE, SHIPPING_POSTAL_CODE, STATUS];

export default class OrderTracker extends LightningElement {
    @api recordId;
    @api warehouseStreet = 'Schlüterstraße 3';
    @api warehousePostalCode = '40235';
    @api warehouseCity = 'Düsseldorf';
    @api warehouseCountry = 'Germany';
    // Kept for backward compatibility with existing Experience Builder instances.
    @api deliveryStreet;
    @api deliveryPostalCode;
    @api deliveryCity;
    @api deliveryCountry;
    
    mapInitialized = false;
    leafletLoaded = false;
    error = false;
    errorMessage = '';
    map;

    @wire(getRecord, { recordId: '$recordId', fields: FIELDS })
    order;

    @wire(getRecord, { recordId: USER_ID, fields: [USER_CONTACT_ID] })
    currentUser;

    get contactId() {
        return getFieldValue(this.currentUser.data, USER_CONTACT_ID);
    }

    @wire(getRecord, {
        recordId: '$contactId',
        fields: [CONTACT_MAILING_STREET, CONTACT_MAILING_CITY, CONTACT_MAILING_POSTAL_CODE, CONTACT_MAILING_COUNTRY]
    })
    userContact;

    get shippingStreet() { return getFieldValue(this.order.data, SHIPPING_STREET); }
    get shippingCity() { return getFieldValue(this.order.data, SHIPPING_CITY); }
    get shippingState() { return getFieldValue(this.order.data, SHIPPING_STATE); }
    get shippingPostalCode() { return getFieldValue(this.order.data, SHIPPING_POSTAL_CODE); }
    get status() { return getFieldValue(this.order.data, STATUS) || 'In Transit'; }
    get contactStreet() { return getFieldValue(this.userContact.data, CONTACT_MAILING_STREET); }
    get contactCity() { return getFieldValue(this.userContact.data, CONTACT_MAILING_CITY); }
    get contactPostalCode() { return getFieldValue(this.userContact.data, CONTACT_MAILING_POSTAL_CODE); }
    get contactCountry() { return getFieldValue(this.userContact.data, CONTACT_MAILING_COUNTRY); }
    get effectiveDeliveryStreet() { return this.contactStreet || this.deliveryStreet || this.shippingStreet || ''; }
    get effectiveDeliveryCity() { return this.contactCity || this.deliveryCity || this.shippingCity || ''; }
    get effectiveDeliveryPostalCode() { return this.contactPostalCode || this.deliveryPostalCode || this.shippingPostalCode || ''; }
    get effectiveDeliveryCountry() { return this.contactCountry || this.deliveryCountry || ''; }
    get effectiveWarehouseStreet() { return this.warehouseStreet || ''; }
    get effectiveWarehouseCity() { return this.warehouseCity || ''; }
    get effectiveWarehousePostalCode() { return this.warehousePostalCode || ''; }
    get effectiveWarehouseCountry() { return this.warehouseCountry || ''; }

    get isLoading() {
        return !this.error && !this.mapInitialized && (this.recordId && !this.order.data && !this.order.error);
    }

    get isDemoMode() {
        return !this.recordId && this.mapInitialized;
    }

    get mapClass() {
        return this.error ? 'map-container slds-hide' : 'map-container';
    }

    renderedCallback() {
        if (this.mapInitialized) return;

        // If we have recordId, wait for data. If not, proceed to demo mode.
        if (this.recordId && !this.order.data && !this.order.error) return;

        if (this.leafletLoaded) {
            this.initializeMap();
            return;
        }

        this.leafletLoaded = true;
        Promise.all([
            loadScript(this, LEAFLET_JS),
            loadStyle(this, LEAFLET_CSS)
        ])
        .then(() => {
            this.initializeMap();
        })
        .catch(err => {
            this.error = true;
            this.errorMessage = 'Error loading Leaflet. Check if static resources "leaflet_js" and "leaflet_css" exist.';
            console.error('Leaflet Load Error', err);
        });
    }

    async initializeMap() {
        const container = this.template.querySelector('.map-root');
        if (!container || this.mapInitialized) return;

        try {
            const L = window.L;
            if (!L) return;

            this.mapInitialized = true;

            const fallbackWarehouse = [51.2330, 6.8120];
            const fallbackDestination = [51.2255, 6.7828];
            const warehouse = await this.geocodeAddress([
                this.effectiveWarehouseStreet,
                this.effectiveWarehousePostalCode,
                this.effectiveWarehouseCity,
                this.effectiveWarehouseCountry
            ], fallbackWarehouse);
            const destination = await this.geocodeAddress([
                this.effectiveDeliveryStreet,
                this.effectiveDeliveryPostalCode,
                this.effectiveDeliveryCity,
                this.effectiveDeliveryCountry
            ], fallbackDestination);
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
            const warehouseName = [
                this.effectiveWarehouseStreet,
                this.effectiveWarehousePostalCode,
                this.effectiveWarehouseCity,
                this.effectiveWarehouseCountry
            ].filter((p) => p).join(', ');
            L.marker(warehouse, { icon: warehouseIcon }).addTo(this.map)
                .bindPopup(`Warehouse: ${warehouseName || 'Configured warehouse'}`);

            const destinationIcon = L.divIcon({
                html: '<div style="display:flex;justify-content:center;align-items:center;width:32px;height:32px;background:#0176d3;border:2px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.4);"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path><circle cx="12" cy="10" r="3"></circle></svg></div>',
                iconSize: [32, 32],
                iconAnchor: [16, 32]
            });
            
            const destName = [
                this.effectiveDeliveryStreet,
                this.effectiveDeliveryPostalCode,
                this.effectiveDeliveryCity,
                this.effectiveDeliveryCountry
            ].filter((p) => p).join(', ');
            L.marker(destination, { icon: destinationIcon }).addTo(this.map)
                .bindPopup(`Shipping to: ${destName || 'Configured delivery address'}`);

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
        const latDiff = (end[0] - start[0]) / 3;
        const lonDiff = (end[1] - start[1]) / 3;
        return [
            start,
            [start[0] + latDiff, start[1] + lonDiff * 0.8],
            [start[0] + latDiff * 2, start[1] + lonDiff * 2.2],
            end
        ];
    }

    async geocodeAddress(parts, fallback) {
        const cleaned = (parts || []).filter((p) => p && String(p).trim());
        if (!cleaned.length) return fallback;
        try {
            const q = cleaned.join(', ');
            const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`;
            const response = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } });
            if (!response.ok) return fallback;
            const result = await response.json();
            if (!Array.isArray(result) || !result.length) return fallback;
            const lat = Number(result[0].lat);
            const lon = Number(result[0].lon);
            if (!Number.isFinite(lat) || !Number.isFinite(lon)) return fallback;
            return [lat, lon];
        } catch (e) {
            return fallback;
        }
    }

    disconnectedCallback() {
        if (this.map) {
            this.map.remove();
        }
    }
}