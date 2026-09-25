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
} from '../src/models/index.js'
import { hashPassword } from '../src/utils/password.js'

async function seed() {
  console.log(`Connecting to MongoDB at: ${env.MONGODB_URI}...`)
  await mongoose.connect(env.MONGODB_URI)
  console.log('MongoDB connected successfully.')

  const defaultPassword = 'Password123!'
  const passwordHash = await hashPassword(defaultPassword)

  // 1. Platform Admin
  let platformAdmin = await User.findOne({ email: 'admin@leadflow-platform.com' })
  if (!platformAdmin) {
    platformAdmin = await User.create({
      name: 'Platform Superadmin',
      email: 'admin@leadflow-platform.com',
      passwordHash,
      role: 'PLATFORM_ADMIN',
      status: 'ACTIVE',
      brokerageId: null,
    })
    console.log('Created Platform Admin:', platformAdmin.email)
  } else {
    platformAdmin.passwordHash = passwordHash
    platformAdmin.status = 'ACTIVE'
    await platformAdmin.save()
    console.log('Updated Platform Admin password:', platformAdmin.email)
  }

  // 2. Brokerages
  let brokerageA = await Brokerage.findOne({ slug: 'berlin-expat-mortgages' })
  if (!brokerageA) {
    brokerageA = await Brokerage.create({
      name: 'Berlin Expat Mortgages GmbH',
      slug: 'berlin-expat-mortgages',
      webhookSecret: 'whsec_berlin_demo_secret_2026',
      plan: 'GROWTH',
      status: 'ACTIVE',
    })
    console.log('Created Brokerage A:', brokerageA.name)
  }

  let brokerageB = await Brokerage.findOne({ slug: 'munich-home-loans' })
  if (!brokerageB) {
    brokerageB = await Brokerage.create({
      name: 'Munich Home Loans UG',
      slug: 'munich-home-loans',
      webhookSecret: 'whsec_munich_demo_secret_2026',
      plan: 'STARTER',
      status: 'ACTIVE',
    })
    console.log('Created Brokerage B:', brokerageB.name)
  }

  // 3. Brokerage Admin
  let brokerageAdmin = await User.findOne({
    brokerageId: brokerageA._id,
    email: 'klaus.mueller@berlin-mortgages.de',
  })
  if (!brokerageAdmin) {
    brokerageAdmin = await User.create({
      brokerageId: brokerageA._id,
      name: 'Klaus Mueller',
      email: 'klaus.mueller@berlin-mortgages.de',
      passwordHash,
      role: 'BROKERAGE_ADMIN',
      status: 'ACTIVE',
    })
    console.log('Created Brokerage Admin:', brokerageAdmin.email)
  } else {
    brokerageAdmin.passwordHash = passwordHash
    brokerageAdmin.status = 'ACTIVE'
    await brokerageAdmin.save()
    console.log('Updated Brokerage Admin password:', brokerageAdmin.email)
  }

  // 4. Advisor
  let advisor = await User.findOne({
    brokerageId: brokerageA._id,
    email: 'elena.schmidt@berlin-mortgages.de',
  })
  if (!advisor) {
    advisor = await User.create({
      brokerageId: brokerageA._id,
      name: 'Elena Schmidt',
      email: 'elena.schmidt@berlin-mortgages.de',
      passwordHash,
      role: 'ADVISOR',
      status: 'ACTIVE',
    })
    console.log('Created Advisor:', advisor.email)
  } else {
    advisor.passwordHash = passwordHash
    advisor.status = 'ACTIVE'
    await advisor.save()
    console.log('Updated Advisor password:', advisor.email)
  }

  // 5. Client User Account
  let clientUser = await User.findOne({
    brokerageId: brokerageA._id,
    email: 'alex.expat@gmail.com',
  })
  if (!clientUser) {
    clientUser = await User.create({
      brokerageId: brokerageA._id,
      name: 'Alex Johnson',
      email: 'alex.expat@gmail.com',
      passwordHash,
      role: 'CLIENT',
      status: 'ACTIVE',
    })
    console.log('Created Client User:', clientUser.email)
  } else {
    clientUser.passwordHash = passwordHash
    clientUser.status = 'ACTIVE'
    await clientUser.save()
    console.log('Updated Client User password:', clientUser.email)
  }

  // 6. Client Profile
  let clientProfile = await Client.findOne({
    brokerageId: brokerageA._id,
    email: 'alex.expat@gmail.com',
  })
  if (!clientProfile) {
    clientProfile = await Client.create({
      brokerageId: brokerageA._id,
      userId: clientUser._id,
      assignedAdvisorId: advisor._id,
      firstName: 'Alex',
      lastName: 'Johnson',
      email: 'alex.expat@gmail.com',
      phone: '+49 176 12345678',
      nationality: 'British',
      residenceStatus: 'BLUE_CARD',
      employmentStatus: 'EMPLOYED',
      annualGrossIncome: 95000,
      targetLoanAmount: 480000,
      targetPropertyValue: 600000,
      propertyLocation: 'Berlin Kreuzberg',
      caseStatus: 'ACTIVE',
    })
    console.log('Created Client Profile for:', clientProfile.email)
  }

  // 7. Sample Pipeline Leads
  const sampleLeads = [
    {
      firstName: 'Sophie',
      lastName: 'Dubois',
      email: 'sophie.dubois@expat.fr',
      phone: '+49 171 9876543',
      loanAmount: 380000,
      propertyValue: 460000,
      status: 'NEW',
      assignedTo: advisor._id,
    },
    {
      firstName: 'Marco',
      lastName: 'Rossi',
      email: 'marco.rossi@milan.it',
      phone: '+49 172 8765432',
      loanAmount: 520000,
      propertyValue: 650000,
      status: 'CONTACTED',
      assignedTo: advisor._id,
    },
    {
      firstName: 'Priya',
      lastName: 'Sharma',
      email: 'priya.sharma@techcorp.com',
      phone: '+49 173 7654321',
      loanAmount: 620000,
      propertyValue: 750000,
      status: 'QUALIFIED',
      assignedTo: advisor._id,
    },
    {
      firstName: 'Lars',
      lastName: 'Van Der Berg',
      email: 'lars.vdb@amsterdam.nl',
      phone: '+49 174 6543210',
      loanAmount: 410000,
      propertyValue: 500000,
      status: 'PROPOSAL',
      assignedTo: advisor._id,
    },
  ]

  for (const leadData of sampleLeads) {
    const existing = await Lead.findOne({
      brokerageId: brokerageA._id,
      email: leadData.email,
    })
    if (!existing) {
      await Lead.create({
        brokerageId: brokerageA._id,
        ...leadData,
      })
      console.log(`Created sample lead: ${leadData.firstName} (${leadData.status})`)
    }
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
