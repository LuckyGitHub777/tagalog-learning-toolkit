#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak,
    KeepTogether, HRFlowable
)

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'downloads'
DATA = json.loads((ROOT / 'data/lessons/week1.json').read_text(encoding='utf-8'))

NAVY = colors.HexColor('#17324D')
BLUE = colors.HexColor('#245B78')
GOLD = colors.HexColor('#F4B942')
PALE = colors.HexColor('#EEF3F8')
TEXT = colors.HexColor('#142033')
MUTED = colors.HexColor('#5D6B7D')
LINE = colors.HexColor('#D8E1EB')
GREEN = colors.HexColor('#16734F')

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name='DocTitle', parent=styles['Title'], fontName='Helvetica-Bold', fontSize=22, leading=26, textColor=NAVY, alignment=TA_CENTER, spaceAfter=8))
styles.add(ParagraphStyle(name='Subtitle', parent=styles['BodyText'], fontSize=9.5, leading=13, textColor=MUTED, alignment=TA_CENTER, spaceAfter=12))
styles.add(ParagraphStyle(name='H1x', parent=styles['Heading1'], fontName='Helvetica-Bold', fontSize=15, leading=18, textColor=BLUE, spaceBefore=7, spaceAfter=6))
styles.add(ParagraphStyle(name='H2x', parent=styles['Heading2'], fontName='Helvetica-Bold', fontSize=11.5, leading=14, textColor=NAVY, spaceBefore=6, spaceAfter=4))
styles.add(ParagraphStyle(name='Bodyx', parent=styles['BodyText'], fontName='Helvetica', fontSize=9.3, leading=13, textColor=TEXT, spaceAfter=5))
styles.add(ParagraphStyle(name='Smallx', parent=styles['BodyText'], fontName='Helvetica', fontSize=7.8, leading=10.4, textColor=MUTED))
styles.add(ParagraphStyle(name='Answer', parent=styles['BodyText'], fontName='Helvetica-Bold', fontSize=9.2, leading=12, textColor=GREEN, spaceAfter=3))
styles.add(ParagraphStyle(name='Question', parent=styles['BodyText'], fontName='Helvetica-Bold', fontSize=9.5, leading=12, textColor=TEXT, spaceAfter=3))


def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(LINE)
    canvas.line(0.55*inch, 0.48*inch, 7.95*inch, 0.48*inch)
    canvas.setFont('Helvetica', 7)
    canvas.setFillColor(MUTED)
    canvas.drawString(0.55*inch, 0.29*inch, 'Tagalog Academy · Week 1')
    canvas.drawRightString(7.95*inch, 0.29*inch, f'Page {doc.page}')
    canvas.restoreState()


def title_block(title, subtitle):
    return [Paragraph(title, styles['DocTitle']), Paragraph(subtitle, styles['Subtitle']), HRFlowable(width='100%', thickness=1.2, color=GOLD, spaceAfter=10)]


def table_for(items):
    rows = [[Paragraph('<b>Tagalog</b>', styles['Smallx']), Paragraph('<b>English</b>', styles['Smallx']), Paragraph('<b>Usage note</b>', styles['Smallx'])]]
    for item in items:
        rows.append([
            Paragraph(f"<b>{item['tagalog']}</b>", styles['Smallx']),
            Paragraph(item['english'], styles['Smallx']),
            Paragraph(item.get('note',''), styles['Smallx'])
        ])
    table = Table(rows, colWidths=[2.25*inch, 2.15*inch, 2.65*inch], repeatRows=1)
    table.setStyle(TableStyle([
        ('BACKGROUND',(0,0),(-1,0),PALE),
        ('TEXTCOLOR',(0,0),(-1,0),NAVY),
        ('GRID',(0,0),(-1,-1),0.35,LINE),
        ('VALIGN',(0,0),(-1,-1),'TOP'),
        ('LEFTPADDING',(0,0),(-1,-1),5),('RIGHTPADDING',(0,0),(-1,-1),5),
        ('TOPPADDING',(0,0),(-1,-1),4),('BOTTOMPADDING',(0,0),(-1,-1),4),
    ]))
    return table


