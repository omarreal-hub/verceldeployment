import { notion, DATABASE_IDS } from './_lib/notion.js';
import { extractNoteWithAI } from './_lib/ai.js';
import { z } from 'zod';

const NoteSchema = z.object({
    message: z.object({
        text: z.string().min(1)
    })
});

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Standard IDs from n8n logic
const PROFILE_ID = "21ff2317-55ae-8094-82ca-f82390f77977";
const NOTES_DB_ID = "207f2317-55ae-8169-b1ba-fbdce796789a";

export async function OPTIONS() {
    return new Response(null, { headers: corsHeaders });
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { message } = NoteSchema.parse(body);

        // 1. AI Extract Details
        const extraction = await extractNoteWithAI(message.text);

        // 2. Fetch Zones for relation mapping
        const zonesResponse = await notion.databases.query({ database_id: DATABASE_IDS.ZONES });
        const matchedZone = zonesResponse.results.find((p: any) => {
            const name = p.properties['Name']?.title?.[0]?.plain_text?.toLowerCase();
            return name && name.includes(extraction.zone.toLowerCase());
        });

        // 3. Create Note Page
        const response = await notion.pages.create({
            parent: { database_id: NOTES_DB_ID },
            properties: {
                'Name': { title: [{ text: { content: extraction.title } }] },
                'Status': { status: { name: 'Inbox' } },
                'Type': { select: { name: extraction.type } },
                'URL': { url: extraction.url },
                'Profile': { relation: [{ id: PROFILE_ID }] },
                ...(matchedZone ? { 'Zones': { relation: [{ id: matchedZone.id }] } } : {})
            },
            children: [
                {
                    object: 'block',
                    type: 'paragraph',
                    paragraph: {
                        rich_text: [{ text: { content: extraction.summary } }]
                    }
                }
            ]
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
