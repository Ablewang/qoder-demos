import argparse
import json
from pathlib import Path
from PIL import Image

parser = argparse.ArgumentParser()
parser.add_argument('--source', type=Path, required=True)
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
if not args.output.is_dir():
    parser.error('Output directory must already exist')

manifest = {}

def save(image, name, lossless=False):
    destination = args.output / f'{name}.webp'
    image.save(destination, 'WEBP', quality=90, lossless=lossless, method=6)
    manifest[name] = {'file': destination.name, 'width': image.width, 'height': image.height}


def key_out(image):
    image = image.convert('RGBA')
    pixels = image.load()
    for y in range(image.height):
        for x in range(image.width):
            r, g, b, _ = pixels[x, y]
            strength = min(r, b) - g
            alpha = round(255 * max(0, min(1, (140 - strength) / 85)))
            if strength > 55:
                spill = min(r, b) - g
                r = max(0, r - round(spill * (1 - alpha / 255)))
                b = max(0, b - round(spill * (1 - alpha / 255)))
            pixels[x, y] = r, g, b, alpha
    mask = image.getchannel('A').point(lambda value: 255 if value > 30 else 0)
    bounds = mask.getbbox()
    if bounds is None:
        raise ValueError('Empty sprite')
    left, top, right, bottom = bounds
    return image.crop((max(0, left - 3), max(0, top - 3), min(image.width, right + 3), min(image.height, bottom + 3)))


def sprites(filename, columns, names, row_boundary=None):
    source = Image.open(args.source / filename)
    rows = len(names) // columns
    cell_width = source.width // columns
    cell_height = source.height // rows
    for index, name in enumerate(names):
        column, row = index % columns, index // columns
        top, bottom = row * cell_height, (row + 1) * cell_height
        if row_boundary is not None:
            top, bottom = (0, row_boundary) if row == 0 else (row_boundary, source.height)
        crop = source.crop((column * cell_width, top, (column + 1) * cell_width, bottom))
        save(key_out(crop), name, True)


sprites('heroes.png', 4, ['ama', 'sor', 'nec', 'pal', 'bar', 'dru', 'ass', 'traveler'], 491)
sprites('world.png', 4, ['fallen', 'skeleton', 'zombie', 'quill', 'tree', 'ruin', 'cottage', 'chest'])
sprites('items.png', 6, ['sword', 'axe', 'mace', 'bow', 'staff', 'spear', 'helm', 'armor', 'shield', 'gloves', 'boots', 'belt', 'ring', 'amulet', 'health', 'mana', 'rejuvenation', 'scroll', 'book', 'rune', 'gem', 'cube', 'gold', 'arrows'])
materials = Image.open(args.source / 'materials.png').convert('RGB')
for index, name in enumerate(['earth', 'flagstone', 'basalt', 'sand', 'volcanic', 'snow', 'leather', 'carved-stone']):
    x, y = index % 4 * (materials.width // 4), index // 4 * (materials.height // 2)
    texture = materials.crop((x, y, x + materials.width // 4, y + materials.height // 2)).resize((384, 384), Image.Resampling.LANCZOS)
    if index < 6:
        mirrored = Image.new('RGB', (768, 768))
        mirrored.paste(texture, (0, 0))
        mirrored.paste(texture.transpose(Image.Transpose.FLIP_LEFT_RIGHT), (384, 0))
        mirrored.paste(texture.transpose(Image.Transpose.FLIP_TOP_BOTTOM), (0, 384))
        mirrored.paste(texture.transpose(Image.Transpose.ROTATE_180), (384, 384))
        texture = mirrored
    save(texture, name)
save(Image.open(args.source / 'gate.png').convert('RGB'), 'gate')
(args.output / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(f'Prepared {len(manifest)} original WebP game assets')
