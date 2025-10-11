const { NLUHelper } = require('./nlu-helper');

/**
 * Chat Service - Manages conversational flow for extension creation
 */
class ChatService {
  constructor(drafts, contractGuard, storageGuard, codeGenerator) {
    this.drafts = drafts;
    this.contractGuard = contractGuard;
    this.storageGuard = storageGuard;
    this.codeGenerator = codeGenerator;
    this.nlu = new NLUHelper();

    // In-memory session storage (track conversation state per draft)
    this.sessions = new Map();
  }

  /**
   * Process a chat message and return response
   * @param {string} tenantId
   * @param {string} text - User's message
   * @param {string|null} draftId - Optional draft ID
   * @returns {Promise<ChatResponse>}
   */
  async processMessage(tenantId, text, draftId = null) {
    let draft = draftId ? this.drafts.get(draftId) : null;
    let session = draftId ? this.sessions.get(draftId) : null;

    // Initialize new session if needed
    if (!session) {
      session = {
        fields: [],
        currentField: null,
        answers: {},
        phase: 'collecting', // collecting, validating, planning, ready
      };
      if (draftId) {
        this.sessions.set(draftId, session);
      }
    }

    const response = {
      draftId: draftId || null,
      messages: [],
      status: 'collecting',
      plan: null,
      impactReport: null,
    };

    // Parse user's intent
    const intent = this.parseIntent(text, session, !!draft);

    switch (intent.type) {
      case 'new_extension':
        return await this.handleNewExtension(tenantId, text, response);

      case 'add_field':
        return await this.handleAddField(text, draft, session, response);

      case 'answer_question':
        return await this.handleAnswer(text, draft, session, response);

      case 'done_adding_fields':
        return await this.handleComplete(draft, session, response);

      case 'approve_plan':
        return await this.handleApprovePlan(draft, response);

      case 'revise':
        return await this.handleRevise(draft, session, response);

      default:
        response.messages.push({
          role: 'assistant',
          text: 'I can help you create an extension. Try saying something like:\n' +
                '• "Add Customer PO on order header, optional, max length 40"\n' +
                '• "Add priority field to order items"\n' +
                '• "done" when you\'re finished adding fields',
        });
        return response;
    }
  }

  parseIntent(text, session, hasDraft) {
    const lowerText = text.toLowerCase().trim();

    if (lowerText === 'done' || lowerText === 'finish' || lowerText === 'complete') {
      return { type: 'done_adding_fields' };
    }

    if (lowerText === 'approve' || lowerText === 'yes, approve' || lowerText === 'approve plan') {
      return { type: 'approve_plan' };
    }

    if (lowerText.startsWith('revise') || lowerText.startsWith('change')) {
      return { type: 'revise' };
    }

    // Check if answering a pending question
    if (session.currentField && session.currentField.pendingQuestions?.length > 0) {
      return { type: 'answer_question' };
    }

    // Check if adding a field
    if (/add|create|include|need/i.test(text)) {
      // If no draft exists yet, this is a new extension
      if (!hasDraft) {
        return { type: 'new_extension' };
      }
      return { type: 'add_field' };
    }

    return { type: 'unknown' };
  }

  async handleNewExtension(tenantId, text, response) {
    // Parse initial request
    const parsed = this.nlu.parseRequest(text);

    // Create draft with default service (order-svc)
    const { ExtensionDraft } = require('../models/extension');
    const draft = new ExtensionDraft({
      tenantId,
      targetService: 'order-svc',
      extensionName: parsed.fieldName ? `${parsed.fieldName}Extension` : 'customExtension',
      description: text,
      schema: { type: 'object', properties: {} },
      createdBy: 'chat-user',
    });

    this.drafts.set(draft.id, draft);
    response.draftId = draft.id;

    // Initialize session
    const session = {
      fields: [],
      currentField: parsed.confidence > 0.5 ? parsed : null,
      answers: {},
      phase: 'collecting',
    };
    this.sessions.set(draft.id, session);

    response.messages.push({
      role: 'assistant',
      text: `Great! I've started a new extension draft (ID: ${draft.id}). Let's define the fields you need.`,
    });

    if (parsed.confidence > 0.5 && parsed.fieldName) {
      session.currentField = parsed;
      const questions = this.nlu.generateQuestions(parsed, {});
      if (questions.length > 0) {
        session.currentField.pendingQuestions = questions;
        response.messages.push({
          role: 'assistant',
          text: questions[0].question,
        });
      } else {
        // Field is complete
        session.fields.push(parsed);
        session.currentField = null;
        response.messages.push({
          role: 'assistant',
          text: `Added field "${parsed.fieldName}". Add more fields or type "done" to validate.`,
        });
      }
    } else {
      response.messages.push({
        role: 'assistant',
        text: 'What field would you like to add? For example:\n' +
              '• "Add Customer PO on order header, optional, max length 40"\n' +
              '• "Add priority level as enum (standard, high, critical)"',
      });
    }

    return response;
  }

