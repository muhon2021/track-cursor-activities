-- Add unique constraint to meeting_files for upsert operations
ALTER TABLE meeting_files 
ADD CONSTRAINT meeting_files_external_meeting_id_file_type_key 
UNIQUE (external_meeting_id, file_type);