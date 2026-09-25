MERN Developer Assignment 
Build LeadFlow, a lead and document platform for mortgage brokerages, in 5–7 days. We 
describe the problem; the architecture, libraries and trade-offs are yours to decide. 
The problem 
Mortgage brokerages in Germany help expats buy homes. Leads arrive all day from 
outside tools: web forms, ad platforms, booking tools and partner links. Today they land 
in inboxes and spreadsheets. Advisors contact the same person twice, miss hot leads for 
hours, and cannot see who is handling what. 
Once a lead becomes a client, the client uploads 15–40 documents (payslips, ID, bank 
statements). Each one must be checked before the case goes to a bank. The checking is 
slow, and the client should never be left waiting on the upload screen. 
We want to sell one platform to many brokerages at the same time. 
What LeadFlow must do 
1. 
Serve many brokerages from one deployment. Each brokerage sees only its own 
users, leads, clients and documents, never another brokerage's. 
2. Receive leads automatically from at least one real external tool. 
3. Give advisors a pipeline board (New → Contacted → … → Won or Lost) that 
updates live on every open screen when anything changes. 
4. Notice when a new lead is a person the brokerage already knows. 
5. Let an advisor turn a lead into a client who can log in, see their case and upload 
documents. 
6. Check uploaded documents in the background and show each document's status 
live to the client and the advisor. You can fake the checking itself; make it slow 
and let it fail sometimes. 
7. Show a dashboard of pipeline numbers that loads fast and is never out of date. 
8. Email templates. Let a brokerage admin create and edit email templates with 
placeholders such as the client's name or the advisor's name. 
9. Email triggers on the pipeline. When a lead enters a pipeline stage, send the 
email the admin has linked to that stage, for example a welcome email when a 
lead lands in New. 
10. Task triggers on pipeline columns. When a lead enters a column, create the 
tasks the admin has set up for that column, for example "Call within 2 hours" 
when a lead lands in New. Each task has an assigned advisor and a due date, and 
overdue tasks stand out. 
There are four kinds of users: platform admin, brokerage admin, advisor and client. 
You decide exactly what each can do. 
1 
You don't have to build everything 
Pick the parts you think matter most, build them properly, and tell us in your summary 
what you left out and why. 
A smaller product that works well scores higher than every feature half-working. 
Deciding what to cut is part of what we assess, not a weakness. 
Hints 
• The stack is MERN: MongoDB, Express, React, Node. TypeScript is welcome. 
• A good solution will probably involve message queues, caching, WebSockets, 
webhooks, multi-tenant data isolation, authentication with roles, and file 
storage. 
• Everything can be built and deployed on free tiers. You should not need to pay 
for anything. 
Questions worth asking yourself: 
• What happens if the same lead is sent twice, or 500 arrive in one minute? 
• What if two advisors move the same lead at the same moment? 
• What if the background worker crashes halfway through a job? 
• What if the email provider is down when a lead changes stage? 
• If one brokerage floods the system, do the others slow down? 
• What if someone guesses the id of another brokerage's lead? 
• What if an advisor's internet drops for two minutes? 
What to submit 
Send these within 7 days of receiving this brief: 
1. GitHub repository with its full commit history. 
2. Deployed link with test logins for each kind of user. If you do not deploy, send a 
screen recording with voice-over (10–15 minutes) instead, showing the product 
working. 
3. All your prompts (mandatory). Every prompt you gave any AI tool, in order and 
unedited, including the ones that did not work. Put them in PROMPTS.md or 
attach the tool's exports. Submissions without prompts are not reviewed. 
4. Two-paragraph summary. First, what you built and your key decisions. Second, 
what is missing or weak and what you would do next. 
Ground rules 
• Feel free to use any AI coding tool of your choice. We encourage you to leverage 
AI during development 
• For questions, reply to the email that sent you this brief.