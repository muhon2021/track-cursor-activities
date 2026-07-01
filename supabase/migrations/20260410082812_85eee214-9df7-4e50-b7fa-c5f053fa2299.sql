-- Add project_id column to tasks table for ActiveCollab sync
ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;

-- Add index for join performance
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON public.tasks(project_id);