def build_study():
    path = OUT / 'Tagalog-Week-1-Study-Guide.pdf'
    doc = SimpleDocTemplate(str(path), pagesize=letter, leftMargin=.55*inch, rightMargin=.55*inch, topMargin=.5*inch, bottomMargin=.62*inch)
    grouped = {}
    for item in DATA['vocabulary']:
        grouped.setdefault(item['category'], []).append(item)

    story = title_block('TAGALOG WEEK 1 STUDY GUIDE', 'Introductions, greetings, feelings, school, work, and family')
    story += [Paragraph('Learning Outcomes', styles['H1x'])]
    for outcome in DATA['objectives']:
        story.append(Paragraph(f'• {outcome}', styles['Bodyx']))
    for category in ('Greetings', 'Feelings', 'Introductions'):
        story += [Spacer(1,5), Paragraph(category, styles['H1x']), table_for(grouped[category])]

    story += [PageBreak(), *title_block('SCHOOL, WORK, AND LEAVE-TAKING', 'Week 1 questions and useful responses')]
    for category in ('School and Work', 'Leave-Taking'):
        story += [Paragraph(category, styles['H1x']), table_for(grouped[category]), Spacer(1,7)]
    story += [Paragraph('Response Building', styles['H1x']),
              Paragraph('<b>Nag-aaral ako sa ____.</b> I study at ____.', styles['Bodyx']),
              Paragraph('<b>Nag-aaral ako ng ____.</b> I am studying ____.', styles['Bodyx']),
              Paragraph('<b>Nagtatrabaho ako sa ____.</b> I work at ____.', styles['Bodyx']),
              Paragraph('<b>____ ako.</b> I am a/an ____.', styles['Bodyx'])]

    story += [PageBreak(), *title_block('FAMILY AND DESCRIPTION PATTERNS', 'Vocabulary, adjectives, and sentence-building'),
              Paragraph('Family', styles['H1x']), table_for(grouped['Family']),
              Spacer(1,8), Paragraph('Family Description Pattern', styles['H1x']),
              Paragraph('<b>Adjective + si + person</b>', styles['Bodyx']),
              Paragraph('<b>Mabait si Nanay.</b> Mother is kind.', styles['Bodyx']),
              Paragraph('You may also hear: <b>Si Nanay ay mabait.</b> This lesson practices the adjective-first pattern.', styles['Bodyx']),
              Paragraph('Useful Adjectives', styles['H1x'])]
    adj_rows = [[Paragraph('<b>Tagalog</b>', styles['Smallx']), Paragraph('<b>English</b>', styles['Smallx'])]]
    for item in DATA['adjectives']:
        adj_rows.append([Paragraph(f"<b>{item['tagalog']}</b>", styles['Smallx']), Paragraph(item['english'], styles['Smallx'])])
    adj_table = Table(adj_rows, colWidths=[3.2*inch, 3.85*inch], repeatRows=1)
    adj_table.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),PALE),('GRID',(0,0),(-1,-1),.35,LINE),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),5),('RIGHTPADDING',(0,0),(-1,-1),5),('TOPPADDING',(0,0),(-1,-1),4),('BOTTOMPADDING',(0,0),(-1,-1),4)]))
    story += [adj_table, PageBreak(), *title_block('PRACTICE AND MODEL', 'A complete introduction and review method'), Paragraph('Five-Sentence Model', styles['H1x']),
              Paragraph('Ako si Maya.<br/>Taga-Cebu ako.<br/>Nag-aaral ako sa isang unibersidad.<br/>Nag-aaral ako ng Tagalog.<br/>Masaya ako.', styles['Bodyx']),
              Paragraph('Practice Method', styles['H1x'])]
    for line in ['Read each phrase aloud three times.','Cover the Tagalog and retrieve it from English.','Type or write the phrase without copying.','Describe five people using different adjectives.','Review missed phrases tomorrow.']:
        story.append(Paragraph(f'• {line}', styles['Bodyx']))
    story += [Paragraph('Language Note', styles['H1x']), Paragraph('This is a foundational Tagalog lesson. Usage and course naming may vary by audience, region, and register. Human review remains important as the curriculum expands.', styles['Bodyx'])]
    doc.build(story, onFirstPage=footer, onLaterPages=footer)


