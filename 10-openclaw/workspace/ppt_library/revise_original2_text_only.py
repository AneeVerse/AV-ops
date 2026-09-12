from pathlib import Path
from pptx import Presentation

src=Path('/root/.openclaw/media/inbound/Original-2_ppt---94da7217-2fcd-4e27-9bb6-13b47ebff08f.pptx')
out=Path('/root/.openclaw/workspace/ppt_library/Original-2_Revised_Text_Only.pptx')
prs=Presentation(str(src))

# slide_no -> shape_index -> paragraphs/lines. Only text is changed; no shapes/elements/fonts/colors moved.
updates={
    2:{
        5:['Where Truckstop Is Going'],
    },
    3:{
        4:['Truckstop by the Numbers'],
    },
    4:{
        6:['Carriers: How They Book Loads'],
    },
    6:{
        6:['Everything lives in one place','Reduce tool switching with one connected sidebar','See loads, carriers, and status without switching screens'],
    },
    8:{
        5:['Why Carrier Networks Matter'],
        4:[
            'Strong carrier networks help brokers cover freight faster, reduce manual calls, and build more reliable capacity over time.',
            '',
            'The goal is not just to onboard more carriers; it is to activate the right carriers when the right load appears.',
            '',
            'A connected network gives teams better visibility into who is available, who is trusted, and who is most likely to perform.',
            '',
            'Use this slide for a text-heavy insight, market explanation, or strategic point that needs more detail.'
        ]
    },
    9:{
        4:['Live Dashboard Visibility'],
        7:[
            'A live operations dashboard helps teams see load status, carrier activity, and next actions in one place.',
            '',
            'This type of layout works well for product screenshots, platform walkthroughs, workflow previews, or before-and-after process explanations.',
            '',
            'Use short supporting text beside the visual so the audience understands what they are looking at without needing a long explanation.'
        ]
    },
    10:{
        3:['Simplify Freight Operations'],
        5:[
            'Freight teams lose time when sourcing, compliance, booking, and payment are handled across separate tools.',
            '',
            'A connected workflow reduces manual re-entry, improves visibility, and helps teams act faster during high-pressure coverage moments.'
        ],
        6:[
            'Use this slide when you need a clear main point with supporting context.',
            '',
            'It can work as a paragraph slide, a short bullet slide, or a combination of both depending on the message.'
        ]
    },
    11:{
        2:['Compliance Built Into Workflow'],
        5:[
            'Compliance works best when it is part of the daily booking process, not a separate step that slows the team down.',
            '',
            'With risk signals, onboarding status, and verification data available during carrier selection, brokers can protect loads while keeping freight moving.',
            '',
            'Use this layout for one focused explanation supported by a visual, icon, or screenshot.'
        ]
    },
    12:{
        4:['Faster Load Coverage'],
        5:[
            'Better coverage starts with knowing which carriers are available, trusted, and suitable for the load.',
            '',
            'Teams can move faster when carrier history, market data, and operational context are available in the same workflow.',
            '',
            'This layout is useful for explaining a product benefit, workflow improvement, or customer outcome with supporting detail.'
        ]
    },
    13:{
        2:['Operational Control'],
        4:[
            'Operational control improves when every team member works from the same source of truth.',
            '',
            'Instead of chasing updates across systems, teams can see load status, carrier information, compliance signals, and next steps in one clear operating view.',
            '',
            'Use this slide for concise business context, executive summaries, or any message that needs space for a longer paragraph.'
        ]
    },
    # Slides 14 and 15 already make sense, so left unchanged.
    16:{
        2:['Smarter Broker Workflows'],
        5:[
            'Broker teams need workflows that support speed without creating unnecessary risk.',
            '',
            'By connecting load posting, carrier selection, compliance checks, and booking activity, teams can reduce repetitive work and make better decisions faster.',
            '',
            'Use this slide for process explanations, workflow improvements, or feature-benefit messaging.'
        ]
    },
    17:{
        4:['Connected Freight Operations'],
        6:[
            'Connected operations give teams a clearer view of what is happening across freight activity.',
            '',
            'When load data, carrier data, risk information, and workflow actions are connected, teams can reduce handoffs and keep execution moving.',
            '',
            'This layout works well for platform messaging, operational benefits, or a focused explanation with supporting sidebar context.'
        ]
    },
}

def set_text_preserve(shape, lines):
    tf=shape.text_frame
    # Use existing paragraph/run formatting where possible.
    existing=list(tf.paragraphs)
    for i,line in enumerate(lines):
        if i < len(existing):
            p=existing[i]
        else:
            p=tf.add_paragraph()
        if p.runs:
            p.runs[0].text=line
            for r in p.runs[1:]:
                r.text=''
        else:
            p.text=line
    # Clear extra paragraphs without removing them (keeps layout structure stable).
    for p in existing[len(lines):]:
        if p.runs:
            for r in p.runs:
                r.text=''
        else:
            p.text=''

def iter_shapes(shapes):
    for sh in shapes:
        yield sh
        if getattr(sh,'shape_type',None)==6:
            yield from iter_shapes(sh.shapes)

for slide_no, shape_updates in updates.items():
    if slide_no > len(prs.slides):
        continue
    slide=prs.slides[slide_no-1]
    for idx, lines in shape_updates.items():
        sh=slide.shapes[idx]
        if hasattr(sh,'text_frame') and sh.has_text_frame:
            set_text_preserve(sh, lines)

prs.save(out)
print(out)
