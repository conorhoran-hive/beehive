"""Inline beehive.css and the logos into one self-contained HTML file.

Usage: python3 build_standalone.py <template.html> <output.html>

The result opens anywhere (chat previews, email attachments, a browser with no
access to the kit folder) and prints to A4 the same as the source template.
"""
import base64
import re
import sys
from pathlib import Path


def data_uri(path: Path) -> str:
    return "data:image/png;base64," + base64.b64encode(path.read_bytes()).decode()


def main(src: str, dst: str) -> None:
    src_path = Path(src).resolve()
    html = src_path.read_text(encoding="utf-8")

    def inline_css(match: re.Match) -> str:
        css_path = (src_path.parent / match.group(1)).resolve()
        css = css_path.read_text(encoding="utf-8")
        # Images referenced from the stylesheet resolve relative to it
        css = re.sub(
            r'url\("?((?!data:|https?:)[^")]+\.png)"?\)',
            lambda m: f'url("{data_uri((css_path.parent / m.group(1)).resolve())}")',
            css,
        )
        return f"<style>\n{css}\n</style>"

    html = re.sub(r'<link rel="stylesheet" href="([^"]+\.css)">', inline_css, html)
    html = re.sub(
        r'src="((?!data:|https?:)[^"]+\.png)"',
        lambda m: f'src="{data_uri((src_path.parent / m.group(1)).resolve())}"',
        html,
    )
    Path(dst).write_text(html, encoding="utf-8")
    print(f"wrote {dst}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
