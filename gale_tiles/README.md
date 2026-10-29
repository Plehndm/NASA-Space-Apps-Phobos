# **Gale Crater map tiles: how the notebook works and how to read its output** 

> **In this project (Oct 29):** this folder holds `gale_tiles.ipynb`, its output `out_tiles/` and the unzipped DTMs `dtm_src/`. `DTMs.zip` was set aside in `../_Trash_Review/`; to rerun cell 8, move it back into this folder or download it again (see below). The previews on disk are at zoom 11 (`imagery_preview_z11.png`, `topo_preview_z11.png`).

# **Reading the output** 

## **The folder** 

```
out_tiles/
  imagery/
    manifest.json
    7/66/225.png        <- zoom 7, row 66, column 225
    ...
    12/2142/7207.png
  topo/
    manifest.json
    7/66/225.png
    ...
    11/1071/3603.png
  dem/
    gale_dem_20m.tif    <- elevation in metres, for the data team, not for the web map
  imagery_preview_z9.png
  topo_preview_z9.png
dtm_src/                <- the unzipped DTMs, next to the notebook
```

## **What the three numbers in a path mean** 

```
out_tiles/<layer>/<zoom>/<row>/<col>.png
```

**layer:** Imagery or Topographic layer. 

**zoom:** how zoomed in. Each step up doubles the detail. Zoom 7 is Gale Crater in 3 x 3 tiles. 

- **row (latitude):** counts from the **north pole downwards** . Row 0 is at 90 degrees north. A bigger row is further south. (Gale is south of the equator, so its rows are in the middle of the range.) 

- **col (longitude):** counts from **-180 degrees longitude eastwards** . A bigger col is further east. 

Every tile is 256 x 256 pixels and spans `180 / 2^zoom` degrees both ways. 

## **Tile size at each zoom** 

|**Zoom**|**Tile width and height**|**Metres per pixel**|**Cols**|**Rows**|**Tiles for our box**|
|---|---|---|---|---|---|
|7|1.4062°, about 83 km|325.6|225-227|66-68|9|
|8|0.7031°, about 42 km|162.8|450-454|133-137|25|
|9|0.3516°, about 21 km|81.4|900-908|267-274|72|
|10|0.1758°, about 10.4 km|40.7|1801-1816|535-549|240|
|11|0.0879°, about 5.2 km|20.4|3603-3632|1071-1098|840|
|12|0.0439°, about 2.6 km|10.2|7207-7264|2142-2197|3,248|


Totals: imagery 4,434 tiles (zooms 7 to 12). Topo at most 1,186 (zooms 7 to 11; empty tiles are not written). Both together about 5,620. 


The topo layer stops at zoom 11 because its source DTMs are 20 m per pixel. Zoom 12 imagery is sharper than the topography (10 m per pixel against 20 m), so at zoom 12 the web map just enlarges the zoom 11 topo tiles. 

## **Which tile is where** 

Each tile's numbers for the same two places, at every zoom: 

|**Zoom**|**Gale centre (137.8 E, 5.4 S): row / col**|**Bradbury Landing (137.44 E, 4.59 S): row / col**|
|---|---|---|
|7|67 / 225|67 / 225|
|8|135 / 451|134 / 451|
|9|271 / 903|269 / 902|
|10|542 / 1807|538 / 1805|
|11|1085 / 3615|1076 / 3611|
|12|2170 / 7231|2152 / 7223|



**Coordinates to tile** ( `deg = 180 / 2**z` ): 

```
import math
def tile_for(lon, lat, z):
    deg = 180 / 2**z
    return math.floor((90 - lat) / deg), math.floor((lon + 180) / deg)   # row, col
def tile_bounds(z, row, col):
    deg = 180 / 2**z
    west, north = -180 + col * deg, 90 - row * deg
    return west, north - deg, west + deg, north        # lon_min, lat_min, lon_max, lat_max
```

