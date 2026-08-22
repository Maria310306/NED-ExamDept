# ExamPortal
 
**University Document Request Management System**
 
ExamPortal is a web application for managing student document requests —
degrees, transcripts, verifications, and related certificates — from
submission through processing and final delivery.
 
---
 
## What the system does
 
- Students' document requests are submitted at a central counter.
- Each request is routed to the relevant processing section (Result,
  Degree, External, or Masters).
- Sections can update the status of a request, transfer it to another
  section if needed, and mark it as completed once processed.
- An administrator has an overview of all requests across every section,
  along with reports and analytics.
- Every request automatically calculates its own processing fee based on
  the document type, programme level, and delivery option selected.
---
 
## Technology Stack
 
| Layer | Technology |
|---|---|
| Frontend | HTML, CSS, JavaScript |
| Backend | Node.js with the Express framework |
| Database | SQLite |
| Authentication | Session-based login with encrypted (bcrypt) passwords |
 
**Node.js** is a widely used, industry-standard JavaScript runtime for
building web servers, used by many large-scale production systems.
 
**Express** is the framework used to structure the backend — handling
page requests, processing form submissions, and enforcing access rules
based on user role.
 
**SQLite** is a full relational database engine, storing all data in a
single database file. It supports the same core database concepts as
larger database systems (tables, relationships, and structured queries),
without needing a separate database server to install or manage.
 
---
 
## User Roles
 
| Role | Access |
|---|---|
| Counter | Submits new requests and tracks their progress |
| Section (Department) | Manages requests assigned to that section |
| Administrator | Full visibility across all sections, plus reports and user management |
 
---
 
## Project Structure (overview)
 
```
examportal/
├── public/        → the website itself (pages, styling, client logic)
├── server/        → the backend application and database logic
└── data/          → the database file, created automatically on first run
```
 
---
 
## Running the Project
 
1. Install [Node.js](https://nodejs.org).
2. From the project folder, install the required packages:
```
   npm install
```
3. Start the application:
```
   npm start
```
4. Open a browser and go to `http://localhost:3000`.
The database is created automatically the first time the application
runs — no separate setup or import step is required.