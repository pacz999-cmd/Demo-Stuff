public without sharing class GuestLeadFormController {
    @AuraEnabled
    public static Id createLead(
        String firstName,
        String lastName,
        String email,
        String phone,
        String company,
        String leadSource,
        String recordTypeDeveloperName,
        Map<String, String> extraFields
    ) {
        if (String.isBlank(lastName) || String.isBlank(company)) {
            throw new AuraHandledException('Last Name and Company are required.');
        }

        Lead lead = new Lead();
        lead.FirstName = firstName;
        lead.LastName = lastName;
        lead.Email = email;
        lead.Phone = phone;
        lead.Company = company;

        if (!String.isBlank(leadSource)) {
            lead.LeadSource = leadSource;
        }

        if (!String.isBlank(recordTypeDeveloperName)) {
            List<RecordType> rts = [
                SELECT Id
                FROM RecordType
                WHERE SObjectType = 'Lead'
                AND DeveloperName = :recordTypeDeveloperName
                AND IsActive = true
                LIMIT 1
            ];
            if (!rts.isEmpty()) {
                lead.RecordTypeId = rts[0].Id;
            }
        }

        if (extraFields != null && !extraFields.isEmpty()) {
            Map<String, Schema.SObjectField> leadFields = Schema.SObjectType.Lead.fields.getMap();
            for (String fieldApiName : extraFields.keySet()) {
                if (String.isBlank(fieldApiName) || !leadFields.containsKey(fieldApiName)) {
                    continue;
                }
                lead.put(fieldApiName, extraFields.get(fieldApiName));
            }
        }

        insert lead;
        return lead.Id;
    }
}
