from pathlib import Path
import json
import pypdfium2 as pdfium
from pypdf import PdfReader
from PIL import Image,ImageOps,ImageDraw,ImageChops
root=Path(__file__).resolve().parents[2]
p=root/'output/project_report/Aethor_OS_Project_Report.pdf'
out=Path(__file__).resolve().parent
reader=PdfReader(p)
doc=pdfium.PdfDocument(p)
pages=[]
for i,page in enumerate(doc):
    image=page.render(scale=1.4).to_pil().convert('RGB')
    image.save(out/f'page-{i+1:02d}.png')
    extrema=ImageChops.difference(image,ImageOps.grayscale(image).convert('RGB')).getbbox()
    text=reader.pages[i].extract_text()
    pages.append({'page':i+1,'characters':len(text),'color_pixels':bool(extrema),'start':text[:110].replace('\n',' '),'end':text[-120:].replace('\n',' ')})
for start in range(0,len(pages),6):
    sheet=Image.new('RGB',(3*420,2*620),'white')
    for j,i in enumerate(range(start,min(start+6,len(pages)))):
        im=Image.open(out/f'page-{i+1:02d}.png');im.thumbnail((405,580))
        x=(j%3)*420;y=(j//3)*620
        sheet.paste(im,(x,y+25));ImageDraw.Draw(sheet).text((x+12,y+5),f'PAGE {i+1}',fill='black')
    sheet.save(out/f'contact-{start+1:02d}.png')
(out/'page_audit.json').write_text(json.dumps(pages,indent=2),encoding='utf-8')
print(json.dumps({'pages':len(pages),'page_audit':pages},indent=2))
