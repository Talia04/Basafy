import { parseEmailCombined } from './llm.ts';

const mockEmails = [
    {
        subject: "Newsletter: Top Jobs for Software Engineers",
        from: "newsletter@glassdoor.com",
        body: "Here are some top jobs you might be interested in. Apply today!",
        expectedJobRelated: false
    },
    {
        subject: "Interview Request: Software Engineer at Stripe",
        from: "recruiting@stripe.com",
        body: "Hi Tanya, we'd like to invite you to an interview for the Software Engineer role.",
        expectedJobRelated: true,
        expectedStatus: "Interview",
        expectedCompany: "Stripe"
    },
    {
        subject: "Update on your application",
        from: "careers@acme.com",
        body: "We have decided not to move forward with your candidacy at this time. We will reach out if another role opens up.",
        expectedJobRelated: true,
        expectedStatus: "Rejected",
        expectedCompany: "Acme"
    }
];

async function runTests() {
    for (const email of mockEmails) {
        console.log(`\nTesting email: ${email.subject}`);
        try {
            const result = await parseEmailCombined(email.subject, email.from, '', email.body, true);
            console.log(`Expected is_job_related: ${email.expectedJobRelated}, Got: ${result.is_job_related}`);
            if (email.expectedJobRelated) {
                console.log(`Expected Status: ${email.expectedStatus}, Got: ${result.status}`);
                console.log(`Expected Company: ${email.expectedCompany}, Got: ${result.company_name}`);
            }
        } catch (e) {
            console.error(e);
        }
    }
}

runTests();
