"""Atualiza thumbnails das aulas 2 e 3 em course_lessons."""
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

client.table("course_lessons").update({"thumbnail": "/curso/aula-2.jpg"}).eq("lesson_order", 2).execute()
client.table("course_lessons").update({"thumbnail": "/curso/aula-3.jpg"}).eq("lesson_order", 3).execute()

print("Thumbnails aulas 2 e 3 atualizados.")
