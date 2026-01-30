/**
 * PageExpectationChecker - Validates scan results against expected page structure
 *
 * Single Responsibility: Check if scan results meet page expectations
 */

interface CodeFormat {
  code: string
  count: number
}

interface PageFormat {
  pageNumber: number
  totalCodeCount: number
  formats: CodeFormat[]
}

interface Structure {
  format: PageFormat[]
}

interface CodeObject {
  format: string
  [key: string]: unknown
}

interface ExpectationCheckResult {
  met: boolean
  foundCount: number
  expectedCount: number
  missingFormats: string[]
}

export class PageExpectationChecker {
  /**
   * Get expected codes for a specific page from structure
   * @param {Object} structure - Structure definition
   * @param {number} pageNumber - Page number to get expected codes for
   * @returns {Object|null} - { totalCodeCount, formats } or null if no structure/page defined
   */
  static getPageExpectation(structure: Structure | null | undefined, pageNumber: number): PageFormat | null {
    if (!structure || !structure.format) {
      return null;
    }

    const pageFormat = structure.format.find((p) => p.pageNumber === pageNumber);

    return pageFormat || null;
  }

  /**
   * Check if scan result meets page expectations
   * @param {Array} codes - Array of detected codes
   * @param {Object} expectation - Expected codes { totalCodeCount, formats: [{code, count}] }
   * @returns {Object} - { met, foundCount, expectedCount, missingFormats }
   */
  static check(codes: CodeObject[], expectation: PageFormat | null): ExpectationCheckResult {
    if (!expectation) {
      // No expectation - any result is acceptable
      return {
        met: true,
        foundCount: codes.length,
        expectedCount: 0,
        missingFormats: [],
      };
    }

    // If totalCodeCount is 0, page expects no codes
    if (expectation.totalCodeCount === 0) {
      return {
        met: true,
        foundCount: codes.length,
        expectedCount: 0,
        missingFormats: [],
      };
    }

    // Count codes by format
    const foundCounts: Record<string, number> = {};
    for (const code of codes) {
      foundCounts[code.format] = (foundCounts[code.format] || 0) + 1;
    }

    // Check each expected format
    const missingFormats: string[] = [];
    for (const expected of expectation.formats) {
      const foundCount = foundCounts[expected.code] || 0;
      if (foundCount < expected.count) {
        missingFormats.push(`${expected.code} (found ${foundCount}/${expected.count})`);
      }
    }

    return {
      met: missingFormats.length === 0 && codes.length >= expectation.totalCodeCount,
      foundCount: codes.length,
      expectedCount: expectation.totalCodeCount,
      missingFormats,
    };
  }

  /**
   * Check if page should be skipped (expects no codes)
   * @param {Object} expectation - Expected codes structure
   * @returns {boolean}
   */
  static shouldSkipPage(expectation: PageFormat | null): boolean {
    return expectation !== null && expectation.totalCodeCount === 0;
  }
}
