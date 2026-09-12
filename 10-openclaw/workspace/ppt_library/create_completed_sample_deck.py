from pathlib import Path
from pptx import Presentation

src=Path('/root/.openclaw/workspace/ppt_library/Combined Cleaned PPT Template Review.pptx')
out=Path('/root/.openclaw/workspace/ppt_library/Combined Completed Sample PPT Review.pptx')
prs=Presentation(str(src))

def set_text(shape, text):
    if not (hasattr(shape,'text_frame') and shape.has_text_frame): return
    tf=shape.text_frame
    lines=text.split('\n')
    # keep same first paragraph formatting where possible
    if len(tf.paragraphs)==0:
        return
    for i,p in enumerate(tf.paragraphs):
        if i < len(lines):
            p.text=lines[i]
        else:
            p.text=''
    # add extra paragraphs if needed
    for line in lines[len(tf.paragraphs):]:
        p=tf.add_paragraph(); p.text=line

def shape(slide_no, idx):
    return prs.slides[slide_no-1].shapes[idx]

content={
8: {
 5: 'Carrier networks are only valuable when they are active, trusted, and easy to reach.\nBrokers need faster ways to find the right carrier for each load.\nA connected platform helps teams reduce manual calls, improve coverage, and make better freight decisions.',
 6: 'Why Carrier Networks Matter'
},
9: {
 6: 'Live Dashboard Visibility',
 7: 'Track loads, carrier status, and operational updates from one dashboard. This layout is ideal for product screenshots, platform demos, or workflow visibility slides.'
},
10: {
 4: 'Simplify Freight Operations',
 6: 'Freight teams lose time when sourcing, compliance, booking, and payment live in separate tools.',
 7: 'A connected workflow helps teams move faster, reduce rework, and keep every load under control.'
},
11: {
 3: 'Compliance Built Into Workflow',
 4: 'Use this slide to explain how risk, verification, and compliance checks support daily operations without slowing down the team.'
},
12: {
 5: 'Faster Load Coverage',
 6: 'Match the right load with the right carrier faster using trusted data, performance history, and real-time capacity signals.'
},
13: {
 2: 'Operational control improves when teams work from a single source of truth. Use this layout for concise explanations, short summaries, or key business messages.',
 3: 'Operational Control'
},
14: {
 3: 'Platform Capabilities',
 4: 'A connected system for sourcing, compliance, execution, and payments.'
},
15: {
 3: 'Market Intelligence',
 4: 'Use data to understand capacity, pricing, carrier behavior, and freight movement trends.'
},
16: {
 2: 'Smarter Broker Workflows',
 5: 'Reduce manual steps by connecting load posting, carrier selection, compliance review, and booking activity in one repeatable process.'
},
17: {
 4: 'Connected Freight Operations',
 7: 'Give teams a clear operating view across loads, carriers, risk signals, and next actions so work moves forward without unnecessary handoffs.'
},
18: {
 1: 'Three Ways to Improve Coverage',
 8: 'Use trusted carrier lists to reach reliable capacity first.',
 9: 'Prioritize carriers based on fit, performance, and availability.',
 10: 'Control',
 11: 'Speed'
},
19: {
 2: 'Three Factors That Drive Efficiency',
 9: 'Centralized data keeps every team aligned.',
 10: 'Automation reduces repetitive manual work.',
 11: 'Clear visibility helps teams act faster.'
},
20: {
 2: 'Flexible Content Slide',
 3: 'Use this slide for custom notes, executive summaries, client-specific context, or any message that does not need a fixed visual structure.',
 4: 'Best for short, flexible content that needs room to breathe.'
}
}

for slide_no, replacements in content.items():
    for idx, txt in replacements.items():
        set_text(shape(slide_no, idx), txt)

prs.save(out)
print(out)
