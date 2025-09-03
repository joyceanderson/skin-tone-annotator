# Skin Tone Annotation Web App

This web application allows you to annotate skin tone images, marking affected and unaffected areas, and calculating average colors. It's a web-based version of the original Python script that uses OpenCV.

## Features

- Upload and view images for annotation
- Mark affected and unaffected skin areas with simple clicks
- Calculate average RGB and HEX color values for both areas
- Save annotations to a CSV file
- View history of all annotations
- Keyboard shortcuts for faster annotation
- Touch and Apple Pencil support for iPad

## Local Installation

1. Install the required dependencies:

```bash
pip install -r requirements.txt
```

2. Run the application locally:

```bash
python app.py
```

3. Open your web browser and navigate to `http://127.0.0.1:5000`

## How to Use

1. **Upload an image**: Click "Choose File" and select an image to annotate.

2. **Select annotation mode**:
   - Click "Unaffected" button or press `U` key to mark unaffected skin areas
   - Click "Affected" button or press `A` key to mark affected skin areas
   - Click "None" button or press `C` key to disable selection mode

3. **Mark areas**: Click on the image to mark points in the current selection mode.

4. **Save annotation**: Click "Save" button or press `S` key to save the annotation.

5. **Reset**: Click "Reset" button or press `R` key to clear all annotations for the current image.

## Keyboard Shortcuts

- `U`: Select unaffected skin mode
- `A`: Select affected skin mode
- `C`: Clear selection mode
- `R`: Reset all annotations for current image
- `S`: Save annotation

## Output

The annotations are saved to a CSV file named `annotations.csv` with the following columns:
- `subject_id`: ID of the subject (extracted from filename)
- `RGB_unaff`: RGB values of unaffected skin
- `RGB_aff`: RGB values of affected skin
- `HEX_unaff`: HEX color code of unaffected skin
- `HEX_aff`: HEX color code of affected skin
