// NLU Helper - Natural Language Understanding for extension requirements
class NLUHelper {
  constructor() {
    this.fieldTypePatterns = [
      { pattern: /text|string|varchar/i, type: 'string' },
      { pattern: /integer|int|number|count/i, type: 'integer' },
      { pattern: /decimal|float|money|price|amount/i, type: 'number' },
      { pattern: /boolean|bool|flag|toggle/i, type: 'boolean' },
      { pattern: /date|timestamp|datetime/i, type: 'string', format: 'date-time' },
      { pattern: /enum|select|choice|option/i, type: 'string', isEnum: true },
      { pattern: /array|list/i, type: 'array' },
    ];

    this.scopePatterns = [
      { pattern: /order header|order level|per order/i, scope: 'order_header' },
      { pattern: /order item|item level|line item|per item/i, scope: 'order_item' },
      { pattern: /customer|client/i, scope: 'customer' },
      { pattern: /product/i, scope: 'product' },
    ];
  }

  /**
   * Parse a natural language request into structured extension fields
   * Example: "Add Customer PO on order header, optional, max length 40"
   */
  parseRequest(text) {
    const parsed = {
      fieldName: null,
      scope: null,
      type: 'string',
      required: false,
      constraints: {},
      confidence: 0,
    };

    // Extract field name (look for quoted strings or capitalized phrases)
    const fieldNameMatch = text.match(/"([^"]+)"|'([^']+)'|([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/);
    if (fieldNameMatch) {
      const name = fieldNameMatch[1] || fieldNameMatch[2] || fieldNameMatch[3];
      parsed.fieldName = this.toCamelCase(name);
      parsed.confidence += 0.3;
    }

    // Detect scope (order_header, order_item, etc.)
    for (const { pattern, scope } of this.scopePatterns) {
      if (pattern.test(text)) {
        parsed.scope = scope;
        parsed.confidence += 0.2;
        break;
      }
    }

    // Detect field type
    for (const { pattern, type, format, isEnum } of this.fieldTypePatterns) {
      if (pattern.test(text)) {
        parsed.type = type;
        if (format) parsed.format = format;
        if (isEnum) parsed.isEnum = true;
        parsed.confidence += 0.2;
        break;
      }
    }

    // Detect required vs optional
    if (/required|mandatory|must/i.test(text)) {
      parsed.required = true;
      parsed.confidence += 0.1;
    } else if (/optional/i.test(text)) {
      parsed.required = false;
      parsed.confidence += 0.1;
    }

    // Extract constraints
    const maxLengthMatch = text.match(/max(?:imum)?\s+length\s+(\d+)/i);
    if (maxLengthMatch) {
      parsed.constraints.maxLength = parseInt(maxLengthMatch[1], 10);
      parsed.confidence += 0.1;
    }

    const minMaxMatch = text.match(/between\s+(\d+)\s+and\s+(\d+)/i);
    if (minMaxMatch) {
      parsed.constraints.minimum = parseInt(minMaxMatch[1], 10);
      parsed.constraints.maximum = parseInt(minMaxMatch[2], 10);
      parsed.confidence += 0.1;
    }

    // Extract enum values (look for parenthesized lists or "options: a, b, c")
    const enumMatch = text.match(/\(([^)]+)\)|options?:\s*([^\n.]+)/i);
    if (enumMatch && parsed.isEnum) {
      const valuesList = enumMatch[1] || enumMatch[2];
      parsed.constraints.enum = valuesList.split(/[,;]/).map(v => v.trim());
      parsed.confidence += 0.1;
    }

    return parsed;
  }

  /**
   * Convert field name to camelCase
   */
  toCamelCase(str) {
    return str
      .toLowerCase()
      .replace(/[^a-zA-Z0-9]+(.)/g, (_, chr) => chr.toUpperCase())
      .replace(/^(.)/, (_, chr) => chr.toLowerCase());
  }

  /**
   * Generate follow-up questions based on missing slots
   */
  generateQuestions(parsedData, existingAnswers = {}) {
    const questions = [];

    if (!parsedData.fieldName || parsedData.confidence < 0.5) {
      questions.push({
        slot: 'fieldName',
        question: 'What would you like to name this field?',
        type: 'text',
      });
    }

    if (!parsedData.scope && !existingAnswers.scope) {
      questions.push({
        slot: 'scope',
        question: 'Where should this field be stored?',
        type: 'select',
        options: [
          { value: 'order_header', label: 'Order Header (one per order)' },
          { value: 'order_item', label: 'Order Item (one per line item)' },
        ],
      });
    }

    if (!parsedData.type && !existingAnswers.type) {
      questions.push({
        slot: 'type',
        question: 'What type of data is this?',
        type: 'select',
        options: [
          { value: 'string', label: 'Text (string)' },
          { value: 'integer', label: 'Whole Number (integer)' },
          { value: 'number', label: 'Decimal Number (number)' },
          { value: 'boolean', label: 'Yes/No (boolean)' },
          { value: 'date', label: 'Date/Time' },
          { value: 'enum', label: 'Predefined Options (enum)' },
        ],
      });
    }

    if (parsedData.isEnum && !parsedData.constraints.enum && !existingAnswers.enumValues) {
      questions.push({
        slot: 'enumValues',
        question: 'What are the allowed values? (comma-separated)',
        type: 'text',
      });
    }

    if (!existingAnswers.required && parsedData.required === undefined) {
      questions.push({
        slot: 'required',
        question: 'Is this field required?',
        type: 'boolean',
      });
    }

    if (parsedData.type === 'string' && !parsedData.constraints.maxLength && !existingAnswers.maxLength) {
      questions.push({
        slot: 'maxLength',
        question: 'What is the maximum length? (leave empty for no limit)',
        type: 'text',
        optional: true,
      });
    }

    if ((parsedData.type === 'integer' || parsedData.type === 'number') && !existingAnswers.range) {
      questions.push({
        slot: 'range',
        question: 'Any minimum or maximum values? (e.g., "0 to 100", or leave empty)',
        type: 'text',
        optional: true,
      });
    }

    return questions;
  }

  /**
   * Build JSON schema from parsed data and answers
   */
  buildSchema(extensionName, fields) {
    const properties = {};

    for (const field of fields) {
      const prop = { type: field.type };

      if (field.format) {
        prop.format = field.format;
      }

      if (field.constraints) {
        Object.assign(prop, field.constraints);
      }

      properties[field.fieldName] = prop;
    }

    return {
      type: 'object',
      properties,
      additionalProperties: false,
    };
  }
}

module.exports = { NLUHelper };
