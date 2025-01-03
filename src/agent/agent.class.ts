import OpenAI from "openai";
import dotenv from 'dotenv';

dotenv.config();
export default class Agent {
    model: any;

    constructor() {
        this.model = new OpenAI({
            apiKey:process.env.OPENAI_API_KEY,
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
}