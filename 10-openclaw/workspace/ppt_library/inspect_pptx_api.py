from pptx import Presentation
prs=Presentation('/root/.openclaw/workspace/ppt_library/Original-2_Revised_Text_Only.pptx')
s=prs.slides[0]
print(type(s.part))
print([x for x in dir(s.part) if 'rel' in x.lower()][:50])
print(s.part.rels)
for rId,rel in s.part.rels.items():
 print(rId, rel.reltype, rel.target_ref, getattr(rel,'_target',None))
