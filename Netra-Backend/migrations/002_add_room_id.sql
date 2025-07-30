-- Add room_id column to streams table (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'streams' AND column_name = 'room_id'
    ) THEN
        ALTER TABLE streams ADD COLUMN room_id TEXT;
    END IF;
END $$; 