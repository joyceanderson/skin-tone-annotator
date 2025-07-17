document.addEventListener('DOMContentLoaded', function() {
    // Global variables for image navigation
    let allImages = [];
    let currentImageIndex = 0;
    // DOM Elements
    const uploadForm = document.getElementById('upload-form');
    const fileInput = document.getElementById('file');
    const imageContainer = document.getElementById('image-container');
    const noImageMessage = document.getElementById('no-image-message');
    const annotationCanvas = document.getElementById('annotation-canvas');
    const ctx = annotationCanvas.getContext('2d');
    const imageTitle = document.getElementById('image-title');
    const selectionModeIndicator = document.getElementById('selection-mode-indicator');
    
    // Navigation elements
    const prevButton = document.getElementById('prev-image');
    const nextButton = document.getElementById('next-image');
    const imageCounter = document.getElementById('image-counter');
    const resetAnnotationsBtn = document.getElementById('reset-annotations');
    
    // Control buttons
    const unaffectedBtn = document.getElementById('unaffected-btn');
    const affectedBtn = document.getElementById('affected-btn');
    const noneBtn = document.getElementById('none-btn');
    const resetBtn = document.getElementById('reset-btn');
    const saveBtn = document.getElementById('save-btn');
    
    // Result elements
    const currentResults = document.getElementById('current-results');
    const unaffectedColorPreview = document.getElementById('unaffected-color-preview');
    const affectedColorPreview = document.getElementById('affected-color-preview');
    const annotationsTable = document.getElementById('annotations-table');
    
    // Toast elements
    const notificationToast = document.getElementById('notification-toast');
    const toastTitle = document.getElementById('toast-title');
    const toastMessage = document.getElementById('toast-message');
    const toast = new bootstrap.Toast(notificationToast);
    
    // Application state
    let currentImage = null;
    let currentSubjectId = null;
    let selectionMode = null;
    let unaffectedPoints = [];
    let affectedPoints = [];
    let unaffectedPixels = [];
    let affectedPixels = [];
    
    // Initialize
    loadAnnotations();
    loadImagesFromDirectory();
    
    // Event Listeners
    uploadForm.addEventListener('submit', handleUpload);
    annotationCanvas.addEventListener('click', handleCanvasClick);
    unaffectedBtn.addEventListener('click', () => setSelectionMode('unaffected'));
    affectedBtn.addEventListener('click', () => setSelectionMode('affected'));
    noneBtn.addEventListener('click', () => setSelectionMode(null));
    resetBtn.addEventListener('click', resetAnnotations);
    saveBtn.addEventListener('click', saveAnnotation);
    
    // Navigation event listeners
    prevButton.addEventListener('click', navigateToPrevImage);
    nextButton.addEventListener('click', navigateToNextImage);
    
    // Reset All button event listener
    const resetAllBtn = document.getElementById('reset-all-btn');
    if (resetAllBtn) {
        console.log('Reset All button found, adding event listener');
        resetAllBtn.addEventListener('click', function(e) {
            e.preventDefault(); // Prevent any default action
            console.log('Reset All button clicked');
            
            // Create a modal dialog instead of using the browser's confirm
            // This is more reliable across browsers
            const confirmDialog = document.createElement('div');
            confirmDialog.className = 'modal fade';
            confirmDialog.id = 'confirmResetModal';
            confirmDialog.setAttribute('tabindex', '-1');
            confirmDialog.setAttribute('aria-hidden', 'true');
            
            confirmDialog.innerHTML = `
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Confirm Reset</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <p>Are you sure you want to reset all annotations? This will delete all saved data.</p>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-danger" id="confirmResetBtn">Reset All</button>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(confirmDialog);
            
            const modal = new bootstrap.Modal(confirmDialog);
            modal.show();
            
            // Handle confirmation
            document.getElementById('confirmResetBtn').addEventListener('click', function() {
                console.log('Reset confirmed via modal');
                modal.hide();
                
                // Show loading notification
                showNotification('Processing', 'Resetting annotations...', 'info');
                
                // Submit the request using fetch
                fetch('/reset_annotations', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({reset: true})
                })
                .then(response => {
                    console.log('Reset response received:', response.status);
                    if (!response.ok) {
                        throw new Error(`HTTP error! Status: ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    console.log('Reset data:', data);
                    if (data.success) {
                        showNotification('Success', 'All annotations have been reset', 'success');
                        // Clear the annotations table and reload annotations
                        loadAnnotations();
                    } else {
                        showNotification('Error', data.message || 'Unknown error', 'error');
                    }
                })
                .catch(error => {
                    console.error('Error during reset:', error);
                    showNotification('Error', `Failed to reset annotations: ${error.message}`, 'error');
                })
                .finally(() => {
                    // Remove the modal from the DOM after it's hidden
                    confirmDialog.addEventListener('hidden.bs.modal', function() {
                        document.body.removeChild(confirmDialog);
                    });
                });
            });
            
            // Remove the modal when it's closed without confirmation
            confirmDialog.addEventListener('hidden.bs.modal', function() {
                if (document.body.contains(confirmDialog)) {
                    document.body.removeChild(confirmDialog);
                }
            });
        });
    } else {
        console.error('Reset All button not found in the DOM');
    }
    
    // Remove the existing click handler and add direct touch support
    annotationCanvas.removeEventListener('click', handleCanvasClick);
    
    // Function to process touch/click input and add annotation points
    function processTouchOrClick(clientX, clientY) {
        if (!currentImage || !selectionMode) return;
        
        const rect = annotationCanvas.getBoundingClientRect();
        const scaleX = annotationCanvas.width / rect.width;
        const scaleY = annotationCanvas.height / rect.height;
        
        // Calculate position relative to canvas
        const x = (clientX - rect.left) * scaleX;
        const y = (clientY - rect.top) * scaleY;
        
        // Get pixel color at click position
        // Convert the scaled coordinates back to original image coordinates
        const scaleFactor = currentImage.scaleFactor || 1;
        const originalX = Math.floor(x / scaleFactor);
        const originalY = Math.floor(y / scaleFactor);
        
        // Make sure we stay within the bounds of the original image
        const boundedX = Math.min(Math.max(0, originalX), currentImage.width - 1);
        const boundedY = Math.min(Math.max(0, originalY), currentImage.height - 1);
        
        // Get the pixel color from the original image data
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = currentImage.width;
        tempCanvas.height = currentImage.height;
        tempCtx.drawImage(currentImage, 0, 0);
        const pixelData = tempCtx.getImageData(boundedX, boundedY, 1, 1).data;
        const pixel = [pixelData[0], pixelData[1], pixelData[2]]; // RGB
        
        const point = { x, y };
        
        if (selectionMode === 'unaffected') {
            unaffectedPoints.push(point);
            unaffectedPixels.push(pixel);
            drawPoint(x, y, 'unaffected');
            console.log(`Added unaffected point at (${x}, ${y}), color: RGB(${pixel.join(',')})`); 
        } else if (selectionMode === 'affected') {
            affectedPoints.push(point);
            affectedPixels.push(pixel);
            drawPoint(x, y, 'affected');
            console.log(`Added affected point at (${x}, ${y}), color: RGB(${pixel.join(',')})`); 
        }
        
        // Update color previews
        updateColorPreviews();
        
        // Enable save button if we have points in both categories
        saveBtn.disabled = !(unaffectedPoints.length > 0 && affectedPoints.length > 0);
    }
    
    // Mouse click handler
    annotationCanvas.addEventListener('click', function(e) {
        processTouchOrClick(e.clientX, e.clientY);
    });
    
    // Touch start handler
    annotationCanvas.addEventListener('touchstart', function(e) {
        e.preventDefault(); // Prevent scrolling
        if (e.touches.length > 0) {
            const touch = e.touches[0];
            processTouchOrClick(touch.clientX, touch.clientY);
        }
    }, { passive: false });
    
    // Touch move handler for continuous drawing
    annotationCanvas.addEventListener('touchmove', function(e) {
        e.preventDefault(); // Prevent scrolling
        if (e.touches.length > 0 && selectionMode) {
            const touch = e.touches[0];
            processTouchOrClick(touch.clientX, touch.clientY);
        }
    }, { passive: false });
    
    // Make UI more touch-friendly
    document.querySelectorAll('.btn').forEach(button => {
        button.style.minHeight = '44px'; // Make buttons larger for touch
    });
    
    // Add a message for mobile users
    const mobileMessage = document.createElement('div');
    mobileMessage.className = 'alert alert-info mt-2';
    mobileMessage.innerHTML = 'Touch enabled: Tap to add points, drag to draw continuously.';
    document.querySelector('.annotation-controls').appendChild(mobileMessage);
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (!currentImage) return;
        
        switch (e.key.toLowerCase()) {
            case 'u':
                setSelectionMode('unaffected');
                break;
            case 'a':
                setSelectionMode('affected');
                break;
            case 'c':
                setSelectionMode(null);
                break;
            case 'r':
                resetAnnotations();
                break;
            case 's':
                saveAnnotation();
                break;
        }
    });
    
    // Functions
    function handleUpload(e) {
        e.preventDefault();
        
        const file = fileInput.files[0];
        if (!file) {
            showNotification('Error', 'Please select a file first', 'error');
            return;
        }
        
        const formData = new FormData();
        formData.append('file', file);
        
        fetch('/upload', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                loadImage(data.filename, data.subject_id);
            } else {
                showNotification('Error', data.error, 'error');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showNotification('Error', 'Failed to upload image', 'error');
        });
    }
    
    function loadImage(filename, subjectId) {
        // Create new image
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = `/uploads/${filename}`;
        
        img.onload = function() {
            // Reset current annotations
            resetAnnotations();
            
            // Update canvas size to match image
            annotationCanvas.width = img.width;
            annotationCanvas.height = img.height;
            
            // Draw image on canvas
            ctx.drawImage(img, 0, 0);
            
            // Update UI
            currentImage = img;
            currentSubjectId = subjectId;
            imageTitle.textContent = `Image: ${filename} (ID: ${subjectId})`;
            noImageMessage.style.display = 'none';
            imageContainer.style.display = 'block';
            
            // Enable controls
            enableControls();
            
            showNotification('Success', 'Image loaded successfully', 'success');
        };
        
        img.onerror = function() {
            showNotification('Error', 'Failed to load image', 'error');
        };
    }
    
    function handleCanvasClick(e) {
        if (!currentImage || !selectionMode) return;
        
        // Get click coordinates relative to canvas
        const rect = annotationCanvas.getBoundingClientRect();
        const scaleX = annotationCanvas.width / rect.width;
        const scaleY = annotationCanvas.height / rect.height;
        
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;
        
        // Add point to appropriate array
        const point = { x, y };
        
        // Get pixel color at click position
        // We need to convert the scaled coordinates back to original image coordinates
        const scaleFactor = currentImage.scaleFactor || 1;
        const originalX = Math.floor(x / scaleFactor);
        const originalY = Math.floor(y / scaleFactor);
        
        // Make sure we stay within the bounds of the original image
        const boundedX = Math.min(Math.max(0, originalX), currentImage.width - 1);
        const boundedY = Math.min(Math.max(0, originalY), currentImage.height - 1);
        
        // Get the pixel color from the original image data
        // We need to create a temporary canvas to get the original image data
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = currentImage.width;
        tempCanvas.height = currentImage.height;
        tempCtx.drawImage(currentImage, 0, 0);
        const pixelData = tempCtx.getImageData(boundedX, boundedY, 1, 1).data;
        const pixel = [pixelData[0], pixelData[1], pixelData[2]]; // RGB
        
        if (selectionMode === 'unaffected') {
            unaffectedPoints.push(point);
            unaffectedPixels.push(pixel);
            drawPoint(x, y, 'unaffected');
            console.log(`Added unaffected point at scaled (${x}, ${y}), original (${boundedX}, ${boundedY}), color: RGB(${pixel.join(',')})`); 
        } else if (selectionMode === 'affected') {
            affectedPoints.push(point);
            affectedPixels.push(pixel);
            drawPoint(x, y, 'affected');
            console.log(`Added affected point at scaled (${x}, ${y}), original (${boundedX}, ${boundedY}), color: RGB(${pixel.join(',')})`); 
        }
        
        // Update color previews
        updateColorPreviews();
        
        // Enable save button if we have points in both categories
        saveBtn.disabled = !(unaffectedPoints.length > 0 && affectedPoints.length > 0);
    }
    
    function drawPoint(x, y, type) {
        const color = type === 'unaffected' ? '#198754' : '#dc3545';
        const scaleFactor = currentImage.scaleFactor || 1;
        
        // Draw circle on canvas - make points larger on scaled images
        const pointRadius = Math.max(3, 3 * scaleFactor / 2); // Scale point size with image
        
        ctx.beginPath();
        ctx.arc(x, y, pointRadius, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
    }
    
    function setSelectionMode(mode) {
        selectionMode = mode;
        
        // Update UI
        selectionModeIndicator.textContent = mode ? 
            `Mode: ${mode.toUpperCase()}` : 
            'No Selection Mode';
        
        selectionModeIndicator.className = 'badge';
        if (mode === 'unaffected') {
            selectionModeIndicator.classList.add('bg-success', 'selection-mode-unaffected');
        } else if (mode === 'affected') {
            selectionModeIndicator.classList.add('bg-danger', 'selection-mode-affected');
        } else {
            selectionModeIndicator.classList.add('bg-secondary');
        }
        
        // Update button states
        unaffectedBtn.classList.toggle('active', mode === 'unaffected');
        affectedBtn.classList.toggle('active', mode === 'affected');
        noneBtn.classList.toggle('active', mode === null);
    }
    
    function resetAnnotations() {
        // Clear points
        unaffectedPoints = [];
        affectedPoints = [];
        unaffectedPixels = [];
        affectedPixels = [];
        
        // Reset canvas
        if (currentImage) {
            ctx.clearRect(0, 0, annotationCanvas.width, annotationCanvas.height);
            ctx.drawImage(currentImage, 0, 0);
        }
        
        // Reset color previews
        unaffectedColorPreview.style.backgroundColor = '#f0f0f0';
        affectedColorPreview.style.backgroundColor = '#f0f0f0';
        
        // Disable save button
        saveBtn.disabled = true;
        
        showNotification('Info', 'Annotations reset', 'info');
    }
    
    function updateColorPreviews() {
        // Update unaffected color preview
        if (unaffectedPixels.length > 0) {
            const avgUnaffected = computeAverageColor(unaffectedPixels);
            unaffectedColorPreview.style.backgroundColor = `rgb(${avgUnaffected[0]}, ${avgUnaffected[1]}, ${avgUnaffected[2]})`;
        }
        
        // Update affected color preview
        if (affectedPixels.length > 0) {
            const avgAffected = computeAverageColor(affectedPixels);
            affectedColorPreview.style.backgroundColor = `rgb(${avgAffected[0]}, ${avgAffected[1]}, ${avgAffected[2]})`;
        }
    }
    
    function computeAverageColor(pixels) {
        if (pixels.length === 0) return [0, 0, 0];
        
        const sum = pixels.reduce((acc, pixel) => {
            return [acc[0] + pixel[0], acc[1] + pixel[1], acc[2] + pixel[2]];
        }, [0, 0, 0]);
        
        return [
            Math.round(sum[0] / pixels.length),
            Math.round(sum[1] / pixels.length),
            Math.round(sum[2] / pixels.length)
        ];
    }
    
    function saveAnnotation() {
        if (!currentSubjectId || unaffectedPoints.length === 0 || affectedPoints.length === 0) {
            showNotification('Error', 'Please annotate both unaffected and affected areas', 'error');
            return;
        }
        
        const data = {
            subject_id: currentSubjectId,
            unaffected_pixels: unaffectedPixels,
            affected_pixels: affectedPixels
        };
        
        fetch('/save_annotation', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showNotification('Success', 'Annotation saved successfully', 'success');
                displayCurrentResult(data.result);
                loadAnnotations(); // Refresh annotations table
                
                // Automatically move to next image if available
                if (currentImageIndex < allImages.length - 1) {
                    navigateToNextImage();
                } else {
                    showNotification('Info', 'All images have been annotated', 'info');
                }
            } else {
                showNotification('Error', data.error, 'error');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showNotification('Error', 'Failed to save annotation', 'error');
        });
    }
    
    function displayCurrentResult(result) {
        currentResults.innerHTML = `
            <div class="alert alert-success">
                <h6>Saved for Subject ID: ${result.subject_id}</h6>
                <div class="row">
                    <div class="col-6">
                        <strong>Unaffected:</strong><br>
                        RGB: ${result.unaffected.rgb}<br>
                        HEX: ${result.unaffected.hex}
                    </div>
                    <div class="col-6">
                        <strong>Affected:</strong><br>
                        RGB: ${result.affected.rgb}<br>
                        HEX: ${result.affected.hex}
                    </div>
                </div>
            </div>
        `;
    }
    
    function loadAnnotations() {
        fetch('/get_annotations')
            .then(response => response.json())
            .then(data => {
                if (data.length === 0) {
                    annotationsTable.innerHTML = `
                        <tr>
                            <td colspan="5" class="text-center">No annotations yet</td>
                        </tr>
                    `;
                    return;
                }
                
                let tableHTML = '';
                data.forEach(annotation => {
                    tableHTML += `
                        <tr>
                            <td>${annotation.subject_id}</td>
                            <td>${annotation.RGB_unaff}</td>
                            <td>${annotation.RGB_aff}</td>
                            <td>
                                <span class="d-inline-block me-1" style="width: 15px; height: 15px; background-color: ${annotation.HEX_unaff}"></span>
                                ${annotation.HEX_unaff}
                            </td>
                            <td>
                                <span class="d-inline-block me-1" style="width: 15px; height: 15px; background-color: ${annotation.HEX_aff}"></span>
                                ${annotation.HEX_aff}
                            </td>
                        </tr>
                    `;
                });
                
                annotationsTable.innerHTML = tableHTML;
            })
            .catch(error => {
                console.error('Error:', error);
                showNotification('Error', 'Failed to load annotations', 'error');
            });
    }
    
    function enableControls() {
        unaffectedBtn.disabled = false;
        affectedBtn.disabled = false;
        noneBtn.disabled = false;
        resetBtn.disabled = false;
        // Save button will be enabled when both types of points are added
    }
    
    function showNotification(title, message, type) {
        toastTitle.textContent = title;
        toastMessage.textContent = message;
        
        // Set toast color based on type
        notificationToast.className = 'toast';
        switch (type) {
            case 'success':
                notificationToast.classList.add('bg-success', 'text-white');
                break;
            case 'error':
                notificationToast.classList.add('bg-danger', 'text-white');
                break;
            case 'info':
                notificationToast.classList.add('bg-info', 'text-white');
                break;
            default:
                notificationToast.classList.add('bg-light');
        }
        
        toast.show();
    }
    
    // Function to load all images from the directory
    function loadImagesFromDirectory() {
        fetch('/get_images')
            .then(response => response.json())
            .then(data => {
                if (data.length === 0) {
                    showNotification('Info', 'No images found in the directory', 'info');
                    return;
                }
                
                allImages = data;
                currentImageIndex = 0;
                
                // Load the first image
                const firstImage = allImages[0];
                loadImageFromDirectory(firstImage.filename, firstImage.subject_id);
                
                // Update navigation controls
                updateNavigationControls();
                
                showNotification('Success', `Loaded ${data.length} images from directory`, 'success');
            })
            .catch(error => {
                console.error('Error:', error);
                showNotification('Error', 'Failed to load images from directory', 'error');
            });
    }
    
    // Function to load a specific image from the directory
    function loadImageFromDirectory(filename, subjectId) {
        // Create new image
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = `/images/${filename}`;
        
        // Extract just the ID part (before _face_nose) as the subject ID
        let fullSubjectId = filename.replace(/\.[^/.]+$/, ""); // Remove file extension
        
        // Remove _face_nose or similar suffixes if present
        if (fullSubjectId.includes("_face_nose")) {
            fullSubjectId = fullSubjectId.split("_face_nose")[0];
        } else if (fullSubjectId.includes("_face")) {
            fullSubjectId = fullSubjectId.split("_face")[0];
        } else if (fullSubjectId.includes("_nose")) {
            fullSubjectId = fullSubjectId.split("_nose")[0];
        }
        
        img.onload = function() {
            // Reset current annotations
            resetAnnotations();
            
            // Scale factor to make small images bigger (4x for 112x112 images)
            const scaleFactor = 4;
            
            // Update canvas size to match scaled image
            annotationCanvas.width = img.width * scaleFactor;
            annotationCanvas.height = img.height * scaleFactor;
            
            // Enable image smoothing for better scaling
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            
            // Draw image on canvas with scaling
            ctx.drawImage(img, 0, 0, img.width, img.height, 
                         0, 0, annotationCanvas.width, annotationCanvas.height);
            
            // Store original dimensions and scale factor for click coordinate conversion
            currentImage = img;
            currentImage.scaleFactor = scaleFactor;
            currentSubjectId = fullSubjectId; // Use the full filename as the subject ID
            
            // Update UI
            imageTitle.textContent = `Image: ${filename} (ID: ${fullSubjectId}) - Original size: ${img.width}x${img.height}, Scaled: ${annotationCanvas.width}x${annotationCanvas.height}`;
            noImageMessage.style.display = 'none';
            imageContainer.style.display = 'block';
            
            // Enable controls
            enableControls();
        };
        
        img.onerror = function() {
            showNotification('Error', `Failed to load image: ${filename}`, 'error');
        };
    }
    
    // Function to navigate to the previous image
    function navigateToPrevImage() {
        if (currentImageIndex > 0) {
            currentImageIndex--;
            const image = allImages[currentImageIndex];
            loadImageFromDirectory(image.filename, image.subject_id);
            updateNavigationControls();
        }
    }
    
    // Function to navigate to the next image
    function navigateToNextImage() {
        if (currentImageIndex < allImages.length - 1) {
            currentImageIndex++;
            const image = allImages[currentImageIndex];
            loadImageFromDirectory(image.filename, image.subject_id);
            updateNavigationControls();
        }
    }
    
    // Function to update navigation controls
    function updateNavigationControls() {
        // Update counter
        if (imageCounter) {
            imageCounter.textContent = `Image ${currentImageIndex + 1} of ${allImages.length}`;
        }
        
        // Update button states
        if (prevButton) {
            prevButton.disabled = currentImageIndex === 0;
        }
        
        if (nextButton) {
            nextButton.disabled = currentImageIndex === allImages.length - 1;
        }
    }
    
    // Function to reset all annotations (clear the CSV file)
    function resetAllAnnotations() {
        console.log('resetAllAnnotations function called');
        if (confirm('Are you sure you want to reset all annotations? This will delete all saved data.')) {
            console.log('User confirmed reset');
            
            // Show loading notification
            showNotification('Processing', 'Resetting annotations...', 'info');
            
            fetch('/reset_annotations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({reset: true}) // Adding a payload for clarity
            })
            .then(response => {
                console.log('Reset response received:', response.status);
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                console.log('Reset data:', data);
                if (data.success) {
                    showNotification('Success', 'All annotations have been reset', 'success');
                    // Clear the annotations table and reload annotations
                    loadAnnotations();
                } else {
                    showNotification('Error', data.message || 'Unknown error', 'error');
                }
            })
            .catch(error => {
                console.error('Error during reset:', error);
                showNotification('Error', `Failed to reset annotations: ${error.message}`, 'error');
            });
        } else {
            console.log('User cancelled reset');
        }
    }
});
