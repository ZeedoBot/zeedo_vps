-- Aula 0: boas-vindas e preparação (capa estática em /curso/aula-0.jpg no frontend)
INSERT INTO course_lessons (title, description, video_url, duration, thumbnail, lesson_order)
SELECT
  'Bem vindo | Preparação',
  'Boas-vindas ao curso e o que você precisa para acompanhar as aulas com tranquilidade.',
  '',
  '—',
  '/curso/aula-0.jpg',
  0
WHERE NOT EXISTS (SELECT 1 FROM course_lessons WHERE lesson_order = 0);
