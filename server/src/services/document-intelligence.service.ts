import type {
  DocumentType,
  IDocumentExtractedData,
  IDocumentClassification,
  IDocumentExtractedFields,
  IExtractedField,
  IReviewSignal,
} from '../models/document.model.js';
import { logger } from '../utils/logger.js';

export const CURRENT_MODEL_VERSION = 'rule-engine-1.0';

/**
 * Normalizes number strings like "1,50,000.00" or "85,000" into raw numeric values.
 */
function parseNumericAmount(amountStr: string): number | null {
  if (!amountStr) return null;
  const cleaned = amountStr.replace(/[^0-9.]/g, '');
  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Masks bank account number, preserving only the last 4 digits.
 */
function maskAccountNumber(rawAcc: string): string {
  const digitsOnly = rawAcc.replace(/[^0-9]/g, '');
  if (digitsOnly.length <= 4) {
    return `****${digitsOnly}`;
  }
  const last4 = digitsOnly.slice(-4);
  const maskedPrefix = '*'.repeat(Math.min(digitsOnly.length - 4, 8));
  return `${maskedPrefix}${last4}`;
}

export class DocumentIntelligenceService {
  /**
   * Classifies raw OCR text into one of the recognized financial document types.
   */
  classify(
    ocrText: string,
    declaredType?: DocumentType
  ): IDocumentClassification {
    const trimmed = (ocrText || '').trim();
    if (!trimmed || trimmed.length < 25) {
      return {
        status: 'INSUFFICIENT_DATA',
        detectedType: null,
        confidence: 0,
        matchedKeywords: [],
      };
    }

    const upperText = trimmed.toUpperCase();
    const words = upperText.split(/\s+/).filter(Boolean);
    if (words.length < 5) {
      return {
        status: 'INSUFFICIENT_DATA',
        detectedType: null,
        confidence: 0,
        matchedKeywords: [],
      };
    }

    // Keyword & pattern indicators per category
    const panKeywords = [
      'INCOME TAX DEPARTMENT',
      'GOVT. OF INDIA',
      'GOVT OF INDIA',
      'PERMANENT ACCOUNT NUMBER',
      "FATHER'S NAME",
      'FATHERS NAME',
      'DATE OF BIRTH',
    ];
    const payslipKeywords = [
      'PAYSLIP',
      'SALARY SLIP',
      'PAY SLIP',
      'GROSS EARNINGS',
      'GROSS SALARY',
      'NET PAY',
      'NET SALARY',
      'BASIC PAY',
      'DEDUCTIONS',
      'EMPLOYEE ID',
      'DESIGNATION',
      'EARNINGS',
    ];
    const bankKeywords = [
      'ACCOUNT STATEMENT',
      'BANK STATEMENT',
      'STATEMENT OF ACCOUNT',
      'ACCOUNT NUMBER',
      'A/C NO',
      'IFSC',
      'OPENING BALANCE',
      'CLOSING BALANCE',
      'WITHDRAWALS',
      'DEPOSITS',
      'TRANSACTION DATE',
    ];
    const itrKeywords = [
      'INDIAN INCOME TAX RETURN',
      'INCOME TAX RETURN ACKNOWLEDGEMENT',
      'ITR-V',
      'ITR-1',
      'ITR-2',
      'ITR-3',
      'ITR-4',
      'ASSESSMENT YEAR',
      'FINANCIAL YEAR',
      'GROSS TOTAL INCOME',
      'TOTAL TAX PAYABLE',
      'TAX PAYABLE',
    ];

    const matchKeywords = (list: string[]) =>
      list.filter((kw) => upperText.includes(kw));

    const matchedPanKws = matchKeywords(panKeywords);
    const matchedPayslipKws = matchKeywords(payslipKeywords);
    const matchedBankKws = matchKeywords(bankKeywords);
    const matchedItrKws = matchKeywords(itrKeywords);

    // PAN regex detection
    const hasPanRegex = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/.test(upperText);

    // Compute category scores (0.0 to 1.0)
    let panScore = 0;
    if (hasPanRegex) panScore += 0.45;
    if (upperText.includes('PERMANENT ACCOUNT NUMBER') || upperText.includes('INCOME TAX DEPARTMENT')) {
      panScore += 0.35;
    }
    if (upperText.includes('FATHER') || upperText.includes('DATE OF BIRTH') || upperText.includes('DOB')) {
      panScore += 0.20;
    }
    panScore = Math.min(panScore, 0.98);

    let payslipScore = 0;
    if (upperText.includes('PAYSLIP') || upperText.includes('SALARY SLIP') || upperText.includes('PAY SLIP')) {
      payslipScore += 0.40;
    }
    if ((upperText.includes('GROSS') || upperText.includes('EARNINGS')) && (upperText.includes('NET PAY') || upperText.includes('NET SALARY'))) {
      payslipScore += 0.35;
    }
    if (upperText.includes('EMPLOYEE ID') || upperText.includes('DESIGNATION') || upperText.includes('BASIC PAY')) {
      payslipScore += 0.25;
    }
    payslipScore = Math.min(payslipScore, 0.98);

    let bankScore = 0;
    if (upperText.includes('BANK STATEMENT') || upperText.includes('ACCOUNT STATEMENT') || upperText.includes('STATEMENT OF ACCOUNT')) {
      bankScore += 0.40;
    }
    if (upperText.includes('OPENING BALANCE') || upperText.includes('CLOSING BALANCE')) {
      bankScore += 0.30;
    }
    if (upperText.includes('ACCOUNT NUMBER') || upperText.includes('A/C NO') || upperText.includes('IFSC')) {
      bankScore += 0.30;
    }
    bankScore = Math.min(bankScore, 0.98);

    let itrScore = 0;
    if (upperText.includes('ITR-V') || upperText.includes('INCOME TAX RETURN') || upperText.includes('INDIAN INCOME TAX RETURN')) {
      itrScore += 0.40;
    }
    if (upperText.includes('ASSESSMENT YEAR') || upperText.includes('FINANCIAL YEAR')) {
      itrScore += 0.30;
    }
    if (upperText.includes('GROSS TOTAL INCOME') || upperText.includes('TAX PAYABLE') || upperText.includes('TOTAL TAX')) {
      itrScore += 0.30;
    }
    itrScore = Math.min(itrScore, 0.98);

    // If ITR contains PAN, PAN is part of ITR, not standalone PAN card
    if (itrScore >= 0.50 && panScore > 0) {
      panScore = 0.20;
    }

    const categories: Array<{
      type: DocumentType;
      score: number;
      matched: string[];
    }> = [
      { type: 'IDENTIFICATION', score: panScore, matched: matchedPanKws },
      { type: 'PAYSLIP', score: payslipScore, matched: matchedPayslipKws },
      { type: 'BANK_STATEMENT', score: bankScore, matched: matchedBankKws },
      { type: 'TAX_RETURN', score: itrScore, matched: matchedItrKws },
    ];

    categories.sort((a, b) => b.score - a.score);
    const top = categories[0];

    // Threshold for recognition is 0.50
    if (top && top.score >= 0.50) {
      return {
        status: 'RECOGNIZED',
        detectedType: top.type,
        confidence: Math.round(top.score * 100) / 100,
        matchedKeywords: top.matched,
      };
    }

    // Legible content, but does not match any of the 4 financial categories
    return {
      status: 'UNKNOWN',
      detectedType: null,
      confidence: 0,
      matchedKeywords: [],
    };
  }

  /**
   * Extracts structured domain fields from OCR text using deterministic patterns.
   */
  extractFields(
    ocrText: string,
    classification: IDocumentClassification
  ): IDocumentExtractedFields {
    const fields: IDocumentExtractedFields = {
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
    };

    if (!ocrText || classification.status === 'INSUFFICIENT_DATA') {
      return fields;
    }

    const text = ocrText;
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    // 1. PAN Extraction (strict 10-char alphanumeric Indian PAN)
    const panMatch = text.match(/\b([A-Z]{5}[0-9]{4}[A-Z])\b/);
    if (panMatch && panMatch[1]) {
      fields.pan = {
        value: panMatch[1],
        confidence: 0.95,
      };
    }

    // 2. Currency Detection
    if (/INR|Rs\.?|₹/i.test(text)) {
      fields.currency = { value: 'INR', confidence: 0.95 };
    } else if (/EUR|€/i.test(text)) {
      fields.currency = { value: 'EUR', confidence: 0.95 };
    } else if (/USD|\$/i.test(text)) {
      fields.currency = { value: 'USD', confidence: 0.95 };
    }

    // 3. Document Period Detection
    // Matches e.g. "September 2026", "01/04/2026 to 30/04/2026", or "2025-2026"
    const monthYearMatch = text.match(
      /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/i
    );
    const dateRangeMatch = text.match(
      /\b(\d{2}[/\-.]\d{2}[/\-.]\d{4})\s*(?:to|-)\s*(\d{2}[/\-.]\d{2}[/\-.]\d{4})\b/i
    );
    const yearRangeMatch = text.match(
      /\b(20\d{2}\s*[-–]\s*20?\d{2})\b/
    );

    if (dateRangeMatch && dateRangeMatch[1] && dateRangeMatch[2]) {
      fields.documentPeriod = {
        value: `${dateRangeMatch[1]} to ${dateRangeMatch[2]}`,
        confidence: 0.90,
      };
    } else if (monthYearMatch && monthYearMatch[0]) {
      fields.documentPeriod = {
        value: monthYearMatch[0],
        confidence: 0.85,
      };
    } else if (yearRangeMatch && yearRangeMatch[1]) {
      fields.documentPeriod = {
        value: yearRangeMatch[1].replace(/\s+/g, ''),
        confidence: 0.80,
      };
    }

    // 4. Date of Birth
    const dobMatch = text.match(
      /(?:DOB|Date of Birth|D\.O\.B)\s*[:\-]?\s*(\d{2}[/\-.]\d{2}[/\-.]\d{4})/i
    );
    if (dobMatch && dobMatch[1]) {
      fields.dateOfBirth = {
        value: dobMatch[1],
        confidence: 0.90,
      };
    }

    // 5. Category-Specific Extractions

    // --- A. IDENTIFICATION (PAN / Identity Card) ---
    if (classification.detectedType === 'IDENTIFICATION') {
      // Find candidate name in PAN card: look before Father's Name or standalone uppercase line
      let panName: string | null = null;

      // 1. Check for explicit Cardholder Name label (ignoring Father's Name)
      const explicitCardholder = text.match(/(?:Cardholder\s+Name)\s*[:\-]?\s*([A-Za-z .]{2,40})/i);
      if (explicitCardholder && explicitCardholder[1]) {
        panName = explicitCardholder[1].trim();
      }

      // 2. Line heuristic: check line right before "Father"
      if (!panName) {
        for (let i = 0; i < lines.length; i++) {
          const l = lines[i];
          if (!l) continue;
          if (/Father/i.test(l) && i > 0) {
            const prev = lines[i - 1]?.trim();
            if (
              prev &&
              /^[A-Za-z .]{2,35}$/.test(prev) &&
              !/INCOME|GOVT|INDIA|PERMANENT|ACCOUNT|NUMBER|CARD|SIGNATURE/i.test(prev) &&
              !/\b[A-Z]{5}[0-9]{4}[A-Z]\b/.test(prev)
            ) {
              panName = prev;
              break;
            }
          }
        }
      }

      // 3. Line heuristic: line right after PAN number
      if (!panName) {
        for (let i = 0; i < lines.length; i++) {
          const l = lines[i];
          if (!l) continue;
          if (/\b[A-Z]{5}[0-9]{4}[A-Z]\b/.test(l) && i + 1 < lines.length) {
            const next = lines[i + 1]?.trim();
            if (
              next &&
              /^[A-Za-z .]{2,35}$/.test(next) &&
              !/INCOME|GOVT|INDIA|PERMANENT|ACCOUNT|NUMBER|CARD|SIGNATURE|FATHER|DATE/i.test(next)
            ) {
              panName = next;
              break;
            }
          }
        }
      }

      if (panName) {
        fields.borrowerName = { value: panName, confidence: 0.85 };
      }
    }

    // --- B. PAYSLIP (Salary Slip) ---
    if (classification.detectedType === 'PAYSLIP') {
      // Borrower / Employee Name (stop at line break)
      const empNameMatch = text.match(
        /(?:Employee\s+Name|Emp\s+Name|Name)\s*[:\-]?\s*([A-Za-z .]{2,40})/i
      );
      if (empNameMatch && empNameMatch[1]?.trim()) {
        fields.borrowerName = {
          value: empNameMatch[1].trim(),
          confidence: 0.90,
        };
      }

      // Employee ID
      const empIdMatch = text.match(
        /(?:Employee\s+ID|Emp\s+ID|Emp\s+Code|Staff\s+ID)\s*[:\-]?\s*([A-Za-z0-9\-]+)/i
      );
      if (empIdMatch && empIdMatch[1]?.trim()) {
        fields.employeeId = {
          value: empIdMatch[1].trim(),
          confidence: 0.90,
        };
      }

      // Employer / Company Name
      const compLabeledMatch = text.match(
        /(?:Company\s+Name|Employer|Organization)\s*[:\-]?\s*([^\n\r]+)/i
      );
      if (compLabeledMatch && compLabeledMatch[1]?.trim()) {
        fields.employerName = {
          value: compLabeledMatch[1].trim(),
          confidence: 0.90,
        };
      } else {
        // Check top 4 lines for corporate suffixes (Pvt Ltd, Technologies, Solutions, Inc, GmbH)
        for (let i = 0; i < Math.min(lines.length, 4); i++) {
          const l = lines[i];
          if (!l) continue;
          if (/(?:Pvt\.?\s*Ltd\.?|Limited|Technologies|Solutions|Services|Corp|GmbH|LLC|Inc\.?)/i.test(l)) {
            fields.employerName = { value: l, confidence: 0.85 };
            break;
          }
        }
      }

      // Gross Salary / Earnings
      const grossMatch = text.match(
        /(?:Gross(?:\s+Earnings|\s+Salary|\s+Pay)?)\s*[:\-]?\s*(?:INR|Rs\.?|₹|\$|€)?\s*([\d,]+(?:\.\d{2})?)/i
      );
      if (grossMatch && grossMatch[1]) {
        const parsed = parseNumericAmount(grossMatch[1]);
        if (parsed !== null) {
          fields.grossIncome = { value: parsed, confidence: 0.90 };
        }
      }

      // Net Pay / Take Home
      const netMatch = text.match(
        /(?:Net(?:\s+Pay|\s+Salary|\s+Amount)?|Take\s+Home)\s*[:\-]?\s*(?:INR|Rs\.?|₹|\$|€)?\s*([\d,]+(?:\.\d{2})?)/i
      );
      if (netMatch && netMatch[1]) {
        const parsed = parseNumericAmount(netMatch[1]);
        if (parsed !== null) {
          fields.netIncome = { value: parsed, confidence: 0.90 };
        }
      }
    }

    // --- C. BANK_STATEMENT ---
    if (classification.detectedType === 'BANK_STATEMENT') {
      // Customer / Account Name (stop at newline)
      const custNameMatch = text.match(
        /(?:Customer\s+Name|Account\s+Name|Name)\s*[:\-]?\s*([A-Za-z .]{2,40})/i
      );
      if (custNameMatch && custNameMatch[1]?.trim()) {
        fields.borrowerName = {
          value: custNameMatch[1].trim(),
          confidence: 0.85,
        };
      }

      // Bank Name
      const bankMatch = text.match(
        /\b(HDFC\s+Bank|ICICI\s+Bank|State\s+Bank\s+of\s+India|SBI|Axis\s+Bank|Kotak\s+Mahindra\s+Bank|Punjab\s+National\s+Bank|Bank\s+of\s+Baroda|Canara\s+Bank|Citibank|Deutsche\s+Bank|Standard\s+Chartered)\b/i
      );
      if (bankMatch && bankMatch[0]) {
        fields.bankName = {
          value: bankMatch[0],
          confidence: 0.90,
        };
      }

      // Account Number (Strictly Masked)
      const accMatch = text.match(
        /(?:Account\s+Number|Account\s+No|A\/c\s+No|A\/c\s+Number)\s*[:\-]?\s*([0-9xX*\-]{6,25})/i
      );
      if (accMatch && accMatch[1]) {
        fields.accountNumberMasked = {
          value: maskAccountNumber(accMatch[1]),
          confidence: 0.90,
        };
      }

      // IFSC Code
      const ifscMatch = text.match(/\b([A-Z]{4}0[A-Z0-9]{6})\b/);
      if (ifscMatch && ifscMatch[1]) {
        fields.ifscCode = {
          value: ifscMatch[1],
          confidence: 0.95,
        };
      }
    }

    // --- D. TAX_RETURN (ITR) ---
    if (classification.detectedType === 'TAX_RETURN') {
      // Assessee Name (stop at newline)
      const assesseeMatch = text.match(
        /(?:Name\s+of\s+Assessee|Assessee\s+Name|Name)\s*[:\-]?\s*([A-Za-z .]{2,40})/i
      );
      if (assesseeMatch && assesseeMatch[1]?.trim()) {
        fields.borrowerName = {
          value: assesseeMatch[1].trim(),
          confidence: 0.85,
        };
      }
      if (assesseeMatch && assesseeMatch[1]?.trim()) {
        fields.borrowerName = {
          value: assesseeMatch[1].trim(),
          confidence: 0.85,
        };
      }

      // Assessment Year
      const ayMatch = text.match(
        /(?:Assessment\s+Year|AY)\s*[:\-]?\s*(\d{4}\s*[-–]\s*\d{2,4})/i
      );
      if (ayMatch && ayMatch[1]) {
        fields.assessmentYear = {
          value: ayMatch[1].replace(/\s+/g, ''),
          confidence: 0.90,
        };
      }

      // Gross Total Income
      const totalIncomeMatch = text.match(
        /(?:Gross\s+Total\s+Income|Total\s+Income)\s*[:\-]?\s*(?:INR|Rs\.?|₹|\$|€)?\s*([\d,]+(?:\.\d{2})?)/i
      );
      if (totalIncomeMatch && totalIncomeMatch[1]) {
        const parsed = parseNumericAmount(totalIncomeMatch[1]);
        if (parsed !== null) {
          fields.grossIncome = { value: parsed, confidence: 0.90 };
        }
      }
    }

    return fields;
  }

  /**
   * Main entry point: executes classification and structured extraction on OCR text.
   */
  process(
    ocrText: string,
    declaredType?: DocumentType
  ): IDocumentExtractedData {
    const classification = this.classify(ocrText, declaredType);
    const fields = this.extractFields(ocrText, classification);

    // Count extracted fields for metrics logging (avoiding any PII exposure)
    const extractedFieldsCount = Object.values(fields).filter((f) => f !== null).length;

    logger.info(
      {
        status: classification.status,
        detectedType: classification.detectedType,
        confidence: classification.confidence,
        extractedFieldsCount,
      },
      'Document classification and structured field extraction completed'
    );

    return {
      classification,
      fields,
      reviewSignals: [],
      extractedAt: new Date(),
      modelVersion: CURRENT_MODEL_VERSION,
    };
  }

  /**
   * Checks document-type consistency between declared and detected types.
   */
  /**
   * Checks document-type consistency between declared and detected types.
   */
  checkDocumentTypeConsistency(target: ConsistencyCheckDocument): IReviewSignal[] {
    const signals: IReviewSignal[] = [];
    const detectedType = target.extractedData?.classification?.detectedType;
    const classificationStatus = target.extractedData?.classification?.status;

    if (classificationStatus === 'RECOGNIZED' && detectedType) {
      if (target.type !== detectedType) {
        // Exception: INCOME_PROOF, PAYSLIP, and TAX_RETURN are compatible domain categories
        const isCompatibleAlias =
          (target.type === 'INCOME_PROOF' && (detectedType === 'PAYSLIP' || detectedType === 'TAX_RETURN')) ||
          ((target.type === 'PAYSLIP' || target.type === 'TAX_RETURN') && detectedType === 'INCOME_PROOF');

        if (!isCompatibleAlias) {
          signals.push({
            id: 'sig_doc_type_mismatch',
            type: 'DOCUMENT_TYPE_MISMATCH',
            severity: 'INFO',
            message: 'Declared document type differs from detected type',
            details: `Document was uploaded as ${target.type}, but automated pre-checks detected ${detectedType} with high confidence.`,
            field: 'type',
            relatedDocumentIds: [target._id.toString()],
            relatedDocumentTitles: [target.title || target.type],
          });
        }
      }
    }

    return signals;
  }

  /**
   * Checks identity consistency across documents belonging to the same client/case.
   */
  checkIdentityConsistency(
    target: ConsistencyCheckDocument,
    siblings: ConsistencyCheckDocument[]
  ): IReviewSignal[] {
    const signals: IReviewSignal[] = [];
    const targetFields = target.extractedData?.fields;
    if (!targetFields) return signals;

    const targetName = targetFields.borrowerName?.value;
    const targetPan = targetFields.pan?.value?.toUpperCase();
    const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

    for (const sib of siblings) {
      const sibFields = sib.extractedData?.fields;
      if (!sibFields) continue;

      // 1. Borrower Name Check
      const sibName = sibFields.borrowerName?.value;
      if (targetName && sibName) {
        if (!areNamesCompatible(targetName, sibName)) {
          signals.push({
            id: `sig_identity_name_${sib._id}`,
            type: 'IDENTITY_MISMATCH',
            severity: 'WARNING',
            message: 'Identity information differs across documents',
            details: `Borrower name on this document differs from ${sib.title || sib.type}.`,
            field: 'borrowerName',
            relatedDocumentIds: [sib._id.toString()],
            relatedDocumentTitles: [sib.title || sib.type],
          });
        }
      }

      // 2. PAN Check (strict format comparison when both are valid 10-char PANs)
      const sibPan = sibFields.pan?.value?.toUpperCase();
      if (targetPan && sibPan) {
        if (PAN_REGEX.test(targetPan) && PAN_REGEX.test(sibPan) && targetPan !== sibPan) {
          signals.push({
            id: `sig_identity_pan_${sib._id}`,
            type: 'IDENTITY_MISMATCH',
            severity: 'WARNING',
            message: 'Identity information differs across documents',
            details: `PAN identifier on this document differs from ${sib.title || sib.type}.`,
            field: 'pan',
            relatedDocumentIds: [sib._id.toString()],
            relatedDocumentTitles: [sib.title || sib.type],
          });
        }
      }
    }

    return signals;
  }

  /**
   * Checks income consistency between Salary Slip and Tax Return (ITR).
   */
  checkIncomeConsistency(
    target: ConsistencyCheckDocument,
    siblings: ConsistencyCheckDocument[]
  ): IReviewSignal[] {
    const signals: IReviewSignal[] = [];
    const targetFields = target.extractedData?.fields;
    if (!targetFields) return signals;

    const targetType = target.extractedData?.classification?.detectedType || target.type;

    for (const sib of siblings) {
      const sibFields = sib.extractedData?.fields;
      if (!sibFields) continue;

      const sibType = sib.extractedData?.classification?.detectedType || sib.type;

      // Cross-compare between Salary Slip and Tax Return (ITR)
      let salaryDoc: ConsistencyCheckDocument | null = null;
      let itrDoc: ConsistencyCheckDocument | null = null;

      const isTargetPayslip = targetType === 'PAYSLIP' || target.type === 'PAYSLIP';
      const isTargetTaxReturn = targetType === 'TAX_RETURN' || target.type === 'TAX_RETURN';
      const isSibPayslip = sibType === 'PAYSLIP' || sib.type === 'PAYSLIP';
      const isSibTaxReturn = sibType === 'TAX_RETURN' || sib.type === 'TAX_RETURN';

      if (isTargetPayslip && isSibTaxReturn) {
        salaryDoc = target;
        itrDoc = sib;
      } else if (isTargetTaxReturn && isSibPayslip) {
        salaryDoc = sib;
        itrDoc = target;
      }

      if (salaryDoc && itrDoc) {
        const monthlySalary =
          salaryDoc.extractedData?.fields?.grossIncome?.value ||
          salaryDoc.extractedData?.fields?.netIncome?.value;
        const annualItr = itrDoc.extractedData?.fields?.grossIncome?.value;

        if (monthlySalary && annualItr && monthlySalary > 0 && annualItr > 0) {
          const annualizedSalary = monthlySalary * 12;
          const maxVal = Math.max(annualizedSalary, annualItr);
          const minVal = Math.min(annualizedSalary, annualItr);
          const ratio = maxVal / minVal;

          // Significant mismatch: more than 2.0x difference (e.g. >100% variance)
          if (ratio > 2.0) {
            signals.push({
              id: `sig_income_${sib._id}`,
              type: 'INCOME_INCONSISTENCY',
              severity: 'WARNING',
              message: 'Income figures may require review',
              details: `Extracted annual income figures differ significantly between Salary Slip and Tax Return (${sib.title || sib.type}).`,
              field: 'grossIncome',
              relatedDocumentIds: [sib._id.toString()],
              relatedDocumentTitles: [sib.title || sib.type],
            });
          }
        }
      }
    }

    return signals;
  }

  /**
   * Evaluates all cross-document consistency review signals with strict tenant isolation.
   */
  evaluateConsistency(
    target: ConsistencyCheckDocument,
    siblings: ConsistencyCheckDocument[]
  ): IReviewSignal[] {
    // Strict tenant boundary isolation defense: filter out any cross-tenant or self references
    const targetBrokerage = target.brokerageId?.toString();
    const isolatedSiblings = siblings.filter(
      (s) =>
        s.brokerageId?.toString() === targetBrokerage &&
        s._id?.toString() !== target._id?.toString()
    );

    const signals: IReviewSignal[] = [
      ...this.checkDocumentTypeConsistency(target),
      ...this.checkIdentityConsistency(target, isolatedSiblings),
      ...this.checkIncomeConsistency(target, isolatedSiblings),
    ];

    // Deduplicate by signal id
    const seen = new Set<string>();
    return signals.filter((s) => {
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });
  }
}

export interface ConsistencyCheckDocument {
  _id: string | { toString(): string };
  brokerageId: string | { toString(): string };
  type: DocumentType;
  title?: string;
  extractedData?: IDocumentExtractedData | null;
}

export function normalizeNameTokens(rawName: string): string[] {
  if (!rawName) return [];
  const cleaned = rawName
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .trim();
  const titleWords = new Set(['mr', 'mrs', 'ms', 'dr', 'shri', 'smt', 'kumar', 'kumari']);
  return cleaned
    .split(/\s+/)
    .filter((w) => w.length > 0 && !titleWords.has(w));
}

export function areNamesCompatible(nameA: string, nameB: string): boolean {
  if (!nameA || !nameB) return true;
  const tokensA = normalizeNameTokens(nameA);
  const tokensB = normalizeNameTokens(nameB);
  if (tokensA.length === 0 || tokensB.length === 0) return true;

  // Exact match
  if (tokensA.join(' ') === tokensB.join(' ')) return true;
  if (tokensA.slice().sort().join(' ') === tokensB.slice().sort().join(' ')) return true;

  // Single token containment (e.g. "sharma" in ["rahul", "sharma"])
  if (tokensA.length === 1 && tokensB.includes(tokensA[0]!)) return true;
  if (tokensB.length === 1 && tokensA.includes(tokensB[0]!)) return true;

  // Initial matching (e.g. "r sharma" vs "rahul sharma")
  const lastA = tokensA[tokensA.length - 1];
  const lastB = tokensB[tokensB.length - 1];
  if (lastA === lastB) {
    const firstA = tokensA[0]!;
    const firstB = tokensB[0]!;
    if (firstA === firstB || firstA[0] === firstB[0]) {
      return true;
    }
  }

  // Token overlap check
  const setA = new Set(tokensA);
  const common = tokensB.filter((t) => setA.has(t));
  const minLen = Math.min(tokensA.length, tokensB.length);
  if (common.length >= Math.ceil(minLen / 2) && common.length >= 1) {
    return true;
  }

  return false;
}

export const documentIntelligenceService = new DocumentIntelligenceService();
