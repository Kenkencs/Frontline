// OpenAI requires an object at the root. Nest the union, then unwrap it on the server.
// Sources are empty until the Knowledge Agent can provide verified documents.
const sources = {
  type: "array",
  maxItems: 0,
  items: {
    type: "object",
    properties: {
      id: { type: "string" },
      title: { type: "string" },
      version: { type: "string" },
      section: { type: "string" },
      excerpt: { type: "string" },
    },
    required: ["id", "title", "version", "section", "excerpt"],
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
            confidence: { type: "string", enum: ["low"] },
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
