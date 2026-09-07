"""Generate deterministic SHC 2.0 app and launch assets.

The source of truth is intentionally code plus the bundled Pretendard font, so
the wordmark can be regenerated without relying on an opaque AI image.
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "asset" / "brand"
FONT_BOLD = ROOT / "asset" / "fonts" / "Pretendard-Bold.otf"
FONT_SEMIBOLD = ROOT / "asset" / "fonts" / "Pretendard-SemiBold.otf"

BLUE = "#175CD3"
BLUE_DARK = "#0B3B8F"
INK = "#475467"
BACKGROUND = "#F5F7FB"
WHITE = "#FFFFFF"


def font(path: Path, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(path), size=size)


def centered_text(
    draw: ImageDraw.ImageDraw,
    center: tuple[float, float],
    text: str,
    selected_font: ImageFont.FreeTypeFont,
    fill: str,
) -> None:
    box = draw.textbbox((0, 0), text, font=selected_font)
    width = box[2] - box[0]
    height = box[3] - box[1]
    draw.text(
        (center[0] - width / 2 - box[0], center[1] - height / 2 - box[1]),
        text,
        font=selected_font,
        fill=fill,
    )


def make_app_icon() -> None:
    image = Image.new("RGB", (1024, 1024), BACKGROUND)
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle(
        (72, 72, 952, 952),
        radius=216,
        fill=WHITE,
        outline=BLUE,
        width=34,
    )
    centered_text(draw, (512, 505), "SHC", font(FONT_BOLD, 260), BLUE)
    draw.rounded_rectangle((350, 684, 674, 702), radius=9, fill=BLUE)
    image.save(OUTPUT / "app-icon-v2.png", optimize=True)


def make_adaptive_foreground() -> None:
    image = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    centered_text(draw, (512, 500), "SHC", font(FONT_BOLD, 230), BLUE)
    draw.rounded_rectangle((368, 642, 656, 658), radius=8, fill=BLUE)
    image.save(OUTPUT / "adaptive-foreground-v2.png", optimize=True)


def make_splash_wordmark() -> None:
    image = Image.new("RGBA", (1600, 800), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    mark_font = font(FONT_BOLD, 214)
    label_font = font(FONT_SEMIBOLD, 52)
    centered_text(draw, (600, 390), "SHC", mark_font, BLUE)
    draw.rounded_rectangle((844, 270, 854, 510), radius=5, fill="#C7D7F4")
    draw.text((906, 305), "SMART", font=label_font, fill=BLUE_DARK)
    draw.text((906, 402), "HOMECARE", font=label_font, fill=BLUE_DARK)
    image.save(OUTPUT / "splash-wordmark-v2.png", optimize=True)


def make_favicon() -> None:
    image = Image.new("RGB", (256, 256), BACKGROUND)
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle(
        (12, 12, 244, 244),
        radius=60,
        fill=WHITE,
        outline=BLUE,
        width=10,
    )
    centered_text(draw, (128, 126), "SHC", font(FONT_BOLD, 69), BLUE)
    image.save(OUTPUT / "favicon-v2.png", optimize=True)


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    make_app_icon()
    make_adaptive_foreground()
    make_splash_wordmark()
    make_favicon()


if __name__ == "__main__":
    main()