**Tile to coordinates.** Tile `11/1085/3615` covers lon 137.7246 to 137.8125 and lat -5.4492 to -5.3613. A pixel `(x, y)` inside it (0 to 255, y counting down from the top) is at `lon = lon_min + x/256 * (lon_max - lon_min)` and `lat = lat_max - y/256 * (lat_max - lat_min)` . For example pixel (100, 50) is lon 137.7589, lat -5.3785. 

**Zooming.** Tile `z/row/col` is made of four tiles at `z+1` : rows `2*row` and `2*row+1` , columns `2*col` and `2*col+1` . Its parent at `z-1` is `row//2` , `col//2` . For example `10/542/1807` is made of `11/1084/3614` , `11/1084/3615` , `11/1085/3614` and `11/1085/3615` . 

## **Missing tiles and transparency** 

- A **missing file** is not an error. For imagery it means Trek has no data there (a 404, counted as `no_coverage` in the manifest). For topo it means the whole tile had no elevation data and was skipped. The web map should show nothing there. 

- Inside a **topo** tile, pixels with no elevation data are **transparent** . Topo tiles are grey plus transparency (PNG mode `LA` ), so lay them over the imagery with some opacity. There are no colours in them. 

- Brightness in a topo tile is light on the slope with the sun in the northwest (azimuth 315) at 45 degrees up, heights exaggerated 2x. It is not elevation. Use `out_tiles/dem/gale_dem_20m.tif` for numbers. 

## **The manifests** 

Each layer has `manifest.json` , which tells you what the folder holds: 

- **imagery:** `layer` , `product` , `source` , `retrieved` , `bbox_lonlat` , `ext` , `tile_size` , `scheme` , `tile_matrix_set` , `zoom_range` , `per_zoom` (column and row range per zoom), `summary` , `summary_by_zoom` (ok / cached / no_coverage / error counts per zoom), `attribution` . 


- **topo:** `layer` , `product` , `source` , `retrieved` , `bbox_lonlat` , `ext` , `image_mode` ("grey + alpha"), `tile_size` , `scheme` , 

- `zoom_range` , `per_zoom` , `tiles_written` , `sun_azimuth` , `sun_altitude` , `z_factor` , `elevation_range_m` , `note` , `attribution` . 

`per_zoom` is the quickest way to find which row and column numbers exist at each zoom. 

## **The other files** 

- `out_tiles/imagery_preview_z11.png` and `out_tiles/topo_preview_z11.png` are single stitched pictures of the whole box at zoom 11 (missing 

- tiles are blank). Look at these first. 

- `out_tiles/dem/gale_dem_20m.tif` is a float32 GeoTIFF in metres (no data = NaN) in the Mars longitude/latitude system, 7,680 x 7,168 

- pixels on the zoom 11 grid. Open it in QGIS or rasterio. It is for the data pipeline (slope, route cost), not for the web map. `gale_tiles.ipynb` builds two sets of map tiles for Gale Crater (NASA Space Apps 2026, "Interplanetary Survival Guide: Martian Map") 

|**Layer**|**Folder**|**What it is**|**Where it comes from**|**Zooms**|
|---|---|---|---|---|
|Surface<br>imagery|`out_tiles/imagery/`|MRO CTX grayscale photo<br>mosaic (base layer)|Downloaded from NASA Mars Trek,<br>product<br>`Gale_CTX_BlockAdj_dd`|7 to 12|
|Topography|`out_tiles/topo/`|Grey hillshade with a<br>transparent background, no<br>colours (the UI team adds<br>colour)|Built locally from the NHM Gale Crater<br>CTX stereo DTMs (<br>`DTMs.zip` , 20 m per<br>pixel)|7 to 11|



Both layers cover the same rectangle, `BBOX = (136.75, -6.57, 139.24, -4.15)` as (lon_min, lat_min, lon_max, lat_max) in degrees east and north. That is the area fully covered by the DTMs, clipped to the CTX mosaic. It contains Bradbury Landing and the early Curiosity traverse. It cuts off about 7% of the 154 km crater disc (west rim about 15 km, south about 8 km, north about 3 km). 

