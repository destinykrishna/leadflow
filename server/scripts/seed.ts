import mongoose from 'mongoose'
import { env } from '../src/config/env.js'
import {
  Brokerage,
  User,
  Lead,
  Client,
  Document as DocumentModel,
  Task,
  EmailTemplate,
  PipelineTrigger,
  TriggerExecution,
  Session,
} from '../src/models/index.js'
import { hashPassword } from '../src/utils/password.js'

async function seed() {
  console.log(`Connecting to MongoDB at: ${env.MONGODB_URI}...`)
  await mongoose.connect(env.MONGODB_URI)
  console.log('MongoDB connected successfully.')

  console.log('Clearing existing collections for a clean re-seed...')
  await Promise.all([
    Session.deleteMany({}),
    TriggerExecution.deleteMany({}),
    Task.deleteMany({}),
    DocumentModel.deleteMany({}),
    Lead.deleteMany({}),
    Client.deleteMany({}),
    User.deleteMany({}),
    Brokerage.deleteMany({}),
    EmailTemplate.deleteMany({}),
    PipelineTrigger.deleteMany({}),
  ])
  console.log('All previous database collections cleared.')

  const defaultPassword = 'Password123!'
  const passwordHash = await hashPassword(defaultPassword)

  // 1. Platform Admin
  const platformAdmin = await User.create({
    name: 'Platform Superadmin',
    email: 'admin@leadflow-platform.com',
    passwordHash,
    role: 'PLATFORM_ADMIN',
    status: 'ACTIVE',
    brokerageId: null,
  })
  console.log('Created Platform Admin:', platformAdmin.email)

  // 2. Brokerages
  const brokerageA = await Brokerage.create({
    name: 'Berlin Expat Mortgages GmbH',
    slug: 'berlin-expat-mortgages',
    webhookSecret: 'whsec_berlin_demo_secret_2026',
    plan: 'GROWTH',
    status: 'ACTIVE',
  })
  console.log('Created Brokerage A:', brokerageA.name)

  const brokerageB = await Brokerage.create({
    name: 'Munich Home Loans UG',
    slug: 'munich-home-loans',
    webhookSecret: 'whsec_munich_demo_secret_2026',
    plan: 'STARTER',
    status: 'ACTIVE',
  })
  console.log('Created Brokerage B:', brokerageB.name)

  // 3. Brokerage Admin
  const brokerageAdmin = await User.create({
    brokerageId: brokerageA._id,
    name: 'Klaus Mueller',
    email: 'klaus.mueller@berlin-mortgages.de',
    passwordHash,
    role: 'BROKERAGE_ADMIN',
    status: 'ACTIVE',
  })
  console.log('Created Brokerage Admin:', brokerageAdmin.email)

  // 4. Advisor
  const advisor = await User.create({
    brokerageId: brokerageA._id,
    name: 'Elena Schmidt',
    email: 'elena.schmidt@berlin-mortgages.de',
    passwordHash,
    role: 'ADVISOR',
    status: 'ACTIVE',
  })
  console.log('Created Advisor:', advisor.email)

  // 5. Client User Account
  const clientUser = await User.create({
    brokerageId: brokerageA._id,
    name: 'Alex Johnson',
    email: 'alex.expat@gmail.com',
    passwordHash,
    role: 'CLIENT',
    status: 'ACTIVE',
  })
  console.log('Created Client User:', clientUser.email)

  // 6. Client Profile
  const clientProfile = await Client.create({
    brokerageId: brokerageA._id,
    userId: clientUser._id,
    assignedTo: advisor._id,
    firstName: 'Alex',
    lastName: 'Johnson',
    email: 'alex.expat@gmail.com',
    phone: '+49 176 12345678',
    type: 'BUYER',
    status: 'ACTIVE',
    address: {
      street: 'Friedrichstraße 42',
      city: 'Berlin',
      state: 'Berlin',
      postalCode: '10117',
    },
  })
  console.log('Created Client Profile for:', clientProfile.email)

  // 7. Sample Document for Client
  await DocumentModel.create({
    brokerageId: brokerageA._id,
    title: 'March 2026 Payslip (Gehaltsabrechnung)',
    fileUrl: 'https://storage.leadflow.internal/docs/payslip_alex_032026.pdf',
    type: 'PAYSLIP',
    status: 'VERIFIED',
    uploadedBy: clientUser._id,
    clientId: clientProfile._id,
  })
  console.log('Created sample verified document for Alex Johnson')

  // 8. Sample Tasks
  await Task.create({
    brokerageId: brokerageA._id,
    title: 'Initial mortgage consultation with Alex Johnson',
    description: 'Review Blue Card residency status and 3-month bank statements.',
    status: 'PENDING',
    priority: 'HIGH',
    assignedTo: advisor._id,
    clientId: clientProfile._id,
    dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
  })
  console.log('Created sample task for Elena Schmidt')

  // 9. Email Template & Pipeline Trigger
  await EmailTemplate.create({
    brokerageId: brokerageA._id,
    name: 'New Inquiry Confirmation',
    slug: 'new-inquiry-confirmation',
    subject: 'Welcome to Berlin Expat Mortgages, {{lead.firstName}}',
    body: '<p>Hi {{lead.firstName}}, thank you for submitting your mortgage inquiry. Your dedicated advisor {{advisor.name}} will contact you shortly.</p>',
    variables: ['lead.firstName', 'advisor.name'],
  })

  await PipelineTrigger.create({
    brokerageId: brokerageA._id,
    name: 'Auto-schedule introductory call on lead intake',
    fromStage: null,
    toStage: 'NEW',
    actionType: 'CREATE_TASK',
    actionConfig: {
      taskTitle: 'Reach out to new lead within 2 hours',
      taskPriority: 'HIGH',
      dueDaysOffset: 0,
    },
  })
  console.log('Created sample email template and pipeline trigger')

  // 10. Sample Pipeline Leads
  type SampleLead = {
    firstName: string
    lastName: string
    email: string
    phone: string
    status: 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'PROPOSAL' | 'NEGOTIATION' | 'WON'
    source: 'WEBSITE' | 'REFERRAL' | 'REALTOR' | 'CAMPAIGN'
    score: number
    assignedTo: mongoose.Types.ObjectId
    convertedClientId?: mongoose.Types.ObjectId
    customFields: {
      loanAmount: number
      propertyValue: number
    }
  }

  const sampleLeads: SampleLead[] = [
    {
      firstName: 'Sophie',
      lastName: 'Dubois',
      email: 'sophie.dubois@expat.fr',
      phone: '+49 171 9876543',
      status: 'NEW',
      source: 'CAMPAIGN',
      score: 75,
      assignedTo: advisor._id,
      customFields: { loanAmount: 380000, propertyValue: 460000 },
    },
    {
      firstName: 'Marco',
      lastName: 'Rossi',
      email: 'marco.rossi@milan.it',
      phone: '+49 172 8765432',
      status: 'CONTACTED',
      source: 'REFERRAL',
      score: 82,
      assignedTo: advisor._id,
      customFields: { loanAmount: 520000, propertyValue: 650000 },
    },
    {
      firstName: 'Priya',
      lastName: 'Sharma',
      email: 'priya.sharma@techcorp.com',
      phone: '+49 173 7654321',
      status: 'QUALIFIED',
      source: 'WEBSITE',
      score: 90,
      assignedTo: advisor._id,
      customFields: { loanAmount: 620000, propertyValue: 750000 },
    },
    {
      firstName: 'Lars',
      lastName: 'Van Der Berg',
      email: 'lars.vdb@amsterdam.nl',
      phone: '+49 174 6543210',
      status: 'PROPOSAL',
      source: 'REALTOR',
      score: 88,
      assignedTo: advisor._id,
      customFields: { loanAmount: 410000, propertyValue: 500000 },
    },
    {
      firstName: 'Mateo',
      lastName: 'Fernandez',
      email: 'mateo.fernandez@madrid.es',
      phone: '+49 175 5432109',
      status: 'NEGOTIATION',
      source: 'WEBSITE',
      score: 94,
      assignedTo: advisor._id,
      customFields: { loanAmount: 580000, propertyValue: 710000 },
    },
    {
      firstName: 'Alex',
      lastName: 'Johnson',
      email: 'alex.inquiry@gmail.com',
      phone: '+49 176 12345678',
      status: 'WON',
      source: 'WEBSITE',
      score: 98,
      assignedTo: advisor._id,
      convertedClientId: clientProfile._id,
      customFields: { loanAmount: 450000, propertyValue: 560000 },
    },
  ]

  for (const leadData of sampleLeads) {
    await Lead.create({
      brokerageId: brokerageA._id,
      ...leadData,
    })
    console.log(`Created sample lead: ${leadData.firstName} ${leadData.lastName} (${leadData.status})`)
  }

  console.log('\n======================================================')
  console.log('Database Seeding Complete!')
  console.log('======================================================')
  console.log('You can now log in with the following demo credentials:')
  console.log('Default Password for all accounts: Password123!')
  console.log('1. Brokerage Admin: klaus.mueller@berlin-mortgages.de (slug: berlin-expat-mortgages)')
  console.log('2. Mortgage Advisor: elena.schmidt@berlin-mortgages.de (slug: berlin-expat-mortgages)')
  console.log('3. Expat Client: alex.expat@gmail.com (slug: berlin-expat-mortgages)')
  console.log('4. Platform Admin: admin@leadflow-platform.com (slug not required)')
  console.log('======================================================\n')

  await mongoose.disconnect()
}

seed().catch((err) => {
  console.error('Seeding error:', err)
  process.exit(1)
})
