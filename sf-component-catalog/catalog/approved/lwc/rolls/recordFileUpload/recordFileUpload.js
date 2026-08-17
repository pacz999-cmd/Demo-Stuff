import { LightningElement, api, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { getRecord } from 'lightning/uiRecordApi';
import { CurrentPageReference } from 'lightning/navigation';
import uploadFilesToRecord from '@salesforce/apex/RecordFileUploadController.uploadFilesToRecord';

export default class RecordFileUpload extends LightningElement {
    @api recordId; // Automatically provided by the page context
    
    // Configuration
    acceptedFormats = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt'];
    maxFileSize = 10 * 1024 * 1024; // 10 MB in bytes
    
    // State
    selectedFiles = [];
    uploadedFiles = [];
    uploading = false;
    dragOver = false;
    componentInitialized = false;

    // Wire to get current page reference for recordId extraction
    @wire(CurrentPageReference)
    getStateParameters(currentPageReference) {
        if (currentPageReference) {
            console.log('📄 Page Reference received:', currentPageReference);
            
            // Try to get recordId from page reference state
            if (currentPageReference.state && currentPageReference.state.recordId) {
                this.recordId = currentPageReference.state.recordId;
                console.log('✅ RecordId from page state:', this.recordId);
            }
            // Try to get from attributes
            else if (currentPageReference.attributes && currentPageReference.attributes.recordId) {
                this.recordId = currentPageReference.attributes.recordId;
                console.log('✅ RecordId from page attributes:', this.recordId);
            }
            // Try to extract from URL
            else {
                const urlRecordId = this.extractRecordIdFromUrl();
                if (urlRecordId) {
                    this.recordId = urlRecordId;
                    console.log('✅ RecordId from URL:', this.recordId);
                }
            }
        }
    }

    // Wire to verify record exists (optional but good practice)
    @wire(getRecord, { recordId: '$recordId', fields: ['Id'] })
    record;

    connectedCallback() {
        console.log('🔌 Component Connected!');
        console.log('📍 Initial RecordId:', this.recordId);
        
        // Try to get recordId from URL as fallback
        if (!this.recordId) {
            const urlRecordId = this.extractRecordIdFromUrl();
            if (urlRecordId) {
                this.recordId = urlRecordId;
                console.log('✅ RecordId extracted from URL:', this.recordId);
            } else {
                console.warn('⚠️ No RecordId found - component may not work correctly');
            }
        }
        
        this.componentInitialized = true;
        console.log('✅ Component fully initialized with RecordId:', this.recordId);
    }

    extractRecordIdFromUrl() {
        try {
            // Get URL
            const url = window.location.href;
            console.log('🔍 Extracting recordId from URL:', url);
            
            // Try different URL patterns
            // Pattern 1: /recordId/view or /recordId
            const recordIdMatch = url.match(/\/([a-zA-Z0-9]{15,18})(\/|$|\?)/);
            if (recordIdMatch) {
                return recordIdMatch[1];
            }
            
            // Pattern 2: ?recordId=xxx
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.has('recordId')) {
                return urlParams.get('recordId');
            }
            
            // Pattern 3: Look for any 15 or 18 character Salesforce ID in URL
            const idMatch = url.match(/[a-zA-Z0-9]{15}|[a-zA-Z0-9]{18}/);
            if (idMatch) {
                return idMatch[0];
            }
            
            console.warn('⚠️ Could not extract recordId from URL');
            return null;
        } catch (error) {
            console.error('❌ Error extracting recordId:', error);
            return null;
        }
    }

    get acceptedFormatsString() {
        return this.acceptedFormats.join(',');
    }

    get hasSelectedFiles() {
        return this.selectedFiles.length > 0;
    }

    get hasUploadedFiles() {
        return this.uploadedFiles.length > 0;
    }

    get dropZoneClass() {
        return `slds-file-selector slds-file-selector_files ${
            this.dragOver ? 'slds-has-drag-over' : ''
        }`;
    }

    get uploadButtonLabel() {
        return this.uploading 
            ? 'Uploading...' 
            : `Upload ${this.selectedFiles.length} File${this.selectedFiles.length !== 1 ? 's' : ''}`;
    }

    // Handle file input change
    handleFileChange(event) {
        const files = event.target.files;
        this.processFiles(files);
    }

    // Drag and drop handlers
    handleDragOver(event) {
        event.preventDefault();
        this.dragOver = true;
    }

    handleDragLeave(event) {
        event.preventDefault();
        this.dragOver = false;
    }

    handleDrop(event) {
        event.preventDefault();
        event.stopPropagation();
        this.dragOver = false;
        
        const files = event.dataTransfer.files;
        this.processFiles(files);
    }

    processFiles(files) {
        const fileArray = Array.from(files);
        const validFiles = [];
        const errors = [];

        fileArray.forEach(file => {
            // Validate file size
            if (file.size > this.maxFileSize) {
                errors.push(`${file.name}: File size exceeds 10 MB limit`);
                return;
            }

            // Validate file type
            const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
            if (!this.acceptedFormats.includes(fileExtension)) {
                errors.push(`${file.name}: File type not allowed`);
                return;
            }

            validFiles.push({
                file: file,
                name: file.name,
                size: this.formatFileSize(file.size),
                id: this.generateId()
            });
        });

        // Show errors if any
        if (errors.length > 0) {
            this.showToast('Validation Error', errors.join('\n'), 'error');
        }

        // Add valid files to selection
        if (validFiles.length > 0) {
            this.selectedFiles = [...this.selectedFiles, ...validFiles];
        }
    }

    handleRemoveFile(event) {
        const fileId = event.target.dataset.id;
        this.selectedFiles = this.selectedFiles.filter(f => f.id !== fileId);
    }

    handleUpload() {
        console.log('🔘 Upload button clicked!');
        console.log('📍 Current RecordId:', this.recordId);
        console.log('📂 Selected Files:', this.selectedFiles.length);
        
        if (!this.recordId) {
            console.error('❌ No recordId available!');
            this.showToast(
                'Missing Record ID', 
                'Cannot upload files: No record ID found. Please ensure this component is placed on a record detail page.', 
                'error'
            );
            return;
        }

        if (this.selectedFiles.length === 0) {
            console.warn('⚠️ No files selected');
            this.showToast('Error', 'Please select at least one file to upload.', 'warning');
            return;
        }

        this.performUpload();
    }

    async performUpload() {
        this.uploading = true;

        try {
            console.log('📤 Starting file upload process...');
            console.log('📍 Record ID:', this.recordId);
            console.log('📁 Files to upload:', this.selectedFiles.length);

            // Read all files and convert to base64
            const fileDataList = await Promise.all(
                this.selectedFiles.map(fileObj => this.readFileAsBase64(fileObj.file))
            );

            console.log('Files converted to base64');

            // Prepare data for Apex
            const filesToUpload = this.selectedFiles.map((fileObj, index) => ({
                fileName: fileObj.name,
                base64Data: fileDataList[index],
                contentType: fileObj.file.type
            }));

            console.log('Calling Apex method uploadFilesToRecord...');

            // Call Apex to upload files
            const result = await uploadFilesToRecord({
                recordId: this.recordId,
                files: filesToUpload
            });

            console.log('Apex call successful, processing results...');
            console.log('Result:', result);

            // Process results
            const successCount = result.filter(r => r.success).length;
            const failCount = result.filter(r => !r.success).length;

            // Add successful uploads to uploaded files list
            result.forEach((r, index) => {
                if (r.success) {
                    this.uploadedFiles.push({
                        id: r.contentDocumentId,
                        name: r.fileName,
                        size: this.selectedFiles[index].size,
                        contentVersionId: r.contentVersionId
                    });
                } else {
                    // Log individual file failures
                    console.error(`File upload failed: ${r.fileName}`, r.message);
                }
            });

            // Clear selected files
            this.selectedFiles = [];

            // Show results
            if (successCount > 0 && failCount === 0) {
                this.showToast(
                    'Success',
                    `${successCount} file${successCount !== 1 ? 's' : ''} uploaded successfully`,
                    'success'
                );
            } else if (successCount > 0 && failCount > 0) {
                this.showToast(
                    'Partial Success',
                    `${successCount} file${successCount !== 1 ? 's' : ''} uploaded, ${failCount} failed`,
                    'warning'
                );
            } else {
                this.showToast(
                    'Error',
                    'All file uploads failed. Please check the console for details.',
                    'error'
                );
            }

        } catch (error) {
            console.error('Upload error:', error);
            console.error('Error details:', JSON.stringify(error, null, 2));
            
            // Provide more specific error messages
            let errorMessage = 'An error occurred during upload';
            
            if (error.body) {
                if (error.body.message) {
                    errorMessage = error.body.message;
                    
                    // Check for common permission errors
                    if (errorMessage.includes('insufficient access') || 
                        errorMessage.includes('permission') ||
                        errorMessage.includes('INSUFFICIENT_ACCESS')) {
                        errorMessage = 'Permission Error: You do not have access to upload files. Please contact your administrator to grant access to the RecordFileUploadController Apex class.';
                    }
                } else if (error.body.pageErrors && error.body.pageErrors.length > 0) {
                    errorMessage = error.body.pageErrors[0].message;
                }
            } else if (error.message) {
                errorMessage = error.message;
            }
            
            this.showToast(
                'Upload Error',
                errorMessage,
                'error'
            );
        } finally {
            this.uploading = false;
            console.log('Upload process completed');
        }
    }

    readFileAsBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
        });
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    }

    generateId() {
        return Date.now() + Math.random().toString(36).substr(2, 9);
    }

    showToast(title, message, variant) {
        this.dispatchEvent(
            new ShowToastEvent({
                title: title,
                message: message,
                variant: variant
            })
        );
    }
}