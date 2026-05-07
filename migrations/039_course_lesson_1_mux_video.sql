-- Aula 1: primeiro vídeo (Mux playback ID em `video_url`; player em /dashboard/curso/[id])
UPDATE course_lessons
SET
  title = 'Introdução',
  description = 'Introdução ao Zeedo, apresentação das abas Dashboard e Trades e todos os detalhes que você precisa saber antes de começar.',
  video_url = 'yMJ02LjlQq8VfvJ8XP401UqMc02ATLTkQ9Nub9J489rCHk',
  duration = '9:01',
  thumbnail = '/curso/aula-1.jpg'
WHERE lesson_order = 1;

INSERT INTO course_lessons (title, description, video_url, duration, thumbnail, lesson_order)
SELECT
  'Introdução',
  'Introdução ao Zeedo, apresentação das abas Dashboard e Trades e todos os detalhes que você precisa saber antes de começar.',
  'yMJ02LjlQq8VfvJ8XP401UqMc02ATLTkQ9Nub9J489rCHk',
  '9:01',
  '/curso/aula-1.jpg',
  1
WHERE NOT EXISTS (SELECT 1 FROM course_lessons WHERE lesson_order = 1);