  async handleAddField(text, draft, session, response) {
    if (!draft) {
      response.messages.push({
        role: 'assistant',
        text: 'Please start a new extension first. Say something like "Add Customer PO to order header".',
      });
      return response;
    }

    const parsed = this.nlu.parseRequest(text);

    if (parsed.confidence > 0.3 && parsed.fieldName) {
      session.currentField = parsed;
      const questions = this.nlu.generateQuestions(parsed, {});

      if (questions.length > 0) {
        session.currentField.pendingQuestions = questions;
        response.messages.push({
          role: 'assistant',
          text: questions[0].question,
        });
      } else {
        // Field is complete
        session.fields.push(parsed);
        session.currentField = null;
        response.messages.push({
          role: 'assistant',
          text: `Added field "${parsed.fieldName}". Add more fields or type "done" to validate.`,
        });
      }
    } else {
      response.messages.push({
        role: 'assistant',
        text: 'I couldn\'t understand that field definition. Try:\n' +
              '• "Add [field name] to [order header/order item], [required/optional]"\n' +
              '• Example: "Add notes field, optional, max length 500"',
      });
    }

    response.draftId = draft.id;
    return response;
  }

  async handleAnswer(text, draft, session, response) {
    if (!session.currentField || !session.currentField.pendingQuestions) {
      return this.handleAddField(text, draft, session, response);
    }

    const question = session.currentField.pendingQuestions[0];

    // Store answer
    if (question.type === 'boolean') {
      session.answers[question.slot] = /yes|true|required|mandatory/i.test(text);
    } else if (question.type === 'select') {
      const option = question.options.find(opt =>
        text.toLowerCase().includes(opt.value) || text.toLowerCase().includes(opt.label.toLowerCase())
      );
      session.answers[question.slot] = option ? option.value : text;
    } else {
      session.answers[question.slot] = text.trim();
    }

    // Update current field with answer
    this.applyAnswer(session.currentField, question.slot, session.answers[question.slot]);

    // Remove answered question
    session.currentField.pendingQuestions.shift();

    // Check if more questions remain
    if (session.currentField.pendingQuestions.length > 0) {
      response.messages.push({
        role: 'assistant',
        text: session.currentField.pendingQuestions[0].question,
      });
    } else {
      // Field is complete
      session.fields.push(session.currentField);
      response.messages.push({
        role: 'assistant',
        text: `Great! Added field "${session.currentField.fieldName}". Add another field or type "done" to proceed.`,
      });
      session.currentField = null;
      session.answers = {};
    }

    response.draftId = draft.id;
    return response;
  }

  applyAnswer(field, slot, value) {
    switch (slot) {
      case 'fieldName':
        field.fieldName = this.nlu.toCamelCase(value);
        break;
      case 'scope':
        field.scope = value;
        break;
      case 'type':
        field.type = value === 'enum' ? 'string' : value;
        field.isEnum = value === 'enum';
        break;
      case 'required':
        field.required = value;
        break;
      case 'maxLength':
        if (value && !isNaN(value)) {
          field.constraints = field.constraints || {};
          field.constraints.maxLength = parseInt(value, 10);
        }
        break;
      case 'enumValues':
        field.constraints = field.constraints || {};
        field.constraints.enum = value.split(/[,;]/).map(v => v.trim());
        break;
      case 'range':
        const rangeMatch = value.match(/(\d+)\s+to\s+(\d+)/i);
        if (rangeMatch) {
          field.constraints = field.constraints || {};
          field.constraints.minimum = parseInt(rangeMatch[1], 10);
          field.constraints.maximum = parseInt(rangeMatch[2], 10);
        }
        break;
    }
  }