def lines(n=3, width=7.1):
    out=[]
    for _ in range(n):
        out.append(Spacer(1,9))
        out.append(HRFlowable(width=width*inch, thickness=.45, color=colors.HexColor('#8C99A8')))
    return out


def build_practice():
    path = OUT / 'Tagalog-Week-1-Practice.pdf'
    doc = SimpleDocTemplate(str(path), pagesize=letter, leftMargin=.6*inch, rightMargin=.6*inch, topMargin=.5*inch, bottomMargin=.62*inch)
    story = title_block('TAGALOG WEEK 1 PRACTICE', 'Complete sentences, memory retrieval, and family descriptions')
    story += [Paragraph('Name: _________________________________________________', styles['Bodyx']), Paragraph('Part 1: Introduce Yourself', styles['H1x']), Paragraph('Answer in complete Tagalog sentences.', styles['Smallx'])]
    questions=['Ano ang pangalan mo?','Taga-saan ka?','Saan ka nag-aaral?','Ano ang inaaral mo?','Kumusta ka?']
    for i,q in enumerate(questions,1):
        story.append(Paragraph(f'{i}. {q}', styles['Question']))
        story += lines(2)
    story += [PageBreak(), *title_block('TAGALOG WEEK 1 PRACTICE', 'Family vocabulary and retrieval'), Paragraph('Part 2: Family Names', styles['H1x']), Paragraph('Write real or fictional names.', styles['Smallx'])]
    family=[('Nanay','Tatay'),('Kuya','Ate'),('Bunso','Pinsan')]
    rows=[]
    for left,right in family:
        rows.append([Paragraph(f'<b>{left}:</b> __________________________',styles['Bodyx']),Paragraph(f'<b>{right}:</b> __________________________',styles['Bodyx'])])
    t=Table(rows,colWidths=[3.55*inch,3.55*inch])
    t.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('TOPPADDING',(0,0),(-1,-1),8),('BOTTOMPADDING',(0,0),(-1,-1),8)]))
    story += [t, Spacer(1,10), Paragraph('Part 3: Memory Check', styles['H1x']), Paragraph('Without looking at notes, write the Tagalog word or words.', styles['Smallx'])]
    memory=['Mother','Father','Older brother','Older sister','Youngest child or sibling','Cousin']
    for i,item in enumerate(memory,1):
        story.append(Paragraph(f'{i}. {item}: ______________________________________', styles['Bodyx']))
        story.append(Spacer(1,6))
    story += [PageBreak(), *title_block('TAGALOG WEEK 1 PRACTICE', 'Create and apply'), Paragraph('Part 4: Describe Five People', styles['H1x']), Paragraph('Use <b>adjective + si + person</b>. Example: <b>Mabait si Nanay.</b>', styles['Bodyx'])]
    for i in range(1,6):
        story.append(Paragraph(f'{i}.', styles['Question']))
        story += lines(2)
    story += [Spacer(1,6), Paragraph('Helpful Adjectives', styles['H1x']), Paragraph('Mabait (kind) · Maganda (beautiful) · Gwapo (handsome) · Masaya (happy) · Matalino (smart) · Masipag (hardworking) · Nakakatawa (funny) · Matangkad (tall) · Mabuti (good) · Palakaibigan (friendly)', styles['Smallx']), Spacer(1,10), Paragraph('Self-Check', styles['H1x'])]
    for item in ['Every answer is a complete sentence when required.','I used si before each family member or name.','I used a capital letter and final punctuation.','I read my sentences aloud at least once.']:
        story.append(Paragraph(f'□ {item}', styles['Bodyx']))
    doc.build(story, onFirstPage=footer, onLaterPages=footer)


