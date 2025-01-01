import OpenAI from "openai";
import * as dotenv from "dotenv";
dotenv.config();

export const openai = new OpenAI({
  apiKey:process.env.OPENAI_API_KEY,
});

export const completion = openai.chat.completions.create({
  model: "gpt-4o-mini",
  store: true,
  messages: [
    {"role": "user", "content": "write a haiku about ai"},
  ],
});
