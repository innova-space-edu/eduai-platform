CREATE TABLE IF NOT EXISTS spaced_repetition (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  easiness FLOAT DEFAULT 2.5,
  interval INTEGER DEFAULT 1,
  repetitions INTEGER DEFAULT 0,
  next_review DATE DEFAULT CURRENT_DATE,
  last_score INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, topic)
);

ALTER TABLE spaced_repetition ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own repetitions" ON spaced_repetition
  FOR ALL USING (auth.uid() = user_id);
