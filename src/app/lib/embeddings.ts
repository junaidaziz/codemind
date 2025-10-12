import OpenAI from "openai";
import { env } from '../../types/env';

const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY
});

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const res = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: texts
  });
  return res.data.map(r => r.embedding);
}