Both layers use the **same tile grid** , so tile `z/row/col` in `imagery` and in `topo` is the same patch of ground. 

# **Before you run it** 

- Run it on your own computer or in Colab. It needs internet access to `trek.nasa.gov` , which the workspace that wrote it could not reach. 

- Python packages: `numpy` , `Pillow` , `rasterio` (it brings `affine` ). Install with `pip install numpy pillow rasterio` . 

- Download `DTMs.zip` (about 355 MiB) from figshare (NHM Gale Crater DTMs, Grindrod & Davis, item 6584984) and put it next to the notebook. 

Run the cells from top to bottom. Cells are numbered from 0. 

- **What has and has not been tested:** the tile maths, the hillshade and the tiling/pyramid code (cells 3, 10, 11) were tested on synthetic data. Cells 4, 6, 8 and 9 (Trek access, reading the real DTMs, reprojecting them) have **not** been run, so expect to fix small things on the first real run. If Trek has no tiles at zoom 7 or 8, set `ZMIN = 9` . If the zoom 12 imagery is too big or slow, set `IMAGERY_ZMAX = 11` . 

**What each cell does** 

|**Cell**|**Type**|**What it does**|
|---|---|---|
|0|Markdown|Title, the two layers and the steps. Nothing runs.|
|1<br>2|Markdown<br>Code|Explains the Trek grid (see "Reading the output" below).<br>**Configuration, the only cell you normally edit.**Sets<br>`BASE`(Trek server),<br>`OUT`(output folder,<br>`out_tiles` ),<br>`BBOX` ,<br>`ZMIN`= 7,<br>`IMAGERY_ZMAX`= 12,<br>`TOPO_ZMAX`= 11,<br>`LAYERS`(the CTX product and its zoom range),<br>`TOPO`(zip name,<br>`dtm_src`folder, zoom range, valid elevation range -6000 to 2000 m, sun azimuth 315,<br>sun altitude 45, vertical exaggeration<br>`z_factor`2.0, whether to save the DEM), the Mars radius<br>3,396,190 m and the Mars map projection, and<br>`PREVIEW_Z`= 9.|
|3|Code|**Helper functions, plus a self-check.**<br>`fetch`downloads a URL with 3 retries and treats a 404 as "no<br>data".<br>`capabilities`reads a product's WMTS capabilities XML (file type, style, tile matrix set, bounding<br>box, zoom list).<br>`tile_range`turns a lon/lat box into the tile columns and rows covering it.<br>`tile_bounds`and<br>`tile_for`convert between tiles and coordinates. The self-check confirms the centre<br>of Gale falls inside the computed range at every zoom from 7 to 12 and prints<br>`tile math ok` .|
|4|Code|Asks Trek what the CTX product really offers and lowers<br>`zmax`if you asked for a zoom that does not<br>exist. Needs the internet.|
|5|Code|**Dry run.**Prints tiles per zoom for each layer, metres per pixel, and the memory the DTM mosaic needs.<br>Downloads nothing.|
|||**Downloads the CTX tiles.**<br>`download_layer`lists every<br>`(zoom, row, col)`in the box, fetches them 6 at a|
|6|Code|time into<br>`out_tiles/imagery/<z>/<row>/<col>.png` , skips tiles already on disk (so re-running resumes), counts<br>results as<br>`ok` ,<br>`cached` ,<br>`no_coverage`(404) or<br>`error_<code>` , and writes<br>`out_tiles/imagery/manifest.json` .|
|7|Markdown|Explains Part 2: Trek only serves display images, so the topographic layer is built from real elevation<br>data.|
|8|Code|**Unzips**<br>**`DTMs.zip` into**<br>**`dtm_src/`**(it refuses any path that would escape that folder) and opens each<br>DTM with rasterio, printing its size, projection, resolution and no-data value so you can check them.|
|9|Code|**Builds one elevation mosaic.**Reprojects all DTMs onto the zoom 11 tile grid in the Mars<br>longitude/latitude system, so every 256 x 256 block is exactly one tile. Where DTMs overlap, the first<br>file wins. Values outside the valid range are removed. It reports coverage and warns about holes, and<br>saves<br>`out_tiles/dem/gale_dem_20m.tif` .|
|||**Hillshade.**<br>`shade_block`computes light on the slope from the sun direction, using true metres per|
|10|Code|degree on Mars and the cosine of latitude per row.<br>`render_hillshade`runs it block by block and<br>produces the grey image plus an alpha (transparency) channel, transparent where there is no data.|
|11|Code|**Cuts and builds the topo tiles.**Cuts the hillshade into zoom 11 tiles, then makes each lower zoom by<br>shrinking its four child tiles 2x2 into one (LANCZOS). Fully empty tiles are skipped. Writes<br>`out_tiles/topo/manifest.json` .|
|12<br>13|Code<br>Markdown|**Preview.**Stitches both layers at<br>`PREVIEW_Z`= 11 into<br>`out_tiles/imagery_preview_z11.png`and<br>`out_tiles/topo_preview_z11.png`so you can check coverage, seams and alignment by eye.<br>Hand-off notes for the UI/UX team: layer list, a Leaflet example, things to check before shipping.|


