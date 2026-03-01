-- Tabela de aulas do curso
CREATE TABLE IF NOT EXISTS course_lessons (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  video_url TEXT,
  duration TEXT,
  thumbnail TEXT,
  lesson_order INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de progresso do aluno
CREATE TABLE IF NOT EXISTS user_lesson_progress (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id INT NOT NULL REFERENCES course_lessons(id) ON DELETE CASCADE,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  last_watched_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, lesson_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_user_lesson_progress_user_id ON user_lesson_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_lesson_progress_lesson_id ON user_lesson_progress(lesson_id);
CREATE INDEX IF NOT EXISTS idx_course_lessons_order ON course_lessons(lesson_order);

-- RLS (Row Level Security)
ALTER TABLE course_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_lesson_progress ENABLE ROW LEVEL SECURITY;

-- Políticas para course_lessons (todos podem ler)
DROP POLICY IF EXISTS "Todos podem ver aulas" ON course_lessons;
CREATE POLICY "Todos podem ver aulas"
  ON course_lessons
  FOR SELECT
  TO authenticated
  USING (true);

-- Políticas para user_lesson_progress (usuário só vê seu próprio progresso)
DROP POLICY IF EXISTS "Usuários podem ver seu próprio progresso" ON user_lesson_progress;
CREATE POLICY "Usuários podem ver seu próprio progresso"
  ON user_lesson_progress
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuários podem inserir seu próprio progresso" ON user_lesson_progress;
CREATE POLICY "Usuários podem inserir seu próprio progresso"
  ON user_lesson_progress
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuários podem atualizar seu próprio progresso" ON user_lesson_progress;
CREATE POLICY "Usuários podem atualizar seu próprio progresso"
  ON user_lesson_progress
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Inserir as 7 aulas iniciais
INSERT INTO course_lessons (title, description, video_url, duration, thumbnail, lesson_order) VALUES
  ('Bem-vindo ao Zeedo', 'Introdução à plataforma e primeiros passos', '', '5:00', '/zeedo-logo.png', 1),
  ('Configurando sua Conta', 'Como conectar sua exchange e configurar o bot', '', '5:30', '/zeedo-logo.png', 2),
  ('Entendendo os Sinais', 'Como funcionam os sinais de trading e Fibonacci', '', '6:00', '/zeedo-logo.png', 3),
  ('Gerenciamento de Risco', 'Stop loss, alvos e gestão de capital', '', '5:45', '/zeedo-logo.png', 4),
  ('Configurações Avançadas', 'Personalizando alvos, stop e entrada 2', '', '4:30', '/zeedo-logo.png', 5),
  ('Análise de Resultados', 'Como interpretar suas estatísticas de trading', '', '5:15', '/zeedo-logo.png', 6),
  ('Melhores Práticas', 'Dicas para maximizar seus resultados', '', '4:45', '/zeedo-logo.png', 7)
ON CONFLICT DO NOTHING;
