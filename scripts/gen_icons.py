#!/usr/bin/env python3
"""Generate PWA icons for 象棋 app."""
import os
from PIL import Image, ImageDraw, ImageFont

OUT_DIR = os.path.join(os.path.dirname(__file__), "icons")
os.makedirs(OUT_DIR, exist_ok=True)


def draw_icon(size: int):
    """Draw a Xiangqi-themed icon: wooden board + a prominent red piece."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # Rounded background (app icon style)
    bg_margin = size * 0.06
    d.rounded_rectangle(
        [bg_margin, bg_margin, size - bg_margin, size - bg_margin],
        radius=size * 0.18,
        fill=(232, 200, 138, 255),  # board tan
        outline=(169, 119, 58, 255),  # board edge brown
        width=max(2, int(size * 0.02)),
    )

    # Grid: 9 cols x 10 rows logic → draw simplified cross pattern
    pad = size * 0.18
    bottom_grid = size - size * 0.12
    top_grid = size * 0.12
    left = pad
    right = size - pad

    # Horizontal lines (full width, 9 lines)
    for i in range(9):
        y = top_grid + (bottom_grid - top_grid) * i / 8
        d.line(
            [(left, y), (right, y)],
            fill=(145, 98, 51, 220),
            width=max(1, int(size * 0.01)),
        )

    # Vertical lines: full on edges, broken in middle (river) for inner ones
    for j in range(9):
        x = left + (right - left) * j / 8
        if j == 0 or j == 8:
            d.line(
                [(x, top_grid), (x, bottom_grid)],
                fill=(145, 98, 51, 220),
                width=max(1, int(size * 0.01)),
            )
        else:
            mid = (top_grid + bottom_grid) / 2
            d.line(
                [(x, top_grid), (x, mid - (bottom_grid - top_grid) * 0.06)],
                fill=(145, 98, 51, 220),
                width=max(1, int(size * 0.01)),
            )
            d.line(
                [(x, mid + (bottom_grid - top_grid) * 0.06), (x, bottom_grid)],
                fill=(145, 98, 51, 220),
                width=max(1, int(size * 0.01)),
            )

    # Palace diagonals (top half)
    palace_w = (right - left) * 2 / 8
    palace_x1 = left + (right - left) * 3 / 8
    palace_x2 = palace_x1 + palace_w
    palace_y1 = top_grid
    palace_y2 = top_grid + (bottom_grid - top_grid) * 4 / 8
    d.line([(palace_x1, palace_y1), (palace_x2, palace_y2)], fill=(145, 98, 51, 220), width=max(1, int(size * 0.01)))
    d.line([(palace_x2, palace_y1), (palace_x1, palace_y2)], fill=(145, 98, 51, 220), width=max(1, int(size * 0.01)))

    # Palace diagonals (bottom half, mirrored)
    palace_y1b = bottom_grid - (bottom_grid - top_grid) * 4 / 8
    palace_y2b = bottom_grid
    d.line([(palace_x1, palace_y1b), (palace_x2, palace_y2b)], fill=(145, 98, 51, 220), width=max(1, int(size * 0.01)))
    d.line([(palace_x2, palace_y1b), (palace_x1, palace_y2b)], fill=(145, 98, 51, 220), width=max(1, int(size * 0.01)))

    # River text "楚河 汉界"
    try:
        # Try to find a Chinese-capable font
        font_candidates = [
            "C:/Windows/Fonts/simsun.ttc",
            "C:/Windows/Fonts/simhei.ttf",
            "C:/Windows/Fonts/msyh.ttc",
            "/System/Library/Fonts/PingFang.ttc",
            "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
        ]
        font_path = None
        for fp in font_candidates:
            if os.path.exists(fp):
                font_path = fp
                break

        if font_path:
            font = ImageFont.truetype(font_path, int(size * 0.075))
        else:
            font = ImageFont.load_default()

        mid_y = (top_grid + bottom_grid) / 2
        cx = (left + right) / 2
        d.text((cx - (right - left) * 0.2, mid_y - int(size * 0.05)), "楚河", fill=(90, 55, 20, 180), font=font)
        d.text((cx + (right - left) * 0.05, mid_y - int(size * 0.05)), "汉界", fill=(90, 55, 20, 180), font=font)
    except Exception:
        pass

    # Central red piece (大将军)
    piece_r = size * 0.14
    piece_x = (left + right) / 2
    piece_y = bottom_grid - (bottom_grid - top_grid) * 0.12

    # Piece shadow
    d.ellipse(
        [piece_x - piece_r + size * 0.01, piece_y - piece_r + size * 0.02,
         piece_x + piece_r + size * 0.01, piece_y + piece_r + size * 0.02],
        fill=(0, 0, 0, 60),
    )
    # Piece face
    d.ellipse(
        [piece_x - piece_r, piece_y - piece_r, piece_x + piece_r, piece_y + piece_r],
        fill=(248, 237, 210, 255),  # pieceFace
        outline=(166, 43, 35, 255),  # red border
        width=max(2, int(size * 0.018)),
    )
    # Inner ring
    inner = piece_r - size * 0.025
    d.ellipse(
        [piece_x - inner, piece_y - inner, piece_x + inner, piece_y + inner],
        outline=(166, 43, 35, 255),
        width=max(1, int(size * 0.009)),
    )

    # Piece character "帅"
    try:
        if font_path:
            char_font = ImageFont.truetype(font_path, int(size * 0.15))
        else:
            char_font = ImageFont.load_default()
        # Center the character
        bbox = d.textbbox((0, 0), "帅", font=char_font)
        tw = bbox[2] - bbox[0]
        th = bbox[3] - bbox[1]
        d.text((piece_x - tw / 2 - bbox[0], piece_y - th / 2 - bbox[1]),
               "帅", fill=(166, 43, 35, 255), font=char_font)
    except Exception:
        pass

    return img


for s in (192, 512):
    icon = draw_icon(s)
    path = os.path.join(OUT_DIR, f"icon-{s}.png")
    icon.save(path, "PNG")
    print(f"Saved {path}")