# **For the UI/UX team** 

- **The grid is geographic, not web mercator.** Use Leaflet with `L.CRS.EPSG4326` . In Leaflet 1.9.4 the Leaflet zoom equals the folder zoom, so you do not need `zoomOffset` . This was checked in the Leaflet source but not run in a browser. MapLibre GL needs web mercator and will not line up. 

- The tile URL pattern is `tiles/{layer}/{z}/{y}/{x}.png` , where `{y}` is the row and `{x}` is the column. 

- Suggested: map bounds `[[-6.57, 136.75], [-4.15, 139.24]]` , start zoom 8, min zoom 7, max zoom 13. Imagery 

- `maxNativeZoom` 12. Topo `minNativeZoom` 7, `maxNativeZoom` 11, opacity about 0.6. 

- Leaflet's distance tools assume Earth's radius, so they are about 1.88 times too long for Mars. Use 3,396,190 m for the radius in any distance maths. 

- Credits to show on the map: Imagery "NASA/JPL-Caltech/MSSS". Topography "DTM: NASA/JPL-Caltech/MSSS/NHM" (CC BY 4.0). 

# **Changing things** 

- **Different area:** edit `BBOX` in cell 2. If you leave the DTM footprint, the topo has holes. 

- **More or fewer tiles:** change `ZMIN` , `IMAGERY_ZMAX` , `TOPO_ZMAX` in cell 2, then run cell 5 to see the counts first. Each extra zoom is about 4 times the tiles. 

- **Sun direction or exaggeration:** `azimuth` , `altitude` , `z_factor` in `TOPO` , then re-run cells 10 to 12. 

- **Retrying failed downloads:** run cell 6 again. Finished tiles are kept. 

- If Trek is slow or refuses connections, lower `workers=6` in cell 6. 

# **Known limits** 

- The DTMs were made one at a time and were not adjusted to each other, so you may see **seams** where two DTMs meet. Cell 12 shows them. 

The box clips the crater's west rim, south edge and a little of the north. The DTMs end there. 

- Topography is 20 m per pixel, so zoom 12 on the topo layer is an enlargement. 

- Trek is a shared public service. Check its terms of use and keep the credits above on the map. 

# **Sources** 

1. Grindrod, P. (2018): Gale Crater Stereo CTX DTMs + Orthoimages. Version 1. figshare. (Dataset). https://doi.org/10.6084/m9.figshare.6584984.v1 

2. NASA/JPL-Caltech; MRO CTX team at Malin Space Science Systems (n.d.): Gale Crater CTX block-adjusted mosaic (Gale_CTX_BlockAdj_dd). NASA Solar System Treks, Mars Trek. (Image mosaic, WMTS tile layer). https://trek.nasa.gov/tiles/Mars/EQ/Gale_CTX_BlockAdj_dd 
 

