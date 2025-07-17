import os
import csv
import numpy as np
import cv2
from flask import Flask, render_template, request, redirect, url_for, jsonify, send_from_directory, send_file
from werkzeug.utils import secure_filename
import uuid
import json
import glob

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['IMAGES_FOLDER'] = 'face_nose'
app.config['ALLOWED_EXTENSIONS'] = {'png', 'jpg', 'jpeg'}
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max upload size
app.config['RESULTS_FILE'] = 'annotations.csv'

# Ensure upload folder exists
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']

def compute_average_color(pixels):
    """Calculate average BGR color from a list of pixels"""
    pixels_array = np.array(pixels)
    avg_color = np.mean(pixels_array, axis=0)
    return avg_color

def bgr_to_rgb(bgr):
    """Convert BGR to RGB"""
    return (int(bgr[2]), int(bgr[1]), int(bgr[0]))

def rgb_to_hex(rgb):
    """Convert RGB to HEX"""
    return f"#{rgb[0]:02x}{rgb[1]:02x}{rgb[2]:02x}"

@app.route('/')
def index():
    """Render the main page"""
    return render_template('index.html')

@app.route('/get_images')
def get_images():
    """Get list of images from the images folder"""
    images_path = app.config['IMAGES_FOLDER']
    if not os.path.exists(images_path):
        return jsonify([]), 404
    
    # Get all image files
    image_files = []
    for ext in app.config['ALLOWED_EXTENSIONS']:
        image_files.extend(glob.glob(os.path.join(images_path, f'*.{ext}')))
    
    # Sort images by filename
    image_files.sort()
    
    # Extract just the filenames and subject IDs
    images = []
    for image_path in image_files:
        filename = os.path.basename(image_path)
        # Extract subject_id from filename (everything before first underscore)
        subject_id = filename.split('_')[0] if '_' in filename else filename.split('.')[0]
        images.append({
            'filename': filename,
            'subject_id': subject_id,
            'path': image_path
        })
    
    return jsonify(images)

@app.route('/upload', methods=['POST'])
def upload_file():
    """Handle file uploads"""
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    if file and allowed_file(file.filename):
        # Generate a unique filename to prevent collisions
        original_filename = secure_filename(file.filename)
        filename_parts = original_filename.rsplit('.', 1)
        unique_filename = f"{filename_parts[0]}_{uuid.uuid4().hex}.{filename_parts[1]}"
        
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
        file.save(filepath)
        
        # Extract subject_id from filename (everything before first underscore)
        subject_id = original_filename.split('_')[0] if '_' in original_filename else original_filename.split('.')[0]
        
        return jsonify({
            'success': True,
            'filename': unique_filename,
            'subject_id': subject_id,
            'filepath': filepath
        })
    
    return jsonify({'error': 'File type not allowed'}), 400

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    """Serve uploaded files"""
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/images/<filename>')
def image_file(filename):
    """Serve image files from the images directory"""
    return send_from_directory(app.config['IMAGES_FOLDER'], filename)

