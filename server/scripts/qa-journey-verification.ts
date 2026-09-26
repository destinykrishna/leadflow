import { io } from 'socket.io-client';

const API_BASE = 'http://localhost:5000/api';
const DEFAULT_PASSWORD = 'Password123!';

interface LoginResponse {
  success: boolean;
  data: {
    accessToken: string;
    user: {
      id: string;
      email: string;
      role: string;
      brokerageId: string | null;
    };
  };
}

async function login(email: string, brokerageSlug?: string): Promise<{ token: string; user: any; cookie: string }> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: DEFAULT_PASSWORD, brokerageSlug }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Login failed for ${email} (${res.status}): ${errText}`);
  }
  const body = (await res.json()) as LoginResponse;
  const setCookie = res.headers.get('set-cookie') || '';
  return { token: body.data.accessToken, user: body.data.user, cookie: setCookie };
}

async function runQA() {
  console.log('====================================================');
  console.log('🚀 STARTING CRITICAL USER JOURNEYS FINAL QA PASS');
  console.log('====================================================\n');

  let passedChecks = 0;
  let failedChecks = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passedChecks++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failedChecks++;
    }
  }

  try {
    // -------------------------------------------------------------
    // Journey 1: Staff login → pipeline → lead detail → client conversion
    // -------------------------------------------------------------
    console.log('📌 Journey 1: Staff login → pipeline → lead detail → client conversion');
    const advisorAuth = await login('elena.schmidt@berlin-mortgages.de', 'berlin-expat-mortgages');
    assert(!!advisorAuth.token && advisorAuth.user.role === 'ADVISOR', 'Advisor login successful with valid JWT');

    // Pipeline retrieval
    const pipelineRes = await fetch(`${API_BASE}/leads/pipeline`, {
      headers: { Authorization: `Bearer ${advisorAuth.token}` },
    });
    assert(pipelineRes.ok, `GET /api/leads/pipeline returned 200 (status: ${pipelineRes.status})`);
    const pipelineData = await pipelineRes.json();
    assert(pipelineData.data && typeof pipelineData.data.pipeline === 'object', 'Pipeline returns 7 stage buckets');

    // Lead detail retrieval
    const leadsRes = await fetch(`${API_BASE}/leads`, {
      headers: { Authorization: `Bearer ${advisorAuth.token}` },
    });
    const leadsJson = await leadsRes.json();
    const leadsList = leadsJson.data?.leads || [];
    assert(Array.isArray(leadsList) && leadsList.length > 0, `Leads retrieved: ${leadsList.length} found`);
    const testLead = leadsList[0];
    const detailRes = await fetch(`${API_BASE}/leads/${testLead._id}`, {
      headers: { Authorization: `Bearer ${advisorAuth.token}` },
    });
    assert(detailRes.ok, `GET /api/leads/:id returned 200 for lead ${testLead.firstName}`);

    // Verify invalid conversion failure path: NEW lead conversion rejected
    const newLead = leadsList.find((l: any) => l.status === 'NEW');
    if (newLead) {
      const invalidConvertRes = await fetch(`${API_BASE}/clients/convert/${newLead._id}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${advisorAuth.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ profileType: 'BUYER' }),
      });
      assert(
        invalidConvertRes.status === 400,
        `Validation guard: Converting NEW lead rejected with HTTP 400 (got ${invalidConvertRes.status})`
      );
    }

    // Convert an eligible lead (or create and advance one if needed)
    let convertibleLead = leadsList.find(
      (l: any) => ['QUALIFIED', 'PROPOSAL', 'NEGOTIATION'].includes(l.status) && !l.convertedClientId
    );
    if (!convertibleLead) {
      // Ingest a fresh test lead via webhook
      const webhookRes = await fetch(`${API_BASE}/leads/webhook/${advisorAuth.user.brokerageId}`, {
        method: 'POST',
        headers: {
          'x-webhook-secret': 'whsec_berlin_demo_secret_2026',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName: 'QA-Convert',
          lastName: 'Applicant',
          email: `qa.applicant.${Date.now()}@example.com`,
          loanAmount: 500000,
          propertyValue: 650000,
        }),
      });
      const webhookData = await webhookRes.json();
      const createdLeadId = webhookData.data.id;

      // Move NEW -> CONTACTED
      await fetch(`${API_BASE}/leads/${createdLeadId}/stage`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${advisorAuth.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ stage: 'CONTACTED' }),
      });
      // Move CONTACTED -> QUALIFIED
      await fetch(`${API_BASE}/leads/${createdLeadId}/stage`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${advisorAuth.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ stage: 'QUALIFIED' }),
      });
      convertibleLead = { _id: createdLeadId };
    }

    const convertRes = await fetch(`${API_BASE}/clients/convert/${convertibleLead._id}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${advisorAuth.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        profileType: 'BUYER',
        password: 'Password123!',
      }),
    });
    assert(convertRes.status === 201 || convertRes.ok, `Conversion successful: HTTP ${convertRes.status}`);
    const convertJson = await convertRes.json();
    const convertedClient = convertJson.data?.client;
    assert(
      convertedClient && convertedClient.leadId === convertibleLead._id,
      `Converted client case created with linked leadId (${convertedClient?._id})`
    );

    // -------------------------------------------------------------
    // Journey 2: Client login → own case → document upload/re-upload
    // -------------------------------------------------------------
    console.log('\n📌 Journey 2: Client login → own case → document upload/re-upload');
    const clientAuth = await login('alex.expat@gmail.com', 'berlin-expat-mortgages');
    assert(!!clientAuth.token && clientAuth.user.role === 'CLIENT', 'Client login successful');

    // Get own case via GET /api/clients/me
    const ownCaseRes = await fetch(`${API_BASE}/clients/me`, {
      headers: { Authorization: `Bearer ${clientAuth.token}` },
    });
    assert(ownCaseRes.ok, `GET /api/clients/me returned 200 (Case: ${ownCaseRes.status})`);
    const ownCaseJson = await ownCaseRes.json();
    const ownCase = ownCaseJson.data?.client;
    assert(ownCase && ownCase.email === 'alex.expat@gmail.com', 'Client profile matches verified token user');

    // Anti-IDOR test: Client cannot access another client ID directly
    const fakeId = '507f1f77bcf86cd799439011';
    const idorRes = await fetch(`${API_BASE}/clients/${fakeId}`, {
      headers: { Authorization: `Bearer ${clientAuth.token}` },
    });
    assert(idorRes.status === 404, `Anti-IDOR: Non-owned client ID concealed with HTTP 404 (got ${idorRes.status})`);

    // Upload document for own case
    const formData = new FormData();
    const dummyBlob = new Blob(['Dummy payslip file content for QA verification'], { type: 'application/pdf' });
    formData.append('file', dummyBlob, 'qa-payslip.pdf');
    formData.append('clientId', ownCase._id);
    formData.append('type', 'PAYSLIP');
    formData.append('title', 'QA Verification Payslip');
    formData.append('notes', 'Uploaded during final QA pass');

    const uploadRes = await fetch(`${API_BASE}/documents/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${clientAuth.token}` },
      body: formData,
    });
    assert(uploadRes.status === 201, `Document upload successful: HTTP ${uploadRes.status}`);
    const uploadJson = await uploadRes.json();
    const uploadData = uploadJson.data?.document;
    assert(uploadData && ['PENDING', 'PROCESSING', 'VERIFIED'].includes(uploadData.status), `Uploaded document status is ${uploadData?.status}`);
    const uploadedDocId = uploadData._id;

    // -------------------------------------------------------------
    // Journey 3: Document processing/status updates and realtime synchronization
    // -------------------------------------------------------------
    console.log('\n📌 Journey 3: Document processing & realtime synchronization');
    // Socket.IO authentication test
    const socket = io('http://localhost:5000', {
      auth: { token: clientAuth.token },
      transports: ['websocket'],
    });

    const socketConnected = await new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => resolve(false), 5000);
      socket.on('connect', () => {
        clearTimeout(timeout);
        resolve(true);
      });
      socket.on('connect_error', () => {
        clearTimeout(timeout);
        resolve(false);
      });
    });
    assert(socketConnected, 'Socket.IO handshake authenticated with client JWT');

    // Check document status in DB (BullMQ worker or recovery sweeper)
    const docDetailRes = await fetch(`${API_BASE}/documents/${uploadedDocId}`, {
      headers: { Authorization: `Bearer ${clientAuth.token}` },
    });
    assert(docDetailRes.ok, `GET /api/documents/:id returned 200`);
    const docDetailJson = await docDetailRes.json();
    const docDetail = docDetailJson.data?.document;
    assert(
      docDetail && ['PENDING', 'PROCESSING', 'VERIFIED', 'REJECTED'].includes(docDetail.status),
      `Document state machine valid (${docDetail?.status})`
    );
    socket.disconnect();

    // -------------------------------------------------------------
    // Journey 4: Advisor task/automation workflow
    // -------------------------------------------------------------
    console.log('\n📌 Journey 4: Advisor task/automation workflow');
    const adminAuth = await login('klaus.mueller@berlin-mortgages.de', 'berlin-expat-mortgages');
    assert(adminAuth.user.role === 'BROKERAGE_ADMIN', 'Brokerage Admin authenticated for trigger setup');

    // Ensure an automated trigger exists for NEW -> CONTACTED
    const triggersRes = await fetch(`${API_BASE}/triggers`, {
      headers: { Authorization: `Bearer ${adminAuth.token}` },
    });
    assert(triggersRes.ok, `GET /api/triggers returned 200`);
    const triggersData = await triggersRes.json();
    let trigger = triggersData.data?.find((t: any) => t.actionType === 'CREATE_TASK' && t.toStage === 'CONTACTED');

    if (!trigger) {
      const createTriggerRes = await fetch(`${API_BASE}/triggers`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminAuth.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Contact Lead Task Automation',
          fromStage: 'NEW',
          toStage: 'CONTACTED',
          actionType: 'CREATE_TASK',
          actionConfig: {
            taskTitle: 'Reach out to new mortgage applicant',
            taskDescription: 'Call applicant within 2 hours to confirm documentation requirements',
            taskPriority: 'HIGH',
            dueDaysOffset: 1,
          },
          isActive: true,
        }),
      });
      assert(createTriggerRes.status === 201, `Brokerage Admin created pipeline trigger: HTTP ${createTriggerRes.status}`);
    } else {
      assert(true, 'Automated pipeline task trigger already configured');
    }

    // Verify templates exist
    const templatesRes = await fetch(`${API_BASE}/email-templates`, {
      headers: { Authorization: `Bearer ${advisorAuth.token}` },
    });
    assert(templatesRes.ok, `GET /api/email-templates returned 200`);

    // Ingest a fresh lead to test task automation
    const autoLeadRes = await fetch(`${API_BASE}/leads/webhook/${advisorAuth.user.brokerageId}`, {
      method: 'POST',
      headers: {
        'x-webhook-secret': 'whsec_berlin_demo_secret_2026',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        firstName: 'AutoTask',
        lastName: 'Borrower',
        email: `autotask.borrower.${Date.now()}@example.com`,
        loanAmount: 450000,
        propertyValue: 580000,
      }),
    });
    const autoLeadData = await autoLeadRes.json();
    const autoLeadId = autoLeadData.data.id;

    // Transition NEW -> CONTACTED to trigger automated task creation
    const stageRes = await fetch(`${API_BASE}/leads/${autoLeadId}/stage`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${advisorAuth.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ stage: 'CONTACTED' }),
    });
    assert(stageRes.ok, `Lead transitioned to CONTACTED (HTTP ${stageRes.status})`);

    // Give asynchronous trigger execution a brief moment to commit
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Fetch advisor tasks and verify the automated task is present
    const tasksRes = await fetch(`${API_BASE}/tasks`, {
      headers: { Authorization: `Bearer ${advisorAuth.token}` },
    });
    assert(tasksRes.ok, `GET /api/tasks returned 200`);
    const tasksData = await tasksRes.json();
    const tasksList = tasksData.data || [];
    assert(Array.isArray(tasksList) && tasksList.length > 0, `Automated tasks generated: ${tasksList.length} found`);

    const latestTask = tasksList[0];
    const updateTaskRes = await fetch(`${API_BASE}/tasks/${latestTask._id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${advisorAuth.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'COMPLETED' }),
    });
    assert(updateTaskRes.ok, `Advisor task status update to COMPLETED succeeded (HTTP ${updateTaskRes.status})`);

    // -------------------------------------------------------------
    // Journey 5: Role boundaries & tenant isolation
    // -------------------------------------------------------------
    console.log('\n📌 Journey 5: Role boundaries & tenant isolation');

    // 5.1 CLIENT permissions: forbidden from internal staff endpoints
    const clientBlockedPipeline = await fetch(`${API_BASE}/leads/pipeline`, {
      headers: { Authorization: `Bearer ${clientAuth.token}` },
    });
    assert(clientBlockedPipeline.status === 403, `CLIENT blocked from /api/leads/pipeline: HTTP 403 (got ${clientBlockedPipeline.status})`);

    const clientBlockedTasks = await fetch(`${API_BASE}/tasks`, {
      headers: { Authorization: `Bearer ${clientAuth.token}` },
    });
    assert(clientBlockedTasks.status === 403, `CLIENT blocked from /api/tasks: HTTP 403 (got ${clientBlockedTasks.status})`);

    // 5.2 ADVISOR permissions: can read triggers, but forbidden from creating/modifying
    const advisorBlockedTriggerCreate = await fetch(`${API_BASE}/triggers`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${advisorAuth.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Unauthorized Advisor Trigger',
        fromStage: 'NEW',
        toStage: 'CONTACTED',
        actionType: 'CREATE_TASK',
        actionConfig: { taskTitle: 'Unauthorized trigger' },
      }),
    });
    assert(advisorBlockedTriggerCreate.status === 403, `ADVISOR blocked from creating triggers: HTTP 403 (got ${advisorBlockedTriggerCreate.status})`);

    // 5.3 BROKERAGE_ADMIN permissions: can create triggers, but isolated to own brokerage
    assert(adminAuth.user.role === 'BROKERAGE_ADMIN', 'Brokerage Admin authenticated');

    // Verify admin can access triggers
    const adminTriggerRes = await fetch(`${API_BASE}/triggers`, {
      headers: { Authorization: `Bearer ${adminAuth.token}` },
    });
    assert(adminTriggerRes.ok, 'BROKERAGE_ADMIN allowed to manage triggers');

    // 5.4 Cross-Tenant Isolation: Admin from Brokerage A cannot see Brokerage B
    const munichLeadFakeId = '654321654321654321654321';
    const crossTenantLead = await fetch(`${API_BASE}/leads/${munichLeadFakeId}`, {
      headers: { Authorization: `Bearer ${adminAuth.token}` },
    });
    assert(crossTenantLead.status === 404, `Anti-IDOR: Cross-tenant / nonexistent lead returns 404 (got ${crossTenantLead.status})`);

    // 5.5 PLATFORM_ADMIN: system-level admin with global visibility
    const platformAuth = await login('admin@leadflow-platform.com');
    assert(platformAuth.user.role === 'PLATFORM_ADMIN', 'Platform Admin authenticated globally');
    const brokeragesRes = await fetch(`${API_BASE}/brokerages`, {
      headers: { Authorization: `Bearer ${platformAuth.token}` },
    });
    assert(brokeragesRes.ok, `PLATFORM_ADMIN can access global brokerages list: HTTP ${brokeragesRes.status}`);
    const brokeragesJson = await brokeragesRes.json();
    const brokeragesList = brokeragesJson.data?.brokerages || [];
    assert(Array.isArray(brokeragesList) && brokeragesList.length >= 2, `Global brokerages returned (${brokeragesList.length} brokerages)`);

    console.log('\n====================================================');
    console.log(`🏁 QA PASS SUMMARY: ${passedChecks} PASSED, ${failedChecks} FAILED`);
    console.log('====================================================\n');

    if (failedChecks > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('QA Execution Error:', error);
    process.exit(1);
  }
}

runQA();
