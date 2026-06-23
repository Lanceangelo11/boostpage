# Crossfire Boost Queue System

A real-time queue management system for Crossfire boosting services.

## Features

### User Page
- View available boost contracts
- Join queue for specific boosts
- Track your queue status
- Leave queue anytime
- Real-time updates

### Admin Page
- Create boost contracts (player name, rank, target, price)
- Manage active contracts
- Accept queue requests
- Complete boosts
- View earnings dashboard

## Database Schema (Supabase)

### boost_contracts
```sql
CREATE TABLE boost_contracts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    player_ign TEXT NOT NULL,
    from_rank TEXT NOT NULL,
    to_rank TEXT NOT NULL,
    boost_type TEXT NOT NULL,
    price INTEGER NOT NULL,
    notes TEXT,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP DEFAULT now(),
    completed_at TIMESTAMP
);