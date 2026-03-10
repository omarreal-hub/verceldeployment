import { notion, DATABASE_IDS } from './_lib/notion.js';
import { extractNoteWithAI } from './_lib/ai.js';
import { z } from 'zod';

const RequestSchema = z.object({
    text: z.string().optional(), // Support both formats for flexibility
    message: z.object({
        text: z.string()
    }).optional()
});

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Standard IDs derived from notion lib
const PROFILE_ID = DATABASE_IDS.PROFILE;
const NOTES_DB_ID = DATABASE_IDS.NOTES;

const ZONE_MAP: Record<string, string> = {
    "Health": "207f231755ae81c7a048e73601f43cfc",
    "Education": "207f231755ae81c5a484c15581617ba1",
    "Finances": "207f231755ae818e9e4eca4eb85f9607",
    "Business": "207f231755ae81a5ae25f16db12897dc",
    "Personal": "207f231755ae8151bec9f62c26516e41",
    "Other": "207f231755ae81d5b00ce7acd2671833"
};

export async function OPTIONS() {
    return new Response(null, { headers: corsHeaders });
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const parsed = RequestSchema.parse(body);
        const text = parsed.text || parsed.message?.text;

        if (!text) {
            return Response.json({ success: false, error: 'Text is required' }, { status: 400, headers: corsHeaders });
        }

        // 1. AI Extract Details
        const extraction = await extractNoteWithAI(text);

        // 2. Map Zone to Page ID
        const zonePageId = ZONE_MAP[extraction.zone] || ZONE_MAP["Other"];

        // 3. Create Note Page
        const response = await notion.pages.create({
            parent: { database_id: NOTES_DB_ID },
            properties: {
                'Name': { title: [{ text: { content: extraction.title } }] },
                'Status': { status: { name: 'Inbox' } },
                'Type': { select: { name: extraction.type.charAt(0).toUpperCase() + extraction.type.slice(1) } },
                'Zones': { relation: [{ id: zonePageId }] },
                'Profile': { relation: [{ id: PROFILE_ID }] },
                ...(extraction.url ? { 'URL': { url: extraction.url } } : {}),
                'Created Date': { date: { start: new Date().toISOString().split('T')[0] } }
            },
            children: [
                {
                    object: 'block',
                    type: 'paragraph',
                    paragraph: {
                        rich_text: [{ text: { content: extraction.summary } }]
                    }
                }
            ],
            icon: { type: 'emoji', emoji: extraction.type === 'resource' ? '🔗' : '📝' }
        });

        return Response.json({
            success: true,
            id: response.id,
            extraction
        }, { headers: corsHeaders });

    } catch (err: any) {
        console.error('[Add Note Error]', err);
        return Response.json({ error: err.message || String(err) }, {
            status: 500,
            headers: corsHeaders
        });
    }
}
