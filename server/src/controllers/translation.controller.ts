  import type { Request, Response, NextFunction } from 'express';
import { aiTranslationService } from '../services/ai-translation.service.js';
import { translateRequestSchema } from '../validators/translation.validators.js';
import { validateData } from '../validators/common.validators.js';

export class TranslationController {
  /**
   * POST /api/translate
   * Translates eligible free-text between English and German.
   * Authenticated endpoint with rate limiting and PII safeguards.
   */
  async translate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = validateData(translateRequestSchema, req.body);

      const result = await aiTranslationService.translate({
        text: data.text,
        targetLang: data.targetLang,
        sourceLang: data.sourceLang,
        context: data.context,
        brokerageId: req.user?.brokerageId,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const translationController = new TranslationController();
