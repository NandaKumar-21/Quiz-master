-- Sample data for Quiz Master application
-- Insert sample questions and registered teams

-- Insert sample registered teams
INSERT INTO registered_teams (team_id) VALUES
('96232'),
('67890'),
('11111'),
('22222'),
('33333'),
('44444'),
('55555'),
('66666'),
('77777'),
('88888'),
('99999'),
('10101'),
('20202'),
('30303'),
('40404'),
('50505');

-- Insert sample quiz questions
INSERT INTO questions (question, option_a, option_b, option_c, option_d, correct_answer) VALUES

-- Question 1
('What is the capital of France?', 'London', 'Berlin', 'Paris', 'Madrid', 'option_c'),

-- Question 2
('Which planet is known as the Red Planet?', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'option_b'),

-- Question 3
('What is 2 + 2?', '3', '4', '5', '6', 'option_b'),

-- Question 4
('Who painted the Mona Lisa?', 'Van Gogh', 'Picasso', 'Da Vinci', 'Michelangelo', 'option_c'),

-- Question 5
('What is the largest ocean on Earth?', 'Atlantic', 'Indian', 'Arctic', 'Pacific', 'option_d'),

-- Question 6
('In which year did World War II end?', '1944', '1945', '1946', '1947', 'option_b'),

-- Question 7
('What is the chemical symbol for gold?', 'Go', 'Gd', 'Au', 'Ag', 'option_c'),

-- Question 8
('Which country is home to the kangaroo?', 'New Zealand', 'Australia', 'South Africa', 'Brazil', 'option_b'),

-- Question 9
('What is the square root of 64?', '6', '7', '8', '9', 'option_c'),

-- Question 10
('Who wrote "Romeo and Juliet"?', 'Charles Dickens', 'William Shakespeare', 'Jane Austen', 'Mark Twain', 'option_b'),

-- Question 11
('What is the smallest prime number?', '0', '1', '2', '3', 'option_c'),

-- Question 12
('Which gas makes up most of Earth''s atmosphere?', 'Oxygen', 'Carbon Dioxide', 'Nitrogen', 'Hydrogen', 'option_c'),

-- Question 13
('In what year was the iPhone first released?', '2006', '2007', '2008', '2009', 'option_b'),

-- Question 14
('What is the currency of Japan?', 'Yuan', 'Won', 'Yen', 'Ringgit', 'option_c'),

-- Question 15
('Which mountain range contains Mount Everest?', 'Andes', 'Rockies', 'Alps', 'Himalayas', 'option_d'),

-- Question 16
('What does "WWW" stand for?', 'World Wide Web', 'World Wide Wait', 'World Wide Wiki', 'World Wide Wire', 'option_a'),

-- Question 17
('How many sides does a hexagon have?', '5', '6', '7', '8', 'option_b'),

-- Question 18
('Which vitamin is produced when skin is exposed to sunlight?', 'Vitamin A', 'Vitamin B', 'Vitamin C', 'Vitamin D', 'option_d'),

-- Question 19
('What is the hardest natural substance on Earth?', 'Gold', 'Iron', 'Diamond', 'Platinum', 'option_c'),

-- Question 20
('Which programming language is known for its use in web development and has a coffee-related name?', 'Python', 'Java', 'C++', 'Ruby', 'option_b');

-- Verify the data was inserted correctly
SELECT 'Registered Teams Count:', COUNT(*) FROM registered_teams;
SELECT 'Questions Count:', COUNT(*) FROM questions;
SELECT 'Quiz State:', * FROM quiz_state;