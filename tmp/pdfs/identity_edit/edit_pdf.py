from pathlib import Path
from io import BytesIO
import re

import pdfplumber
import pypdfium2 as pdfium
from PIL import ImageChops
from pypdf import PdfReader, PdfWriter
from pypdf.generic import ContentStream, ByteStringObject, NameObject
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

root = Path(__file__).parent
source = Path(r'C:\Users\varad\AppData\Local\Packages\5319275A.51895FA4EA97F_cv1g1gvanyjgm\LocalState\sessions\C0717515594251B65C0ACCF91AE380CD654EDEB9\transfers\2026-42\24BIT0476.pdf')
output = Path(r'F:\os\AetherOS-Complete-Project\aetheros\output\pdf\24BIT0175.pdf')
output.parent.mkdir(parents=True, exist_ok=True)
reader = PdfReader(source)
writer = PdfWriter()
writer.clone_document_from_reader(reader)
page = writer.pages[0]
content = ContentStream(page.get_contents(), writer)

# Original font uses character codes offset by 29, individually positioned.
name_indices = list(range(29, 52, 2))
id_indices = list(range(211, 228, 2))
for indices, expected in [(name_indices, 'M.SHAMYUKTHA'), (id_indices, '24BIT0476')]:
    decoded = ''.join(chr(ord(str(content.operations[i][0][0])) + 29) for i in indices)
    assert decoded == expected, (decoded, expected)
    for i in indices:
        content.operations[i][0][0] = ByteStringObject(b'')
page[NameObject('/Contents')] = content

pdfmetrics.registerFont(TTFont('OriginalArialBold', r'C:\Windows\Fonts\arialbd.ttf'))
with pdfplumber.open(source) as doc:
    chars = doc.pages[0].chars
    name_char = chars[5]
    id_char = next(c for c in chars if c['text'] == '2' and abs(c['x0'] - 186.19959675) < .01)
    overlay_buffer = BytesIO()
    c = canvas.Canvas(overlay_buffer, pagesize=(float(page.mediabox.width), float(page.mediabox.height)))
    c.setFont('OriginalArialBold', 11)
    c.drawString(name_char['x0'], name_char['matrix'][5], 'VARAD PATIL')
    c.drawString(id_char['x0'], id_char['matrix'][5], '24BIT0175')
    c.save()
page.merge_page(PdfReader(overlay_buffer).pages[0])
writer.add_metadata({'/Title': '24BIT0175'})
with output.open('wb') as stream:
    writer.write(stream)

final = PdfReader(output)
assert len(final.pages) == len(reader.pages) == 8
text = '\n'.join(p.extract_text() for p in final.pages)
assert 'VARAD PATIL' in text and '24BIT0175' in text
assert not re.search(r'shamyuktha|24BIT0476', text + str(final.metadata), re.I)

original_doc = pdfium.PdfDocument(str(source))
final_doc = pdfium.PdfDocument(str(output))
for i, (old_page, new_page) in enumerate(zip(original_doc, final_doc)):
    old = old_page.render(scale=2).to_pil().convert('RGB')
    new = new_page.render(scale=2).to_pil().convert('RGB')
    assert old.size == new.size
    diff = ImageChops.difference(old, new)
    if i:
        assert diff.getbbox() is None, f'Unexpected change on page {i+1}'
    else:
        # The only pixels allowed to change are inside the two identity fields.
        diff.paste((0, 0, 0), (214, 144, 400, 172))
        diff.paste((0, 0, 0), (370, 174, 484, 202))
        assert diff.getbbox() is None, f'Unexpected page-one change: {diff.getbbox()}'
        new.save(root/'edited-page-1.png')
        new.crop((120, 120, 700, 220)).resize((1160, 200)).save(root/'edited-header.png')
print('Verified: new name and number, updated PDF title, 8 pages, all other page pixels unchanged.')
print(output)
