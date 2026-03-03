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
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    loadLessons();
  }, []);

  // Verifica se pode scrollar para os lados
  const checkScroll = () => {
    const container = document.getElementById('lessons-scroll');
    if (container) {
      setCanScrollLeft(container.scrollLeft > 0);
      setCanScrollRight(
        container.scrollLeft < container.scrollWidth - container.clientWidth - 10
      );
    }
  };

  useEffect(() => {
    const container = document.getElementById('lessons-scroll');
    if (container) {
      checkScroll();
      container.addEventListener('scroll', checkScroll);
      window.addEventListener('resize', checkScroll);
      return () => {
        container.removeEventListener('scroll', checkScroll);
        window.removeEventListener('resize', checkScroll);
      };
    }
  }, [lessons]);

  async function loadLessons() {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        console.error("Não autenticado - sem token");
        throw new Error("Não autenticado");
      }

      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      console.log("Buscando aulas de:", `${API_URL}/course/lessons`);
      
      // Busca aulas da API
      const response = await fetch(`${API_URL}/course/lessons`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      console.log("Status da resposta:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Erro na resposta:", errorText);
        throw new Error(`Erro ao carregar aulas: ${response.status}`);
      }

      const data = await response.json();
      console.log("Aulas carregadas:", data.length, data);
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
      <div className="relative overflow-hidden rounded-xl md:rounded-2xl bg-gradient-to-r from-zeedo-orange to-orange-600 p-4 md:p-8 text-white">
        <div className="relative z-10">
          <h1 className="text-xl md:text-3xl font-bold mb-1 md:mb-2">Curso Introdutório Zeedo</h1>
          <p className="text-sm md:text-base text-white/90 mb-3 md:mb-4">
            Aprenda tudo sobre trading automatizado e como usar a plataforma Zeedo
          </p>
          
          {/* Barra de Progresso */}
          <div className="space-y-1.5 md:space-y-2">
            <div className="flex items-center justify-between text-xs md:text-sm">
              <span>Seu progresso</span>
              <span className="font-semibold">{progress}%</span>
            </div>
            <div className="h-1.5 md:h-2 bg-white/20 rounded-full overflow-hidden">
              <div 
                className="h-full bg-white transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs md:text-sm text-white/80">
              {lessons.filter(l => l.completed).length} de {lessons.length} aulas concluídas
            </p>
          </div>
        </div>
        
        {/* Padrão decorativo - escondido no mobile */}
        <div className="hidden md:block absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32" />
        <div className="hidden md:block absolute bottom-0 right-0 w-48 h-48 bg-white/10 rounded-full -mr-24 -mb-24" />
      </div>

      {/* Grid de Aulas - Estilo Netflix */}
      <div>
        <h2 className="text-xl font-semibold text-zeedo-black dark:text-zeedo-white mb-4">
          Aulas do Curso
        </h2>
        
        {/* Container com scroll horizontal e setas */}
        <div className="relative flex items-center gap-4">
          {/* Seta Esquerda - apenas desktop e quando pode scrollar */}
          {canScrollLeft && (
            <button
              onClick={() => {
                const container = document.getElementById('lessons-scroll');
                if (container) {
                  container.scrollBy({ left: -400, behavior: 'smooth' });
                  setTimeout(checkScroll, 300);
                }
              }}
              className="hidden md:flex shrink-0 z-10 text-zeedo-orange hover:text-orange-600 transition-colors"
            >
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
              </svg>
            </button>
          )}

          <div 
            id="lessons-scroll"
            className="flex gap-2 md:gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide flex-1"
          >
            {lessons.map((lesson) => (
              <Link
                key={lesson.id}
                href={`/dashboard/curso/${lesson.id}`}
                className="group flex-none w-[calc(33.333%-0.5rem)] md:w-[280px] lg:w-[320px] snap-start"
              >
                <div className="overflow-hidden hover:scale-105 transition-transform duration-200 rounded-lg cursor-pointer">
                  {/* Thumbnail - 9:16 (16 altura : 9 largura) */}
                  <div className="relative w-full aspect-[9/16] overflow-hidden bg-zeedo-black">
                    {/* Imagem - clicável, preenche 16:9 */}
                    {lesson.thumbnail && lesson.thumbnail !== '/zeedo-logo.png' ? (
                      <img 
                        src={lesson.thumbnail} 
                        alt={lesson.title}
                        className="absolute inset-0 w-full h-full object-cover"
                        onError={(e) => {
                          console.error('Erro ao carregar imagem:', lesson.thumbnail);
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-zeedo-orange/20 to-orange-600/20" />
                    )}
                    <div className="absolute inset-0 bg-zeedo-black/30 group-hover:bg-zeedo-black/10 transition-colors" />
                    
                    {/* Badge de Concluído */}
                    {lesson.completed && (
                      <div className="absolute top-2 right-2 bg-green-500 text-white text-xs font-semibold px-1.5 py-0.5 md:px-2 md:py-1 rounded-full flex items-center gap-1 z-10">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        <span className="hidden md:inline">Concluída</span>
                      </div>
                    )}
                    
                    {/* Duração */}
                    <div className="absolute bottom-2 right-2 bg-zeedo-black/80 text-white text-xs font-semibold px-1.5 py-0.5 md:px-2 md:py-1 rounded z-10">
                      {lesson.duration}
                    </div>
                    
                    {/* Número da Aula */}
                    <div className="absolute top-2 left-2 bg-zeedo-orange text-white text-xs font-bold px-1.5 py-0.5 md:px-2 md:py-1 rounded z-10">
                      Aula {lesson.order}
                    </div>
                  </div>
                
                  {/* Informações */}
                  <div className="p-2 md:p-4">
                    <h3 className="text-xs md:text-base font-semibold text-zeedo-black dark:text-zeedo-white mb-1 md:mb-2 group-hover:text-zeedo-orange transition-colors line-clamp-1">
                      {lesson.title}
                    </h3>
                    <p className="hidden md:block text-sm text-zeedo-black/60 dark:text-zeedo-white/60 line-clamp-2">
                      {lesson.description}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Seta Direita - apenas desktop e quando pode scrollar */}
          {canScrollRight && (
            <button
              onClick={() => {
                const container = document.getElementById('lessons-scroll');
                if (container) {
                  container.scrollBy({ left: 400, behavior: 'smooth' });
                  setTimeout(checkScroll, 300);
                }
              }}
              className="hidden md:flex shrink-0 z-10 text-zeedo-orange hover:text-orange-600 transition-colors"
            >
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
              </svg>
            </button>
          )}
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
