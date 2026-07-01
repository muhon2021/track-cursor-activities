-- Set a default chat model (GPT-4o mini is cheapest/fastest)
UPDATE ai_models SET is_default = true WHERE id = '25b7d4ba-06a3-4ead-9229-0ec15b7fa0ba';