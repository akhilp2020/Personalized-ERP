const fs = require('fs');
const path = require('path');
const YAML = require('yaml');

class ContractGuard {
  constructor(repoRoot) {
    this.repoRoot = repoRoot || process.env.REPO_ROOT || '/Users/akhil/personalized-erp';
  }

  /**
   * Load OpenAPI and AsyncAPI contracts for a service
   */
  loadContracts(serviceName) {
    const contracts = {
      openapi: null,
      asyncapi: null
    };

    // Try to load OpenAPI spec
    const openapiPath = path.join(this.repoRoot, 'contracts', 'openapi', `${serviceName}.yaml`);
    if (fs.existsSync(openapiPath)) {
      const content = fs.readFileSync(openapiPath, 'utf8');
      contracts.openapi = YAML.parse(content);
    }

    // Try to load AsyncAPI spec
    const asyncapiPath = path.join(this.repoRoot, 'contracts', 'asyncapi', `${serviceName}.yaml`);
    if (fs.existsSync(asyncapiPath)) {
      const content = fs.readFileSync(asyncapiPath, 'utf8');
      contracts.asyncapi = YAML.parse(content);
    }

    return contracts;
  }

  /**
   * Validate that extension only adds optional fields via extensions map
   * Returns { compatible: boolean, violations: string[] }
   */
  validateExtension(serviceName, extensionSchema) {
    const violations = [];

    // Rule 1: Extensions must only add fields to the extensions map
    if (extensionSchema.type !== 'object') {
      violations.push('Extension schema must be of type "object"');
    }

    // Rule 2: All extension fields should be optional
    if (extensionSchema.required && extensionSchema.required.length > 0) {
      violations.push('Extension fields cannot be required (must be optional for backward compatibility)');
    }

    // Rule 3: Extension schema should not conflict with existing fields
    const contracts = this.loadContracts(serviceName);
    if (contracts.openapi) {
      const existingSchemas = this.extractSchemas(contracts.openapi);
      const conflicts = this.findConflicts(extensionSchema, existingSchemas);
      if (conflicts.length > 0) {
        violations.push(`Extension fields conflict with existing schema: ${conflicts.join(', ')}`);
      }
    }

    return {
      compatible: violations.length === 0,
      violations
    };
  }

  /**
   * Extract all schemas from OpenAPI spec
   */
  extractSchemas(openapiSpec) {
    const schemas = {};
    if (openapiSpec.components && openapiSpec.components.schemas) {
      Object.assign(schemas, openapiSpec.components.schemas);
    }
    return schemas;
  }

  /**
   * Find conflicts between extension schema and existing schemas
   */
  findConflicts(extensionSchema, existingSchemas) {
    const conflicts = [];
    const extensionProps = extensionSchema.properties || {};

    // Check if any extension property names conflict with existing required fields
    for (const [key, value] of Object.entries(existingSchemas)) {
      const existingProps = value.properties || {};
      const existingRequired = value.required || [];

      for (const extProp of Object.keys(extensionProps)) {
        if (existingRequired.includes(extProp)) {
          conflicts.push(`${key}.${extProp} (required field conflict)`);
        }
      }
    }

    return conflicts;
  }

  /**
   * Generate impact report for an extension
   */
  generateImpactReport(serviceName, extensionName, extensionSchema, validationResults) {
    const contracts = this.loadContracts(serviceName);
    const report = {
      service: serviceName,
      extension: extensionName,
      timestamp: new Date().toISOString(),
      backwardCompatible: validationResults.compatible,
      violations: validationResults.violations,
      affectedEndpoints: [],
      affectedEvents: [],
      storageChanges: {
        tablesRequiringExtensions: [],
        migrationsNeeded: false
      },
      summary: ''
    };

    // Analyze affected endpoints (OpenAPI)
    if (contracts.openapi && contracts.openapi.paths) {
      for (const [path, methods] of Object.entries(contracts.openapi.paths)) {
        for (const [method, spec] of Object.entries(methods)) {
          if (typeof spec === 'object' && spec.responses) {
            report.affectedEndpoints.push({
              method: method.toUpperCase(),
              path,
              description: spec.summary || spec.description || ''
            });
          }
        }
      }
    }

    // Analyze affected events (AsyncAPI)
    if (contracts.asyncapi && contracts.asyncapi.channels) {
      for (const [channel, spec] of Object.entries(contracts.asyncapi.channels)) {
        if (spec.publish || spec.subscribe) {
          report.affectedEvents.push({
            channel,
            type: spec.publish ? 'publish' : 'subscribe',
            description: spec.description || ''
          });
        }
      }
    }

    // Generate human-readable summary
    if (report.backwardCompatible) {
      report.summary = `✅ Extension "${extensionName}" for service "${serviceName}" is backward compatible. ` +
        `Will add optional fields to the extensions map. ` +
        `Affects ${report.affectedEndpoints.length} endpoints and ${report.affectedEvents.length} events.`;
    } else {
      report.summary = `❌ Extension "${extensionName}" for service "${serviceName}" is NOT backward compatible. ` +
        `Violations: ${report.violations.join('; ')}. Cannot proceed.`;
    }

    return report;
  }
}

module.exports = { ContractGuard };
