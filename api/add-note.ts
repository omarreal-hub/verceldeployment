import { VercelRequest, VercelResponse } from '@vercel/node';
import { notion, DATABASE_IDS, getZones } from './_lib/notion';
import { extractNoteWithAI } from './_lib/ai';
import { normalizeUrgency } from './_lib/utils';
import { z } from 'zod';

const RequestSchema = z.object({
    text: z.string().optional(),
    prompt: z.string().optional(),
    message: z.object({
        text: z.string()
    }).optional(),
    modelId: z.string().optional(),
    primaryModelId: z.string().optional(),
    fallbackModelId: z.string().optional()
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    try {
        const body = RequestSchema.parse(req.body);
        const text = body.prompt || body.text || body.message?.text;

        if (!text) {
            return res.status(400).json({ error: 'No text provided' });
        }

        // 1. AI Extraction (n8n Logic)
        const extracted = await extractNoteWithAI(
            text,
            body.modelId,
            body.primaryModelId,
            body.fallbackModelId
        );

        // 2. Zone Mapping (n8n Map)
        const zones = await getZones();
        const formattedZone = extracted.zone.charAt(0).toUpperCase() + extracted.zone.slice(1);
        const matchedZone = zones.find(z => z.name === formattedZone) || 
                          zones.find(z => z.name === 'Other');

        // 3. Create Notion Page (n8n Mapping)
        const response = await notion.pages.create({
            parent: { database_id: DATABASE_IDS.NOTES },
            icon: {
                type: 'emoji',
                emoji: '📒'
            },
            properties: {
                'Name': {
                    title: [{ text: { content: extracted.title } }]
                },
                'Type': {
                    select: { name: extracted.type.charAt(0).toUpperCase() + extracted.type.slice(1) }
                },
                'Zones': {
                    relation: matchedZone ? [{ id: matchedZone.id }] : []
                },
                'URL': {
                    url: extracted.url || null
                },
                'Created Date': {
                    date: { start: new Date().toISOString().split('T')[0] }
                },
                'Profile': {
                    relation: [{ id: DATABASE_IDS.PROFILE }]
                },
                'Status': {
                    status: { name: 'Inbox' }
                }
            },
            children: [
                {
                    object: 'block',
                    type: 'paragraph',
                    paragraph: {
                        rich_text: [{ text: { content: extracted.summary } }]
                    }
                }
            ]
        });

        return res.status(200).json({ success: true, pageId: response.id, extracted });
    } catch (error: any) {
        console.error('Error adding note:', error);
        return res.status(500).json({ error: error.message });
    }
}
