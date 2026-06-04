List<WebStore> stores = [SELECT Id, Name FROM WebStore ORDER BY Name];
Http http = new Http();

for (WebStore storeRec : stores) {
    HttpRequest req = new HttpRequest();
    req.setMethod('GET');
    req.setEndpoint(
        URL.getOrgDomainUrl().toExternalForm() +
        '/services/data/v62.0/commerce/management/webstores/' +
        storeRec.Id +
        '/search/indexes'
    );
    req.setHeader('Authorization', 'Bearer ' + UserInfo.getSessionId());
    req.setHeader('Content-Type', 'application/json');

    HttpResponse res = http.send(req);
    System.debug('STORE=' + storeRec.Name + ' (' + storeRec.Id + ') STATUS=' + res.getStatusCode() + ' BODY=' + res.getBody());
}
