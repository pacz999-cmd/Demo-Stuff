String webStoreId = '0ZEHu000000Bb1uOAC';
String indexId = '0axHu0000003gly';
HttpRequest req = new HttpRequest();
req.setMethod('GET');
req.setEndpoint(URL.getOrgDomainUrl().toExternalForm() + '/services/data/v62.0/commerce/management/webstores/' + webStoreId + '/search/indexes/' + indexId);
req.setHeader('Authorization', 'Bearer ' + UserInfo.getSessionId());
req.setHeader('Content-Type', 'application/json');

Http http = new Http();
HttpResponse res = http.send(req);
System.debug('INDEX_GET_STATUS=' + res.getStatusCode());
System.debug('INDEX_GET_BODY=' + res.getBody());
