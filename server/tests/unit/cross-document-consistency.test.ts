import { describe, it, expect } from 'vitest';
import {
  documentIntelligenceService,
  areNamesCompatible,
  normalizeNameTokens,
  type ConsistencyCheckDocument,
} from '../../src/services/document-intelligence.service.js';

describe('AI-4 — Cross-Document Consistency & Review Signals', () => {
  const brokerageIdA = '673000000000000000000001';
  const brokerageIdB = '673000000000000000000002';

  // Helper to create mock documents for consistency evaluation
  const createMockDoc = (overrides: Partial<ConsistencyCheckDocument>): ConsistencyCheckDocument => ({
    _id: overrides._id || 'doc_001',
    brokerageId: overrides.brokerageId || brokerageIdA,
    type: overrides.type || 'IDENTIFICATION',
    title: overrides.title || 'Identification Document',
    extractedData: {
      classification: {
        status: 'RECOGNIZED',
        detectedType: overrides.extractedData?.classification?.detectedType || overrides.type || 'IDENTIFICATION',
        confidence: 0.95,
        matchedKeywords: ['pan'],
      },
      fields: {
        borrowerName: null,
        pan: null,
        employerName: null,
        grossIncome: null,
        netIncome: null,
        currency: null,
        documentPeriod: null,
        dateOfBirth: null,
        accountNumberMasked: null,
        bankName: null,
        ifscCode: null,
        assessmentYear: null,
        employeeId: null,
        ...overrides.extractedData?.fields,
      },
      reviewSignals: [],
      extractedAt: new Date(),
      modelVersion: 'rule-engine-1.0',
      ...overrides.extractedData,
    },
  });

  // 1. Matching Name + PAN
  it('1. matching name + PAN: produces zero identity signals when names and PAN match across documents', () => {
    const panDoc = createMockDoc({
      _id: 'doc_pan',
      type: 'IDENTIFICATION',
      title: 'PAN Card',
      extractedData: {
        fields: {
          borrowerName: { value: 'Rahul Sharma', confidence: 0.95 },
          pan: { value: 'ABCDE1234F', confidence: 0.95 },
        },
      } as any,
    });

    const salaryDoc = createMockDoc({
      _id: 'doc_salary',
      type: 'PAYSLIP',
      title: 'September 2026 Salary Slip',
      extractedData: {
        fields: {
          borrowerName: { value: 'RAHUL SHARMA', confidence: 0.9 },
          pan: { value: 'ABCDE1234F', confidence: 0.9 },
          grossIncome: { value: 85000, confidence: 0.9 },
        },
      } as any,
    });

    const signals = documentIntelligenceService.evaluateConsistency(panDoc, [salaryDoc]);
    const identitySignals = signals.filter((s) => s.type === 'IDENTITY_MISMATCH');
    expect(identitySignals).toHaveLength(0);
  });

  // 2. Name Mismatch
  it('2. name mismatch: generates neutral advisory signal when borrower names differ meaningfully', () => {
    const docA = createMockDoc({
      _id: 'doc_a',
      type: 'IDENTIFICATION',
      title: 'PAN Card',
      extractedData: {
        fields: {
          borrowerName: { value: 'Rahul Sharma', confidence: 0.95 },
          pan: { value: 'ABCDE1234F', confidence: 0.95 },
        },
      } as any,
    });

    const docB = createMockDoc({
      _id: 'doc_b',
      type: 'PAYSLIP',
      title: 'Salary Slip',
      extractedData: {
        fields: {
          borrowerName: { value: 'Amit Verma', confidence: 0.9 },
          pan: { value: 'ABCDE1234F', confidence: 0.9 },
        },
      } as any,
    });

    const signals = documentIntelligenceService.evaluateConsistency(docA, [docB]);
    const nameSignals = signals.filter((s) => s.field === 'borrowerName');

    expect(nameSignals.length).toBeGreaterThanOrEqual(1);
    expect(nameSignals[0]?.type).toBe('IDENTITY_MISMATCH');
    expect(nameSignals[0]?.message).toBe('Identity information differs across documents');
    expect(nameSignals[0]?.details).toContain('Borrower name on this document differs');
    // Verify no pejorative/fraud keywords
    expect(nameSignals[0]?.message).not.toMatch(/fraud|fake|scam|forged/i);
    expect(nameSignals[0]?.details).not.toMatch(/fraud|fake|scam|forged/i);
  });

  // 3. PAN Mismatch
  it('3. PAN mismatch: flags strict mismatch when both valid PAN identifiers differ', () => {
    const docA = createMockDoc({
      _id: 'doc_a',
      type: 'IDENTIFICATION',
      title: 'PAN Card',
      extractedData: {
        fields: {
          borrowerName: { value: 'Rahul Sharma', confidence: 0.95 },
          pan: { value: 'ABCDE1234F', confidence: 0.95 },
        },
      } as any,
    });

    const docB = createMockDoc({
      _id: 'doc_b',
      type: 'PAYSLIP',
      title: 'Salary Slip',
      extractedData: {
        fields: {
          borrowerName: { value: 'Rahul Sharma', confidence: 0.9 },
          pan: { value: 'WXYZP9876Q', confidence: 0.9 },
        },
      } as any,
    });

    const signals = documentIntelligenceService.evaluateConsistency(docA, [docB]);
    const panSignals = signals.filter((s) => s.field === 'pan');

    expect(panSignals).toHaveLength(1);
    expect(panSignals[0]?.type).toBe('IDENTITY_MISMATCH');
    expect(panSignals[0]?.message).toBe('Identity information differs across documents');
    expect(panSignals[0]?.details).toContain('PAN identifier on this document differs');
    expect(panSignals[0]?.relatedDocumentIds).toContain('doc_b');
  });

  // 4. Reasonable Income Difference
  it('4. reasonable income difference: does not flag minor or legitimate variances (e.g. bonus, small deductions)', () => {
    // Monthly salary slip: 85,000 INR -> Annualized: 1,020,000 INR
    // ITR Annual Gross Total Income: 1,150,000 INR (ratio = 1.12x, reasonable variance)
    const salaryDoc = createMockDoc({
      _id: 'doc_salary',
      type: 'PAYSLIP',
      title: 'Salary Slip',
      extractedData: {
        classification: { status: 'RECOGNIZED', detectedType: 'PAYSLIP', confidence: 0.95, matchedKeywords: [] },
        fields: {
          grossIncome: { value: 85000, confidence: 0.9 },
        },
      } as any,
    });

    const itrDoc = createMockDoc({
      _id: 'doc_itr',
      type: 'TAX_RETURN',
      title: 'ITR-V Assessment',
      extractedData: {
        classification: { status: 'RECOGNIZED', detectedType: 'TAX_RETURN', confidence: 0.95, matchedKeywords: [] },
        fields: {
          grossIncome: { value: 1150000, confidence: 0.9 },
        },
      } as any,
    });

    const signals = documentIntelligenceService.evaluateConsistency(salaryDoc, [itrDoc]);
    const incomeSignals = signals.filter((s) => s.type === 'INCOME_INCONSISTENCY');
    expect(incomeSignals).toHaveLength(0);
  });

  // 5. Meaningful Income Inconsistency
  it('5. meaningful income inconsistency: flags significant divergence between annualized salary and ITR', () => {
    // Monthly salary slip: 85,000 INR -> Annualized: 1,020,000 INR
    // ITR Annual Gross Total Income: 350,000 INR (ratio: ~2.9x difference)
    const salaryDoc = createMockDoc({
      _id: 'doc_salary',
      type: 'PAYSLIP',
      title: 'Salary Slip',
      extractedData: {
        classification: { status: 'RECOGNIZED', detectedType: 'PAYSLIP', confidence: 0.95, matchedKeywords: [] },
        fields: {
          grossIncome: { value: 85000, confidence: 0.9 },
        },
      } as any,
    });

    const itrDoc = createMockDoc({
      _id: 'doc_itr',
      type: 'TAX_RETURN',
      title: 'ITR-V Assessment',
      extractedData: {
        classification: { status: 'RECOGNIZED', detectedType: 'TAX_RETURN', confidence: 0.95, matchedKeywords: [] },
        fields: {
          grossIncome: { value: 350000, confidence: 0.9 },
        },
      } as any,
    });

    const signals = documentIntelligenceService.evaluateConsistency(salaryDoc, [itrDoc]);
    const incomeSignals = signals.filter((s) => s.type === 'INCOME_INCONSISTENCY');

    expect(incomeSignals).toHaveLength(1);
    expect(incomeSignals[0]?.message).toBe('Income figures may require review');
    expect(incomeSignals[0]?.details).toContain('differ significantly between Salary Slip and Tax Return');
    expect(incomeSignals[0]?.message).not.toMatch(/fraud|fake|scam|forged/i);
  });

  // 6. Declared vs Detected Document-Type Mismatch
  it('6. declared vs detected document-type mismatch: surfaces review signal when declared type contradicts OCR classification', () => {
    const mismatchedDoc = createMockDoc({
      _id: 'doc_mismatch',
      type: 'CONTRACT', // Uploaded as contract
      title: 'Uploaded Document',
      extractedData: {
        classification: {
          status: 'RECOGNIZED',
          detectedType: 'PAYSLIP', // Detected as salary slip
          confidence: 0.92,
          matchedKeywords: ['salary', 'gross'],
        },
        fields: {},
      } as any,
    });

    const signals = documentIntelligenceService.evaluateConsistency(mismatchedDoc, []);
    const typeSignals = signals.filter((s) => s.type === 'DOCUMENT_TYPE_MISMATCH');

    expect(typeSignals).toHaveLength(1);
    expect(typeSignals[0]?.message).toBe('Declared document type differs from detected type');
    expect(typeSignals[0]?.details).toContain('uploaded as CONTRACT, but automated pre-checks detected PAYSLIP');
  });

  // 7. No Signals
  it('7. no signals: returns clean empty array when all document parameters agree', () => {
    const docA = createMockDoc({
      _id: 'doc_a',
      type: 'PAYSLIP',
      title: 'Salary Slip',
      extractedData: {
        classification: { status: 'RECOGNIZED', detectedType: 'PAYSLIP', confidence: 0.95, matchedKeywords: [] },
        fields: {
          borrowerName: { value: 'Rahul Sharma', confidence: 0.95 },
          pan: { value: 'ABCDE1234F', confidence: 0.95 },
          grossIncome: { value: 85000, confidence: 0.95 },
        },
      } as any,
    });

    const docB = createMockDoc({
      _id: 'doc_b',
      type: 'IDENTIFICATION',
      title: 'PAN Card',
      extractedData: {
        classification: { status: 'RECOGNIZED', detectedType: 'IDENTIFICATION', confidence: 0.95, matchedKeywords: [] },
        fields: {
          borrowerName: { value: 'Rahul Sharma', confidence: 0.95 },
          pan: { value: 'ABCDE1234F', confidence: 0.95 },
        },
      } as any,
    });

    const signals = documentIntelligenceService.evaluateConsistency(docA, [docB]);
    expect(signals).toEqual([]);
  });

  // 8. Tenant Isolation
  it('8. tenant isolation: completely ignores sibling documents belonging to a different brokerage', () => {
    const targetDoc = createMockDoc({
      _id: 'doc_target',
      brokerageId: brokerageIdA,
      type: 'IDENTIFICATION',
      title: 'PAN Card A',
      extractedData: {
        classification: { status: 'RECOGNIZED', detectedType: 'IDENTIFICATION', confidence: 0.95, matchedKeywords: [] },
        fields: {
          borrowerName: { value: 'Rahul Sharma', confidence: 0.95 },
          pan: { value: 'ABCDE1234F', confidence: 0.95 },
        },
      } as any,
    });

    // Foreign sibling belonging to another tenant (Brokerage B) with conflicting name & PAN
    const foreignSiblingDoc = createMockDoc({
      _id: 'doc_foreign',
      brokerageId: brokerageIdB,
      type: 'PAYSLIP',
      title: 'Salary Slip Foreign',
      extractedData: {
        classification: { status: 'RECOGNIZED', detectedType: 'PAYSLIP', confidence: 0.95, matchedKeywords: [] },
        fields: {
          borrowerName: { value: 'Different User', confidence: 0.95 },
          pan: { value: 'XXXXX9999X', confidence: 0.95 },
        },
      } as any,
    });

    // Passing the foreign sibling should be safely discarded by tenant boundary defense
    const signals = documentIntelligenceService.evaluateConsistency(targetDoc, [foreignSiblingDoc]);
    expect(signals).toEqual([]);
  });

  // Name Matching Tolerance Edge Cases
  describe('Name Compatibility Tolerance Engine', () => {
    it('tolerates honorifics, casing, punctuation, and initials', () => {
      expect(areNamesCompatible('Mr. Rahul Sharma', 'Rahul Sharma')).toBe(true);
      expect(areNamesCompatible('Dr. Sneha Roy', 'Sneha Roy')).toBe(true);
      expect(areNamesCompatible('RAHUL SHARMA', 'rahul sharma')).toBe(true);
      expect(areNamesCompatible('R. Sharma', 'Rahul Sharma')).toBe(true);
      expect(areNamesCompatible('Rahul Kumar Sharma', 'Rahul Sharma')).toBe(true);
    });

    it('rejects clearly different individual names', () => {
      expect(areNamesCompatible('Rahul Sharma', 'Amit Verma')).toBe(false);
      expect(areNamesCompatible('Priya Patel', 'Rohan Gupta')).toBe(false);
    });
  });
});
