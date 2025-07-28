-- Quiz Master Database Schema
-- PostgreSQL database schema for Netlify DB or Supabase

-- Drop existing tables if they exist (use with caution in production)
DROP TABLE IF EXISTS responses CASCADE;
DROP TABLE IF EXISTS leaderboard CASCADE;
DROP TABLE IF EXISTS attendees CASCADE;
DROP TABLE IF EXISTS quiz_state CASCADE;
DROP TABLE IF EXISTS questions CASCADE;
DROP TABLE IF EXISTS registered_teams CASCADE;

-- Create registered_teams table
CREATE TABLE registered_teams (
    team_id VARCHAR(5) PRIMARY KEY,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create attendees table  
CREATE TABLE attendees (
    team_id VARCHAR(5) PRIMARY KEY REFERENCES registered_teams(team_id) ON DELETE CASCADE,
    joined_at TIMESTAMP DEFAULT NOW()
);

-- Create questions table
CREATE TABLE questions (
    id SERIAL PRIMARY KEY,
    question TEXT NOT NULL,
    option_a TEXT NOT NULL,
    option_b TEXT NOT NULL,
    option_c TEXT NOT NULL,
    option_d TEXT NOT NULL,
    correct_answer TEXT NOT NULL CHECK (correct_answer IN ('option_a', 'option_b', 'option_c', 'option_d')),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create quiz_state table (single row to track quiz progress)
CREATE TABLE quiz_state (
    id SERIAL PRIMARY KEY,
    is_started BOOLEAN DEFAULT FALSE,
    current_question INTEGER DEFAULT 0,
    total_questions INTEGER DEFAULT 20,
    question_start_time TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create responses table
CREATE TABLE responses (
    id SERIAL PRIMARY KEY,
    team_id VARCHAR(5) REFERENCES registered_teams(team_id) ON DELETE CASCADE,
    question_number INTEGER NOT NULL,
    answer TEXT, -- NULL means no answer (timeout)
    response_time INTEGER, -- in seconds
    is_correct BOOLEAN,
    submitted_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(team_id, question_number) -- Prevent duplicate answers
);

-- Create leaderboard table (materialized view alternative)
CREATE TABLE leaderboard (
    team_id VARCHAR(5) PRIMARY KEY REFERENCES registered_teams(team_id) ON DELETE CASCADE,
    score INTEGER DEFAULT 0,
    avg_response_time DECIMAL(5,2) DEFAULT 0.00,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_responses_team_question ON responses(team_id, question_number);
CREATE INDEX idx_responses_question_number ON responses(question_number);
CREATE INDEX idx_leaderboard_score ON leaderboard(score DESC, avg_response_time ASC);
CREATE INDEX idx_attendees_joined_at ON attendees(joined_at);

-- Create trigger to update leaderboard automatically
CREATE OR REPLACE FUNCTION update_leaderboard_trigger()
RETURNS TRIGGER AS $$
BEGIN
    -- Update or insert leaderboard entry for this team
    INSERT INTO leaderboard (team_id, score, avg_response_time, updated_at)
    SELECT 
        NEW.team_id,
        COUNT(CASE WHEN is_correct THEN 1 END) as score,
        ROUND(AVG(response_time), 2) as avg_response_time,
        NOW()
    FROM responses 
    WHERE team_id = NEW.team_id
    ON CONFLICT (team_id) DO UPDATE SET
        score = (
            SELECT COUNT(CASE WHEN is_correct THEN 1 END)
            FROM responses 
            WHERE team_id = NEW.team_id
        ),
        avg_response_time = (
            SELECT ROUND(AVG(response_time), 2)
            FROM responses 
            WHERE team_id = NEW.team_id
        ),
        updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to responses table
CREATE TRIGGER update_leaderboard_after_response
    AFTER INSERT ON responses
    FOR EACH ROW
    EXECUTE FUNCTION update_leaderboard_trigger();

-- Initialize quiz state (single row)
INSERT INTO quiz_state (is_started, current_question, total_questions) 
VALUES (FALSE, 0, 20);

-- Grant necessary permissions (adjust as needed for your setup)
-- These are commented out as permissions vary by database provider
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO quiz_app_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO quiz_app_user;