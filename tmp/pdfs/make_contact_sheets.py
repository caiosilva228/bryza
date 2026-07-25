from pathlib import Path
from PIL import Image, ImageDraw

source = Path(r"C:\Users\lucas\Desktop\Bryza\tmp\pdfs\rendered")
pages = sorted(source.glob("page-*.png"))

for group_index in range(0, len(pages), 6):
    group = pages[group_index:group_index + 6]
    thumbs = []
    for path in group:
        image = Image.open(path).convert("RGB")
        image.thumbnail((480, 680))
        thumbs.append((path.name, image.copy()))

    sheet = Image.new("RGB", (1040, 2180), "#DDE6EA")
    draw = ImageDraw.Draw(sheet)
    for index, (name, image) in enumerate(thumbs):
        col = index % 2
        row = index // 2
        x = 30 + col * 510
        y = 35 + row * 710
        draw.rectangle((x - 5, y - 5, x + image.width + 5, y + image.height + 27), fill="white")
        sheet.paste(image, (x, y))
        draw.text((x, y + image.height + 8), name, fill="#24323B")

    output = source / f"contact-{group_index // 6 + 1}.png"
    sheet.save(output, quality=92)
    print(output)
