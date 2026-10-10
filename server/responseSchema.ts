// OpenAI requires an object at the root. Nest the union, then unwrap it on the server.
// Sources are verified against the Knowledge Agent's current retrieval result.
const sources = {
  type: "array",
  maxItems: 4,
  items: {
    type: "object",
    properties: {
      id: { type: "string" },
      title: { type: "string" },
      version: { type: "string" },
      section: { type: "string" },
      excerpt: { type: "string" },
      sample: { type: "boolean" },
    },
    required: ["id", "title", "version", "section", "excerpt", "sample"],
    additionalProperties: false,
  },
};

export const chatOutputSchema = {
  type: "object",
  properties: {
    response: {
      anyOf: [
        {
          type: "object",
          properties: {
            type: { type: "string", enum: ["message"] },
            content: { type: "string" },
            sources,
          },
          required: ["type", "content", "sources"],
          additionalProperties: false,
        },
        {
          type: "object",
          properties: {
            type: { type: "string", enum: ["action"] },
            risk: { type: "string", enum: ["low", "medium", "high"] },
            summary: { type: "string" },
            actions: {
              type: "array",
              items: { type: "string" },
              minItems: 1,
              maxItems: 8,
            },
            sources,
            confidence: { type: "string", enum: ["low", "medium"] },
            escalate: { type: "boolean" },
          },
          required: [
            "type",
            "risk",
            "summary",
            "actions",
            "sources",
            "confidence",
            "escalate",
          ],
          additionalProperties: false,
        },
      ],
    },
  },
  required: ["response"],
  additionalProperties: false,
};
