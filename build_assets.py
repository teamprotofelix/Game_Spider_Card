from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance, ImageOps
from pathlib import Path
import math, random
ROOT=Path(__file__).parent
AS=ROOT/'assets'; CARD=AS/'cards'
SRC1=Image.open('/mnt/data/a_wide_high_detail_fantasy_themed_card_game_inter.png').convert('RGB')
SRC2=Image.open('/mnt/data/a_wide_high_detail_promotional_gameplay_collage_o.png').convert('RGB')
fontserif='/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf'
fontbold='/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf'
symbolfont='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
def font(sz, path=fontbold):return ImageFont.truetype(path,sz)
def fitted(crop,wh):
 im=ImageOps.fit(crop,wh,method=Image.Resampling.LANCZOS,centering=(.5,.45));return im
# Background painting: generated image of citadel architecture, intentionally defocused to keep game board clear.
crop=SRC2.crop((385,290,1050,654));bg=fitted(crop,(1920,1080));bg=bg.filter(ImageFilter.GaussianBlur(9));
over=Image.new('RGB',bg.size,(3,9,18));bg=Image.blend(bg,over,.58)
# subtle intense moonlight & atmosphere
bg.save(AS/'arena.webp','WEBP',quality=81,method=6)
# Promotional art retains the originally generated compositions
SRC1.resize((1152,768),Image.Resampling.LANCZOS).save(AS/'cover.webp','WEBP',quality=78,method=6)
# boss portrait styles; source regions from generated compositions
portraits={
 'queen':(SRC1,(1070,0,1340,230)),
 'dragon':(SRC2,(1185,84,1525,430)),
 'hero':(SRC2,(20,295,275,667)),
 'reaper':(SRC1,(24,302,138,498))
}
for nm,(src,area) in portraits.items():
 im=fitted(src.crop(area),(480,480));vign=Image.new('RGBA',im.size,(0,0,0,0));d=ImageDraw.Draw(vign)
 for i in range(100):
  a=int(2.2*(100-i));d.rounded_rectangle((i//2,i//2,479-i//2,479-i//2),radius=32,outline=(4,8,19,max(0,min(255,a))),width=3)
 im.save(AS/f'{nm}.webp','WEBP',quality=87,method=6)
# card illustrations portraits from image generator (faces adapt coloring per suit)
face_art={
 'J': fitted(SRC1.crop((518,312,628,491)),(265,330)),
 'Q': fitted(SRC1.crop((263,307,387,494)),(265,330)),
 'K': fitted(SRC1.crop((28,312,134,486)),(265,330)),
}
sym={'S':'♠','H':'♥','D':'♦','C':'♣'};suit_rgb={'S':(22,36,51),'H':(158,30,44),'D':(168,48,38),'C':(27,91,79)}
# deck cards: hi res, native local 320x448 webp
W,H=320,448
# pip positions in normalized center-board 70..380
grid={
 2:[(160,140),(160,314)],3:[(160,132),(160,224),(160,319)],
 4:[(103,141),(219,141),(103,302),(219,302)],
 5:[(103,141),(219,141),(161,224),(103,302),(219,302)],
 6:[(103,135),(219,135),(103,225),(219,225),(103,311),(219,311)],
 7:[(103,135),(219,135),(160,180),(103,225),(219,225),(103,311),(219,311)],
 8:[(103,135),(219,135),(160,176),(103,225),(219,225),(160,277),(103,317),(219,317)],
 9:[(103,121),(219,121),(103,190),(219,190),(160,224),(103,259),(219,259),(103,326),(219,326)],
 10:[(103,117),(219,117),(160,152),(103,193),(219,193),(103,265),(219,265),(160,295),(103,331),(219,331)]
}
# subtle parchment texture pre-computed
random.seed(305)
noise=Image.new('RGBA',(W,H),(0,0,0,0));nd=ImageDraw.Draw(noise)
for _ in range(1900):
 x=random.randrange(W);y=random.randrange(H); c=random.choice([(130,106,75,8),(250,227,165,12),(98,83,64,5)])
 nd.point((x,y),fill=c)
for suit in 'SHDC':
 for rank in range(1,14):
  im=Image.new('RGBA',(W,H),(249,243,225,255));d=ImageDraw.Draw(im)
  # frame shadows & engraved gold rails
  d.rounded_rectangle((3,3,W-4,H-4),radius=24,fill=(248,241,220),outline=(41,44,55),width=5)
  d.rounded_rectangle((9,9,W-10,H-10),radius=17,outline=(166,127,60),width=3)
  d.rounded_rectangle((14,14,W-15,H-15),radius=13,outline=(227,196,139),width=2)
  im=Image.alpha_composite(im,noise)
  d=ImageDraw.Draw(im)
  color=suit_rgb[suit]; suit_char=sym[suit]; label={1:'A',11:'J',12:'Q',13:'K'}.get(rank,str(rank))
  d.text((23,15),label,font=font(51),fill=color,stroke_width=0)
  d.text((25,72),suit_char,font=font(37,symbolfont),fill=color)
  # reflected bottom corner
  small=Image.new('RGBA',(84,95),(0,0,0,0));sd=ImageDraw.Draw(small)
  sd.text((4,0),label,font=font(46),fill=color)
  sd.text((5,54),suit_char,font=font(34,symbolfont),fill=color)
  rot=small.rotate(180,expand=False)
  im.alpha_composite(rot,(W-99,H-114))
  d=ImageDraw.Draw(im)
  if rank in [11,12,13]:
   art=face_art[label].convert('RGBA')
   # fade portrait edges, paint rich internal illustration
   mask=Image.new('L',art.size,0);md=ImageDraw.Draw(mask);md.rounded_rectangle((0,0,264,329),radius=23,fill=242)
   mask=mask.filter(ImageFilter.GaussianBlur(4))
   im.paste(art,(48,97),mask)
   d=ImageDraw.Draw(im)
   d.rounded_rectangle((55,106,260,374),radius=6,outline=(179,123,56),width=3)
   d.text((143,345),suit_char,font=font(48,symbolfont),fill=color,stroke_width=1,stroke_fill=(249,239,204))
  elif rank==1:
   d.ellipse((79,136,249,318),outline=(191,155,99),width=3)
   d.ellipse((90,147,238,307),outline=(223,198,145),width=2)
   d.text((99,141),suit_char,font=font(122,symbolfont),fill=color)
  else:
   for x,y in grid[rank]:
    d.text((x-24,y-24),suit_char,font=font(44,symbolfont),fill=color)
  im.convert('RGB').save(CARD/f'{suit}-{rank}.webp','WEBP',quality=87,method=6)
# Back of card with ornate interlaced spiderweb geometry
b=Image.new('RGBA',(W,H),(5,19,31,255));d=ImageDraw.Draw(b)
d.rounded_rectangle((4,4,W-5,H-5),radius=21,outline=(30,34,42),width=6)
d.rounded_rectangle((11,11,W-12,H-12),radius=17,outline=(213,149,66),width=5)
d.rounded_rectangle((19,19,W-20,H-20),radius=14,outline=(75,119,145),width=2)
for gap in range(0,400,30):
 d.line((W//2,38,W//2+int(math.sin(gap/100)*6),H-39),fill=(21,57,74,120),width=1)
# radial golden web
cx,cy=160,226
for i in range(16):
 a=i*math.tau/16
 d.line((cx,cy,cx+158*math.cos(a),cy+190*math.sin(a)),fill=(110,84,64,210),width=2)
for rr in [42,72,105,142,176]:
 pp=[]
 for i in range(16):
  a=i*math.tau/16
  pp.append((cx+rr*.77*math.cos(a),cy+rr*math.sin(a)))
 d.line(pp+[pp[0]],fill=(153,122,83,185),width=2)
d.ellipse((96,164,224,288),fill=(4,12,22),outline=(205,139,70),width=5)
d.text((112,173),'♠',font=font(87,symbolfont),fill=(206,61,50))
d.text((97,303),'SPIDER',font=font(22),fill=(213,174,110))
b.convert('RGB').save(AS/'card-back.webp','WEBP',quality=90,method=6)
# small skill icon, just original illustrated artwork crop (local compressed)
fitted(SRC2.crop((1374,557,1473,656)),(240,240)).save(AS/'skill.webp','WEBP',quality=81,method=6)
print('generated',len(list(CARD.glob('*.webp'))),'cards; assets MB',round(sum(f.stat().st_size for f in AS.rglob('*.webp'))/1e6,2))
