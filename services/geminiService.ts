
import { GoogleGenAI, Type } from "@google/genai";

// Ensure the API key is available
const apiKey = process.env.API_KEY;
if (!apiKey) {
  console.error("API_KEY is missing via process.env.API_KEY");
}

const ai = new GoogleGenAI({ apiKey: apiKey || "" });

// Helper to convert file to base64
const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            // Remove the data URL prefix (e.g., "data:image/png;base64,")
            const base64 = result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// 1. General Chat with Search Grounding (for accuracy)
export const sendMarketChatMessage = async (
  history: { role: string; parts: { text: string }[] }[],
  message: string
) => {
  try {
    const chat = ai.chats.create({
      model: "gemini-2.5-flash",
      config: {
        systemInstruction: `You are StockSage, a senior Indian Stock Market Analyst (SEBI Registered style persona).
        
        CRITICAL RULES FOR ACCURACY:
        1. **Identity**: You analyze the NSE/BSE, Nifty 50, and Bank Nifty.
        2. **Language**: Use natural "Hinglish" (Mix of Hindi & English) to be friendly and clear, OR English if the user prefers.
        3. **Data Source**: You **MUST** use the 'googleSearch' tool for EVERY query about prices, news, or trends. DO NOT guess prices.
        4. **Off-Topic**: If the user asks about anything NOT related to money, finance, or stocks (e.g., "Tell me a joke", "Capital of France"), politely refuse: "Main bas Stock Market aur Finance ke baare mein baat kar sakta hoon."
        
        RESPONSE FORMAT:
        - **Direct Answer**: Give the price/trend immediately.
        - **Analysis**: Why is it moving? (Short reason).
        - **Target/StopLoss**: If asked for levels, give technical support/resistance.
        - **Chart Data**: If the user asks for a chart/trend/performance, ALWAYS generate JSON at the end.
        
        JSON CHART FORMAT (Strict):
        \`\`\`json
        [
          {"date": "2024-01-01", "value": 1200.50},
          {"date": "2024-01-02", "value": 1215.00}
        ]
        \`\`\`
        `,
        tools: [{ googleSearch: {} }],
      },
      history: history,
    });

    const response = await chat.sendMessage({ message });
    
    // Extract text
    const text = response.text || "Market data currently unavailable. Please check connection.";
    
    // Extract grounding metadata (sources) with titles
    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map(
      (chunk: any) => ({
          uri: chunk.web?.uri,
          title: chunk.web?.title || new URL(chunk.web?.uri).hostname.replace('www.', '')
      })
    ).filter((s: any) => s.uri) || [];

    return { text, sources };
  } catch (error) {
    console.error("Chat Error:", error);
    return { text: "Server connection issue. Please try again.", sources: [] };
  }
};

