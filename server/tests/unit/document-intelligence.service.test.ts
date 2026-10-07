import { describe, it, expect } from 'vitest';
import {
  documentIntelligenceService,
  CURRENT_MODEL_VERSION,
} from '../../src/services/document-intelligence.service.js';

describe('Document Intelligence Service Unit Tests', () => {
  // 1. PAN / Identification Classification & Field Extraction
  describe('1. PAN / KYC Document Classification & Extraction', () => {
    const syntheticPanOcrText = `
INCOME TAX DEPARTMENT
GOVT. OF INDIA
PERMANENT ACCOUNT NUMBER CARD
ABCDE1234F
RAHUL SHARMA
Father's Name: RAM SHARMA
Date of Birth: 15/08/1990
Signature
`;

    it('classifies PAN card as IDENTIFICATION with high confidence', () => {
      const classification = documentIntelligenceService.classify(syntheticPanOcrText);
      expect(classification.status).toBe('RECOGNIZED');
      expect(classification.detectedType).toBe('IDENTIFICATION');
      expect(classification.confidence).toBeGreaterThanOrEqual(0.85);
      expect(classification.matchedKeywords.length).toBeGreaterThan(0);
    });

    it('extracts structured fields from PAN card correctly', () => {
      const result = documentIntelligenceService.process(syntheticPanOcrText);
      expect(result.classification.detectedType).toBe('IDENTIFICATION');
      expect(result.modelVersion).toBe(CURRENT_MODEL_VERSION);

      // PAN
      expect(result.fields.pan).not.toBeNull();
      expect(result.fields.pan?.value).toBe('ABCDE1234F');
      expect(result.fields.pan?.confidence).toBeGreaterThanOrEqual(0.9);

      // Name
      expect(result.fields.borrowerName).not.toBeNull();
      expect(result.fields.borrowerName?.value).toBe('RAHUL SHARMA');

      // Date of Birth
      expect(result.fields.dateOfBirth).not.toBeNull();
      expect(result.fields.dateOfBirth?.value).toBe('15/08/1990');
    });
  });

  // 2. Salary Slip Classification & Extraction
  describe('2. Salary Slip Document Classification & Extraction', () => {
    const syntheticSalarySlipOcrText = `
ABC Technologies Pvt. Ltd.
Salary Slip for September 2026
Employee Name: Rahul Sharma
Employee ID: LF-1024
Designation: Senior Software Engineer
Gross Earnings: INR 85,000
Net Pay: INR 71,200
PAN: ABCDE1234F
Basic Pay: INR 45,000
HRA: INR 25,000
Deductions: INR 13,800
`;

    it('classifies salary slip as PAYSLIP with high confidence', () => {
      const classification = documentIntelligenceService.classify(syntheticSalarySlipOcrText);
      expect(classification.status).toBe('RECOGNIZED');
      expect(classification.detectedType).toBe('PAYSLIP');
      expect(classification.confidence).toBeGreaterThanOrEqual(0.85);
    });

    it('extracts structured fields from salary slip correctly', () => {
      const result = documentIntelligenceService.process(syntheticSalarySlipOcrText);
      expect(result.classification.status).toBe('RECOGNIZED');
      expect(result.classification.detectedType).toBe('PAYSLIP');

      // Borrower / Employee Name
      expect(result.fields.borrowerName).not.toBeNull();
      expect(result.fields.borrowerName?.value).toBe('Rahul Sharma');

      // Employer
      expect(result.fields.employerName).not.toBeNull();
      expect(result.fields.employerName?.value).toContain('ABC Technologies');

      // Employee ID
      expect(result.fields.employeeId).not.toBeNull();
      expect(result.fields.employeeId?.value).toBe('LF-1024');

      // Salary Amounts
      expect(result.fields.grossIncome?.value).toBe(85000);
      expect(result.fields.netIncome?.value).toBe(71200);
      expect(result.fields.currency?.value).toBe('INR');

      // Document Period
      expect(result.fields.documentPeriod?.value).toBe('September 2026');

      // PAN
      expect(result.fields.pan?.value).toBe('ABCDE1234F');
    });
  });

  // 3. Bank Statement Classification & Extraction
  describe('3. Bank Statement Classification & Extraction', () => {
    const syntheticBankStatementOcrText = `
HDFC Bank Limited
Account Statement
Customer Name: Rahul Sharma
Account Number: 50100234567890
IFSC: HDFC0001234
Branch: Indiranagar, Bangalore
Statement Period: 01/04/2026 to 30/04/2026
Opening Balance: INR 1,50,000.00
Total Withdrawals: INR 45,000.00
Total Deposits: INR 85,000.00
Closing Balance: INR 1,90,000.00
`;

    it('classifies bank statement as BANK_STATEMENT with high confidence', () => {
      const classification = documentIntelligenceService.classify(syntheticBankStatementOcrText);
      expect(classification.status).toBe('RECOGNIZED');
      expect(classification.detectedType).toBe('BANK_STATEMENT');
      expect(classification.confidence).toBeGreaterThanOrEqual(0.85);
    });

    it('extracts bank details and masks account number correctly', () => {
      const result = documentIntelligenceService.process(syntheticBankStatementOcrText);
      expect(result.classification.status).toBe('RECOGNIZED');
      expect(result.classification.detectedType).toBe('BANK_STATEMENT');

      // Bank Name
      expect(result.fields.bankName?.value).toBe('HDFC Bank');

      // Masked Account Number (protects customer PII)
      expect(result.fields.accountNumberMasked).not.toBeNull();
      expect(result.fields.accountNumberMasked?.value).toContain('7890');
      expect(result.fields.accountNumberMasked?.value).toContain('*');
      expect(result.fields.accountNumberMasked?.value).not.toBe('50100234567890');

      // IFSC Code
      expect(result.fields.ifscCode?.value).toBe('HDFC0001234');

      // Customer Name
      expect(result.fields.borrowerName?.value).toBe('Rahul Sharma');

      // Statement Period
      expect(result.fields.documentPeriod?.value).toBe('01/04/2026 to 30/04/2026');
    });
  });

  // 4. ITR (Income Tax Return) Classification & Extraction
  describe('4. Income Tax Return (ITR) Classification & Extraction', () => {
    const syntheticItrOcrText = `
INDIAN INCOME TAX RETURN ACKNOWLEDGEMENT
ITR-V
Assessment Year: 2026-27
PAN: ABCDE1234F
Name of Assessee: Rahul Sharma
Gross Total Income: INR 10,20,000
Total Tax Payable: INR 85,000
Verification: E-filing completed successfully
`;

    it('classifies ITR document as TAX_RETURN with high confidence', () => {
      const classification = documentIntelligenceService.classify(syntheticItrOcrText);
      expect(classification.status).toBe('RECOGNIZED');
      expect(classification.detectedType).toBe('TAX_RETURN');
      expect(classification.confidence).toBeGreaterThanOrEqual(0.85);
    });

    it('extracts ITR structured fields accurately', () => {
      const result = documentIntelligenceService.process(syntheticItrOcrText);
      expect(result.classification.status).toBe('RECOGNIZED');
      expect(result.classification.detectedType).toBe('TAX_RETURN');

      // Assessment Year
      expect(result.fields.assessmentYear?.value).toBe('2026-27');

      // Assessee Name
      expect(result.fields.borrowerName?.value).toBe('Rahul Sharma');

      // PAN
      expect(result.fields.pan?.value).toBe('ABCDE1234F');

      // Gross Income
      expect(result.fields.grossIncome?.value).toBe(1020000);
      expect(result.fields.currency?.value).toBe('INR');
    });
  });

  // 5. Unknown and Insufficient Document Classification
  describe('5. Unknown and Insufficient Document Handling', () => {
    it('correctly labels unrecognized legible text as UNKNOWN', () => {
      const randomText = `
Coffee Shop Equipment Rental Agreement
Terms and conditions of commercial lease for espresso machines.
Serial Number: ESP-99212
Monthly Fee: $120
Both parties agree to standard maintenance and repair protocols.
`;
      const classification = documentIntelligenceService.classify(randomText);
      expect(classification.status).toBe('UNKNOWN');
      expect(classification.detectedType).toBeNull();
      expect(classification.confidence).toBe(0);

      const result = documentIntelligenceService.process(randomText);
      expect(result.classification.status).toBe('UNKNOWN');
      expect(result.fields.pan).toBeNull();
    });

    it('correctly labels sparse or unreadable text as INSUFFICIENT_DATA', () => {
      const sparseTexts = ['', '   ', 'Random text', 'XYZ 123'];
      for (const sparse of sparseTexts) {
        const classification = documentIntelligenceService.classify(sparse);
        expect(classification.status).toBe('INSUFFICIENT_DATA');
        expect(classification.detectedType).toBeNull();
        expect(classification.confidence).toBe(0);
      }
    });
  });

  // 6. Security and Invariants
  describe('6. Security and Domain Invariants', () => {
    it('sets extraction timestamp and model version metadata', () => {
      const sampleText = 'PAYSLIP Employee Name: John Doe Gross Earnings: 50000 Net Pay: 40000';
      const result = documentIntelligenceService.process(sampleText);
      expect(result.extractedAt).toBeInstanceOf(Date);
      expect(result.modelVersion).toBe(CURRENT_MODEL_VERSION);
    });

    it('handles numeric amount normalization with varied delimiters', () => {
      const sample = 'PAYSLIP Gross Salary: INR 1,25,000.50 Net Pay: INR 1,02,400.00';
      const result = documentIntelligenceService.process(sample);
      expect(result.fields.grossIncome?.value).toBe(125000.5);
      expect(result.fields.netIncome?.value).toBe(102400);
    });
  });
});
