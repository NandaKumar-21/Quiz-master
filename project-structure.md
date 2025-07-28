# Quiz Master - Complete Project Structure

```
quiz-master/
├── public/                     # Frontend static files
│   ├── index.html             # Landing page
│   ├── host.html              # Host dashboard
│   ├── participant.html       # Participant interface
│   ├── styles.css             # Custom styles + Tailwind
│   └── main.js                # Frontend JavaScript
├── netlify/
│   └── functions/             # Serverless API endpoints
│       ├── db.js              # Database connection helper
│       ├── host.js            # Host API endpoints
│       ├── participant.js     # Participant API endpoints
│       └── common.js          # Shared utilities
├── database/
│   ├── schema.sql             # Database schema
│   └── sample-data.sql        # Sample questions and teams
├── netlify.toml               # Netlify configuration
├── package.json               # Dependencies and scripts
├── .gitignore                 # Git ignore rules
└── README.md                  # Setup and deployment guide
```

## Key Features
- Modern responsive UI with Tailwind CSS
- Serverless backend with Netlify Functions
- PostgreSQL database (Netlify DB or Supabase)
- Real-time polling for live updates
- CSV export functionality
- Mobile-first design
- Team ID validation system