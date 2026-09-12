from pathlib import Path
from PIL import Image, ImageDraw
out=Path('/root/.openclaw/workspace/ppt_library/test_images')
out.mkdir(exist_ok=True)
colors={
 'hero': ((20,25,35),(170,45,35)),
 'ui': ((245,245,245),(60,110,180)),
 'content_a': ((250,250,250),(200,60,60)),
 'content_b': ((235,240,245),(90,150,90)),
 'full': ((20,20,25),(130,60,170)),
}
for name,(left,right) in colors.items():
    im=Image.new('RGB',(1600,900),left)
    d=ImageDraw.Draw(im)
    # right-side visual blocks; no text
    for i in range(6):
        x0=850+i*70; y0=130+i*55
        d.rounded_rectangle([x0,y0,x0+430,y0+70], radius=18, fill=tuple(min(255,c+i*8) for c in right), outline=(255,255,255), width=3)
    if name=='ui':
        d.rounded_rectangle([760,120,1480,760], radius=25, outline=(35,35,35), width=8, fill=(255,255,255))
        for i in range(5):
            d.rounded_rectangle([820,190+i*95,1400,245+i*95], radius=12, fill=(80+i*20,120,185))
    if name=='full':
        for r in range(80,500,60):
            d.ellipse([800-r,450-r,800+r,450+r], outline=right, width=8)
    im.save(out/f'{name}.png')
print(out)
