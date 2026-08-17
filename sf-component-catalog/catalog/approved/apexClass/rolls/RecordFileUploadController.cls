public with sharing class RecordFileUploadController {
    
    /**
     * Upload multiple files to a specific record
     * @param recordId The ID of the record to attach files to
     * @param files List of files with name, base64 data, and content type
     * @return List of upload results for each file
     */
    @AuraEnabled
    public static List<FileUploadResult> uploadFilesToRecord(String recordId, List<FileData> files) {
        List<FileUploadResult> results = new List<FileUploadResult>();
        
        // Validate inputs
        if (String.isBlank(recordId)) {
            throw new AuraHandledException('Record ID is required');
        }
        
        if (files == null || files.isEmpty()) {
            throw new AuraHandledException('At least one file is required');
        }
        
        // Verify user has access to the record
        if (!isRecordAccessible(recordId)) {
            throw new AuraHandledException('You do not have access to this record');
        }
        
        // Process each file
        List<ContentVersion> contentVersionsToInsert = new List<ContentVersion>();
        
        for (FileData fileData : files) {
            try {
                // Validate file data
                if (String.isBlank(fileData.fileName)) {
                    results.add(createErrorResult(fileData.fileName, 'File name is required'));
                    continue;
                }
                
                if (String.isBlank(fileData.base64Data)) {
                    results.add(createErrorResult(fileData.fileName, 'File data is required'));
                    continue;
                }
                
                // Server-side validation for file size (10 MB = 10485760 bytes)
                // Base64 encoding increases size by ~33%, so check decoded size
                Integer decodedSize = (fileData.base64Data.length() * 3) / 4;
                if (decodedSize > 10485760) {
                    results.add(createErrorResult(fileData.fileName, 'File size exceeds 10 MB limit'));
                    continue;
                }
                
                // Validate file type
                if (!isValidFileType(fileData.fileName)) {
                    results.add(createErrorResult(fileData.fileName, 'File type not allowed'));
                    continue;
                }
                
                // Create ContentVersion
                ContentVersion cv = new ContentVersion();
                cv.Title = fileData.fileName;
                cv.PathOnClient = fileData.fileName;
                cv.VersionData = EncodingUtil.base64Decode(fileData.base64Data);
                cv.IsMajorVersion = true;
                
                // Set content type if provided
                if (String.isNotBlank(fileData.contentType)) {
                    cv.ContentLocation = 'S'; // S = Salesforce
                }
                
                contentVersionsToInsert.add(cv);
                
            } catch (Exception e) {
                results.add(createErrorResult(fileData.fileName, 'Error processing file: ' + e.getMessage()));
            }
        }
        
        // Insert ContentVersions
        if (!contentVersionsToInsert.isEmpty()) {
            try {
                insert contentVersionsToInsert;
                
                // Query to get ContentDocumentIds
                Set<Id> cvIds = new Set<Id>();
                for (ContentVersion cv : contentVersionsToInsert) {
                    cvIds.add(cv.Id);
                }
                
                List<ContentVersion> insertedCVs = [
                    SELECT Id, ContentDocumentId, Title, FileType, ContentSize
                    FROM ContentVersion
                    WHERE Id IN :cvIds
                ];
                
                // Create ContentDocumentLinks to associate files with the record
                List<ContentDocumentLink> cdLinks = new List<ContentDocumentLink>();
                for (ContentVersion cv : insertedCVs) {
                    ContentDocumentLink cdl = new ContentDocumentLink();
                    cdl.ContentDocumentId = cv.ContentDocumentId;
                    cdl.LinkedEntityId = recordId;
                    cdl.ShareType = 'V'; // Viewer permission
                    cdl.Visibility = 'AllUsers'; // Visible to all users with access to record
                    cdLinks.add(cdl);
                }
                
                insert cdLinks;
                
                // Create success results
                for (ContentVersion cv : insertedCVs) {
                    FileUploadResult result = new FileUploadResult();
                    result.success = true;
                    result.contentVersionId = cv.Id;
                    result.contentDocumentId = cv.ContentDocumentId;
                    result.fileName = cv.Title;
                    result.fileType = cv.FileType;
                    result.fileSize = cv.ContentSize;
                    result.message = 'File uploaded successfully';
                    results.add(result);
                }
                
            } catch (Exception e) {
                // If batch insert fails, create error results for all files
                for (ContentVersion cv : contentVersionsToInsert) {
                    results.add(createErrorResult(cv.Title, 'Error uploading file: ' + e.getMessage()));
                }
            }
        }
        
        return results;
    }
    
    /**
     * Check if the current user has access to the record
     */
    private static Boolean isRecordAccessible(String recordId) {
        try {
            // Try to query the record - this will fail if user doesn't have access
            String objectType = Id.valueOf(recordId).getSObjectType().getDescribe().getName();
            String query = 'SELECT Id FROM ' + objectType + ' WHERE Id = :recordId LIMIT 1';
            List<SObject> records = Database.query(query);
            return !records.isEmpty();
        } catch (Exception e) {
            return false;
        }
    }
    
    /**
     * Validate file type based on extension
     */
    private static Boolean isValidFileType(String fileName) {
        if (String.isBlank(fileName)) {
            return false;
        }
        
        String fileExtension = '.' + fileName.substringAfterLast('.').toLowerCase();
        
        Set<String> allowedExtensions = new Set<String>{
            '.jpg', '.jpeg', '.png', '.gif', '.bmp',  // Images
            '.pdf',                                     // PDF
            '.doc', '.docx',                            // Word
            '.xls', '.xlsx',                            // Excel
            '.ppt', '.pptx',                            // PowerPoint
            '.txt'                                      // Text
        };
        
        return allowedExtensions.contains(fileExtension);
    }
    
    /**
     * Create an error result
     */
    private static FileUploadResult createErrorResult(String fileName, String errorMessage) {
        FileUploadResult result = new FileUploadResult();
        result.success = false;
        result.fileName = fileName;
        result.message = errorMessage;
        return result;
    }
    
    /**
     * Wrapper class for file data input
     */
    public class FileData {
        @AuraEnabled
        public String fileName { get; set; }
        
        @AuraEnabled
        public String base64Data { get; set; }
        
        @AuraEnabled
        public String contentType { get; set; }
    }
    
    /**
     * Wrapper class for upload results
     */
    public class FileUploadResult {
        @AuraEnabled
        public Boolean success { get; set; }
        
        @AuraEnabled
        public String contentVersionId { get; set; }
        
        @AuraEnabled
        public String contentDocumentId { get; set; }
        
        @AuraEnabled
        public String fileName { get; set; }
        
        @AuraEnabled
        public String fileType { get; set; }
        
        @AuraEnabled
        public Long fileSize { get; set; }
        
        @AuraEnabled
        public String message { get; set; }
    }
}