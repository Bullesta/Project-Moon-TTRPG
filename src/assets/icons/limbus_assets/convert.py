from __future__ import annotations
import os
from PIL import Image


def convert_png_to_webp(root_dir: str | None = None, quality: int = 80) -> None:
    """Recursively convert all .png files under root_dir to .webp and remove originals.

    If root_dir is None, uses the directory containing this script.
    """
    if root_dir is None:
        root_dir = os.path.dirname(os.path.abspath(__file__))

    for dirpath, _, filenames in os.walk(root_dir):
        for fname in filenames:
            if not fname.lower().endswith(".png"):
                continue

            png_path = os.path.join(dirpath, fname)
            webp_path = os.path.splitext(png_path)[0] + ".webp"

            try:
                with Image.open(png_path) as im:
                    # Convert palette/LA images to RGBA first so transparency is preserved
                    if im.mode in ("P", "LA"):
                        im = im.convert("RGBA")
                    # For images without alpha, you can still save as RGB webp
                    save_kwargs = {"quality": quality}
                    if "A" in im.getbands():
                        save_kwargs.setdefault("lossless", False)

                    im.save(webp_path, "WEBP", **save_kwargs)

                # Remove original PNG after successful save
                os.remove(png_path)
                print(f"Converted: {png_path} -> {webp_path}")
            except Exception as e:
                print(f"Failed to convert {png_path}: {e}")


if __name__ == "__main__":
    import argparse

    p = argparse.ArgumentParser(description="Convert PNG -> WEBP recursively in this folder")
    p.add_argument("root", nargs="?", default=None, help="Root folder to scan (default: this script folder)")
    p.add_argument("-q", "--quality", type=int, default=80, help="WEBP quality (0-100)")
    args = p.parse_args()
    convert_png_to_webp(args.root, args.quality)
