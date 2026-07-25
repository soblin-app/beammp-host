#!/usr/bin/env python3
"""Generate BeamMP Host app icons for Tauri.

Creates PNG icons at the sizes Tauri requires (32x32, 128x128, 128x128@2x)
plus a 512x512 master and converts to ICO/ICNS-compatible formats.
Uses Pillow.
"""
import os
from PIL import Image, ImageDraw, ImageFont

ICONS_DIR = "/home/z/my-project/src-tauri/icons"
os.makedirs(ICONS_DIR, exist_ok=True)

def make_icon(size: int) -> Image.Image:
    """Generate a BeamMP Host icon: dark rounded square with a stylized car silhouette."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    # Background: dark slate rounded square
    bg_color = (15, 23, 42)  # slate-900
    radius = size // 6
    draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=bg_color)
    # Accent stripe: emerald
    accent = (16, 185, 129)  # emerald-500
    stripe_h = max(2, size // 16)
    draw.rounded_rectangle(
        [size // 8, size - size // 4 - stripe_h, size - size // 8, size - size // 4],
        radius=stripe_h // 2,
        fill=accent,
    )
    # Stylized car body (simple rounded rectangle + windows)
    car_color = (226, 232, 240)  # slate-200
    body_y0 = size // 3
    body_y1 = int(size * 0.62)
    body_x0 = size // 6
    body_x1 = size - size // 6
    draw.rounded_rectangle([body_x0, body_y0, body_x1, body_y1], radius=size // 16, fill=car_color)
    # Windshield (smaller dark rectangle on top of car body)
    win_color = (15, 23, 42)
    win_y0 = body_y0 + size // 16
    win_y1 = body_y0 + (body_y1 - body_y0) // 2
    win_x0 = body_x0 + (body_x1 - body_x0) // 4
    win_x1 = body_x1 - (body_x1 - body_x0) // 4
    draw.rounded_rectangle([win_x0, win_y0, win_x1, win_y1], radius=size // 32, fill=win_color)
    # Wheels (two dark circles below the body)
    wheel_r = max(2, size // 14)
    wheel_y = body_y1 + wheel_r // 2
    wheel_xs = [body_x0 + (body_x1 - body_x0) // 4, body_x1 - (body_x1 - body_x0) // 4]
    for wx in wheel_xs:
        draw.ellipse([wx - wheel_r, wheel_y - wheel_r, wx + wheel_r, wheel_y + wheel_r], fill=win_color)
    return img

# Generate PNGs at all sizes Tauri expects.
sizes = {
    "32x32.png": 32,
    "128x128.png": 128,
    "128x128@2x.png": 256,
    "icon.png": 512,
}
for fname, size in sizes.items():
    img = make_icon(size)
    img.save(os.path.join(ICONS_DIR, fname), "PNG")
    print(f"Generated {fname} ({size}x{size})")

# Generate ICO (multi-size) for Windows.
ico_img = make_icon(256)
ico_img.save(os.path.join(ICONS_DIR, "icon.ico"), format="ICO", sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
print("Generated icon.ico")

# Generate ICNS for macOS (Tauri accepts .icns but Pillow can't write it directly;
# we'll write a PNG and let Tauri's bundler convert if needed).
# As a fallback, just copy the 512 PNG as .icns — Tauri's build will warn but proceed.
import shutil
shutil.copy(os.path.join(ICONS_DIR, "icon.png"), os.path.join(ICONS_DIR, "icon.icns"))
print("Generated icon.icns (placeholder, replace with real ICNS for macOS builds)")

print("\nAll icons generated in", ICONS_DIR)
