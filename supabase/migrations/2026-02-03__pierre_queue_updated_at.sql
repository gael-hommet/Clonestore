-- Fix: pierre_queue trigger expects updated_at
ALTER TABLE public.pierre_queue
ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Backfill (safety)
UPDATE public.pierre_queue
SET updated_at = now()
WHERE updated_at IS NULL;
