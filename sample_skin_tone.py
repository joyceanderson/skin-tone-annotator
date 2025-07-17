import cv2
import numpy as np
import os
import csv
import re

# Paths
image_dir = '/Users/joyceanderson/Desktop/face_nose'  # <- UPDATE THIS
output_csv = 'new_vitiligo_skin_tones.csv'

# Store points
unaffected_colors = []
affected_colors = []

# Track processed subjects
class ProcessedSubjects:
    def __init__(self):
        self.subject_ids = set()

# Initialize processed subjects tracker
processed_subjects = ProcessedSubjects()

# Current selection mode
selection_mode = None  # Can be 'unaffected', 'affected', or None

# Results per image
results = []

def compute_average_color(pixels):
    # Calculate average BGR color
    pixels_array = np.array(pixels)
    avg_color = np.mean(pixels_array, axis=0)
    return avg_color

def bgr_to_rgb(bgr):
    # Convert BGR to RGB
    return (int(bgr[2]), int(bgr[1]), int(bgr[0]))

def rgb_to_hex(rgb):
    # Convert RGB to HEX
    return f"#{rgb[0]:02x}{rgb[1]:02x}{rgb[2]:02x}"

def mouse_move(event, x, y, flags, param):
    global unaffected_colors, affected_colors, img_copy, selection_mode
    
    # Only process clicks when in a selection mode
    if event == cv2.EVENT_LBUTTONDOWN:
        if selection_mode == 'unaffected':
            unaffected_colors.append(img[y, x].tolist())
            cv2.circle(img_copy, (x, y), 1, (0, 255, 0), -1)  # Green = unaffected, smaller circle
            print(f"  Added unaffected sample at ({x}, {y})")
        elif selection_mode == 'affected':
            affected_colors.append(img[y, x].tolist())
            cv2.circle(img_copy, (x, y), 1, (0, 0, 255), -1)  # Red = affected, smaller circle
            print(f"  Added affected sample at ({x}, {y})")

# Iterate over images
for filename in os.listdir(image_dir):
    if not filename.lower().endswith(('.jpg', '.png')):
        continue
        
    # Extract subject_id from filename (everything before first underscore)
    # For example: ID000_1_face_nose.png -> ID000
    subject_id = filename.split('_')[0]
    
    # Skip if we've already processed an image for this subject
    if subject_id in processed_subjects.subject_ids:
        print(f"Skipping {filename} - already processed subject {subject_id}")
        continue
        
    # Add this subject to the processed set
    processed_subjects.subject_ids.add(subject_id)
    print(f"Processing subject: {subject_id}")
    
    image_path = os.path.join(image_dir, filename)
    img = cv2.imread(image_path)
    if img is None:
        print(f"Error loading {filename}")
        continue

    unaffected_colors = []
    affected_colors = []
    img_copy = img.copy()

    cv2.namedWindow("Sample Skin Tones")
    cv2.setMouseCallback("Sample Skin Tones", mouse_move)

    print(f"\nSampling {filename} (ID: {subject_id})")
    print("  Press 'u' to select unaffected skin areas (will turn green)")
    print("  Press 'a' to select affected skin areas (will turn red)")
    print("  Press 'c' to clear current selection mode")
    print("  Press 'r' to reset all selections for this image")
    print("  Press 's' to save and continue to next image")
    print("  Press 'q' to quit")

    while True:
        # Create a status bar to show current mode
        status_img = img_copy.copy()
        if selection_mode == 'unaffected':
            cv2.putText(status_img, "Mode: UNAFFECTED", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
        elif selection_mode == 'affected':
            cv2.putText(status_img, "Mode: AFFECTED", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
        else:
            cv2.putText(status_img, "Mode: NONE (press u or a)", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
            
        cv2.imshow("Sample Skin Tones", status_img)
        key = cv2.waitKey(1) & 0xFF
        
        # Handle key presses
        if key == ord('u'):
            selection_mode = 'unaffected'
            print("Mode: UNAFFECTED - Click to select unaffected skin areas")
        elif key == ord('a'):
            selection_mode = 'affected'
            print("Mode: AFFECTED - Click to select affected skin areas")
        elif key == ord('c'):
            selection_mode = None
            print("Mode: NONE - No selection active")
        elif key == ord('r'):
            # Reset all selections for this image
            unaffected_colors = []
            affected_colors = []
            img_copy = img.copy()  # Reset the image
            print("All selections reset for this image")
        elif key == ord('s'):
            if unaffected_colors and affected_colors:
                # Calculate average colors
                avg_unaffected_bgr = compute_average_color(unaffected_colors)
                avg_affected_bgr = compute_average_color(affected_colors)
                
                # Convert BGR to RGB
                rgb_unaffected = bgr_to_rgb(avg_unaffected_bgr)
                rgb_affected = bgr_to_rgb(avg_affected_bgr)
                
                # Convert RGB to HEX for unaffected
                hex_unaffected = rgb_to_hex(rgb_unaffected)
                
                # Format RGB values as tuples in string format
                rgb_unaffected_str = f"({rgb_unaffected[0]},{rgb_unaffected[1]},{rgb_unaffected[2]})"
                rgb_affected_str = f"({rgb_affected[0]},{rgb_affected[1]},{rgb_affected[2]})"
                
                # Generate hex code for affected skin too
                hex_affected = rgb_to_hex(rgb_affected)
                
                # Store results with the new format
                results.append([subject_id, rgb_unaffected_str, rgb_affected_str, hex_unaffected, hex_affected])
                
                print(f"Saved: {subject_id}")
                print(f"  Unaffected: RGB={rgb_unaffected_str}, HEX={hex_unaffected}")
                print(f"  Affected: RGB={rgb_affected_str}, HEX={hex_affected}")
            else:
                print("Please sample both unaffected and affected pixels first.")
            break
        elif key == ord('q'):
            print("Quitting.")
            break

    cv2.destroyAllWindows()

# Save results to CSV
with open(output_csv, 'w', newline='') as f:
    writer = csv.writer(f)
    writer.writerow(['subject_id', 'RGB_unaff', 'RGB_aff', 'HEX_unaff', 'HEX_aff'])
    writer.writerows(results)

print(f"\nAll done. Results saved to {output_csv}")
