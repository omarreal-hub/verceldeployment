import { Client } from '@notionhq/client';

if (!process.env.NOTION_API_KEY) {
  throw new Error('NOTION_API_KEY is not defined in environment variables');
}

export const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

export const DATABASE_IDS = {
  ZONES: '207f2317-55ae-8137-a815-d5e30b51abf8',
  PROJECTS: '207f2317-55ae-8135-abf8-ea6150021c30',
  TASKS: '207f2317-55ae-8141-9dba-c847715bc9e1',
  HABITS: '207f2317-55ae-8147-8067-ecc96da80dbe',
  SHOP: '207f2317-55ae-815d-87ac-cd9367487ec1',
  NOTES: '207f2317-55ae-8169-b1ba-fbdce796789a',
  PROJECT_NOTES: '207f2317-55ae-81ef-8b75-ebbc49298cee',
  PROFILE: '207f2317-55ae-8153-9da3-ce5cfe4dd0c8'
};

/**
 * Retrieves all zones from the ZONES database for dynamic replacement
 */
export async function getZones() {
  try {
    const response = await notion.databases.query({
      database_id: DATABASE_IDS.ZONES,
    });
    return response.results.map((page: any) => ({
      id: page.id,
      name: page.properties['Name']?.title?.[0]?.plain_text || 'Unknown'
    }));
  } catch (error) {
    console.error('Error fetching zones:', error);
    return [];
  }
}
