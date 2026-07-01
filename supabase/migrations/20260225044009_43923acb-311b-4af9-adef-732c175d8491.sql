
-- Reassign tasks to IC user
UPDATE tasks SET assigned_to = 'd2cdb3a0-fd4b-4e05-8fd9-a3135a9f1d39' WHERE id IN (
  '616f770d-adbd-4d91-aee8-40829463537d',
  'bbfa70c6-1621-44ad-9b5e-4faf1ecf05e5',
  '5c72dc63-7668-4af7-a64b-9abd73692dc1',
  'ed8f7f79-db1f-4999-b812-8d13ce628617',
  'fa9982cd-804c-4826-93fe-c93f5695cb15',
  '0db6565f-a9f7-44bc-99f3-237bdf7b354e'
);

-- Reassign tasks to PM/demo user
UPDATE tasks SET assigned_to = 'e46a6d4e-d69e-4bf5-9341-ba998e8da243' WHERE id IN (
  '8cfd6ea6-1227-42a9-94ca-44c4f7b9ca7d',
  'bc075ebb-f1b6-413c-8c4d-db0030e0603a',
  '2cbdc06b-dcb7-427d-914c-ad533fa04905',
  '9cd857a6-041c-402e-be0b-c521c59d7dc2'
);

-- Reassign tasks to CEO user
UPDATE tasks SET assigned_to = 'c4642966-5969-4d55-b3a6-ce850c1e2786' WHERE id IN (
  '602a5bbb-359a-4dba-9f79-ea6f5b71be5a',
  'dad3e2f3-8e11-4a27-83d1-78e2320758f1'
);