@app.route('/save_annotation', methods=['POST'])
def save_annotation():
    """Save annotation data"""
    data = request.json
    
    if not data or 'subject_id' not in data:
        return jsonify({'error': 'Invalid data'}), 400
    
    subject_id = data.get('subject_id')
    unaffected_pixels = data.get('unaffected_pixels', [])
    affected_pixels = data.get('affected_pixels', [])
    
    if not unaffected_pixels or not affected_pixels:
        return jsonify({'error': 'Both unaffected and affected pixels must be provided'}), 400
    
    # Process the pixels
    try:
        # Convert the pixel data from RGB (from frontend) to BGR (for OpenCV processing)
        unaffected_bgr = [[pixel[2], pixel[1], pixel[0]] for pixel in unaffected_pixels]
        affected_bgr = [[pixel[2], pixel[1], pixel[0]] for pixel in affected_pixels]
        
        # Calculate average colors
        avg_unaffected_bgr = compute_average_color(unaffected_bgr)
        avg_affected_bgr = compute_average_color(affected_bgr)
        
        # Convert BGR to RGB
        rgb_unaffected = bgr_to_rgb(avg_unaffected_bgr)
        rgb_affected = bgr_to_rgb(avg_affected_bgr)
        
        # Convert RGB to HEX
        hex_unaffected = rgb_to_hex(rgb_unaffected)
        hex_affected = rgb_to_hex(rgb_affected)
        
        # Format RGB values as tuples in string format
        rgb_unaffected_str = f"({rgb_unaffected[0]},{rgb_unaffected[1]},{rgb_unaffected[2]})"
        rgb_affected_str = f"({rgb_affected[0]},{rgb_affected[1]},{rgb_affected[2]})"
        
        # Prepare result row
        result = [subject_id, rgb_unaffected_str, rgb_affected_str, hex_unaffected, hex_affected]
        
        # Check if CSV exists, if not create with header
        csv_exists = os.path.isfile(app.config['RESULTS_FILE'])
        
        # Append result to CSV
        with open(app.config['RESULTS_FILE'], 'a', newline='') as f:
            writer = csv.writer(f)
            if not csv_exists:
                writer.writerow(['subject_id', 'RGB_unaff', 'RGB_aff', 'HEX_unaff', 'HEX_aff'])
            writer.writerow(result)
        
        return jsonify({
            'success': True,
            'result': {
                'subject_id': subject_id,
                'unaffected': {
                    'rgb': rgb_unaffected_str,
                    'hex': hex_unaffected
                },
                'affected': {
                    'rgb': rgb_affected_str,
                    'hex': hex_affected
                }
            }
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/get_annotations')
def get_annotations():
    """Get all annotations from the CSV file"""
    if not os.path.isfile(app.config['RESULTS_FILE']):
        return jsonify([])
    
    annotations = []
    with open(app.config['RESULTS_FILE'], 'r', newline='') as f:
        reader = csv.DictReader(f)
        for row in reader:
            annotations.append(row)
    
    return jsonify(annotations)

@app.route('/download_csv')
def download_csv():
    """Download the annotations CSV file"""
    if not os.path.isfile(app.config['RESULTS_FILE']):
        # If file doesn't exist yet, create an empty one with headers
        with open(app.config['RESULTS_FILE'], 'w', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(['subject_id', 'RGB_unaff', 'RGB_aff', 'HEX_unaff', 'HEX_aff'])
    
    # Send the file to the user
    return send_file(app.config['RESULTS_FILE'],
                     mimetype='text/csv',
                     as_attachment=True,
                     download_name='skin_tone_annotations.csv')

@app.route('/reset_annotations', methods=['POST', 'GET'])
def reset_annotations():
    """Reset all annotations by creating a new CSV file with just headers"""
    print("Reset annotations endpoint called")
    try:
        # Create a new CSV file with just headers
        with open(app.config['RESULTS_FILE'], 'w', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(['subject_id', 'RGB_unaff', 'RGB_aff', 'HEX_unaff', 'HEX_aff'])
        
        print("Annotations reset successfully")
        
        # Check if this is an AJAX request or a form submission
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest' or request.content_type == 'application/json':
            return jsonify({'success': True, 'message': 'All annotations have been reset'})
        else:
            # For regular form submissions, redirect back to the index page
            flash('All annotations have been reset successfully', 'success')
            return redirect(url_for('index'))
    except Exception as e:
        print(f"Error resetting annotations: {str(e)}")
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest' or request.content_type == 'application/json':
            return jsonify({'success': False, 'message': f'Error: {str(e)}'}), 500
        else:
            flash(f'Error resetting annotations: {str(e)}', 'danger')
            return redirect(url_for('index'))

if __name__ == '__main__':
    # Make the server accessible from any device on the network
    # The host '0.0.0.0' makes it available on all network interfaces
    app.run(debug=True, host='0.0.0.0', port=5001)
