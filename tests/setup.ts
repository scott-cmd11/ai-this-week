import '@testing-library/jest-dom'

// Stub Notion env vars so lib/notion.ts can be imported in tests without real credentials
process.env.NOTION_TOKEN = process.env.NOTION_TOKEN ?? 'test-token'
process.env.NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID ?? 'test-database-id'
