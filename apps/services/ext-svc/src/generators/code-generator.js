const fs = require('fs');
const path = require('path');
const YAML = require('yaml');

class CodeGenerator {
  constructor(repoRoot) {
    this.repoRoot = repoRoot || process.env.REPO_ROOT || '/Users/akhil/personalized-erp';
  }

  /**
   * Generate AJV validation schema overlay
   */
  generateAjvValidator(extensionName, extensionSchema) {
    const validatorCode = `// AJV Validator for ${extensionName} extension
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

const ajv = new Ajv({ allErrors: true, useDefaults: true });
addFormats(ajv);

const ${this.toCamelCase(extensionName)}Schema = ${JSON.stringify(extensionSchema, null, 2)};

const validate${this.toPascalCase(extensionName)} = ajv.compile(${this.toCamelCase(extensionName)}Schema);

/**
 * Validate extension data
 * @param {object} data - Extension data to validate
 * @returns {{ valid: boolean, errors: array }}
 */
function validate(data) {
  const valid = validate${this.toPascalCase(extensionName)}(data);
  return {
    valid,
    errors: validate${this.toPascalCase(extensionName)}.errors || []
  };
}

module.exports = { validate, schema: ${this.toCamelCase(extensionName)}Schema };
`;
    return validatorCode;
  }

  /**
   * Generate Zod validation schema
   */
  generateZodValidator(extensionName, extensionSchema) {
    const zodSchema = this.jsonSchemaToZod(extensionSchema);
    const validatorCode = `// Zod Validator for ${extensionName} extension
import { z } from 'zod';

export const ${this.toCamelCase(extensionName)}Schema = ${zodSchema};

export type ${this.toPascalCase(extensionName)} = z.infer<typeof ${this.toCamelCase(extensionName)}Schema>;

export function validate(data: unknown) {
  return ${this.toCamelCase(extensionName)}Schema.safeParse(data);
}
`;
    return validatorCode;
  }

  /**
   * Generate React Hook Form UI fragment
   */
  generateUIFragment(extensionName, extensionSchema) {
    const fields = this.schemaToFormFields(extensionSchema);
    const formCode = `// React Hook Form for ${extensionName} extension
import React from 'react';
import { useForm } from 'react-hook-form';

export function ${this.toPascalCase(extensionName)}Form({ defaultValues, onSubmit }) {
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="extension-form">
      <h3>${extensionName} Extension</h3>
${fields.map(field => this.generateFormField(field)).join('\n')}
      <button type="submit">Save Extension Data</button>
    </form>
  );
}
`;
    return formCode;
  }

  /**
   * Generate tagged test template
   */
  generateTest(serviceName, extensionName, extensionSchema) {
    const testCode = `// Test for ${extensionName} extension on ${serviceName}
// Tag: @extension:${extensionName}

const request = require('supertest');

describe('${serviceName} - ${extensionName} Extension', () => {
  const baseUrl = process.env.SERVICE_URL || 'http://localhost:8080';

  it('should accept valid extension data', async () => {
    const payload = {
      // Base order data
      customerId: 'test-customer',
      currency: 'USD',
      lines: [
        { sku: 'TEST-SKU', qty: 1, unitPrice: 10.00 }
      ],
      // Extension data
      extensions: {
        ${this.toCamelCase(extensionName)}: ${JSON.stringify(this.generateSampleData(extensionSchema), null, 10)}
      }
    };

    const response = await request(baseUrl)
      .post('/orders')
      .set('x-tenant-id', 'tenant1')
      .send(payload);

    expect(response.status).toBe(201);
    expect(response.body.ok).toBe(true);
  });

  it('should store extension data in extensions JSONB column', async () => {
    // Test database storage
    // TODO: Query database and verify extensions field
  });

  it('should reject invalid extension data', async () => {
    const payload = {
      customerId: 'test-customer',
      currency: 'USD',
      lines: [
        { sku: 'TEST-SKU', qty: 1, unitPrice: 10.00 }
      ],
      extensions: {
        ${this.toCamelCase(extensionName)}: {
          // Invalid data according to schema
        }
      }
    };

    const response = await request(baseUrl)
      .post('/orders')
      .set('x-tenant-id', 'tenant1')
      .send(payload);

    expect(response.status).toBe(400);
  });

  it('should respect feature flag for ${extensionName}', async () => {
    // TODO: Test feature flag behavior
  });
});
`;
    return testCode;
  }

