import { notion, DATABASE_IDS, getZones } from './_lib/notion.js';
import { extractNoteWithAI } from './_lib/ai.js';
import { z } from 'zod';

const RequestSchema = z.object({
    text: z.string().optional(),
    message: z.object({
        text: z.string()
    }).optional()
});

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const NOTES_DB_ID = DATABASE_IDS.NOTES;
const PROFILE_ID = DATABASE_IDS.PROFILE;

export async function OPTIONS() {
    return new Response(null, { headers: corsHeaders });
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { text, message } = RequestSchema.parse(body);
        const finalContent = text || message?.text;

        if (!finalContent) {
            return Response.json({ error: 'No content provided' }, { status: 400, headers: corsHeaders });
        }

        // 1. Fetch dynamic zones
        const zones = await getZones();

        // 2. AI Extraction
        console.log('[Add Note] Extracting information with AI...');
        const extraction = await extractNoteWithAI(finalContent);
        console.log('[Add Note] AI Extraction complete:', extraction.title);

        // Dynamic Zone matching
        const matchedZone = zones.find(z => 
            z.name.toLowerCase().includes(extraction.zone_name.toLowerCase())
        ) || zones[0];

        // 3. Create Notion Page
        console.log('[Add Note] Creating Notion page in DB:', NOTES_DB_ID);
        const response = await notion.pages.create({
            parent: { database_id: NOTES_DB_ID },
            properties: {
                'Name': {
                    title: [{ text: { content: extraction.title } }]
                },
                'Status': {
                    status: { name: 'Inbox' }
                },
                'Type': {
                    select: { name: extraction.type } // 'Capture' or 'Resource' (Capitalized in AI schema)
                },
                'Zones': {
                    relation: [{ id: matchedZone.id }]
                },
                'Profile': {
                    relation: [{ id: PROFILE_ID }]
                },
                'URL': {
                    url: extraction.url
                },
                'Created Date': {
                    date: { start: new Date().toISOString().split('T')[0] }
                }
            },
            icon: {
                type: 'emoji',
                emoji: '📒'
            }
        });

        console.log('[Add Note] Success! Page ID:', response.id);
        return Response.json({ success: true, id: response.id, extraction }, { headers: corsHeaders });

    } catch (err: any) {
        console.error('[Add Note Error]', err);
        return Response.json({ error: err.message || String(err) }, {
            status: 500,
            headers: corsHeaders
        });
    }
}
