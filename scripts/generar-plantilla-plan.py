"""
Genera public/plantilla-plan-obra.xlsx: la plantilla de plan de obra que
se da a un cliente nuevo para que "Traer el plan del Excel" funcione a la
primera (punto 20 del plan). Sigue exactamente lo que entiende
lib/importar-excel.ts.

Uso:  pip install openpyxl  &&  python scripts/generar-plantilla-plan.py
"""
import datetime as dt
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

SALIDA = Path(__file__).resolve().parent.parent / "public" / "plantilla-plan-obra.xlsx"
SEMANAS = 12
LUNES = dt.date(2026, 1, 5)

pintado = PatternFill("solid", fgColor="F2851B")
cabecera = PatternFill("solid", fgColor="1F1B16")
capitulo = PatternFill("solid", fgColor="F3E6D3")
fina = Side(style="thin", color="D9D2C7")
borde = Border(left=fina, right=fina, top=fina, bottom=fina)

wb = Workbook()
ws = wb.active
ws.title = "Plan"

titulos = ["CÓDIGO", "TRABAJO", "CANTIDAD", "PRECIO", "IMPORTE"]
for i in range(SEMANAS):
    lunes = LUNES + dt.timedelta(weeks=i)
    viernes = lunes + dt.timedelta(days=4)
    titulos.append(f"SEMANA {i + 1} {lunes.day:02d}.{lunes.month:02d}-{viernes.day:02d}.{viernes.month:02d}")
ws.append(titulos)
for c in range(1, len(titulos) + 1):
    celda = ws.cell(1, c)
    celda.font = Font(bold=True, color="FFFFFF")
    celda.fill = cabecera
    celda.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
ws.row_dimensions[1].height = 32

# (código o capítulo, trabajo, cantidad, precio, semanas pintadas 1..N)
filas = [
    ("CAPÍTULO 01: DEMOLICIONES", None, None, None, []),
    ("01.01", "Demolición de tabiques", 40, 12.5, [1]),
    ("01.02", "Retirada de escombros", 1, 450, [1, 2]),
    ("CAPÍTULO 02: ALBAÑILERÍA", None, None, None, []),
    ("02.01", "Tabiquería de ladrillo", 60, 28, [2, 3, 4]),
    ("02.02", "Enlucido de yeso", 180, 9.5, [4, 5]),
    ("CAPÍTULO 03: FONTANERÍA", None, None, None, []),
    ("03.01", "Red de agua fría y caliente", 1, 1800, [5, 6]),
    ("03.02", "Desagües", 1, 950, [6]),
    ("CAPÍTULO 04: ELECTRICIDAD", None, None, None, []),
    ("04.01", "Cableado y cajas", 1, 2400, [6, 7, 8]),
    ("CAPÍTULO 05: PINTURA Y LIMPIEZA", None, None, None, []),
    ("05.01", "Pintura plástica", 220, 6, [9, 10]),
    ("05.02", "Limpieza final", 1, 300, [10]),
]
for cod, trabajo, cant, precio, semanas in filas:
    if trabajo is None:
        ws.append([cod])
        f = ws.max_row
        ws.merge_cells(start_row=f, start_column=1, end_row=f, end_column=5)
        for c in range(1, len(titulos) + 1):
            ws.cell(f, c).fill = capitulo
        ws.cell(f, 1).font = Font(bold=True)
        continue
    ws.append([cod, trabajo, cant, precio])
    f = ws.max_row
    # Número, no fórmula: openpyxl no guarda el resultado de las fórmulas y
    # la app leería el importe vacío hasta que alguien abriera el Excel.
    ws.cell(f, 5).value = round(cant * precio, 2)
    ws.cell(f, 4).number_format = '#,##0.00 "€"'
    ws.cell(f, 5).number_format = '#,##0.00 "€"'
    for s in semanas:
        ws.cell(f, 5 + s).fill = pintado
    for c in range(1, len(titulos) + 1):
        ws.cell(f, c).border = borde

ws.column_dimensions["A"].width = 12
ws.column_dimensions["B"].width = 34
for c in (3, 4, 5):
    ws.column_dimensions[get_column_letter(c)].width = 12
for c in range(6, len(titulos) + 1):
    ws.column_dimensions[get_column_letter(c)].width = 11
ws.freeze_panes = "C2"

# --- Hoja de instrucciones, en los tres idiomas de la app ---
inst = wb.create_sheet("Instrucciones")
textos = [
    ("ES — Cómo rellenar el plan", True),
    ("1. Fila 1: una columna por semana, con el texto «SEMANA 1 05.01-09.01» (día.mes del lunes y del viernes). También vale poner la fecha del lunes.", False),
    ("2. Cada capítulo en su fila, empezando por «CAPÍTULO», «FASE» o «ZONA» (ej. «CAPÍTULO 02: ALBAÑILERÍA»).", False),
    ("3. Debajo, cada trabajo: código tipo «02.01» en la columna A y el nombre en la B.", False),
    ("4. El importe en la columna «IMPORTE», en la fila del trabajo.", False),
    ("5. Pinta de color (cualquiera menos blanco) las semanas en las que se hace cada trabajo.", False),
    ("6. En la app: Planificación → Traer el plan del Excel. Cada capítulo se convierte en una tarea con sus fechas y su presupuesto.", False),
    ("", False),
    ("UA — Як заповнити план", True),
    ("1. Рядок 1: по колонці на тиждень, з текстом «SEMANA 1 05.01-09.01» (день.місяць понеділка й п'ятниці). Можна також поставити дату понеділка.", False),
    ("2. Кожен розділ у своєму рядку, що починається з «CAPÍTULO», «РОЗДІЛ», «FASE» або «ZONA».", False),
    ("3. Під ним кожна робота: код на кшталт «02.01» у колонці A і назва в колонці B.", False),
    ("4. Сума в колонці «IMPORTE», у рядку роботи.", False),
    ("5. Зафарбуй кольором (будь-яким, крім білого) тижні, коли виконується кожна робота.", False),
    ("6. У застосунку: Планування → Завантажити план з Excel. Кожен розділ стане роботою з датами й кошторисом.", False),
    ("", False),
    ("EN — How to fill in the plan", True),
    ("1. Row 1: one column per week, with the text “SEMANA 1 05.01-09.01” (day.month of Monday and Friday). A Monday date also works.", False),
    ("2. Each section on its own row, starting with “CAPÍTULO”, “CHAPTER”, “FASE” or “ZONA”.", False),
    ("3. Below it, each task: a code like “02.01” in column A and the name in column B.", False),
    ("4. The amount in the “IMPORTE” column, on the task row.", False),
    ("5. Colour in (any colour except white) the weeks when each task is done.", False),
    ("6. In the app: Planning → Import the plan from Excel. Each section becomes a task with its dates and budget.", False),
]
for texto, negrita in textos:
    inst.append([texto])
    inst.cell(inst.max_row, 1).font = Font(bold=negrita, size=12 if negrita else 11)
    inst.cell(inst.max_row, 1).alignment = Alignment(wrap_text=True, vertical="top")
inst.column_dimensions["A"].width = 110

SALIDA.parent.mkdir(exist_ok=True)
wb.save(SALIDA)
print(f"Plantilla guardada en {SALIDA}")
