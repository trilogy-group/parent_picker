# CLAUDE.md


This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**IMPORTANT:** This file is maintained by the user and should remain clean and focused. Always ask permission before making changes to CLAUDE.md, most of which will be denied.

## Project Overview

An interactive, consumer-facing website where parents can vote on and express preferences for potential Alpha micro school locations. The application helps gather community input.  A different AI agent (out of scope) will make site selection decisions and negotiate/finalize leases while keeping the interested parents informed in a positive manner.

## Key Context

- Scaling Alpha School (Stanford of K-12, www.alpha.school) and affiliates to hundreds/thousands of locations
  - Scale requires humans in the loop (other than distributed parents as described). 
  - Humans on central team and feedback / processing loops will not be allowed, design accordingly.
- Real estate expertise (sourcing, zoning, permitting) is hyper-local
- Excited prospective Alpha parents have most local expertise, network, and capability and this site should leverage this.
- Reference implementation: https://sportsacademy.school/map/facilities (used by 30k parents for facility voting)


## Test-Driven Development

- This project uses TDD. All requirements are documented in `requirements.md` with corresponding test cases.  
- Create a feedback.md to keep my feedback.  Understand the root cause for the feedback, and update requirements.md and correspending tests to keep issues like that from re-appearing.
- Before adding a requirement, ask yourself "will this require a human (other than parent) in the processing loop".  Redesign until the answer is "no."


## MVP Scope

Duplicate the Sports Academy facilities map functionality:
- Parents can view locations on a map by city
- Vote on existing locations from a location database (Supabase - stub for now)
- Suggest new locations

## Version 2.0 (Future - Do Not Build Yet)

- Pre-scored locations database in Supabase
- Low-scoring locations prompt parent assistance (zoning help, contacts)
  - "I know you all voted for this property, but we can't get it zoned, do you anyone who can get it zoned. city hall? lawyer who has gotten approvals in the past?"
- Parent-suggested locations trigger scoring workflow (separate agent)
- Lease outreach, negotiation, and execution (separate agent)

**API Keys:**  API keys stored in .local.env

**Key Invariant:** Ship MVP before adding any v2 complexity.


**Key files:**
- `requirements.md` - Complete requirements specification (137 test cases)
- `tests/requirements.test.py` - Automated Playwright test suite (45 implemented tests)
- `feedback.md` - User feedback log with root cause analysis and corrective actions
- `architecture.md` - Technical architecture, commands, tech stack, and file structure


# CLAUDE MUST REQUEST APPROVAL BEFORE WRITING INTO THIS FILE