  async handleComplete(draft, session, response) {
    if (!draft) {
      response.messages.push({
        role: 'assistant',
        text: 'No draft found. Please start a new extension first.',
      });
      return response;
    }

    if (session.fields.length === 0) {
      response.messages.push({
        role: 'assistant',
        text: 'You haven\'t added any fields yet. Please describe the fields you need.',
      });
      return response;
    }

    response.messages.push({
      role: 'system',
      text: `Validating ${session.fields.length} field(s)...`,
    });

    // Build schema from collected fields
    const schema = this.nlu.buildSchema(draft.extensionName, session.fields);
    draft.schema = schema;
    draft.updatedAt = new Date().toISOString();

    // Run validation
    const contractValidation = this.contractGuard.validateExtension(
      draft.targetService,
      schema
    );

    const storageChecks = await this.storageGuard.checkTablesForExtensions(draft.targetService);
    const impactReport = this.contractGuard.generateImpactReport(
      draft.targetService,
      draft.extensionName,
      schema,
      contractValidation
    );

    draft.validationResults = {
      contract: contractValidation,
      storage: {
        tables: storageChecks,
        needsMigration: storageChecks.some(t => !t.hasExtensions),
      },
    };
    draft.impactReport = impactReport;

    if (!contractValidation.compatible) {
      // Contract break!
      draft.status = 'rejected';
      response.status = 'contract_break';
      response.impactReport = impactReport;
      response.messages.push({
        role: 'assistant',
        text: `⚠️  Contract Break Detected:\n${impactReport.violations.join('\n')}\n\n` +
              `To fix: Make all fields optional or remove conflicts. Type "revise" to adjust.`,
      });
    } else {
      // Valid! Build plan
      draft.status = 'validated';
      session.phase = 'ready';
      response.status = 'ready_to_propose';

      const plan = await this.buildPlan(draft, storageChecks);
      response.plan = plan;

      response.messages.push({
        role: 'assistant',
        text: `✅ Validation successful! Here's the plan:\n\n` +
              `**Storage:** JSONB field in ${draft.targetService}/${session.fields[0]?.scope || 'order_header'}\n` +
              `**API:** Optional overlay on existing endpoints\n` +
              `**Fields:** ${session.fields.map(f => `${f.fieldName} (${f.type})`).join(', ')}\n` +
              `**Tests:** Auto-generated validation tests\n` +
              `**Docs:** kg.yaml, change-map.yaml updates\n\n` +
              `Type "approve" to proceed with implementation.`,
      });
    }

    response.draftId = draft.id;
    return response;
  }

  async buildPlan(draft, storageChecks) {
    const needsMigration = storageChecks.some(t => !t.hasExtensions);

    return {
      storage: {
        scope: draft.targetService,
        tables: storageChecks.map(t => t.table),
        migrations: needsMigration ? ['Add extensions JSONB column'] : [],
      },
      api: {
        changes: 'Optional field overlay (backward compatible)',
        endpoints: draft.impactReport?.affectedEndpoints || [],
      },
      ui: {
        fragments: 'Auto-generated form fields',
      },
      tests: {
        packs: ['validation', 'contract', 'integration'],
      },
      docs: {
        files: ['kg.yaml', 'change-map.yaml', 'ADR'],
      },
    };
  }

  async handleApprovePlan(draft, response) {
    if (!draft) {
      response.messages.push({
        role: 'assistant',
        text: 'No draft found.',
      });
      return response;
    }

    if (draft.status !== 'validated') {
      response.messages.push({
        role: 'assistant',
        text: `Cannot approve: draft status is "${draft.status}". Please validate first.`,
      });
      return response;
    }

    response.messages.push({
      role: 'system',
      text: 'Generating code artifacts...',
    });

    // Generate artifacts
    const artifacts = {
      ajvValidator: this.codeGenerator.generateAjvValidator(draft.extensionName, draft.schema),
      zodValidator: this.codeGenerator.generateZodValidator(draft.extensionName, draft.schema),
      uiFragment: this.codeGenerator.generateUIFragment(draft.extensionName, draft.schema),
      test: this.codeGenerator.generateTest(draft.targetService, draft.extensionName, draft.schema),
      kgUpdate: this.codeGenerator.updateKG(draft.targetService, draft.extensionName, draft.schema),
      changeMapUpdate: this.codeGenerator.updateChangeMap(draft.targetService, draft.extensionName),
    };

    draft.generatedArtifacts = artifacts;
    draft.status = 'testing';
    draft.updatedAt = new Date().toISOString();

    response.status = 'proposed';
    response.messages.push({
      role: 'assistant',
      text: `✅ Code artifacts generated!\n\n` +
            `Next steps:\n` +
            `1. Review generated files\n` +
            `2. Run tests with "Run Tests" button\n` +
            `3. Approve for deployment\n\n` +
            `Draft ID: ${draft.id}`,
    });

    response.draftId = draft.id;
    return response;
  }

  async handleRevise(draft, session, response) {
    if (!draft) {
      response.messages.push({
        role: 'assistant',
        text: 'No draft found.',
      });
      return response;
    }

    // Reset session to allow re-collection
    session.fields = [];
    session.currentField = null;
    session.answers = {};
    session.phase = 'collecting';

    draft.status = 'draft';
    draft.schema = { type: 'object', properties: {} };

    response.messages.push({
      role: 'assistant',
      text: 'Okay, let\'s revise. What fields do you need? (Make sure they\'re all optional for backward compatibility)',
    });

    response.draftId = draft.id;
    return response;
  }
}

module.exports = { ChatService };
