// Extension Draft Model
class ExtensionDraft {
  constructor(data) {
    this.id = data.id || `ext-${Date.now()}`;
    this.tenantId = data.tenantId;
    this.targetService = data.targetService;
    this.extensionName = data.extensionName;
    this.description = data.description;
    this.schema = data.schema; // JSON Schema for extension fields
    this.status = data.status || 'draft'; // draft, validated, testing, approved, rejected, deployed, rolled_back
    this.featureFlag = data.featureFlag || `ext_${data.targetService}_${data.extensionName}`;
    this.validationResults = data.validationResults || null;
    this.testResults = data.testResults || null;
    this.impactReport = data.impactReport || null;
    this.migrations = data.migrations || [];
    this.generatedArtifacts = data.generatedArtifacts || {};
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    this.createdBy = data.createdBy;
    this.approvedBy = data.approvedBy || null;
    this.deployedAt = data.deployedAt || null;
  }

  toJSON() {
    return {
      id: this.id,
      tenantId: this.tenantId,
      targetService: this.targetService,
      extensionName: this.extensionName,
      description: this.description,
      schema: this.schema,
      status: this.status,
      featureFlag: this.featureFlag,
      validationResults: this.validationResults,
      testResults: this.testResults,
      impactReport: this.impactReport,
      migrations: this.migrations,
      generatedArtifacts: this.generatedArtifacts,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      createdBy: this.createdBy,
      approvedBy: this.approvedBy,
      deployedAt: this.deployedAt
    };
  }
}

module.exports = { ExtensionDraft };
