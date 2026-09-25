import { Client, type IClient, type IClientDocument } from '../models/client.model.js';
import { ScopedRepository } from './scoped.repository.js';

export class ClientRepository extends ScopedRepository<IClient, IClientDocument> {
  constructor() {
    super(Client);
  }
}

export const clientRepository = new ClientRepository();
