"""Scripts para course_lessons: thumbnails e ordem."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv

load_dotenv()

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_KEY")
if not url or not key:
    print("Configure SUPABASE_URL e SUPABASE_SERVICE_KEY no .env")
    sys.exit(1)

from supabase import create_client
client = create_client(url, key)

# Reordena: Configurações Avançadas vai para última (aula 7)
r = client.table("course_lessons").select("id, title, lesson_order").order("lesson_order").execute()
lessons = r.data or []
by_order = {int(l["lesson_order"]): l for l in lessons if l.get("lesson_order") is not None}

adv_id = next((l["id"] for l in lessons if "Configurações Avançadas" in (l.get("title") or "")), None)
if adv_id:
    client.table("course_lessons").update({"lesson_order": 99}).eq("id", adv_id).execute()
    if 7 in by_order and by_order[7]["id"] != adv_id:
        client.table("course_lessons").update({"lesson_order": 6}).eq("id", by_order[7]["id"]).execute()
    if 6 in by_order and by_order[6]["id"] != adv_id:
        client.table("course_lessons").update({"lesson_order": 5}).eq("id", by_order[6]["id"]).execute()
    client.table("course_lessons").update({"lesson_order": 7}).eq("id", adv_id).execute()
    print("Ordem atualizada: Configurações Avançadas agora é a aula 7.")
else:
    print("Aula 'Configurações Avançadas' não encontrada.")

# Thumbnails
client.table("course_lessons").update({"thumbnail": "/curso/aula-2.jpg"}).eq("lesson_order", 2).execute()
client.table("course_lessons").update({"thumbnail": "/curso/aula-3.jpg"}).eq("lesson_order", 3).execute()
print("Thumbnails aulas 2 e 3 ok.")
