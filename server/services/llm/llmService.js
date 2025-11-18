import { GoogleGenAI } from '@google/genai';
import { getInstruction } from '../../config/llmSystemInstructions.js';

const ai = new GoogleGenAI({});
const model = "gemini-2.5-flash";

export async function generateContent(prompt, systemInstruction='') {
    const config = {
        systemInstruction: systemInstruction,
    };

    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: config,
        });

        return response.text;
    } catch (error) {
        console.error("LLM API Error:", error);
        throw new Error("Failed to reach LLM API.");
    }
}

export async function generateContentRouteHandler(req, res){
    const { prompt, key } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: 'No prompt supplied' });
    }

    const llmConfig = getInstruction(key);
    let systemInstruction = '';
    let parser = null;

    if (llmConfig) {
        systemInstruction = llmConfig.systemInstruction || '';
        if (llmConfig.parser) {
            parser = await import(`./${llmConfig.parser}.js`);
        }
    }


    try {
        let llmResponse = await generateContent(prompt, systemInstruction);

        console.log(llmResponse)

        if (parser && parser.parse) {
            console.log("QUIZ_CREATION: Calling parser")
            llmResponse = parser.parse(llmResponse);
        }

        res.json({ response: llmResponse });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({
            error: "Error processing LLM request."
        });
    }
}
