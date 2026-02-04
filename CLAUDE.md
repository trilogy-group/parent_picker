# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

An interactive, consumer-facing website where parents can vote on and express preferences for potential Alpha micro school locations. The application helps gather community input to inform site selection decisions.

## Key Context

- Scaling Alpha School and affiliates to hundreds/thousands of locations
- Real estate expertise (sourcing, zoning, permitting) is hyper-local
- Alpha parents are highly connected in their communities - leverage this network
- Reference implementation: https://sportsacademy.school/map/facilities (used by 30k parents for facility voting)

## MVP Scope

Duplicate the Sports Academy facilities map functionality:
- Parents can view locations on a map by city
- Vote on existing locations from a location database (Supabase - stub for now)
- Suggest new locations
- API keys stored in ~/.env

## Version 2.0 (Future - Do Not Build Yet)

- Pre-scored locations database in Supabase
- Parent-suggested locations trigger scoring workflow
- Low-scoring locations prompt parent assistance (zoning help, contacts)

**Key Invariant:** Ship MVP before adding any v2 complexity.

## Reference Implementation Analysis

Based on analysis of https://sportsacademy.school/map/facilities:
- Split-pane layout: Map (left ~50%) + Facilities list (right)
- Responsive: Stacks vertically on mobile (<768px)
- Voting: Star/favorite button per location with vote counts
- Tech: Next.js + Tailwind CSS + Mapbox GL JS (inferred)

## Environment Variables

Store in `.env.local`:
```
NEXT_PUBLIC_MAPBOX_TOKEN=   # Get from mapbox.com
```
