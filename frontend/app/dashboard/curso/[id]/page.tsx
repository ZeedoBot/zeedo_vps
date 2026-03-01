"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface Lesson {
  id: number;
  title: string;
  description: string;
  duration: string;
  video_url: string;
  order: number;
  completed?: boolean;
}

export default function LessonPage() {
  const params = useParams();
  const router = useRouter();
  const lessonId = parseInt(params.id as string);
  
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [allLessons, setAllLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    loadLesson();
  }, [lessonId]);

  async function loadLesson() {
    try {
      const supabase = await import("@/utils/supabase/client").then(m => m.createClient());
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error("Não autenticado");
      }

      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      
      // Busca todas as aulas
      const allResponse = await fetch(`${API_URL}/course/lessons`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!allResponse.ok) {
        throw new Error("Erro ao carregar aulas");
      }

      const allData = await allResponse.json();
      setAllLessons(allData);
      
      // Busca aula específica
      const currentLesson = allData.find((l: Lesson) => l.id === lessonId);
      if (currentLesson) {
        setLesson(currentLesson);
        setCompleted(currentLesson.completed || false);
      }
      
    } catch (error) {
      console.error("Erro ao carregar aula:", error);
    } finally {
      setLoading(false);
    }
  }

  async function markAsCompleted() {
    try {
      const supabase = await import("@/utils/supabase/client").then(m => m.createClient());
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token || !lesson) {
        return;
      }

      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      
      // Marca como concluída na API
      const response = await fetch(`${API_URL}/course/progress`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          lesson_id: lesson.id,
          completed: true,
        }),
      });

      if (!response.ok) {
        throw new Error("Erro ao marcar aula como concluída");
      }

      setCompleted(true);
      
      // Navegar para próxima aula se houver
      const nextLesson = allLessons.find(l => l.order === (lesson?.order || 0) + 1);
      if (nextLesson) {
        setTimeout(() => {
          router.push(`/dashboard/curso/${nextLesson.id}`);
        }, 1500);
      }
    } catch (error) {
      console.error("Erro ao marcar aula como concluída:", error);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-zeedo-black/60 dark:text-zeedo-white/60">Carregando aula...</p>
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="text-center py-12">
        <p className="text-zeedo-black/60 dark:text-zeedo-white/60 mb-4">Aula não encontrada</p>
        <Link href="/dashboard/curso" className="text-zeedo-orange hover:underline">
          Voltar para o curso
        </Link>
      </div>
    );
  }

  const previousLesson = allLessons.find(l => l.order === lesson.order - 1);
  const nextLesson = allLessons.find(l => l.order === lesson.order + 1);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-zeedo-black/60 dark:text-zeedo-white/60">
        <Link href="/dashboard/curso" className="hover:text-zeedo-orange transition-colors">
          Curso
        </Link>
        <span>/</span>
        <span className="text-zeedo-black dark:text-zeedo-white">Aula {lesson.order}</span>
      </div>

      {/* Player de Vídeo */}
      <div className="card p-0 overflow-hidden">
        <div className="relative aspect-video bg-zeedo-black">
          {lesson.video_url ? (
            // Player do Vimeo (quando você adicionar o link)
            <iframe
              src={lesson.video_url}
              className="absolute inset-0 w-full h-full"
              frameBorder="0"
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
            />
          ) : (
            // Placeholder quando não há vídeo
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
              <svg className="w-24 h-24 mb-4 text-white/20" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
              </svg>
              <p className="text-white/60">Vídeo será adicionado em breve</p>
              <p className="text-sm text-white/40 mt-2">Duração: {lesson.duration}</p>
            </div>
          )}
        </div>
      </div>

      {/* Informações da Aula */}
      <div className="card">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <span className="inline-block bg-zeedo-orange text-white text-xs font-bold px-2 py-1 rounded">
                Aula {lesson.order}
              </span>
              {completed && (
                <span className="inline-flex items-center gap-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-semibold px-2 py-1 rounded">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Concluída
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-zeedo-black dark:text-zeedo-white mb-2">
              {lesson.title}
            </h1>
            <p className="text-zeedo-black/70 dark:text-zeedo-white/70">
              {lesson.description}
            </p>
          </div>
          
          {!completed && (
            <button
              onClick={markAsCompleted}
              className="btn-primary whitespace-nowrap"
            >
              Marcar como concluída
            </button>
          )}
        </div>

        {/* Navegação entre aulas */}
        <div className="flex items-center justify-between pt-4 border-t border-zeedo-black/10 dark:border-white/10">
          {previousLesson ? (
            <Link
              href={`/dashboard/curso/${previousLesson.id}`}
              className="flex items-center gap-2 text-sm text-zeedo-black/60 dark:text-zeedo-white/60 hover:text-zeedo-orange transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <div className="text-left">
                <div className="text-xs">Aula anterior</div>
                <div className="font-medium">{previousLesson.title}</div>
              </div>
            </Link>
          ) : (
            <div />
          )}

          {nextLesson ? (
            <Link
              href={`/dashboard/curso/${nextLesson.id}`}
              className="flex items-center gap-2 text-sm text-zeedo-black/60 dark:text-zeedo-white/60 hover:text-zeedo-orange transition-colors"
            >
              <div className="text-right">
                <div className="text-xs">Próxima aula</div>
                <div className="font-medium">{nextLesson.title}</div>
              </div>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          ) : (
            <Link
              href="/dashboard/curso"
              className="flex items-center gap-2 text-sm text-zeedo-orange hover:underline"
            >
              <span>Voltar ao curso</span>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          )}
        </div>
      </div>

      {/* Lista de todas as aulas */}
      <div className="card">
        <h2 className="text-lg font-semibold text-zeedo-black dark:text-zeedo-white mb-4">
          Todas as aulas
        </h2>
        <div className="space-y-2">
          {allLessons.map((l) => (
            <Link
              key={l.id}
              href={`/dashboard/curso/${l.id}`}
              className={`flex items-center gap-4 p-3 rounded-lg transition-colors ${
                l.id === lesson.id
                  ? "bg-zeedo-orange/10 border border-zeedo-orange/30"
                  : "hover:bg-zeedo-black/5 dark:hover:bg-white/5"
              }`}
            >
              <div className={`flex items-center justify-center w-10 h-10 rounded-full shrink-0 ${
                l.completed
                  ? "bg-green-500 text-white"
                  : l.id === lesson.id
                  ? "bg-zeedo-orange text-white"
                  : "bg-zeedo-black/10 dark:bg-white/10 text-zeedo-black/60 dark:text-zeedo-white/60"
              }`}>
                {l.completed ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <span className="text-sm font-semibold">{l.order}</span>
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <h3 className={`font-medium truncate ${
                  l.id === lesson.id
                    ? "text-zeedo-orange"
                    : "text-zeedo-black dark:text-zeedo-white"
                }`}>
                  {l.title}
                </h3>
                <p className="text-sm text-zeedo-black/60 dark:text-zeedo-white/60">
                  {l.duration}
                </p>
              </div>
              
              {l.id === lesson.id && (
                <div className="flex items-center gap-1 text-xs text-zeedo-orange font-semibold">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" />
                  </svg>
                  Assistindo
                </div>
              )}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
