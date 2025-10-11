const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs');

const execAsync = promisify(exec);

class TestRunner {
  constructor(repoRoot) {
    this.repoRoot = repoRoot || process.env.REPO_ROOT || '/Users/akhil/personalized-erp';
  }

  /**
   * Run tagged tests for a specific extension
   * @param {string} serviceName - Target service name
   * @param {string} extensionName - Extension name
   * @param {string} tag - Test tag (default: @extension:{extensionName})
   * @returns {Promise<{passed: boolean, results: object, logs: string}>}
   */
  async runExtensionTests(serviceName, extensionName, tag) {
    const testTag = tag || `@extension:${extensionName}`;
    const servicePath = path.join(this.repoRoot, 'apps', 'services', serviceName);

    if (!fs.existsSync(servicePath)) {
      return {
        passed: false,
        results: null,
        logs: `Service path not found: ${servicePath}`,
        error: 'SERVICE_NOT_FOUND'
      };
    }

    try {
      // Check if tests exist
      const testPath = path.join(servicePath, 'src', 'index.test.js');
      if (!fs.existsSync(testPath)) {
        return {
          passed: false,
          results: null,
          logs: `Test file not found: ${testPath}`,
          error: 'TEST_FILE_NOT_FOUND'
        };
      }

      // Run tests with grep for tag
      const command = `cd ${servicePath} && npm test -- --grep "${testTag}" --reporter json`;
      const { stdout, stderr } = await execAsync(command, { timeout: 60000 });

      // Parse test results
      let results = null;
      try {
        results = JSON.parse(stdout);
      } catch (e) {
        // Fallback parsing
        results = {
          stats: {
            tests: 0,
            passes: 0,
            failures: 0
          },
          rawOutput: stdout
        };
      }

      const passed = results.stats && results.stats.failures === 0 && results.stats.tests > 0;

      return {
        passed,
        results,
        logs: `${stdout}\n${stderr}`,
        error: null
      };

    } catch (error) {
      return {
        passed: false,
        results: null,
        logs: error.message || String(error),
        error: 'TEST_EXECUTION_FAILED'
      };
    }
  }

  /**
   * Run all tests for a service
   */
  async runAllTests(serviceName) {
    const servicePath = path.join(this.repoRoot, 'apps', 'services', serviceName);

    if (!fs.existsSync(servicePath)) {
      return {
        passed: false,
        results: null,
        logs: `Service path not found: ${servicePath}`,
        error: 'SERVICE_NOT_FOUND'
      };
    }

    try {
      const command = `cd ${servicePath} && npm test -- --reporter json`;
      const { stdout, stderr } = await execAsync(command, { timeout: 120000 });

      let results = null;
      try {
        results = JSON.parse(stdout);
      } catch (e) {
        results = {
          stats: { tests: 0, passes: 0, failures: 0 },
          rawOutput: stdout
        };
      }

      const passed = results.stats && results.stats.failures === 0;

      return {
        passed,
        results,
        logs: `${stdout}\n${stderr}`,
        error: null
      };

    } catch (error) {
      return {
        passed: false,
        results: null,
        logs: error.message || String(error),
        error: 'TEST_EXECUTION_FAILED'
      };
    }
  }

  /**
   * Health check for test runner
   */
  async healthCheck(serviceName) {
    const servicePath = path.join(this.repoRoot, 'apps', 'services', serviceName);

    return {
      serviceExists: fs.existsSync(servicePath),
      hasTests: fs.existsSync(path.join(servicePath, 'src', 'index.test.js')),
      hasPackageJson: fs.existsSync(path.join(servicePath, 'package.json'))
    };
  }
}

module.exports = { TestRunner };
