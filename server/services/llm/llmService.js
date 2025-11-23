import { GoogleGenAI } from '@google/genai';
import { getInstruction } from '../../config/llmSystemInstructions.mjs';

const ai = new GoogleGenAI({});
const model = process.env.GEMINI_LLM_NAME;

export async function generateContent(prompt, systemInstruction='', uploadedFiles=[]) {
    const config = {
        systemInstruction: systemInstruction,
    };

    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: uploadedFiles.length > 0 ? [...uploadedFiles.map(file => ({ fileData: { mimeType: file.mimeType, fileUri: file.uri } })), { text: prompt }] : { text : prompt },
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
    let uploadedFiles = [];

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
            const filesToUpload = await contentProvider.getContent(id);
            console.log(`Found ${filesToUpload.length} files from content provider.`);

            for (const file of filesToUpload) {
                console.log(`Attempting to upload file: ${file.filepath}`);
                try {
                    const uploaded = await ai.files.upload({
                        file: file.filepath,
                        config: { mimeType: file.mimeType }
                    });
                    uploadedFiles.push(uploaded);
                    console.log(`File ${file.filepath} uploaded successfully.`);
                } catch (error) {
                    console.log(`File upload error for ${file.filepath}: ${error}`);
                }
            }
        }

        let llmResponse = await generateContent(prompt, systemInstruction, uploadedFiles);

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
     } finally {
        // Delete uploaded files after the request is processed, regardless of success or failure
        for (const uploadedFile of uploadedFiles) {
            try {
                console.log(`Attempting to delete uploaded file: ${uploadedFile.name}`);
                await ai.files.delete(uploadedFile.name);
                console.log(`Successfully deleted file: ${uploadedFile.name}`);
            } catch (deleteError) {
                console.error(`Error deleting uploaded file ${uploadedFile.name}:`, deleteError);
            }
        }
     }
}
