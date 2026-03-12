const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
    return new Response(null, { headers: corsHeaders });
}

export async function GET() {
    try {
        const groqRes = await fetch('https://api.groq.com/openai/v1/models', {
            headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` }
        }).then(r => r.json()).catch(() => ({ data: [] }));

        const googleRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GOOGLE_GENERATIVE_AI_API_KEY}`)
            .then(r => r.json()).catch(() => ({ models: [] }));

        const models = [];

        // Add Groq models
        if (groqRes && groqRes.data) {
            groqRes.data.forEach((m: any) => {
                const id = m.id.toLowerCase();
                if (!id.includes('whisper')) {
                    models.push({
                        id: `groq:${m.id}`,
                        name: m.id,
                        provider: 'Groq'
                    });
                }
            });
        }

        // Add Google models
        if (googleRes && googleRes.models) {
            googleRes.models.forEach((m: any) => {
                if (m.name.includes('gemini') && m.supportedGenerationMethods?.includes('generateContent')) {
                    const cleanName = m.name.replace('models/', '');
                    models.push({
                        id: `google:${cleanName}`,
                        name: m.displayName || cleanName,
                        provider: 'Google'
                    });
                }
            });
        }

        if (models.length === 0) {
            models.push(
                { id: 'google:gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash Exp', provider: 'Google' },
                { id: 'google:gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: 'Google' },
                { id: 'groq:llama-3.3-70b-versatile', name: 'LLaMA 3.3 70B', provider: 'Groq' }
            );
        }

        return Response.json({ models }, { headers: corsHeaders });
    } catch (error) {
        return Response.json({
            error: 'Failed to fetch models', 
            models: [
                { id: 'google:gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash Exp', provider: 'Google' },
                { id: 'groq:llama-3.3-70b-versatile', name: 'LLaMA 3.3 70B', provider: 'Groq' }
            ]
        }, { headers: corsHeaders });
    }
}