def build_answer():
    path = OUT / 'Tagalog-Week-1-Answer-Key.pdf'
    doc = SimpleDocTemplate(str(path), pagesize=letter, leftMargin=.6*inch, rightMargin=.6*inch, topMargin=.5*inch, bottomMargin=.62*inch)
    story = title_block('TAGALOG WEEK 1 ANSWER KEY', 'Fixed answers, acceptable variants, and sample responses')
    story += [Paragraph('How to Use This Key', styles['H1x']), Paragraph('Parts 1, 2, and 4 are open-ended. The samples show correct Week 1 patterns, not the only possible answers.', styles['Bodyx']), Paragraph('Part 1: Sample Introduction', styles['H1x'])]
    samples=[('Ano ang pangalan mo?','Ako si Maya.'),('Taga-saan ka?','Taga-Cebu ako.'),('Saan ka nag-aaral?','Nag-aaral ako sa isang unibersidad.'),('Ano ang inaaral mo?','Nag-aaral ako ng Tagalog.'),('Kumusta ka?','Masaya ako. / Ayos lang ako.')]
    for i,(q,a) in enumerate(samples,1):
        story += [Paragraph(f'{i}. {q}', styles['Question']), Paragraph(a, styles['Answer'])]
    story += [Paragraph('Part 2: Family Names', styles['H1x']), Paragraph('Any real or fictional names are acceptable when they are placed under the intended family role.', styles['Bodyx']), Paragraph('Part 3: Memory Check', styles['H1x'])]
    rows=[
        [Paragraph('<b>English</b>',styles['Smallx']),Paragraph('<b>Accepted answer</b>',styles['Smallx'])],
        [Paragraph('Mother',styles['Smallx']),Paragraph('Nanay or Ina',styles['Smallx'])],
        [Paragraph('Father',styles['Smallx']),Paragraph('Tatay or Ama',styles['Smallx'])],
        [Paragraph('Older brother',styles['Smallx']),Paragraph('Kuya',styles['Smallx'])],
        [Paragraph('Older sister',styles['Smallx']),Paragraph('Ate',styles['Smallx'])],
        [Paragraph('Youngest child or sibling',styles['Smallx']),Paragraph('Bunso',styles['Smallx'])],
        [Paragraph('Cousin',styles['Smallx']),Paragraph('Pinsan',styles['Smallx'])]
    ]
    t=Table(rows,colWidths=[3.1*inch,4*inch],repeatRows=1)
    t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),PALE),('GRID',(0,0),(-1,-1),.35,LINE),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),5),('RIGHTPADDING',(0,0),(-1,-1),5),('TOPPADDING',(0,0),(-1,-1),5),('BOTTOMPADDING',(0,0),(-1,-1),5)]))
    story += [t, PageBreak(), *title_block('SAMPLE DESCRIPTIONS AND REVIEW NOTES', 'Open-ended examples and accepted forms'), Paragraph('Part 4: Sample Descriptions', styles['H1x'])]
    for item in ['Mabait si Nanay.','Masipag si Tatay.','Nakakatawa si Kuya.','Matalino si Ate.','Masaya si Bunso.']:
        story.append(Paragraph(item, styles['Answer']))
    story += [Paragraph('Accepted Variants', styles['H1x'])]
    notes=[
        'Accept Kumusta? and common Kamusta? when spelling conventions allow.',
        'Accept Ayos lang ako. and Okay lang ako.',
        'For a field of study, Nag-aaral ako ng ____ is the primary model in this lesson.',
        'Na-stress ako. is the primary study form; Stressed ako. is familiar Taglish, and nai-stress ako may also appear.',
        'Kuya and Ate can also function as respectful forms of address, but this lesson teaches older brother and older sister.',
        'Tiyo/Tiya and Tito/Tita are recognized variants for uncle and aunt.',
        'Bunso means the youngest child or sibling, not any younger sibling.'
    ]
    for note in notes:
        story.append(Paragraph(f'• {note}', styles['Bodyx']))
    story += [Paragraph('Review Boundary', styles['H1x']), Paragraph('This answer key supports the specific Week 1 activities. It should not be treated as a complete grammar reference or a substitute for fluent-speaker feedback.', styles['Bodyx'])]
    doc.build(story, onFirstPage=footer, onLaterPages=footer)



if __name__ == '__main__':
    OUT.mkdir(exist_ok=True)
    build_study(); build_practice(); build_answer()
    print('Generated 3 PDFs.')
