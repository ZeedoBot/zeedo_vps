"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

interface Lesson {
  id: number;
  title: string;
  description: string;
  duration: string;
  thumbnail: string;
  video_url: string;
  order: number;
  completed?: boolean;
}

export default function CursoPage() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    loadLessons();
  }, []);

  async function loadLessons() {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error("Não autenticado");
      }

      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      
      // Busca aulas da API
      const response = await fetch(`${API_URL}/course/lessons`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Erro ao carregar aulas");
      }

      const data = await response.json();
      setLessons(data);
      
      // Calcula progresso
      const completed = data.filter((l: Lesson) => l.completed).length;
      setProgress(Math.round((completed / data.length) * 100));
      
    } catch (error) {
      console.error("Erro ao carregar aulas:", error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-zeedo-black/60 dark:text-zeedo-white/60">Carregando curso...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header do Curso */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-zeedo-orange to-orange-600 p-8 text-white">
        <div className="relative z-10">
          <h1 className="text-3xl font-bold mb-2">Curso Introdutório Zeedo</h1>
          <p className="text-white/90 mb-4">
            Aprenda tudo sobre trading automatizado e como usar a plataforma Zeedo
          </p>
          
          {/* Barra de Progresso */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Seu progresso</span>
              <span className="font-semibold">{progress}%</span>
            </div>
            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
              <div 
                className="h-full bg-white transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-sm text-white/80">
              {lessons.filter(l => l.completed).length} de {lessons.length} aulas concluídas
            </p>
          </div>
        </div>
        
        {/* Padrão decorativo */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32" />
        <div className="absolute bottom-0 right-0 w-48 h-48 bg-white/10 rounded-full -mr-24 -mb-24" />
      </div>

      {/* Grid de Aulas */}
      <div>
        <h2 className="text-xl font-semibold text-zeedo-black dark:text-zeedo-white mb-4">
          Aulas do Curso
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {lessons.map((lesson) => (
            <Link
              key={lesson.id}
              href={`/dashboard/curso/${lesson.id}`}
              className="group"
            >
              <div className="card p-0 overflow-hidden hover:scale-105 transition-transform duration-200">
                {/* Thumbnail */}
                <div className="relative aspect-video bg-gradient-to-br from-zeedo-orange/20 to-orange-600/20 flex items-center justify-center">
                  <div className="absolute inset-0 bg-zeedo-black/40 group-hover:bg-zeedo-black/20 transition-colors" />
                  
                  {/* Play Button */}
                  <div className="relative z-10 w-16 h-16 rounded-full bg-zeedo-orange flex items-center justify-center group-hover:scale-110 transition-transform">
                    <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                  
                  {/* Badge de Concluído */}
                  {lesson.completed && (
                    <div className="absolute top-3 right-3 bg-green-500 text-white text-xs font-semibold px-2 py-1 rounded-full flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Concluída
                    </div>
                  )}
                  
                  {/* Duração */}
                  <div className="absolute bottom-3 right-3 bg-zeedo-black/80 text-white text-xs font-semibold px-2 py-1 rounded">
                    {lesson.duration}
                  </div>
                  
                  {/* Número da Aula */}
                  <div className="absolute top-3 left-3 bg-zeedo-orange text-white text-xs font-bold px-2 py-1 rounded">
                    Aula {lesson.order}
                  </div>
                </div>
                
                {/* Informações */}
                <div className="p-4">
                  <h3 className="font-semibold text-zeedo-black dark:text-zeedo-white mb-2 group-hover:text-zeedo-orange transition-colors">
                    {lesson.title}
                  </h3>
                  <p className="text-sm text-zeedo-black/60 dark:text-zeedo-white/60 line-clamp-2">
                    {lesson.description}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Certificado (quando completar 100%) */}
      {progress === 100 && (
        <div className="card bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center shrink-0">
              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-green-900 dark:text-green-100 mb-1">
                🎉 Parabéns! Você concluiu o curso!
              </h3>
              <p className="text-sm text-green-800 dark:text-green-200">
                Você está pronto para usar o Zeedo com confiança. Continue praticando e bons trades!
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
