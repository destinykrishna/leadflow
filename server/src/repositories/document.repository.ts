import { Document as DocumentModel, type IDocument, type IDocumentDocument } from '../models/document.model.js';
import { ScopedRepository } from './scoped.repository.js';

export class DocumentRepository extends ScopedRepository<IDocument, IDocumentDocument> {
  constructor() {
    super(DocumentModel);
  }
}

export const documentRepository = new DocumentRepository();
