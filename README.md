# Basafy
> Your job search, on autopilot.
Basafy is an AI-powered job search assistant designed to help candidates manage applications, interviews, tasks, and recruiter communication automatically.
Built with React Native, Supabase, and Gmail integrations, Basafy transforms scattered job search workflows into a centralized mobile experience.
---
![alt text](<Simulator Screen Recording - iPhone 16 - 2026-04-02 at 13.32.49.gif>)
## Overview
Job searching is fragmented.
Applications live across:
- Gmail
- calendars
- spreadsheets
- LinkedIn
- notes apps
- recruiter threads

Basafy was built to automate and centralize that experience.
The platform connects to Gmail to intelligently detect:
- job applications
- recruiter outreach
- interview scheduling
- follow-ups
- action items
and converts them into a structured workflow inside a mobile-first application.
---
## Features
- Gmail integration for automatic application tracking
- AI-assisted task and follow-up generation
- Interview and recruiter email detection
- Calendar workflow integration
- Mobile-first React Native experience
- Real-time syncing with Supabase
- Deep linking into Gmail threads
- Centralized application dashboard
- Task management system
- AI-enhanced productivity workflows
---
## Tech Stack
### Frontend
- React Native
- Expo
- TypeScript
### Backend
- Supabase
- PostgreSQL
- Supabase Edge Functions
### Integrations
- Gmail API
- Google OAuth
- Calendar integrations
### Additional Technologies
- GraphQL
- REST APIs
- Async workflows
- Mobile deep linking
---
## Architecture
```text
User Gmail Inbox
        ↓
 Gmail API Integration
        ↓
 Supabase Edge Functions
        ↓
 AI Parsing + Workflow Logic
        ↓
 Application + Task Generation
        ↓
 React Native Mobile App

⸻

Engineering Challenges

Gmail Parsing

Recruiter emails are highly inconsistent.

Basafy required building logic capable of identifying:

* interviews
* rejections
* recruiter outreach
* action items
* application confirmations

across a wide variety of email formats and writing styles.

Mobile Deep Linking

Implemented iOS deep linking into Gmail threads to create seamless transitions between recruiter emails and application workflows.

Real-Time Synchronization

Designed backend workflows using Supabase to synchronize:

* applications
* tasks
* reminders
* recruiter communication

across devices in real time.

Product Design

The goal was not just building another tracker, but creating a workflow experience that reduces the cognitive overhead of job searching.

⸻

Screenshots

Add screenshots or GIF demos here

⸻

Demo

Add demo video or live preview here

⸻

Motivation

As a student navigating internship and full-time recruiting, I found existing workflows fragmented and repetitive.

Basafy was created to reduce manual tracking and automate the operational side of the job search process so candidates can focus more on preparation, networking, and interviews.

⸻

Future Improvements

* Smarter AI-based recruiter intent detection
* Enhanced analytics and insights
* Cross-platform web support
* Team collaboration workflows
* Expanded calendar automation
* AI-generated interview preparation assistance

⸻

Status

Actively under development.

⸻

Author

Tanyaradzwa Chisepo

* Portfolio: https://www.tanyachisepo.dev
* LinkedIn: https://www.linkedin.com/in/tanyaradzwa-chisepo/
* GitHub: https://github.com/Talia04

:::