const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { ExtensionDraft } = require('./models/extension');
const { ContractGuard } = require('./guards/contract-guard');
const { StorageGuard } = require('./guards/storage-guard');
const { CodeGenerator } = require('./generators/code-generator');
const { TestRunner } = require('./runners/test-runner');
const { ChatService } = require('./services/chat-service');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8090;
const PG_URL = process.env.PG_URL || 'postgres://postgres:postgres@pg.dev.svc.cluster.local:5432/postgres';
const REPO_ROOT = process.env.REPO_ROOT || '/Users/akhil/personalized-erp';

const pool = new Pool({ connectionString: PG_URL });
const contractGuard = new ContractGuard(REPO_ROOT);
const storageGuard = new StorageGuard(PG_URL, REPO_ROOT);
const codeGenerator = new CodeGenerator(REPO_ROOT);
const testRunner = new TestRunner(REPO_ROOT);

// In-memory storage for drafts (replace with DB in production)
const drafts = new Map();

// Initialize chat service
const chatService = new ChatService(drafts, contractGuard, storageGuard, codeGenerator);

app.get('/healthz', (_, res) => res.send('ok'));

/**
 * POST /extensions/drafts
 * Create a new extension draft
 */
app.post('/extensions/drafts', async (req, res) => {
  try {
    const { tenantId, targetService, extensionName, description, schema, createdBy } = req.body;

    if (!tenantId || !targetService || !extensionName || !schema) {
      return res.status(400).json({
        ok: false,
        error: 'Missing required fields: tenantId, targetService, extensionName, schema'
      });
    }

    const draft = new ExtensionDraft({
      tenantId,
      targetService,
      extensionName,
      description,
      schema,
      createdBy
    });

    drafts.set(draft.id, draft);

    res.status(201).json({
      ok: true,
      draft: draft.toJSON()
    });

  } catch (error) {
    console.error('Error creating draft:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * GET /extensions/drafts
 * List all extension drafts
 */
app.get('/extensions/drafts', (req, res) => {
  const { tenantId, targetService, status } = req.query;
  let results = Array.from(drafts.values());

  if (tenantId) {
    results = results.filter(d => d.tenantId === tenantId);
  }
  if (targetService) {
    results = results.filter(d => d.targetService === targetService);
  }
  if (status) {
    results = results.filter(d => d.status === status);
  }

  res.json({
    ok: true,
    drafts: results.map(d => d.toJSON())
  });
});

/**
 * GET /extensions/drafts/:id
 * Get a specific draft
 */
app.get('/extensions/drafts/:id', (req, res) => {
  const draft = drafts.get(req.params.id);

  if (!draft) {
    return res.status(404).json({ ok: false, error: 'Draft not found' });
  }

  res.json({
    ok: true,
    draft: draft.toJSON()
  });
});

/**
 * POST /extensions/drafts/:id/validate
 * Validate an extension draft (contract + storage)
 */
app.post('/extensions/drafts/:id/validate', async (req, res) => {
  try {
    const draft = drafts.get(req.params.id);

    if (!draft) {
      return res.status(404).json({ ok: false, error: 'Draft not found' });
    }

    // Step 1: Contract validation
    const contractValidation = contractGuard.validateExtension(
      draft.targetService,
      draft.schema
    );

    // Step 2: Storage validation
    const storageChecks = await storageGuard.checkTablesForExtensions(draft.targetService);

    // Step 3: Generate impact report
    const impactReport = contractGuard.generateImpactReport(
      draft.targetService,
      draft.extensionName,
      draft.schema,
      contractValidation
    );

    // Step 4: Generate migrations if needed
    const tablesNeedingExtensions = storageChecks.filter(t => !t.hasExtensions);
    let migration = null;

    if (tablesNeedingExtensions.length > 0) {
      migration = storageGuard.generateExtensionsMigration(
        draft.targetService,
        tablesNeedingExtensions
      );
    }

    // Update draft
    draft.validationResults = {
      contract: contractValidation,
      storage: {
        tables: storageChecks,
        needsMigration: tablesNeedingExtensions.length > 0
      }
    };
    draft.impactReport = impactReport;
    draft.migrations = migration ? [migration] : [];
    draft.status = contractValidation.compatible ? 'validated' : 'rejected';
    draft.updatedAt = new Date().toISOString();

    res.json({
      ok: true,
      draft: draft.toJSON(),
      validation: draft.validationResults,
      impactReport,
      migrations: draft.migrations
    });

  } catch (error) {
    console.error('Error validating draft:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * POST /extensions/drafts/:id/generate
 * Generate code artifacts for an extension
 */
app.post('/extensions/drafts/:id/generate', async (req, res) => {
  try {
    const draft = drafts.get(req.params.id);

    if (!draft) {
      return res.status(404).json({ ok: false, error: 'Draft not found' });
    }

    if (draft.status !== 'validated') {
      return res.status(400).json({
        ok: false,
        error: 'Draft must be validated before generating artifacts'
      });
    }

    // Generate all artifacts
    const artifacts = {
      ajvValidator: codeGenerator.generateAjvValidator(draft.extensionName, draft.schema),
      zodValidator: codeGenerator.generateZodValidator(draft.extensionName, draft.schema),
      uiFragment: codeGenerator.generateUIFragment(draft.extensionName, draft.schema),
      test: codeGenerator.generateTest(draft.targetService, draft.extensionName, draft.schema),
      kgUpdate: codeGenerator.updateKG(draft.targetService, draft.extensionName, draft.schema),
      changeMapUpdate: codeGenerator.updateChangeMap(draft.targetService, draft.extensionName)
    };

    draft.generatedArtifacts = artifacts;
    draft.updatedAt = new Date().toISOString();

    res.json({
      ok: true,
      draft: draft.toJSON(),
      artifacts
    });

  } catch (error) {
    console.error('Error generating artifacts:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * POST /extensions/drafts/:id/test
 * Run tests for an extension
 */
app.post('/extensions/drafts/:id/test', async (req, res) => {
  try {
    const draft = drafts.get(req.params.id);

    if (!draft) {
      return res.status(404).json({ ok: false, error: 'Draft not found' });
    }

    // Run extension-specific tests
    const testResults = await testRunner.runExtensionTests(
      draft.targetService,
      draft.extensionName
    );

    draft.testResults = testResults;
    draft.status = testResults.passed ? 'testing' : 'rejected';
    draft.updatedAt = new Date().toISOString();

    res.json({
      ok: true,
      draft: draft.toJSON(),
      testResults
    });

  } catch (error) {
    console.error('Error running tests:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * POST /extensions/drafts/:id/approve
 * Approve an extension for deployment
 */
app.post('/extensions/drafts/:id/approve', (req, res) => {
  const { approvedBy } = req.body;
  const draft = drafts.get(req.params.id);

  if (!draft) {
    return res.status(404).json({ ok: false, error: 'Draft not found' });
  }

  if (draft.status !== 'testing' && draft.status !== 'validated') {
    return res.status(400).json({
      ok: false,
      error: `Cannot approve draft in status: ${draft.status}`
    });
  }

  if (!draft.testResults || !draft.testResults.passed) {
    return res.status(400).json({
      ok: false,
      error: 'Cannot approve: tests have not passed'
    });
  }

  draft.status = 'approved';
  draft.approvedBy = approvedBy;
  draft.updatedAt = new Date().toISOString();

  res.json({
    ok: true,
    draft: draft.toJSON()
  });
});

/**
 * POST /extensions/drafts/:id/deploy
 * Mark extension as deployed
 */
app.post('/extensions/drafts/:id/deploy', (req, res) => {
  const draft = drafts.get(req.params.id);

  if (!draft) {
    return res.status(404).json({ ok: false, error: 'Draft not found' });
  }

  if (draft.status !== 'approved') {
    return res.status(400).json({
      ok: false,
      error: `Cannot deploy draft in status: ${draft.status}`
    });
  }

  draft.status = 'deployed';
  draft.deployedAt = new Date().toISOString();
  draft.updatedAt = new Date().toISOString();

  res.json({
    ok: true,
    draft: draft.toJSON()
  });
});

/**
 * POST /extensions/drafts/:id/rollback
 * Rollback an extension
 */
app.post('/extensions/drafts/:id/rollback', (req, res) => {
  const draft = drafts.get(req.params.id);

  if (!draft) {
    return res.status(404).json({ ok: false, error: 'Draft not found' });
  }

  if (draft.status !== 'deployed') {
    return res.status(400).json({
      ok: false,
      error: `Cannot rollback draft in status: ${draft.status}`
    });
  }

  draft.status = 'rolled_back';
  draft.updatedAt = new Date().toISOString();

  res.json({
    ok: true,
    draft: draft.toJSON(),
    message: 'Extension rolled back. Disable feature flag and remove extension data.'
  });
});

/**
 * GET /extensions/qa/:draftId
 * Interactive Q&A for extension requirements
 */
app.get('/extensions/qa/:draftId', (req, res) => {
  const draft = drafts.get(req.params.draftId);

  if (!draft) {
    return res.status(404).json({ ok: false, error: 'Draft not found' });
  }

  const questions = [
    {
      id: 'purpose',
      question: 'What is the business purpose of this extension?',
      type: 'text'
    },
    {
      id: 'fields',
      question: 'What fields do you need to add?',
      type: 'array',
      hint: 'List field names and types (e.g., priority:string, notes:text)'
    },
    {
      id: 'validation',
      question: 'What validation rules apply?',
      type: 'text'
    },
    {
      id: 'tenants',
      question: 'Which tenants need this extension?',
      type: 'array'
    }
  ];

  res.json({
    ok: true,
    draft: draft.toJSON(),
    questions
  });
});

/**
 * POST /chat/message
 * Chat-based extension creation flow
 * Body: { tenant: string, text: string, draftId?: string }
 * Response: { draftId, messages: [{role, text}], status, plan?, impactReport? }
 */
app.post('/chat/message', async (req, res) => {
  try {
    const { tenant, text, draftId } = req.body;

    if (!tenant || !text) {
      return res.status(400).json({
        ok: false,
        error: 'Missing required fields: tenant, text'
      });
    }

    const response = await chatService.processMessage(tenant, text, draftId);

    res.json({
      ok: true,
      ...response
    });

  } catch (error) {
    console.error('Error processing chat message:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`ext-svc listening on :${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing connections...');
  await storageGuard.close();
  await pool.end();
  process.exit(0);
});
