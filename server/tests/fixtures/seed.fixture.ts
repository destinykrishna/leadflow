import { Types } from 'mongoose';
import {
  Brokerage,
  User,
  Lead,
  Client,
  Document as DocumentModel,
  Task,
  EmailTemplate,
  PipelineTrigger,
} from '../../src/models/index.js';

/**
 * Creates minimal seed data aligning with assignment requirements:
 * - 1 Platform Admin (system-level)
 * - 2 Brokerages (Berlin Mortgages & Munich Expat Finance)
 * - Users for all 4 roles (PLATFORM_ADMIN, BROKERAGE_ADMIN, ADVISOR, CLIENT)
 * - Sample Lead, Client, Document, Task, EmailTemplate, PipelineTrigger
 */
export async function createMinimalSeedData() {
  // 1. Platform Admin (no brokerageId)
  const platformAdmin = await User.create({
    name: 'Platform Superadmin',
    email: 'admin@leadflow-platform.com',
    passwordHash: '$2b$10$hashedpasswordforexpatmortgages',
    role: 'PLATFORM_ADMIN',
    status: 'ACTIVE',
  });

  // 2. Brokerage A
  const brokerageA = await Brokerage.create({
    name: 'Berlin Expat Mortgages GmbH',
    slug: 'berlin-expat-mortgages',
    plan: 'GROWTH',
    status: 'ACTIVE',
  });

  // 3. Brokerage B (for tenant isolation verification)
  const brokerageB = await Brokerage.create({
    name: 'Munich Home Loans UG',
    slug: 'munich-home-loans',
    plan: 'STARTER',
    status: 'ACTIVE',
  });

  // 4. Brokerage Admin for Brokerage A
  const brokerageAdmin = await User.create({
    brokerageId: brokerageA._id,
    name: 'Klaus Mueller',
    email: 'klaus.mueller@berlin-mortgages.de',
    passwordHash: '$2b$10$hashedpasswordforexpatmortgages',
    role: 'BROKERAGE_ADMIN',
    status: 'ACTIVE',
  });

  // 5. Advisor for Brokerage A
  const advisor = await User.create({
    brokerageId: brokerageA._id,
    name: 'Elena Schmidt',
    email: 'elena.schmidt@berlin-mortgages.de',
    passwordHash: '$2b$10$hashedpasswordforexpatmortgages',
    role: 'ADVISOR',
    status: 'ACTIVE',
  });

  // 6. Client User account for portal access
  const clientUser = await User.create({
    brokerageId: brokerageA._id,
    name: 'Alex Johnson',
    email: 'alex.expat@gmail.com',
    passwordHash: '$2b$10$hashedpasswordforexpatmortgages',
    role: 'CLIENT',
    status: 'ACTIVE',
  });

  // 7. Lead for Brokerage A
  const lead = await Lead.create({
    brokerageId: brokerageA._id,
    firstName: 'David',
    lastName: 'Chen',
    email: 'david.chen@expat-tech.com',
    phone: '+49 170 1234567',
    status: 'NEW',
    source: 'WEBSITE',
    score: 85,
    assignedTo: advisor._id,
  });

  // 8. Client profile for Alex Johnson (linked to clientUser)
  const client = await Client.create({
    brokerageId: brokerageA._id,
    userId: clientUser._id,
    firstName: 'Alex',
    lastName: 'Johnson',
    email: 'alex.expat@gmail.com',
    phone: '+49 171 9876543',
    status: 'ACTIVE',
    type: 'BUYER',
    assignedTo: advisor._id,
    address: {
      street: 'Friedrichstraße 42',
      city: 'Berlin',
      state: 'Berlin',
      postalCode: '10117',
    },
  });

  // 9. Document uploaded by Client
  const document = await DocumentModel.create({
    brokerageId: brokerageA._id,
    title: 'March 2026 Payslip (Gehaltsabrechnung)',
    fileUrl: 'https://storage.leadflow.internal/docs/payslip_alex_032026.pdf',
    type: 'PAYSLIP',
    status: 'PENDING',
    uploadedBy: clientUser._id,
    clientId: client._id,
  });

  // 10. Task assigned to Advisor
  const task = await Task.create({
    brokerageId: brokerageA._id,
    title: 'Call new expat lead within 2 hours',
    description: 'Lead interested in apartment in Berlin Mitte. Verify German visa status.',
    status: 'PENDING',
    priority: 'HIGH',
    assignedTo: advisor._id,
    leadId: lead._id,
    dueDate: new Date(Date.now() + 2 * 60 * 60 * 1000),
  });

  // 11. Email template
  const emailTemplate = await EmailTemplate.create({
    brokerageId: brokerageA._id,
    name: 'New Lead Welcome Email',
    slug: 'new-lead-welcome',
    subject: 'Welcome to Berlin Expat Mortgages, {{lead.firstName}}',
    body: '<p>Hello {{lead.firstName}}, your advisor {{advisor.name}} will contact you shortly.</p>',
    variables: ['lead.firstName', 'advisor.name'],
  });

  // 12. Pipeline trigger
  const pipelineTrigger = await PipelineTrigger.create({
    brokerageId: brokerageA._id,
    name: 'Auto-create call task when lead lands in NEW',
    fromStage: null,
    toStage: 'NEW',
    actionType: 'CREATE_TASK',
    actionConfig: {
      taskTitle: 'Call lead within 2 hours',
      taskPriority: 'HIGH',
      dueDaysOffset: 0,
    },
  });

  return {
    platformAdmin,
    brokerageA,
    brokerageB,
    brokerageAdmin,
    advisor,
    clientUser,
    lead,
    client,
    document,
    task,
    emailTemplate,
    pipelineTrigger,
  };
}
