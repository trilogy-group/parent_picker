---
name: add-proposed-location
description: Add a proposed location from the Google Drive folder. Downloads brochure, extracts best photos, uploads to Supabase storage, creates DB records with photo carousel.
---

# /add-proposed-location — Add Proposed Location with Photos

## Purpose
Automates the full pipeline for adding a proposed Alpha School location:
1. Confirm the address via Google Geocoding
2. Insert into `pp_locations` (proposed=true, released=false)
3. Download brochure PDF from Google Drive
4. Extract images from the PDF
5. Visually review and select the 3-5 best photos
6. Optimize photos (1200px max, JPEG quality 85)
7. Upload photos + brochure to Supabase storage (`proposed-photos` bucket)
8. Insert `pp_location_photos` records and set `brochure_url`

## Usage
```
/add-proposed-location <Google Drive folder URL or folder name>
```

If no argument provided, check the master proposed locations folder:
`https://drive.google.com/drive/folders/1JmePyYxZf5aZ9cu-SZqzQGRMuEYo2YFB`

## Step-by-Step Process

### 1. Identify the location
- List the Google Drive folder contents using `mcp__google-workspace__list_drive_items` (user: andy.price@trilogy.com)
- The folder name format is "City, ST - Street Address"
- Find the brochure PDF (named `*Brochure*.pdf`) and note the file ID

### 2. Check if location already exists in DB
```sql
SELECT id, address, city, state, proposed, released
FROM pp_locations
WHERE address ILIKE '%<street>%' AND city ILIKE '<city>'
```
If it exists, skip insert. If it exists but isn't marked proposed, update it.

### 3. Geocode and upsert
- Use Google Geocoding API (key from `NEXT_PUBLIC_GOOGLE_MAPS_KEY` in `.env.local`):
  ```
  https://maps.googleapis.com/maps/api/geocode/json?address=<encoded>&key=<key>
  ```
- **Check for an existing row first.** `pp_sync_new_sites` cron mirrors all rebl sites into `pp_locations` with `proposed=false`. Creating a second row for the same site trips a gotcha in `pp_watch_loi_status` step 5, which joins on `proposed=false` and will cancel the parents status.
  ```sql
  SELECT id, proposed, released, rebl3_site_id
  FROM pp_locations
  WHERE address ILIKE '%<street>%' AND city ILIKE '<city>'
  ```
- **If a row exists**, UPDATE it rather than inserting:
  ```sql
  UPDATE pp_locations
  SET proposed = true, released = false, status = 'active', updated_at = NOW()
  WHERE id = '<existing_id>'
  RETURNING id
  ```
- **Only if no row exists**, insert a new one:
  ```sql
  INSERT INTO pp_locations (name, address, city, state, lat, lng, status, source, proposed, released)
  VALUES ('<address>', '<address>', '<city>', '<state>', <lat>, <lng>, 'active', 'internal', true, false)
  RETURNING id
  ```
- Save the `id` for later steps.

### 4. Download brochure PDF
- Use `mcp__google-workspace__get_drive_file_download_url` to download
- File saves to `~/.workspace-mcp/attachments/`

### 5. Extract images from PDF
```python
import fitz  # PyMuPDF
doc = fitz.open(pdf_path)
for page in doc:
    for img_info in page.get_images(full=True):
        base_image = doc.extract_image(img_info[0])
        # Skip images < 200px in either dimension
        # Skip images with aspect ratio > 5 (decorative strips)
        # Save remaining images
```

### 6. Review and select best photos
- Generate thumbnails (800px max) for visual review
- Use the Read tool to view each thumbnail
- **Pick 3-5 best images per location**, prioritizing:
  1. Building exterior shots (most important)
  2. Interior shots showing nice spaces
  3. Neighborhood/street-level context
  4. Aerial views
- **Skip**: floor plans, maps, logos, charts, text-heavy pages, abstract graphics, placeholder images ("PLACE IMAGE HERE"), satellite views that are too zoomed out

### 7. Optimize selected photos
```python
from PIL import Image
img = Image.open(src)
img.thumbnail((1200, 1200), Image.LANCZOS)
img.convert('RGB').save(out_path, 'JPEG', quality=85)
```

### 8. Upload to Supabase storage
- Bucket: `proposed-photos` (already exists, public)
- Storage path pattern: `<location_key>/<nn>.jpg` for photos, `<location_key>/brochure.pdf` for brochure
- Location key format: `<city_slug>_<street_slug>` (e.g., `austin_121_w_6th`)
- Upload via REST API:
  ```
  POST {SUPABASE_URL}/storage/v1/object/proposed-photos/{path}
  Authorization: Bearer {SERVICE_ROLE_KEY}
  Content-Type: image/jpeg  (or application/pdf for brochure)
  Body: raw file bytes
  ```
- Credentials: `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from `.env.local`

### 9. Insert DB records
```sql
-- Photos
INSERT INTO pp_location_photos (location_id, url, sort_order) VALUES
('<loc_id>', '<photo_url>', 0),
('<loc_id>', '<photo_url>', 1),
...;

-- Brochure URL
UPDATE pp_locations SET brochure_url = '<brochure_url>' WHERE id = '<loc_id>';
```

### 10. Verify
- Confirm the photos load: `curl -I <photo_url>` should return 200
- Check the brochure link works
- Remind the user: location is `released=false` — test in admin view, then set `released=true` when ready

## Replacing Photos for Existing Location
If the location already has photos and you need to replace them:
```sql
DELETE FROM pp_location_photos WHERE location_id = '<loc_id>';
```
Then re-upload and re-insert. Storage objects can be overwritten with the same path.

## Key Details
- **Supabase project URL**: `https://mnxgkozrutvylzeogphh.supabase.co`
- **Storage bucket**: `proposed-photos` (public)
- **DB tables**: `pp_locations`, `pp_location_photos`
- **Google Drive master folder**: `1JmePyYxZf5aZ9cu-SZqzQGRMuEYo2YFB`
- **Python deps**: PyMuPDF (`fitz`), Pillow (`PIL`)
