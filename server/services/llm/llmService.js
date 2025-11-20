import { GoogleGenAI } from '@google/genai';
import { getInstruction } from '../../config/llmSystemInstructions.js';

const ai = new GoogleGenAI({});
const model = "gemini-2.5-flash";

export async function generateContent(prompt, systemInstruction='', uploadedFile=null) {
    const config = {
        systemInstruction: systemInstruction,
    };

    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: uploadedFile ? [{ fileData: { mimeType: uploadedFile.mimeType, fileUri: uploadedFile.uri } }, { text: prompt }] : { text : prompt },
            config: config,
        });

        return response.text;
    } catch (error) {
        console.error("LLM API Error:", error);
        throw new Error("Failed to reach LLM API.");
    }
}

export async function generateContentRouteHandler(req, res){
    const { prompt, key, id } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: 'No prompt supplied' });
    }

    const llmConfig = getInstruction(key);
    let systemInstruction = '';
    let parser = null;
    let contentProvider = null;
    let uploaded = null;

    if (llmConfig) {
        systemInstruction = llmConfig.systemInstruction || '';
        if (llmConfig.parser) {
            parser = await import(`./parsers/${llmConfig.parser}.js`);
        }

        if (llmConfig.contentProvider) {
            contentProvider = await import(`./contentProviders/${llmConfig.contentProvider}.js`);
        }
    }


    try {
        if (contentProvider && contentProvider.getContent) {
            console.log(`${key}: Calling content provider`);
            const { filepath, mimeType } = await contentProvider.getContent(id);
            console.log(`File ${filepath} fetched`)

            try {
                uploaded = await ai.files.upload({
                    file: filepath,
                    config: { mimeType: mimeType }
                });
            } catch (error){
                console.log(`File upload error: ${error}`);
            }
        }

        let llmResponse = await generateContent(prompt, systemInstruction, uploaded);

        console.log(llmResponse)

        if (parser && parser.parse) {
            console.log(`${key}: Calling parser`);
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