// 2. Deep Analysis with Thinking Config
export const getDeepAnalysis = async (prompt: string) => {
  try {
    // Wrap the user query to enforce the persona and depth
    const enhancedPrompt = `
    ROLE: You are a Senior Hedge Fund Manager for the Indian Market.
    USER QUERY: "${prompt}"
    
    INSTRUCTIONS:
    - If the user asks in Hindi/Hinglish, reply in Hinglish.
    - Focus strictly on Financial/Economic impact.
    - Provide a "Buy", "Sell", or "Hold" perspective based on data.
    - Analyze: Technicals (RSI, Moving Averages), Fundamentals (P/E, Earnings), and Sentiment.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview", // Using Pro for complex reasoning
      contents: enhancedPrompt,
      config: {
        thinkingConfig: { thinkingBudget: 4096 }, // Enable thinking for depth
        tools: [{ googleSearch: {} }], // Search for live facts to ground the thinking
      },
    });
    return response.text;
  } catch (error) {
    console.error("Deep Analysis Error:", error);
    throw error;
  }
};

// 3. Visual Analysis (Pure Graph Data)
export const getGraphData = async (symbol: string, period: string = '1M') => {
  try {
    let durationText = "last 30 days";
    let frequencyText = "daily";

    // Adjust prompt based on period to manage data density and relevance
    switch(period) {
        case '1W': 
            durationText = "last 7 days"; 
            frequencyText = "daily";
            break;
        case '1M': 
            durationText = "last 30 days"; 
            frequencyText = "daily";
            break;
        case '3M': 
            durationText = "last 3 months"; 
            frequencyText = "weekly";
            break;
        case '6M': 
            durationText = "last 6 months"; 
            frequencyText = "weekly";
            break;
        case '1Y': 
            durationText = "last 1 year"; 
            frequencyText = "monthly";
            break;
        default: 
            durationText = "last 30 days";
            frequencyText = "daily";
    }

    // Optimized prompt for speed and format strictness
    const prompt = `Return a JSON array of ${frequencyText} closing prices for ${symbol} for the ${durationText}.
    FORMAT: \`\`\`json [{"date": "YYYY-MM-DD", "value": 123.45}] \`\`\`
    NO TEXT. JUST JSON. Use Google Search for data.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });
    
    const text = response.text || "";
    
    // Manual extraction of JSON block
    const jsonMatch = text.match(/```json\s*(\[\s*\{[\s\S]*?\}\s*\])\s*```/) || text.match(/(\[\s*\{[\s\S]*?\}\s*\])/);
    
    if (jsonMatch && jsonMatch[1]) {
        return JSON.parse(jsonMatch[1]);
    }
    
    // Fallback: try to parse the whole text if it looks like JSON
    try {
        return JSON.parse(text);
    } catch {
        console.warn("Could not parse JSON from Visual Analysis response:", text);
        return [];
    }
  } catch (error) {
    console.error("Graph Data Error:", error);
    return [];
  }
};

// 4. Veo Video Generation
export const generateMarketVideo = async (prompt: string) => {
    // Check for API Key selection (Required for Veo)
    if (window.aistudio && !await window.aistudio.hasSelectedApiKey()) {
        throw new Error("API_KEY_SELECTION_REQUIRED");
    }

    // Re-initialize to ensure we have the user-selected key
    const veoAi = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    let operation = await veoAi.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt: prompt,
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: '16:9'
      }
    });

    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      operation = await veoAi.operations.getVideosOperation({operation: operation});
    }

    const uri = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!uri) throw new Error("No video generated");
    
    // Fetch the actual bytes
    const vidResponse = await fetch(`${uri}&key=${process.env.API_KEY}`);
    const blob = await vidResponse.blob();
    return URL.createObjectURL(blob);
};

// 5. Multimodal Analysis (Image/Video)
export const analyzeUploadedFile = async (file: File, prompt: string) => {
    try {
        const base64Data = await fileToBase64(file);
        const mimeType = file.type;
        
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash", // Flash is good for multimodal
            contents: {
                parts: [
                    { inlineData: { mimeType, data: base64Data } },
                    { text: prompt }
                ]
            }
        });
        return response.text;
    } catch (error) {
        console.error("Multimodal Error", error);
        return "Failed to analyze the file.";
    }
}

// 6. Specialized Advance Screen Analysis
export const analyzeFinancialScreenshot = async (file: File) => {
    try {
        const base64Data = await fileToBase64(file);
        const mimeType = file.type;
        
        const prompt = `You are a Senior Technical Analyst for the Stock Market. 
        Analyze this chart/screenshot in detail.
        
        CRITICAL: RETURN ONLY JSON. DO NOT RETURN PLAIN TEXT.
        
        JSON Structure:
        {
          "symbol": "Detected Symbol Name",
          "trend": "Bullish / Bearish / Sideways",
          "summary": "Brief 2-line summary of what the chart shows.",
          "technical_table": [
            { "parameter": "RSI", "value": "65", "signal": "Neutral/Bullish" },
            { "parameter": "Support", "value": "21,500", "signal": "Strong Support" },
            { "parameter": "Resistance", "value": "22,000", "signal": "Key Hurdle" },
            { "parameter": "MACD", "value": "Positive Crossover", "signal": "Buy" }
          ],
          "trade_setup": {
            "action": "BUY / SELL / WAIT",
            "entry": "Above 21,800",
            "stop_loss": "Below 21,450",
            "target": "22,250"
          }
        }
        
        If you cannot detect a financial chart, return {"error": "No chart detected"}.`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash", 
            contents: {
                parts: [
                    { inlineData: { mimeType, data: base64Data } },
                    { text: prompt }
                ]
            }
        });
        
        const text = response.text || "{}";
        const jsonMatch = text.match(/```json\s*(\{[\s\S]*?\})\s*```/) || text.match(/(\{[\s\S]*?\})/);
        if (jsonMatch && jsonMatch[1]) {
            return jsonMatch[1]; // Return JSON string
        }
        return text; // Fallback to text if JSON parsing fails
    } catch (error) {
        console.error("Screen Analysis Error", error);
        return JSON.stringify({ error: "Failed to analyze screen. Please try again." });
    }
}

// 7. Stock Screener with Grounding
export const runStockScreener = async (criteria: { sector: string, marketCap: string, peRatio: string, volume: string }) => {
    try {
        const prompt = `Use Google Search to find 5-10 stocks that match the following specific criteria:
        
        - Sector: ${criteria.sector}
        - Market Cap: ${criteria.marketCap}
        - P/E Ratio: ${criteria.peRatio}
        - Volume: ${criteria.volume}
        
        CRITICAL OUTPUT FORMAT:
        Return ONLY a JSON array inside a code block.
        Each object must have: "symbol", "name", "price" (number), "peRatio" (number or "N/A"), "marketCap" (string), "volume" (string).
        
        Example:
        \`\`\`json
        [
            {"symbol": "TCS", "name": "Tata Consultancy Services", "price": 3500.00, "peRatio": 29.5, "marketCap": "12.5T", "volume": "2M"}
        ]
        \`\`\`
        `;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
            },
        });

        const text = response.text || "";
        const jsonMatch = text.match(/```json\s*(\[\s*\{[\s\S]*?\}\s*\])\s*```/) || text.match(/(\[\s*\{[\s\S]*?\}\s*\])/);
        
        if (jsonMatch && jsonMatch[1]) {
            return JSON.parse(jsonMatch[1]);
        }
        
        // Try parsing raw text if clean
        return JSON.parse(text);
    } catch (error) {
        console.error("Screener Error:", error);
        return [];
    }
}