  /**
   * Update KG.yaml with extension info
   */
  updateKG(serviceName, extensionName, extensionSchema) {
    const kgPath = path.join(this.repoRoot, 'docs', 'services', serviceName, 'kg.yaml');
    if (!fs.existsSync(kgPath)) {
      return null;
    }

    const content = fs.readFileSync(kgPath, 'utf8');
    const kg = YAML.parse(content);

    // Add extension to notes
    if (!kg.notes) {
      kg.notes = [];
    }

    const extensionNote = `Extension: ${extensionName} - ${extensionSchema.description || 'No description'} (via extensions.${this.toCamelCase(extensionName)})`;
    if (!kg.notes.includes(extensionNote)) {
      kg.notes.push(extensionNote);
    }

    return YAML.stringify(kg);
  }

  /**
   * Update change-map.yaml with extension pattern
   */
  updateChangeMap(serviceName, extensionName) {
    const changeMapPath = path.join(this.repoRoot, 'docs', 'services', serviceName, 'change-map.yaml');
    if (!fs.existsSync(changeMapPath)) {
      return null;
    }

    const content = fs.readFileSync(changeMapPath, 'utf8');
    const changeMap = YAML.parse(content);

    // Add extension pattern
    if (!changeMap.patterns) {
      changeMap.patterns = {};
    }

    if (!changeMap.patterns.extension_addition) {
      changeMap.patterns.extension_addition = {};
    }

    changeMap.patterns.extension_addition[this.toSnakeCase(extensionName)] = {
      description: `Add ${extensionName} extension via extensions JSONB map`,
      likely_files: [
        `apps/services/${serviceName}/src/**/*.js`,
        `docs/services/${serviceName}/extension-guide.yaml`
      ],
      rationale: 'Extension added via safe JSONB storage, backward compatible'
    };

    return YAML.stringify(changeMap);
  }

  /**
   * Helper: Convert JSON Schema to Zod schema (simplified)
   */
  jsonSchemaToZod(schema) {
    const props = schema.properties || {};
    const required = schema.required || [];

    const fields = Object.entries(props).map(([key, value]) => {
      let zodType = 'z.unknown()';

      switch (value.type) {
        case 'string':
          zodType = 'z.string()';
          if (value.minLength) zodType += `.min(${value.minLength})`;
          if (value.maxLength) zodType += `.max(${value.maxLength})`;
          if (value.pattern) zodType += `.regex(/${value.pattern}/)`;
          break;
        case 'number':
        case 'integer':
          zodType = 'z.number()';
          if (value.minimum !== undefined) zodType += `.min(${value.minimum})`;
          if (value.maximum !== undefined) zodType += `.max(${value.maximum})`;
          break;
        case 'boolean':
          zodType = 'z.boolean()';
          break;
        case 'array':
          zodType = 'z.array(z.any())';
          break;
        case 'object':
          zodType = 'z.object({})';
          break;
      }

      if (!required.includes(key)) {
        zodType += '.optional()';
      }

      return `  ${key}: ${zodType}`;
    });

    return `z.object({\n${fields.join(',\n')}\n})`;
  }

  /**
   * Helper: Convert schema to form fields
   */
  schemaToFormFields(schema) {
    const props = schema.properties || {};
    return Object.entries(props).map(([key, value]) => ({
      name: key,
      type: value.type,
      label: value.title || key,
      description: value.description,
      required: (schema.required || []).includes(key)
    }));
  }

  /**
   * Helper: Generate form field HTML
   */
  generateFormField(field) {
    const inputType = field.type === 'number' ? 'number' : field.type === 'boolean' ? 'checkbox' : 'text';
    return `      <div className="form-field">
        <label htmlFor="${field.name}">${field.label}${field.required ? ' *' : ''}</label>
        <input
          id="${field.name}"
          type="${inputType}"
          {...register('${field.name}'${field.required ? ', { required: true }' : ''})}
        />
        {errors.${field.name} && <span className="error">This field is required</span>}
        ${field.description ? `<small>${field.description}</small>` : ''}
      </div>`;
  }

  /**
   * Helper: Generate sample data from schema
   */
  generateSampleData(schema) {
    const sample = {};
    const props = schema.properties || {};

    for (const [key, value] of Object.entries(props)) {
      switch (value.type) {
        case 'string':
          sample[key] = value.example || 'sample-value';
          break;
        case 'number':
        case 'integer':
          sample[key] = value.example || 42;
          break;
        case 'boolean':
          sample[key] = value.example || true;
          break;
        default:
          sample[key] = value.example || null;
      }
    }

    return sample;
  }

  // Case conversion helpers
  toCamelCase(str) {
    return str.replace(/[-_](.)/g, (_, c) => c.toUpperCase()).replace(/^(.)/, c => c.toLowerCase());
  }

  toPascalCase(str) {
    return this.toCamelCase(str).replace(/^(.)/, c => c.toUpperCase());
  }

  toSnakeCase(str) {
    return str.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
  }
}

module.exports = { CodeGenerator };
