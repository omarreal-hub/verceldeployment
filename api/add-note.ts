import { extractNoteWithAI } from './_lib/ai.js';
import { notion, DATABASE_IDS } from './_lib/notion.js';
import { ZONE_MAP, PROFILE_ID, ICONS } from './_lib/constants.js';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
    return new Response(null, { headers: corsHeaders });
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const text = body.text || body.message?.text;
        const modelId = body.modelId || 'google:gemini-2.5-flash';

        if (!text) {
            return Response.json({ success: false, error: 'No text provided' }, { status: 400, headers: corsHeaders });
        }

        console.log(`[API] Extracting note from: "${text.substring(0, 50)}..."`);

        // 1. AI Extraction
        const note = await extractNoteWithAI(text, modelId);

        // 2. Map Zone
        const matchedZoneId = ZONE_MAP[note.zone as keyof typeof ZONE_MAP] || ZONE_MAP["Other"];

        // 3. Create Notion Page
        const response = await notion.pages.create({
            parent: { database_id: DATABASE_IDS.NOTES },
            icon: { emoji: ICONS.NOTE as any },
            properties: {
                'Name': { title: [{ text: { content: note.title } }] },
                'Type': { select: { name: note.type === 'resource' ? 'Resource' : 'Capture' } },
                'Status': { status: { name: 'Inbox' } },
                'URL': note.url ? { url: note.url } : undefined as any,
                'Zones': { relation: [{ id: matchedZoneId }] },
                'Profile': { relation: [{ id: PROFILE_ID }] }
            },
            children: [
                {
                    object: 'block',
                    type: 'paragraph',
                    paragraph: {
                        rich_text: [{ type: 'text', text: { content: note.summary } }]
                    }
                }
            ]
        });

        return Response.json({
            success: true,
            note_id: response.id,
            extracted: note
        }, { headers: corsHeaders });

    } catch (error: any) {
        console.error('[API ERROR]', error);
        return Response.json({
            success: false,
            error: error.message || 'Internal Server Error'
        }, { status: 500, headers: corsHeaders });
    }
}
