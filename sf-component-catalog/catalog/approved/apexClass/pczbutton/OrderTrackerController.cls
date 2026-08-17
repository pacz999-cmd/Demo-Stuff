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
        @AuraEnabled public String status { get; set; }
    }
    
    @AuraEnabled(cacheable=false)
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
                LIMIT 1
            ];
            System.debug('Query returned ' + orderSummaries.size() + ' order summaries');
            
            if (!orderSummaries.isEmpty()) {
                System.debug('OrderSummary found: ' + orderSummaries[0].Id);
                return orderSummaries[0].Id;
            } else {
                System.debug('No OrderSummary found with OrderNumber: ' + orderNumber);
                return null;
            }
        } catch (Exception e) {
            System.debug('ERROR finding OrderSummary by number: ' + e.getMessage());
            System.debug('ERROR type: ' + e.getTypeName());
            System.debug('ERROR stack trace: ' + e.getStackTraceString());
            
            // Throw a user-friendly error message
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
    
    @AuraEnabled(cacheable=false)
    public static OrderAddressData getOrderSummaryAddress(Id orderSummaryId) {
        System.debug('=== getOrderSummaryAddress called ===');
        System.debug('Input orderSummaryId: ' + orderSummaryId);
        
        OrderAddressData result = new OrderAddressData();
        
        try {
            // First query OrderSummary to get AccountId and Status
            OrderSummary ordSum = [
                SELECT AccountId, Status, OrderedDate, OrderNumber
                FROM OrderSummary 
                WHERE Id = :orderSummaryId 
                LIMIT 1
            ];
            
            System.debug('OrderSummary found: ' + ordSum.Id);
            System.debug('OrderSummary.AccountId: ' + ordSum.AccountId);
            System.debug('OrderSummary.Status: ' + ordSum.Status);
            
            result.status = ordSum.Status;
            
            // Then query Account separately to get shipping address
            if (ordSum.AccountId != null) {
                List<Account> accounts = [
                    SELECT ShippingStreet, ShippingCity, ShippingState, 
                           ShippingPostalCode, ShippingCountry
                    FROM Account 
                    WHERE Id = :ordSum.AccountId 
                    LIMIT 1
                ];
                
                if (!accounts.isEmpty()) {
                    Account acc = accounts[0];
                    System.debug('Account found: ' + acc.Id);
                    System.debug('Account.ShippingStreet: ' + acc.ShippingStreet);
                    System.debug('Account.ShippingCity: ' + acc.ShippingCity);
                    System.debug('Account.ShippingState: ' + acc.ShippingState);
                    System.debug('Account.ShippingPostalCode: ' + acc.ShippingPostalCode);
                    System.debug('Account.ShippingCountry: ' + acc.ShippingCountry);
                    
                    result.shippingStreet = acc.ShippingStreet;
                    result.shippingCity = acc.ShippingCity;
                    result.shippingState = acc.ShippingState;
                    result.shippingPostalCode = acc.ShippingPostalCode;
                    result.shippingCountry = acc.ShippingCountry;
                } else {
                    System.debug('Account not found for AccountId: ' + ordSum.AccountId);
                }
            } else {
                System.debug('OrderSummary has no AccountId');
            }
            
            System.debug('Result.shippingStreet: ' + result.shippingStreet);
            System.debug('Result.shippingCity: ' + result.shippingCity);
            System.debug('Result.shippingState: ' + result.shippingState);
            System.debug('Result.shippingPostalCode: ' + result.shippingPostalCode);
            System.debug('Result.shippingCountry: ' + result.shippingCountry);
            System.debug('Result.status: ' + result.status);
            
        } catch (Exception e) {
            System.debug('ERROR: ' + e.getMessage());
            System.debug('ERROR Type: ' + e.getTypeName());
            System.debug('ERROR Stack Trace: ' + e.getStackTraceString());
            throw new AuraHandledException('Error retrieving order address: ' + e.getMessage());
        }
        
        System.debug('=== getOrderSummaryAddress returning ===');
        return result;
    }
    
    @AuraEnabled(cacheable=false)
    public static GeocodingResult getCoordinates(String street, String city, String state, String postalCode, String country) {
        GeocodingResult result = new GeocodingResult();
        result.success = false;
        
        try {
            // Build address string for geocoding
            List<String> addressParts = new List<String>();
            if (String.isNotBlank(street)) addressParts.add(street);
            if (String.isNotBlank(postalCode)) addressParts.add(postalCode);
            if (String.isNotBlank(city)) addressParts.add(city);
            if (String.isNotBlank(state)) addressParts.add(state);
            if (String.isNotBlank(country)) addressParts.add(country);
            
            if (addressParts.isEmpty()) {
                result.errorMessage = 'No address components provided';
                return result;
            }
            
            String addressQuery = String.join(addressParts, ', ');
            
            // Call Nominatim API
            String endpoint = 'https://nominatim.openstreetmap.org/search?format=json&q=' + 
                              EncodingUtil.urlEncode(addressQuery, 'UTF-8') + 
                              '&limit=1';
            
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