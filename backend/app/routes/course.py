from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.auth import get_current_user

router = APIRouter(prefix="/course", tags=["course"])


class LessonResponse(BaseModel):
    id: int
    title: str
    description: Optional[str]
    video_url: Optional[str]
    duration: Optional[str]
    thumbnail: Optional[str]
    order: int
    completed: bool = False
    completed_at: Optional[datetime] = None


class MarkCompletedRequest(BaseModel):
    lesson_id: int
    completed: bool = True


@router.get("/lessons", response_model=List[LessonResponse])
async def get_lessons(user=Depends(get_current_user)):
    """
    Retorna todas as aulas do curso com o progresso do usuário.
    """
    from app.db import get_supabase
    
    supabase = get_supabase()
    user_id = user["id"]
    
    try:
        # Busca todas as aulas
        lessons_response = supabase.table("course_lessons").select("*").order("lesson_order").execute()
        
        if not lessons_response.data:
            return []
        
        # Busca progresso do usuário
        progress_response = supabase.table("user_lesson_progress").select("*").eq("user_id", user_id).execute()
        
        # Cria um dicionário de progresso por lesson_id
        progress_dict = {}
        if progress_response.data:
            for p in progress_response.data:
                progress_dict[p["lesson_id"]] = {
                    "completed": p["completed"],
                    "completed_at": p["completed_at"]
                }
        
        # Monta resposta combinando aulas com progresso
        result = []
        for lesson in lessons_response.data:
            progress = progress_dict.get(lesson["id"], {"completed": False, "completed_at": None})
            result.append({
                "id": lesson["id"],
                "title": lesson["title"],
                "description": lesson["description"],
                "video_url": lesson["video_url"],
                "duration": lesson["duration"],
                "thumbnail": lesson["thumbnail"],
                "order": lesson["lesson_order"],
                "completed": progress["completed"],
                "completed_at": progress["completed_at"]
            })
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao buscar aulas: {str(e)}")


@router.get("/lessons/{lesson_id}", response_model=LessonResponse)
async def get_lesson(lesson_id: int, user=Depends(get_current_user)):
    """
    Retorna uma aula específica com o progresso do usuário.
    """
    from app.db import get_supabase
    
    supabase = get_supabase()
    user_id = user["id"]
    
    try:
        # Busca a aula
        lesson_response = supabase.table("course_lessons").select("*").eq("id", lesson_id).single().execute()
        
        if not lesson_response.data:
            raise HTTPException(status_code=404, detail="Aula não encontrada")
        
        lesson = lesson_response.data
        
        # Busca progresso do usuário
        progress_response = supabase.table("user_lesson_progress").select("*").eq("user_id", user_id).eq("lesson_id", lesson_id).execute()
        
        progress = {"completed": False, "completed_at": None}
        if progress_response.data and len(progress_response.data) > 0:
            progress = {
                "completed": progress_response.data[0]["completed"],
                "completed_at": progress_response.data[0]["completed_at"]
            }
        
        return {
            "id": lesson["id"],
            "title": lesson["title"],
            "description": lesson["description"],
            "video_url": lesson["video_url"],
            "duration": lesson["duration"],
            "thumbnail": lesson["thumbnail"],
            "order": lesson["lesson_order"],
            "completed": progress["completed"],
            "completed_at": progress["completed_at"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao buscar aula: {str(e)}")


@router.post("/progress")
async def mark_lesson_progress(request: MarkCompletedRequest, user=Depends(get_current_user)):
    """
    Marca uma aula como concluída ou não concluída.
    """
    from app.db import get_supabase
    
    supabase = get_supabase()
    user_id = user["id"]
    
    try:
        # Verifica se a aula existe
        lesson_response = supabase.table("course_lessons").select("id").eq("id", request.lesson_id).execute()
        
        if not lesson_response.data:
            raise HTTPException(status_code=404, detail="Aula não encontrada")
        
        # Verifica se já existe um registro de progresso
        progress_response = supabase.table("user_lesson_progress").select("*").eq("user_id", user_id).eq("lesson_id", request.lesson_id).execute()
        
        now = datetime.utcnow().isoformat()
        
        if progress_response.data and len(progress_response.data) > 0:
            # Atualiza o registro existente
            update_data = {
                "completed": request.completed,
                "last_watched_at": now
            }
            if request.completed:
                update_data["completed_at"] = now
            else:
                update_data["completed_at"] = None
            
            supabase.table("user_lesson_progress").update(update_data).eq("user_id", user_id).eq("lesson_id", request.lesson_id).execute()
        else:
            # Cria um novo registro
            insert_data = {
                "user_id": user_id,
                "lesson_id": request.lesson_id,
                "completed": request.completed,
                "last_watched_at": now
            }
            if request.completed:
                insert_data["completed_at"] = now
            
            supabase.table("user_lesson_progress").insert(insert_data).execute()
        
        return {"message": "Progresso atualizado com sucesso"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao atualizar progresso: {str(e)}")


@router.get("/progress/stats")
async def get_progress_stats(user=Depends(get_current_user)):
    """
    Retorna estatísticas de progresso do usuário no curso.
    """
    from app.db import get_supabase
    
    supabase = get_supabase()
    user_id = user["id"]
    
    try:
        # Total de aulas
        total_response = supabase.table("course_lessons").select("id", count="exact").execute()
        total_lessons = total_response.count or 0
        
        # Aulas concluídas
        completed_response = supabase.table("user_lesson_progress").select("id", count="exact").eq("user_id", user_id).eq("completed", True).execute()
        completed_lessons = completed_response.count or 0
        
        # Calcula porcentagem
        progress_percentage = 0
        if total_lessons > 0:
            progress_percentage = round((completed_lessons / total_lessons) * 100)
        
        return {
            "total_lessons": total_lessons,
            "completed_lessons": completed_lessons,
            "progress_percentage": progress_percentage
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao buscar estatísticas: {str(e)}")
