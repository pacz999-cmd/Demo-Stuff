String webStoreId = '0ZEHu000000Bb1uOAC';
HttpRequest req = new HttpRequest();
req.setMethod('POST');
req.setEndpoint(URL.getOrgDomainUrl().toExternalForm() + '/services/data/v62.0/commerce/management/webstores/' + webStoreId + '/search/indexes');
req.setHeader('Authorization', 'Bearer ' + UserInfo.getSessionId());
req.setHeader('Content-Type', 'application/json');
req.setBody('{"fullIndexing":true}');

Http http = new Http();
HttpResponse res = http.send(req);
System.debug('REINDEX_STATUS=' + res.getStatusCode());
System.debug('REINDEX_BODY=' + res.getBody());
