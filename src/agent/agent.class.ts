import OpenAI from "openai";
import dotenv from 'dotenv';

dotenv.config();

export default class Agent {
    model: any;

    constructor() {
        this.model = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });
    }

    public async generateDynamicQuestion(prompt: string): Promise<string> {
        try {
            const response = await this.model.chat.completions.create({
                model: "gpt-3.5-turbo-0125",
                store: true,
                messages: [
                    { role: "system", content: "You are a helpful assistant helping a user through a registration process. Provide questions to help the user register." },
                    { role: "user", content: prompt },
                ],
                max_tokens: 100
            });
            return response.choices[0].message['content'];
        } catch (error) {
            console.error("Error generating dynamic question:", error);
            return "Could you please provide the information requested?";
        }
    }

    public async validateUserResponse(prompt: string, response: string): Promise<boolean> {
        try {
            const validationPrompt = `Assess whether the user's response fulfills the main request in the prompt, regardless of additional conversational elements. A valid response must provide the requested information explicitly or implicitly.
    
    Prompt: ${prompt}
    
    Response: ${response}
    
    Reply with 'true' if the user's response satisfies the intent of the prompt, even if it's conversational or includes extra context. Reply with 'false' otherwise.`;
    
            const validationResponse = await this.model.chat.completions.create({
                model: "gpt-3.5-turbo-0125",
                messages: [
                    { role: "system", content: "You are an evaluator that determines whether a user's response satisfies the intent of a given prompt, while allowing for conversational elements and indirect phrasing." },
                    { role: "user", content: validationPrompt },
                ],
                max_tokens: 10
            });
    
            const result = validationResponse.choices[0].message['content'].trim();
    
            // Convert the response to a boolean value
            return result.toLowerCase() === 'true';
        } catch (error) {
            console.error("Error validating user response:", error);
            return false; // Default to false if validation fails
        }
    }
    

    public async extractAnswer(prompt: string, response: string, dataType: string): Promise<any> {
        try {
            const extractionPrompt = `Extract the answer from the user's response based on the following prompt and return it as a ${dataType}.

Prompt: ${prompt}

Response: ${response}

Only provide the extracted value.`;

            const extractionResponse = await this.model.chat.completions.create({
                model: "gpt-3.5-turbo-0125",
                messages: [
                    { role: "system", content: "You are an assistant that extracts specific answers from user responses based on a given prompt." },
                    { role: "user", content: extractionPrompt },
                ],
                max_tokens: 50
            });

            const extractedAnswer = extractionResponse.choices[0].message['content'].trim();

            // Parse the extracted answer based on the expected data type
            switch (dataType.toLowerCase()) {
                case 'number':
                    return parseFloat(extractedAnswer);
                case 'boolean':
                    return extractedAnswer.toLowerCase() === 'true';
                case 'json':
                    return JSON.parse(extractedAnswer);
                default:
                    return extractedAnswer; // Default to string
            }
        } catch (error) {
            console.error("Error extracting answer:", error);
            return null; // Return null if extraction fails
        }
    }
}
