public without sharing class OrderTrackerController {

    public class GeocodingResult {
        @AuraEnabled public Decimal latitude { get; set; }
        @AuraEnabled public Decimal longitude { get; set; }
        @AuraEnabled public Boolean success { get; set; }
        @AuraEnabled public String errorMessage { get; set; }
    }

    public class OrderAddressData {
        @AuraEnabled public String shippingStreet { get; set; }
        @AuraEnabled public String shippingCity { get; set; }
        @AuraEnabled public String shippingState { get; set; }
        @AuraEnabled public String shippingPostalCode { get; set; }
        @AuraEnabled public String shippingCountry { get; set; }
        @AuraEnabled public Decimal shippingLatitude { get; set; }
        @AuraEnabled public Decimal shippingLongitude { get; set; }
        @AuraEnabled public String status { get; set; }
        /** Shipment | Order | Account | None */
        @AuraEnabled public String addressSource { get; set; }
    }

    /**
     * Resolves the destination address for map geocoding: latest Shipment (ship-to),
     * then Order shipping (via OriginalOrderId on Order Summary or the Order itself),
     * then Account shipping on the Order Summary.
     */
    @AuraEnabled(cacheable = true)
    public static OrderAddressData getResolvedTrackingAddress(Id recordId) {
        if (recordId == null) {
            throw new AuraHandledException('recordId is required.');
        }
        Schema.SObjectType objectType = recordId.getSobjectType();
        if (objectType == OrderSummary.SObjectType) {
            return buildForOrderSummary(recordId);
        }
        if (objectType == Order.SObjectType) {
            return buildForOrder(recordId);
        }
        throw new AuraHandledException(
            'Unsupported record type for Order Tracker: ' + objectType.getDescribe().getName()
        );
    }

    @AuraEnabled(cacheable = false)
    public static Id getOrderSummaryIdByNumber(String orderNumber) {
        System.debug('=== getOrderSummaryIdByNumber called ===');
        System.debug('Input orderNumber: ' + orderNumber);
        System.debug('Running user: ' + UserInfo.getUserId());
        System.debug('User type: ' + UserInfo.getUserType());
        System.debug('User profile: ' + UserInfo.getProfileId());

        try {
            List<OrderSummary> orderSummaries = [
                SELECT Id, OrderNumber
                FROM OrderSummary
                WHERE OrderNumber = :orderNumber
                WITH USER_MODE
                LIMIT 1
            ];
            System.debug('Query returned ' + orderSummaries.size() + ' order summaries');

            if (!orderSummaries.isEmpty()) {
                System.debug('OrderSummary found: ' + orderSummaries[0].Id);
                return orderSummaries[0].Id;
            }
            System.debug('No OrderSummary found with OrderNumber: ' + orderNumber);
            return null;
        } catch (Exception e) {
            System.debug('ERROR finding OrderSummary by number: ' + e.getMessage());
            System.debug('ERROR type: ' + e.getTypeName());
            System.debug('ERROR stack trace: ' + e.getStackTraceString());

            String errorMsg = 'Unable to access OrderSummary. ';
            if (e.getMessage().contains('sObject type') || e.getMessage().contains('doesn\'t support query')) {
                errorMsg += 'Guest user may not have permission to query OrderSummary objects. ';
                errorMsg += 'Please ensure the Experience Cloud guest user profile has Read access to OrderSummary and Account objects.';
            } else {
                errorMsg += e.getMessage();
            }
            throw new AuraHandledException(errorMsg);
        }
    }

    @AuraEnabled(cacheable = false)
    public static OrderAddressData getOrderSummaryAddress(Id orderSummaryId) {
        return buildForOrderSummary(orderSummaryId);
    }

    private static OrderAddressData buildForOrderSummary(Id orderSummaryId) {
        System.debug('=== buildForOrderSummary called ===');
        System.debug('Input orderSummaryId: ' + orderSummaryId);

        OrderAddressData result = new OrderAddressData();

        try {
            OrderSummary ordSum = [
                SELECT AccountId, Status, OrderedDate, OrderNumber, OriginalOrderId
                FROM OrderSummary
                WHERE Id = :orderSummaryId
                WITH USER_MODE
                LIMIT 1
            ];

            System.debug('OrderSummary found: ' + ordSum.Id);
            result.status = ordSum.Status;

            Shipment ship = getLatestShipmentForOrderSummary(orderSummaryId);
            if (ship != null && hasShipmentAddress(ship)) {
                copyShipmentAddress(result, ship);
                result.addressSource = 'Shipment';
                return result;
            }

            if (ordSum.OriginalOrderId != null) {
                List<Order> orders = [
                    SELECT
                        ShippingStreet,
                        ShippingCity,
                        ShippingState,
                        ShippingPostalCode,
                        ShippingCountry,
                        ShippingLatitude,
                        ShippingLongitude
                    FROM Order
                    WHERE Id = :ordSum.OriginalOrderId
                    WITH USER_MODE
                    LIMIT 1
                ];
                if (!orders.isEmpty() && hasOrderShipping(orders[0])) {
                    copyOrderShipping(result, orders[0]);
                    result.addressSource = 'Order';
                    return result;
                }
            }

            if (ordSum.AccountId != null) {
                List<Account> accounts = [
                    SELECT
                        ShippingStreet,
                        ShippingCity,
                        ShippingState,
                        ShippingPostalCode,
                        ShippingCountry,
                        ShippingLatitude,
                        ShippingLongitude
                    FROM Account
                    WHERE Id = :ordSum.AccountId
                    WITH USER_MODE
                    LIMIT 1
                ];
                if (!accounts.isEmpty()) {
                    Account acc = accounts[0];
                    result.shippingStreet = acc.ShippingStreet;
                    result.shippingCity = acc.ShippingCity;
                    result.shippingState = acc.ShippingState;
                    result.shippingPostalCode = acc.ShippingPostalCode;
                    result.shippingCountry = acc.ShippingCountry;
                    result.shippingLatitude = acc.ShippingLatitude;
                    result.shippingLongitude = acc.ShippingLongitude;
                    result.addressSource = 'Account';
                }
            }
        } catch (Exception e) {
            System.debug('ERROR: ' + e.getMessage());
            System.debug('ERROR Type: ' + e.getTypeName());
            System.debug('ERROR Stack Trace: ' + e.getStackTraceString());
            throw new AuraHandledException('Error retrieving order address: ' + e.getMessage());
        }

        if (String.isBlank(result.addressSource)) {
            result.addressSource = 'None';
        }
        return result;
    }

    private static OrderAddressData buildForOrder(Id orderId) {
        OrderAddressData result = new OrderAddressData();
        try {
            List<Order> orders = [
                SELECT
                    Id,
                    Status,
                    ShippingStreet,
                    ShippingCity,
                    ShippingState,
                    ShippingPostalCode,
                    ShippingCountry,
                    ShippingLatitude,
                    ShippingLongitude
                FROM Order
                WHERE Id = :orderId
                WITH USER_MODE
                LIMIT 1
            ];
            if (orders.isEmpty()) {
                result.addressSource = 'None';
                return result;
            }
            Order ord = orders[0];
            result.status = ord.Status;

            List<OrderSummary> summaries = [
                SELECT Id
                FROM OrderSummary
                WHERE OriginalOrderId = :orderId
                WITH USER_MODE
                LIMIT 1
            ];
            if (!summaries.isEmpty()) {
                Shipment ship = getLatestShipmentForOrderSummary(summaries[0].Id);
                if (ship != null && hasShipmentAddress(ship)) {
                    copyShipmentAddress(result, ship);
                    result.addressSource = 'Shipment';
                    return result;
                }
            }

            if (hasOrderShipping(ord)) {
                copyOrderShipping(result, ord);
                result.addressSource = 'Order';
                return result;
            }
        } catch (Exception e) {
            System.debug('ERROR buildForOrder: ' + e.getMessage());
            throw new AuraHandledException('Error retrieving order address: ' + e.getMessage());
        }

        result.addressSource = 'None';
        return result;
    }

    private static Shipment getLatestShipmentForOrderSummary(Id orderSummaryId) {
        List<Shipment> shipments = [
            SELECT
                ShipToStreet,
                ShipToCity,
                ShipToState,
                ShipToPostalCode,
                ShipToCountry,
                ShipToLatitude,
                ShipToLongitude
            FROM Shipment
            WHERE OrderSummaryId = :orderSummaryId
            WITH USER_MODE
            ORDER BY CreatedDate DESC
            LIMIT 1
        ];
        return shipments.isEmpty() ? null : shipments[0];
    }

    private static Boolean hasShipmentAddress(Shipment s) {
        return String.isNotBlank(s.ShipToStreet)
            || String.isNotBlank(s.ShipToCity)
            || String.isNotBlank(s.ShipToPostalCode)
            || String.isNotBlank(s.ShipToCountry);
    }

    private static Boolean hasOrderShipping(Order o) {
        return String.isNotBlank(o.ShippingStreet)
            || String.isNotBlank(o.ShippingCity)
            || String.isNotBlank(o.ShippingPostalCode)
            || String.isNotBlank(o.ShippingCountry);
    }

    private static void copyShipmentAddress(OrderAddressData result, Shipment s) {
        result.shippingStreet = s.ShipToStreet;
        result.shippingCity = s.ShipToCity;
        result.shippingState = s.ShipToState;
        result.shippingPostalCode = s.ShipToPostalCode;
        result.shippingCountry = s.ShipToCountry;
        result.shippingLatitude = s.ShipToLatitude;
        result.shippingLongitude = s.ShipToLongitude;
    }

    private static void copyOrderShipping(OrderAddressData result, Order o) {
        result.shippingStreet = o.ShippingStreet;
        result.shippingCity = o.ShippingCity;
        result.shippingState = o.ShippingState;
        result.shippingPostalCode = o.ShippingPostalCode;
        result.shippingCountry = o.ShippingCountry;
        result.shippingLatitude = o.ShippingLatitude;
        result.shippingLongitude = o.ShippingLongitude;
    }

    @AuraEnabled(cacheable = false)
    public static GeocodingResult getCoordinates(String street, String city, String state, String postalCode, String country) {
        GeocodingResult result = new GeocodingResult();
        result.success = false;

        try {
            List<String> addressParts = new List<String>();
            if (String.isNotBlank(street)) {
                addressParts.add(street);
            }
            if (String.isNotBlank(postalCode)) {
                addressParts.add(postalCode);
            }
            if (String.isNotBlank(city)) {
                addressParts.add(city);
            }
            if (String.isNotBlank(state)) {
                addressParts.add(state);
            }
            if (String.isNotBlank(country)) {
                addressParts.add(country);
            }

            if (addressParts.isEmpty()) {
                result.errorMessage = 'No address components provided';
                return result;
            }

            String addressQuery = String.join(addressParts, ', ');

            String endpoint = 'https://nominatim.openstreetmap.org/search?format=json&q='
                + EncodingUtil.urlEncode(addressQuery, 'UTF-8')
                + '&limit=1';

            Http http = new Http();
            HttpRequest request = new HttpRequest();
            request.setEndpoint(endpoint);
            request.setMethod('GET');
            request.setHeader('User-Agent', 'Salesforce-OrderTracker/1.0');
            request.setTimeout(10000);

            HttpResponse response = http.send(request);

            if (response.getStatusCode() == 200) {
                List<Object> results = (List<Object>) JSON.deserializeUntyped(response.getBody());

                if (results != null && !results.isEmpty()) {
                    Map<String, Object> location = (Map<String, Object>) results[0];
                    result.latitude = Decimal.valueOf(String.valueOf(location.get('lat')));
                    result.longitude = Decimal.valueOf(String.valueOf(location.get('lon')));
                    result.success = true;
                } else {
                    result.errorMessage = 'Address not found';
                }
            } else {
                result.errorMessage = 'Geocoding service error: ' + response.getStatus();
            }
        } catch (Exception e) {
            result.errorMessage = 'Error: ' + e.getMessage();
            System.debug('Geocoding error: ' + e.getMessage());
        }

        return result;
    }
}
