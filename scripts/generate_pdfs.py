from pathlib import Path
import json
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether

ROOT=Path(__file__).resolve().parents[1]
CAT=json.loads((ROOT/'data/catalog.json').read_text(encoding='utf-8'))
LESSONS=[json.loads((ROOT/meta['file']).read_text(encoding='utf-8')) for meta in CAT['lessons']]
OUT=ROOT/'downloads'; OUT.mkdir(exist_ok=True)
styles=getSampleStyleSheet()
styles.add(ParagraphStyle(name='TitleTA',parent=styles['Title'],fontName='Helvetica-Bold',fontSize=26,leading=31,textColor=colors.HexColor('#123b55'),spaceAfter=16))
styles.add(ParagraphStyle(name='SubTA',parent=styles['Normal'],fontSize=12,leading=17,textColor=colors.HexColor('#4d6573'),spaceAfter=12))
styles.add(ParagraphStyle(name='LessonTA',parent=styles['Heading1'],fontName='Helvetica-Bold',fontSize=19,leading=23,textColor=colors.HexColor('#123b55'),spaceBefore=6,spaceAfter=9))
styles.add(ParagraphStyle(name='SmallTA',parent=styles['Normal'],fontSize=7.4,leading=8.8))
styles.add(ParagraphStyle(name='CenterTA',parent=styles['Normal'],alignment=TA_CENTER,fontSize=9,textColor=colors.HexColor('#4d6573')))


def exercise_english(item):
    return item.get('exercise_english') or item['english']

def footer(canvas,doc):
    canvas.saveState(); canvas.setFont('Helvetica',8); canvas.setFillColor(colors.HexColor('#4d6573'))
    canvas.drawString(.65*inch,.42*inch,'Tagalog Academy · tagalog.academy')
    canvas.drawRightString(7.85*inch,.42*inch,str(doc.page)); canvas.restoreState()

def doc(path,title,subtitle):
    return SimpleDocTemplate(str(path),pagesize=LETTER,rightMargin=.55*inch,leftMargin=.55*inch,topMargin=.6*inch,bottomMargin=.65*inch,title=title,author='Tagalog Academy')

def cover(story,title,subtitle):
    story += [Spacer(1,.8*inch),Paragraph(title,styles['TitleTA']),Paragraph(subtitle,styles['SubTA']),Spacer(1,.2*inch),Paragraph('Learn · Recall · Speak · Use',styles['CenterTA']),PageBreak()]

def guide():
    path=OUT/'Tagalog-Academy-Beginner-Guide.pdf'; story=[]; cover(story,'Tagalog Academy Beginner Guide','Practical words, phrases, and patterns from the complete learning path.')
    for li,lesson in enumerate(LESSONS):
        story += [Paragraph(f"Lesson {lesson['order']}: {lesson['title']}",styles['LessonTA']),Paragraph(lesson['summary'],styles['SubTA'])]
        rows=[[Paragraph('<b>Tagalog</b>',styles['SmallTA']),Paragraph('<b>English</b>',styles['SmallTA']),Paragraph('<b>Note</b>',styles['SmallTA'])]]
        for item in lesson['vocabulary']:
            rows.append([Paragraph(item['tagalog'],styles['SmallTA']),Paragraph(item['english'],styles['SmallTA']),Paragraph(item.get('note',''),styles['SmallTA'])])
        t=Table(rows,colWidths=[2.15*inch,2.15*inch,3.0*inch],repeatRows=1)
        t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#123b55')),('TEXTCOLOR',(0,0),(-1,0),colors.white),('GRID',(0,0),(-1,-1),.35,colors.HexColor('#758b9a')),('VALIGN',(0,0),(-1,-1),'TOP'),('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,colors.HexColor('#edf3f6')]),('LEFTPADDING',(0,0),(-1,-1),5),('RIGHTPADDING',(0,0),(-1,-1),5),('TOPPADDING',(0,0),(-1,-1),2),('BOTTOMPADDING',(0,0),(-1,-1),2)]))
        story += [t,Spacer(1,.18*inch),Paragraph('<b>Useful patterns</b>',styles['Heading2'])]
        for p in lesson['patterns']:
            story += [KeepTogether([Paragraph(p['tagalog'],styles['SmallTA']),Paragraph(p['english'],styles['SmallTA']),Spacer(1,.06*inch)])]
        if li < len(LESSONS)-1: story.append(PageBreak())
    doc(path,'Tagalog Academy Beginner Guide','Practical Tagalog').build(story,onFirstPage=footer,onLaterPages=footer)

def practice():
    path=OUT/'Tagalog-Academy-Practice-Pack.pdf'; story=[]; cover(story,'Tagalog Academy Practice Pack','Write from memory before checking the answer guide.')
    for li,lesson in enumerate(LESSONS):
        story += [Paragraph(f"Lesson {lesson['order']}: {lesson['title']}",styles['LessonTA']),Paragraph('A. Write the Tagalog.',styles['Heading2'])]
        for i,item in enumerate([v for v in lesson['vocabulary'] if v.get('practice')][:12],1):
            story.append(Paragraph(f"{i}. {exercise_english(item)}  __________________________________________",styles['Normal']))
        story += [Spacer(1,.12*inch),Paragraph('B. Complete the practical task.',styles['Heading2']),Paragraph(lesson['mission']['description'],styles['Normal'])]
        for step in lesson['mission']['steps']:
            story.append(Paragraph(f"• {step}",styles['Normal']))
        story += [Spacer(1,.15*inch),Paragraph('C. Write two original sentences.',styles['Heading2']),Paragraph('1. ____________________________________________________________________',styles['Normal']),Spacer(1,.12*inch),Paragraph('2. ____________________________________________________________________',styles['Normal'])]
        if li < len(LESSONS)-1: story.append(PageBreak())
    doc(path,'Tagalog Academy Practice Pack','Practice').build(story,onFirstPage=footer,onLaterPages=footer)

def answers():
    path=OUT/'Tagalog-Academy-Answer-Guide.pdf'; story=[]; cover(story,'Tagalog Academy Answer Guide','Suggested answers for the printable practice pack.')
    for li,lesson in enumerate(LESSONS):
        story += [Paragraph(f"Lesson {lesson['order']}: {lesson['title']}",styles['LessonTA'])]
        for i,item in enumerate([v for v in lesson['vocabulary'] if v.get('practice')][:12],1):
            story.append(Paragraph(f"{i}. {item['tagalog']} — {exercise_english(item)}",styles['Normal']))
        story += [Spacer(1,.15*inch),Paragraph('<b>Practical-task model</b>',styles['Heading2']),Paragraph(lesson['mission']['example'],styles['Normal']),Paragraph('Original sentences will vary.',styles['SubTA'])]
        if li < len(LESSONS)-1: story.append(PageBreak())
    doc(path,'Tagalog Academy Answer Guide','Answers').build(story,onFirstPage=footer,onLaterPages=footer)

if __name__=='__main__':
    guide(); practice(); answers(); print('Generated 3 PDFs')
